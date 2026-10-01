import { readStripeBilling, observedMode, withholdConflictingBilling } from './billing.mjs';
// Owner-only response data. Never import this module into public browser code.
export const inventory = [
  { id: 'profile', name: 'Personal site', url: 'https://animeshja.in/', kind: 'Identity', description: 'Profile, work and coffee support' },
  { id: 'writing', name: 'Scaling Life', url: 'https://scaling-life.com/', kind: 'Writing', description: 'Essays and notes' },
  { id: 'lab', name: 'Lab', url: 'https://lab.animeshj9.com/', kind: 'Directory', asset: '/index.html', description: 'The public experiment collection' },
  { id: 'after-the-demo', name: 'After the Demo', url: 'https://lab.animeshj9.com/after-the-demo/', kind: 'AI outcomes', asset: '/after-the-demo/index.html', description: 'Measure whether AI actually saved work' },
  { id: 'footpath-optional', name: 'Footpath Optional', url: 'https://footpath-optional.animeshj9.com/', kind: 'Cities', asset: '/footpath-optional/index.html', description: 'Pedestrian evidence and field notes' },
  { id: 'galli-club', name: 'Galli Club', url: 'https://galli-club.animeshj9.com/', kind: 'Stories', asset: '/galli-club/index.html', description: 'Hyderabad story-and-play adventures' },
  { id: 'feedproof', name: 'FeedProof', url: 'https://feedproof.animeshj9.com/', kind: 'Commerce', asset: '/feedproof/index.html', description: 'Local shopping-feed preflight' },
  { id: 'long-arc', name: 'Long Arc', url: 'https://long-arc.animeshj9.com/', kind: 'Decisions', asset: '/long-arc/index.html', description: 'Local-first thesis notebook' },
];

