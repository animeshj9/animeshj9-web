import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStripeSummary, summarizeCharges, readOverview } from '../worker/overview.mjs';
import { handle } from '../worker/index.mjs';
const now = Date.UTC(2026, 9, 1, 8);
const charge = (changes = {}) => ({ id: 'ch_fixture', created: now / 1000 - 60, paid: true, captured: true, status: 'succeeded', livemode: true, currency: 'usd', amount_captured: 500, amount_refunded: 100, ...changes });
const request = (host, path, method = 'GET') => new Request(`https://${host}${path}`, { method });
const assets = { ASSETS: { fetch: async () => new Response('ok') } };
const success = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
test('private overview rejects requests before any source is touched', async () => {
  const env = { ASSETS: { fetch() { throw Error('must not read'); } }, get STRIPE_SECRET_KEY() { throw Error('must not read'); } };
  for (const path of ['/api/overview', '/dashboard.mjs']) assert.equal((await handle(request('animeshj9.com', path), env)).status, 403);
});
test('public lab blocks dashboard and private API, including encoded names', async () => {
  const env = { ASSETS: { fetch() { throw Error('must not read'); } } };
  for (const path of ['/dashboard', '/dashboard/', '/dashboard/index.html', '/dashboard/dashboard.mjs', '/%64ashboard/index.html', '/api/overview', '/%61pi/overview']) assert.equal((await handle(request('lab.animeshj9.com', path), env)).status, 404, path);
  for (const path of ['//dashboard/index.html', '/%2fdashboard/index.html', '/%2564ashboard/index.html', '/%']) assert.equal((await handle(request('lab.animeshj9.com', path), env)).status, 400, path);
  assert.equal((await handle(request('api.animeshj9.com', '/api/overview'), env)).status, 404);
});
test('authorized overview is private/no-store and returns null for missing metrics', async () => {
  const result = await handle(request('animeshj9.com', '/api/overview'), assets, async () => true);
  assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal(result.headers.get('access-control-allow-origin'), null); assert.equal(result.headers.get('x-robots-tag'), 'noindex, nofollow');
  const data = await result.json(); assert.equal(data.sources.traffic.pageviews, null); assert.equal(data.sources.stripe.totals, null); assert.equal(data.sources.substack.subscribers, null); assert.equal(data.sources.x.impressions, null); assert.ok(data.sites.every(site => site.visits === null));
});
test('overview HEAD does not retrieve any assets or financial data', async () => {
  const env = { ASSETS: { fetch() { throw Error('must not read'); } }, get STRIPE_SECRET_KEY() { throw Error('must not read'); } };
  const res = await handle(request('animeshj9.com', '/api/overview', 'HEAD'), env, async () => true); assert.equal(res.status, 200); assert.equal(await res.text(), '');
});
test('health endpoint is public and exposes no configuration or financial data', async () => {
  const result = await handle(request('api.animeshj9.com', '/health'), {});
  assert.deepEqual(await result.json(), { service: 'animeshj9-api', status: 'ok' });
  assert.equal((await handle(request('api.animeshj9.com', '/health', 'HEAD'), {})).status, 200);
  assert.equal((await handle(request('api.animeshj9.com', '/health', 'POST'), {})).status, 404);
});
test('Stripe missing connection is unknown, never zero and makes no request', async () => {
  const result = await readStripeSummary({}, { now, fetchImpl() { throw Error('must not fetch'); } }); assert.equal(result.status, 'not_connected'); assert.equal(result.totals, null);
});
test('Stripe uses existing secret server-side, bounds time and strips private fields', async () => {
  let calls = 0;
  const result = await readStripeSummary({ STRIPE_SECRET_KEY: 'fixture-only' }, { now, fetchImpl: async (url, options) => {
    calls++; const parsed = new URL(url); assert.equal(parsed.origin, 'https://api.stripe.com'); assert.equal(parsed.pathname, '/v1/charges'); assert.equal(parsed.searchParams.get('created[lte]'), String(now / 1000)); assert.equal(options.headers.Authorization, 'Bearer fixture-only');
    return success({ data: [charge({ billing_details: { email: 'private@example.invalid' }, customer: 'cus_private' })], has_more: false });
  }});
  assert.equal(calls, 1); assert.equal(result.status, 'connected'); assert.equal(result.mode, 'live'); assert.deepEqual(result.totals, [{ currency: 'usd', payments: 1, capturedMinor: 500, refundedMinor: 100, retainedMinor: 400 }]);
  assert.doesNotMatch(JSON.stringify(result), /fixture-only|ch_fixture|private@example|cus_private|billing_details/);
});
test('Stripe empty response is a real zero with explicitly unverified mode', async () => {
  const result = await readStripeSummary({ STRIPE_SECRET_KEY: 'fixture-only' }, { now, fetchImpl: async () => success({ data: [], has_more: false }) }); assert.equal(result.status, 'connected'); assert.deepEqual(result.totals, []); assert.equal(result.mode, 'unverified');
});
test('Stripe test data and pagination remain clearly labeled', async () => {
  let page = 0;
  const result = await readStripeSummary({ STRIPE_SECRET_KEY: 'fixture-only' }, { now, fetchImpl: async url => { page++; if (page > 1) assert.equal(new URL(url).searchParams.get('starting_after'), `ch_${page - 1}`); return success({ data: [charge({ id: `ch_${page}`, livemode: false })], has_more: true }); } });
  assert.equal(page, 3); assert.equal(result.status, 'partial'); assert.equal(result.mode, 'test'); assert.equal(result.totals[0].payments, 3);
});
test('Stripe unavailable, invalid and repeated pages never become fake zero totals', async () => {
  const cases = [async () => new Response('sensitive provider text', { status: 403 }), async () => { throw Error('secret'); }, async () => success({ data: [], has_more: true }), async () => success({ data: [charge({ amount_captured: NaN })], has_more: false }), async () => success({ data: [charge(), charge()], has_more: false }), async () => success({ data: [charge({ created: 1 })], has_more: false }), async () => success({ data: [{ id: 'bad_shape', created: now / 1000, livemode: true }], has_more: false })];
  for (const fetchImpl of cases) { const result = await readStripeSummary({ STRIPE_SECRET_KEY: 'fixture-only' }, { now, fetchImpl }); assert.equal(result.status, 'unavailable'); assert.equal(result.totals, null); assert.doesNotMatch(JSON.stringify(result), /secret|sensitive provider text/); }
});
test('charge aggregation separates currencies and excludes unsuccessful/uncaptured attempts', () => {
  const result = summarizeCharges([charge(), charge({ currency: 'jpy', amount_captured: 1200, amount_refunded: 0 }), charge({ paid: false }), charge({ captured: false }), charge({ status: 'failed' })]); assert.equal(result.length, 2); assert.deepEqual(result.map(row => row.currency), ['jpy', 'usd']); assert.equal(result[0].capturedMinor, 1200); assert.equal(result[1].payments, 1);
  assert.throws(() => summarizeCharges([charge({ amount_refunded: 1000 })]));
});
test('overview differentiates external sites, present assets and missing builds', async () => {
  const env = { ASSETS: { fetch: async req => new Response(null, { status: new URL(req.url).pathname.includes('after-the-demo') ? 404 : 200 }) } };
  const data = await readOverview(env, { now }); assert.equal(data.sites.find(site => site.id === 'profile').state, 'external'); assert.equal(data.sites.find(site => site.id === 'after-the-demo').state, 'asset_missing'); assert.equal(data.sites.find(site => site.id === 'lab').state, 'asset_ready');
});


test('Stripe charge formatting honors processor units rather than ISO digits alone', async () => {
  const { stripeMajorAmount, formatStripeAmount } = await import('../dist/dashboard/money.mjs');
  for (const currency of ['isk', 'ugx', 'huf', 'twd', 'usd', 'inr']) assert.equal(stripeMajorAmount(500, currency), 5, currency);
  for (const currency of ['mga', 'jpy', 'krw', 'vnd', 'xaf']) assert.equal(stripeMajorAmount(500, currency), 500, currency);
  assert.equal(formatStripeAmount(500, 'isk', 'en-US'), 'ISK\u00a05');
  assert.throws(() => stripeMajorAmount(NaN, 'usd'));
});


test('After the Demo has a canonical slash route and no outgoing connection policy', async () => {
  const redirect = await handle(request('lab.animeshj9.com', '/after-the-demo?q=1'), assets);
  assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), 'https://lab.animeshj9.com/after-the-demo/?q=1');
  const response = await handle(request('lab.animeshj9.com', '/after-the-demo/'), assets);
  assert.match(response.headers.get('content-security-policy'), /connect-src 'none'/);
});
