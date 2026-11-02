import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDeployments, compareDeployment } from '../worker/deployments.mjs';
import { handle } from '../worker/index.mjs';
const head = 'a'.repeat(40), old = 'b'.repeat(40), version = '123e4567-e89b-12d3-a456-426614174000';
const now = Date.UTC(2026, 10, 2);
const response = data => new Response(JSON.stringify(data));
const env = { OPS_PUBLIC_GITHUB: 'enabled', OPS_CLOUDFLARE_ACCOUNT_ID: 'c'.repeat(32), OPS_CLOUDFLARE_TOKEN: 'fixture-secret' };
function fixture(changes = {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    const path = new URL(url).pathname;
    if (url.startsWith('https://api.github.com/')) {
      assert.equal(options.headers.Authorization, undefined, 'No Cloudflare or Stripe secret sent to GitHub');
      if (path.endsWith('/commits/main')) return response({ sha: head, commit: { committer: { date: new Date(now).toISOString() } } });
      return response({ total_count: 1, workflow_runs: [{ workflow_id: 1, name: 'Checks', head_sha: head, head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', ...changes.run }] });
    }
    assert.equal(options.headers.Authorization, 'Bearer fixture-secret');
    let result;
    const metadata = { commit_hash: head, branch: 'main', build_trigger_source: 'push_event' };
    if (path.endsWith('/deployments')) result = { deployments: [{ versions: [{ version_id: version, percentage: 100 }] }] };
    else if (path.endsWith('/triggers')) result = [{ branch_includes: ['main'], path_includes: ['*'], build_token_uuid: 'do-not-return', repo_connection: { private: 'do-not-return' } }];
    else if (path.endsWith('/builds/builds')) result = { builds: { [version]: { build_trigger_metadata: { ...metadata, repo_name: changes.mappingRepo || 'beat', provider_account_name: 'animeshj9' } } } };
    else result = [{ build_uuid: 'build-fixture', status: 'stopped', build_outcome: 'success', build_trigger_metadata: metadata }];
    if (changes.override) result = changes.override(path, result);
    return response({ success: true, result });
  };
}
test('missing integration is timestamped unknown and makes no network requests', async () => {
  const data = await readDeployments({}, { now, fetchImpl() { throw Error('must not fetch'); } });
  assert.equal(data.checkedAt, new Date(now).toISOString()); assert.equal(data.rows.length, 4);
  assert.ok(data.rows.every(row => row.comparison.status === 'unknown'));
  assert.equal(data.rows[1].active.status, 'not_connected');
  assert.equal(data.rows[2].builds.status, 'not_applicable');
});
test('public GitHub data works without credentials; CI success never implies Beat is deployed', async () => {
  const data = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled' }, { now, fetchImpl: fixture() });
  const beat = data.rows[1]; assert.equal(beat.github.head, head); assert.equal(beat.github.ci, 'success'); assert.equal(beat.comparison.status, 'unknown'); assert.match(beat.comparison.message, /CI passed.*unverified/);
});
test('serving Worker version compares its bundled commit, without claiming all traffic', async () => {
  const data = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled', OPS_VERSION: { id: version }, ASSETS: { fetch: async req => { assert.equal(new URL(req.url).pathname, '/dashboard/release.json'); return response({ commit: old, clean: true }); } } }, { now, fetchImpl: fixture() });
  assert.equal(data.rows[0].active.versions[0].percentage, null); assert.equal(data.rows[0].comparison.status, 'outdated');
  assert.equal(data.rows[1].active.status, 'not_connected');
});
test('Cloudflare active version joins commit records and strips credentials and private metadata', async () => {
  const data = await readDeployments(env, { now, fetchImpl: fixture() });
  assert.equal(data.rows[1].comparison.status, 'current'); assert.equal(data.rows[0].comparison.status, 'unknown', 'wrong repository mapping is withheld');
  assert.equal(data.rows[1].builds.items[0].trigger, 'push_event');
  assert.doesNotMatch(JSON.stringify(data), /fixture-secret|do-not-return|build_token|environment_variables/);
});
test('green CI and absent current build explicitly identify the gap', async () => {
  const data = await readDeployments(env, { now, fetchImpl: fixture({ override(path, result) { if (path.includes('/builds/workers/') && path.endsWith('/builds')) return []; if (path.endsWith('/builds/builds')) return { builds: {} }; return result; } }) });
  assert.equal(data.rows[1].comparison.status, 'missing_build'); assert.match(data.rows[1].comparison.message, /CI passed.*latest 20/);
});
test('comparison distinguishes failed and pending builds, stale and mixed deployments', () => {
  const row = { github: { head, ci: 'success' }, active: { status: 'not_connected' }, builds: { status: 'connected', items: [{ commit: head, branch: 'main', status: 'stopped', outcome: 'fail' }] } };
  assert.equal(compareDeployment(row).status, 'build_failed');
  row.builds.items[0].status = 'running'; assert.equal(compareDeployment(row).status, 'pending');
  row.active = { status: 'connected', commits: [head, old] }; assert.equal(compareDeployment(row).status, 'outdated');
  row.active.commits = [head, null]; row.builds.status = 'unavailable'; assert.equal(compareDeployment(row).status, 'unknown');
  row.active.commits = [head]; assert.equal(compareDeployment(row).status, 'current');
});
test('CI separates pending/failure/skipped/partial and ignores PRs or stale SHAs', async () => {
  for (const [run, expected] of [[{ status: 'in_progress', conclusion: null }, 'pending'], [{ conclusion: 'failure' }, 'not_successful'], [{ conclusion: 'skipped' }, 'not_successful'], [{ event: 'pull_request' }, 'not_found'], [{ head_sha: old }, 'not_found']]) {
    const data = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled' }, { now, fetchImpl: fixture({ run }) }); assert.equal(data.rows[0].github.ci, expected);
  }
});
test('403 rate limits, denied reads, malformed responses and timeout remain unknown', async () => {
  const cases = [async () => new Response('private provider error', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }), async () => new Response('secret', { status: 401 }), async () => response({ sha: 'bad' }), async (url, { signal }) => new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(Error('timeout')), { once: true }); })];
  for (const fetchImpl of cases) {
    const data = await readDeployments(env, { now, fetchImpl, timeoutMs: 10 }); assert.ok(data.rows.every(row => row.comparison.status === 'unknown')); assert.doesNotMatch(JSON.stringify(data), /private provider error|fixture-secret/);
  }
});
test('CI failure leaves independently fetched main commit visible', async () => {
  const data = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled' }, { now, fetchImpl: async (url, options) => url.includes('/actions/') ? new Response('', { status: 403 }) : fixture()(url, options) });
  assert.equal(data.rows[0].github.head, head); assert.equal(data.rows[0].github.ci, 'unavailable');
});
test('owner authorization, HEAD and public routes cannot initiate operational reads', async () => {
  const guarded = { get OPS_PUBLIC_GITHUB() { throw Error('must not read'); }, get OPS_CLOUDFLARE_TOKEN() { throw Error('must not read'); } };
  assert.equal((await handle(new Request('https://animeshj9.com/api/overview'), guarded)).status, 403);
  assert.equal((await handle(new Request('https://animeshj9.com/api/overview', { method: 'HEAD' }), guarded, async () => true)).status, 200);
  for (const path of ['/api/overview', '/dashboard/release.json', '/%64ashboard/release.json']) assert.equal((await handle(new Request(`https://lab.animeshj9.com${path}`), guarded)).status, 404);
  assert.equal((await handle(new Request('https://animeshj9.com/release.json'), guarded, async () => true)).status, 404);
});
test('dirty release metadata and unreadable assets never claim a deployed commit', async () => {
  for (const payload of [{ commit: head, clean: false }, { commit: 'invalid', clean: true }]) {
    const data = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled', OPS_VERSION: { id: version }, ASSETS: { fetch: async () => response(payload) } }, { now, fetchImpl: fixture() });
    assert.equal(data.rows[0].comparison.status, 'unknown'); assert.equal(data.rows[0].servingVersion, version);
  }
});
test('truncated CI history, missing build mapping and oversized API bodies fail conservatively', async () => {
  const data = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled' }, { now, fetchImpl: async (url, options) => {
    if (url.includes('/actions/')) return response({ total_count: 31, workflow_runs: [] });
    return fixture()(url, options);
  } });
  assert.equal(data.rows[0].github.ci, 'partial');
  const huge = await readDeployments({ OPS_PUBLIC_GITHUB: 'enabled' }, { now, fetchImpl: async () => new Response('x'.repeat(2 * 1024 * 1024 + 1)) });
  assert.equal(huge.rows[0].github.status, 'unavailable');
});
