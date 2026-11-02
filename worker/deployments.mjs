// Owner-only operational data. Never import into public browser code.
export const projects = [
  { repo: 'animeshj9-web', worker: 'animeshj9-lab-subdomains', tag: '41fef189c5a44a80bf048e66ba0eab23' },
  { repo: 'beat', worker: 'beat', tag: '81eeff8036ee433eac8f8c3608408641' },
  { repo: 'animeshja.in', worker: null },
  { repo: 'scaling-life', worker: null },
];
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const unavailable = (message, status = 'unavailable') => ({ status, message });
const safe = async operation => { try { return await operation(); } catch (error) { return unavailable(error.code === 429 ? 'API rate limited; retry later. Public GitHub reads use an unauthenticated quota.' : error.code === 401 || error.code === 403 ? 'API access denied; existing access cannot read this source.' : 'Source timed out or returned an unreadable response.'); } };
async function json(url, headers, signal, fetchImpl) {
  const response = await fetchImpl(url, { method: 'GET', headers, signal, redirect: 'error', cache: 'no-store' });
  if (!response.ok) { const error = Error(); error.code = response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0' ? 429 : response.status; throw error; }
  const reader = response.body?.getReader();
  if (!reader) throw Error();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw Error(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function buildSummary(build) {
  if (!build || !['queued', 'initializing', 'running', 'stopped'].includes(build.status) || ![null, undefined, 'success', 'fail', 'skipped', 'cancelled', 'terminated'].includes(build.build_outcome)) throw Error();
  const metadata = build.build_trigger_metadata || {};
  return { id: build.build_uuid, commit: sha(metadata.commit_hash), branch: metadata.branch === 'main' ? 'main' : 'other', trigger: ['push_event', 'manual', 'api', 'deploy_hook'].includes(metadata.build_trigger_source) ? metadata.build_trigger_source : 'other', status: build.status, outcome: build.build_outcome || null, createdAt: date(build.created_on) };
}
export function compareDeployment(row) {
  if (!row.github.head) return { status: 'unknown', message: 'Latest main commit is unavailable; deployment alignment is unknown.' };
  const head = row.github.head;
  const active = row.active;
  if (active.status === 'connected' && active.commits?.length && active.commits.every(commit => commit === head)) return { status: 'current', message: active.scope === 'response' ? 'The Worker serving this response matches main. Other traffic allocations and application health are not checked.' : 'Observed active deployment matches main. This is deployment evidence, not an application health check.' };
  if (active.status === 'connected' && active.commits?.some(commit => commit && commit !== head)) return { status: 'outdated', message: 'Active deployment differs from main. Check for a pending rollout, rollback or missed deployment.' };
  if (row.builds.status === 'connected') {
    const matching = row.builds.items.find(build => build.commit === head && build.branch === 'main');
    if (!matching) return { status: 'missing_build', message: `${row.github.ci === 'success' ? 'CI passed, but no' : 'No'} build for main was found in the latest 20 Cloudflare builds. This bounded history does not prove a build never started.` };
    if (matching.status !== 'stopped') return { status: 'pending', message: 'Cloudflare build for main is queued or running; production alignment is not yet verified.' };
    if (matching.outcome !== 'success') return { status: 'build_failed', message: 'Cloudflare build for main did not succeed; production alignment is not verified.' };
  }
  return { status: 'unknown', message: row.github.ci === 'success' ? 'CI passed; active production commit is unverified. Green CI alone does not confirm deployment.' : 'Active production commit is unverified.' };
}
async function github(project, enabled, signal, fetchImpl) {
  if (!enabled) return unavailable('Public GitHub reporting is not enabled.', 'not_connected');
  return safe(async () => {
    const base = `https://api.github.com/repos/animeshj9/${project.repo}`;
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'animeshj9-owner-overview', 'X-GitHub-Api-Version': '2022-11-28' };
    const commit = await json(`${base}/commits/main`, headers, signal, fetchImpl);
    if (!sha(commit.sha)) throw Error();
    const checks = await safe(async () => {
      const data = await json(`${base}/actions/runs?branch=main&head_sha=${commit.sha}&per_page=30`, headers, signal, fetchImpl);
      if (!Array.isArray(data.workflow_runs) || !Number.isInteger(data.total_count)) throw Error();
      const latest = new Map();
      for (const run of data.workflow_runs) {
        if (run.head_sha !== commit.sha || run.head_branch !== 'main' || !['push', 'workflow_dispatch'].includes(run.event)) continue;
        if (!latest.has(run.workflow_id)) latest.set(run.workflow_id, { name: String(run.name).slice(0,100), status: run.status, conclusion: run.conclusion, updatedAt: date(run.updated_at) });
      }
      const runs = [...latest.values()];
      const ci = data.total_count > 30 ? 'partial' : !runs.length ? 'not_found' : runs.some(run => run.status !== 'completed') ? 'pending' : runs.every(run => run.conclusion === 'success') ? 'success' : 'not_successful';
      return { status: 'connected', ci, runs };
    });
    return { status: 'connected', head: commit.sha, committedAt: date(commit.commit?.committer?.date), ci: checks.ci || 'unavailable', checks, message: 'Public GitHub main and latest push/manual workflow runs for that exact commit. PR runs excluded; at most 30 runs.' };
  });
}
async function cloudflare(project, env, signal, fetchImpl) {
  const missing = unavailable('No Cloudflare reporting connection in this Worker. Build history, trigger configuration and active production version require approved Workers CI Read and Workers Scripts Read access.', 'not_connected');
  if (!project.worker) return { builds: unavailable('This site is not hosted by a Cloudflare Worker.', 'not_applicable'), triggers: unavailable('No Cloudflare Worker mapping.', 'not_applicable'), active: unavailable('Active hosting revision is not connected. GitHub deployment workflow success is not proof of the currently served revision.', 'not_connected') };
  if (!env.OPS_CLOUDFLARE_TOKEN || !/^[a-f0-9]{32}$/.test(env.OPS_CLOUDFLARE_ACCOUNT_ID || '')) return { builds: { ...missing, message: 'Not connected — build history unavailable.' }, triggers: { ...missing, message: 'Not connected — automatic build trigger unverified.' }, active: { ...missing, message: 'Not connected — active version and commit unverified.' } };
  const get = async path => {
    const data = await json(`https://api.cloudflare.com/client/v4/accounts/${env.OPS_CLOUDFLARE_ACCOUNT_ID}${path}`, { Authorization: `Bearer ${env.OPS_CLOUDFLARE_TOKEN}` }, signal, fetchImpl);
    if (data.success !== true) throw Error();
    return data.result;
  };
  const [builds, triggers, active] = await Promise.all([
    safe(async () => { const result = await get(`/builds/workers/${project.tag}/builds?per_page=20`); if (!Array.isArray(result)) throw Error(); return { status: 'connected', items: result.map(buildSummary), message: 'Latest 20 builds; build success does not prove this version is active.' }; }),
    safe(async () => { const result = await get(`/builds/workers/${project.tag}/triggers`); if (!Array.isArray(result)) throw Error(); return { status: 'connected', items: result.filter(t => !t.deleted_on).map(t => ({ branches: t.branch_includes, excludedBranches: t.branch_excludes, paths: t.path_includes, excludedPaths: t.path_excludes })), message: 'Configured trigger filters; does not verify GitHub installation permissions or delivery of a push event.' }; }),
    safe(async () => {
      const result = await get(`/workers/scripts/${project.worker}/deployments?per_page=1`);
      if (!Array.isArray(result.deployments)) throw Error();
      const deployment = result.deployments[0];
      if (!deployment) return unavailable('No active deployment returned.');
      if (!Array.isArray(deployment.versions) || !deployment.versions.length || deployment.versions.length > 20) throw Error();
      const versions = deployment.versions.map(v => { if (!/^[a-f0-9-]{36}$/.test(v.version_id) || !Number.isFinite(v.percentage) || v.percentage <= 0) throw Error(); return { id: v.version_id, percentage: v.percentage }; });
      if (Math.abs(versions.reduce((sum,v)=>sum+v.percentage,0)-100) > 0.01) throw Error();
      const mapping = await safe(async () => get(`/builds/builds?version_ids=${versions.map(v=>v.id).join(',')}`));
      const commits = versions.map(version => {
        const build = mapping.builds?.[version.id];
        const meta = build?.build_trigger_metadata;
        return meta?.repo_name === project.repo && meta?.provider_account_name === 'animeshj9' && meta?.branch === 'main' ? sha(meta.commit_hash) : null;
      });
      return { status: 'connected', versions, commits, deployedAt: date(deployment.created_on), message: commits.every(Boolean) ? 'Active traffic allocation from Cloudflare, commits joined through version-to-build records.' : 'Active versions read; one or more version-to-commit mappings unavailable.' };
    }),
  ]);
  return { builds, triggers, active };
}
export async function readDeployments(env, { now = Date.now(), fetchImpl = fetch, timeoutMs = 7000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const rows = await Promise.all(projects.map(async project => {
      const [gh, cf] = await Promise.all([github(project, env.OPS_PUBLIC_GITHUB === 'enabled', controller.signal, fetchImpl), cloudflare(project, env, controller.signal, fetchImpl)]);
      // Version metadata describes the instance serving this response, not every rollout allocation.
      if (project.repo === 'animeshj9-web' && env.OPS_VERSION?.id) {
        cf.servingVersion = String(env.OPS_VERSION.id).slice(0,100);
        const release = await safe(async () => { const response = await env.ASSETS.fetch(new Request('https://assets.invalid/dashboard/release.json')); if (!response.ok) throw Error(); return response.json(); });
        if (release.clean === true && sha(release.commit) && cf.active.status !== 'connected') cf.active = { status: 'connected', scope: 'response', commits: [release.commit], versions: [{ id: cf.servingVersion, percentage: null }], message: 'This response’s Worker version and bundled release commit. Other rollout versions are not checked.' };
      }
      const row = { repo: project.repo, worker: project.worker, checkedAt: new Date(now).toISOString(), github: gh, ...cf };
      return { ...row, comparison: compareDeployment(row) };
    }));
    return { checkedAt: new Date(now).toISOString(), staleAfterMs: 300000, rows };
  } finally { clearTimeout(timer); }
}