export function summarizeCharges(charges) {
  const currencies = new Map();
  for (const charge of charges) {
    if (typeof charge.paid !== 'boolean' || typeof charge.captured !== 'boolean' || !['succeeded', 'pending', 'failed'].includes(charge.status)) throw Error('Invalid payment classification');
    if (charge.paid !== true || charge.captured !== true || charge.status !== 'succeeded') continue;
    const amount = charge.amount_captured;
    const refunded = charge.amount_refunded;
    if (!/^[a-z]{3}$/.test(charge.currency || '') || !Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(refunded) || refunded < 0 || refunded > amount) throw Error('Invalid payment totals');
    const row = currencies.get(charge.currency) || { currency: charge.currency, payments: 0, capturedMinor: 0, refundedMinor: 0, retainedMinor: 0 };
    row.payments += 1;
    row.capturedMinor += amount;
    row.refundedMinor += refunded;
    row.retainedMinor += amount - refunded;
    if (![row.capturedMinor, row.refundedMinor, row.retainedMinor].every(Number.isSafeInteger)) throw Error('Payment total overflow');
    currencies.set(charge.currency, row);
  }
  return [...currencies.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function readStripeSummary(env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const from = Math.floor(now / 1000) - 30 * 86400;
  const to = Math.floor(now / 1000);
  const base = { id: 'stripe', name: 'Stripe', windowStart: new Date(from * 1000).toISOString(), windowEnd: new Date(to * 1000).toISOString(), totals: null };
  if (!env.STRIPE_SECRET_KEY) return { ...base, status: 'not_connected', message: 'No existing Stripe runtime connection is available.', nextStep: 'Review the existing Stripe backend connection before enabling reporting.' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    let cursor; let more = false; const charges = []; const seen = new Set();
    for (let page = 0; page < 3; page++) {
      const query = new URLSearchParams({ limit: '100', 'created[gte]': String(from), 'created[lte]': String(to) });
      if (cursor) query.set('starting_after', cursor);
      const response = await fetchImpl(`https://api.stripe.com/v1/charges?${query}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }, signal: controller.signal });
      if (!response.ok) return { ...base, status: 'unavailable', message: 'Stripe reporting could not be read with the existing connection.', nextStep: response.status === 401 || response.status === 403 ? 'The existing key may not permit payment reads. Review access separately; checkout settings were not changed.' : 'Retry later or inspect Stripe service status. Checkout settings were not changed.' };
      const data = await response.json();
      if (!Array.isArray(data.data) || typeof data.has_more !== 'boolean') throw Error('Invalid Stripe response');
      for (const charge of data.data) {
        if (typeof charge.id !== 'string' || seen.has(charge.id) || !Number.isInteger(charge.created) || charge.created < from || charge.created > to || typeof charge.livemode !== 'boolean') throw Error('Invalid Stripe page');
        seen.add(charge.id); charges.push(charge);
      }
      more = data.has_more;
      if (!more) break;
      cursor = data.data.at(-1)?.id;
      if (!cursor) throw Error('Missing pagination cursor');
    }
    const modes = new Set(charges.map(charge => charge.livemode));
    const mode = modes.size === 1 ? (modes.has(true) ? 'live' : 'test') : modes.size ? 'mixed' : 'unverified';
    if (mode === 'mixed') return { ...base, mode, status: 'unavailable', message: 'Live/test charge mode evidence conflicts. Amounts are withheld.', nextStep: 'Verify the existing runtime connection; no broader access was requested.' };
    return { ...base, status: more ? 'partial' : 'connected', mode, totals: summarizeCharges(charges), checkedAt: new Date(now).toISOString(), message: more ? 'Partial result: more than 300 charge records in this window. Totals below are incomplete.' : charges.length ? 'Successful captured payments from the last 30 days.' : 'No charge records returned for the last 30 days; account mode cannot be verified from an empty result.', scope: 'All payments in the connected Stripe account, not only coffee. Refunds are cumulative against these charges. Excludes Stripe fees, payouts, disputes and refunds on older charges. Currencies are never combined.' };
  } catch {
    return { ...base, status: 'unavailable', message: 'Stripe reporting timed out or returned an unreadable result.', nextStep: 'Refresh to retry. No zero total has been inferred.' };
  } finally { clearTimeout(timeout); }
}

export async function readOverview(env, options = {}) {
  const now = options.now ?? Date.now();
  const billingPromise = readStripeBilling(env, { ...options, now });
  const chargesPromise = readStripeSummary(env, { ...options, now });
  const sites = await Promise.all(inventory.map(async ({ asset, ...site }) => {
    if (!asset) return { ...site, state: 'external', visits: null };
    try {
      const response = await env.ASSETS.fetch(new Request(`https://assets.invalid${asset}`, { method: 'HEAD' }));
      return { ...site, state: response.ok ? 'asset_ready' : 'asset_missing', visits: null };
    } catch { return { ...site, state: 'asset_unavailable', visits: null }; }
  }));
  let [charges, billing] = await Promise.all([chargesPromise, billingPromise]);
  const connectionMode = observedMode([charges.mode, billing.mode]);
  if (connectionMode === 'mixed') { billing = withholdConflictingBilling(billing); charges = { ...charges, status: 'unavailable', totals: null, message: 'Live/test mode evidence conflicts. Financial counts and amounts are withheld.' }; }
  return {
    generatedAt: new Date(now).toISOString(),
    sites,
    api: { ownerOverview: 'responding', publicHealth: 'not_checked', healthPath: 'https://api.animeshj9.com/health', checkout: env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured' },
    sources: {
      traffic: { status: 'not_connected', pageviews: null, visitors: null, message: 'Visit reporting is not connected. Missing data does not mean zero visitors.', collection: 'A Cloudflare Insights beacon was observed on the live lab on 1 October 2026. Delivery and historical totals are unverified.', nextStep: 'Review Cloudflare Web Analytics for collection and hostname coverage, then authorize an appropriate read-only reporting connection. Edge requests and human visits must remain separate.' },
      stripe: { ...charges, billing, connectionMode, message: charges.status === 'connected' && Array.isArray(charges.totals) && charges.totals.length === 0 ? 'No captured payment totals in the last 30 days. Current subscriptions and paid payouts are reported separately below.' : charges.message },
      substack: { status: 'not_connected', subscribers: null, message: 'Substack audience totals, email opens and engagement are not connected. Stripe billing is reported separately when available.', nextStep: 'Connect an authorized publication reporting source or import an owner-provided aggregate export. Stripe subscriptions are not the full Substack audience, and billing is not attributed to a publication without verified source evidence.' },
      x: { status: 'not_connected', impressions: null, message: 'Post impressions and engagement reporting are not connected.', nextStep: 'Connect an authorized read-only X reporting source or import an aggregate export. No scraping or paid API subscription has been enabled.' },
    },
    upkeep: { cadence: 'Weekly, on Mondays', scope: 'Review live routes, API health, deployment checks, source freshness, privacy boundaries and one useful next improvement.', checks: ['After each release: tests, static checks, both deployment results and live smoke checks', 'Weekly: traffic/source health, broken links, private-route isolation and experiment backlog', 'Monthly: dependency review, storage/export checks and retire or improve low-use experiments'] },
  };
}
