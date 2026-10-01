import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStripeBilling, summarizeSubscriptions, summarizePayouts, observedMode } from '../worker/billing.mjs';
import { readOverview } from '../worker/overview.mjs';
const now = Date.UTC(2026, 9, 1, 10);
const subscription = (changes = {}) => ({ id: 'sub_fixture1', object: 'subscription', livemode: true, currency: 'usd', status: 'active', cancel_at_period_end: false, pause_collection: null, customer: 'cus_private', items: { has_more: false, data: [{ quantity: 2, price: { currency: 'usd', billing_scheme: 'per_unit', unit_amount: 1200, recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' }, transform_quantity: null } }] }, ...changes });
const payout = (changes = {}) => ({ id: 'po_fixture1', object: 'payout', livemode: true, status: 'paid', amount: 5100, currency: 'usd', created: now / 1000 - 86400 * 100, arrival_date: now / 1000 - 86400, destination: 'ba_private', ...changes });
const list = (data = [], has_more = false) => ({ object: 'list', data, has_more });
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
function fixtureFetch({ active = [subscription()], trialing = [], payouts = [payout()], account = { object: 'account', id: 'acct_fixture9', email: 'private@example.invalid', external_accounts: { data: [{ id: 'ba_private' }] } }, inspect } = {}) {
  return async (url, options) => {
    const parsed = new URL(url); inspect?.(parsed, options);
    if (parsed.pathname === '/v1/account') return json(account);
    if (parsed.pathname === '/v1/subscriptions') return json(list(parsed.searchParams.get('status') === 'active' ? active : trialing));
    if (parsed.pathname === '/v1/payouts') return json(list(payouts));
    if (parsed.pathname === '/v1/charges') return json(list());
    throw Error('Unapproved endpoint');
  };
}
test('billing without an existing key stays unknown and makes no requests', async () => {
  const result = await readStripeBilling({}, { now, fetchImpl() { throw Error('must not fetch'); } });
  assert.equal(result.account.accountId, null); assert.equal(result.subscriptions.activeCount, null); assert.equal(result.payouts.totals, null); assert.equal(result.mode, 'unverified');
});
test('runtime identity and aggregate billing are read-only and reveal no raw account/customer/bank details', async () => {
  const calls = [];
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ inspect: (url, options) => { calls.push(url); assert.equal(options.method, 'GET'); assert.equal(options.headers.Authorization, 'Bearer fixture-key'); assert.equal(url.origin, 'https://api.stripe.com'); } }) });
  assert.equal(calls.length, 4); assert.equal(result.account.accountId, 'acct_fixture9'); assert.equal(result.mode, 'live');
  assert.equal(result.subscriptions.activeCount, 1); assert.equal(result.subscriptions.trialingCount, 0); assert.equal(result.subscriptions.status, 'connected');
  assert.deepEqual(result.subscriptions.recurringTotals, [{ currency: 'usd', interval: 'year', intervalCount: 1, listPriceMinor: 2400, items: 1 }]);
  assert.deepEqual(result.payouts.totals, [{ currency: 'usd', payouts: 1, amountMinor: 5100 }]);
  assert.doesNotMatch(JSON.stringify(result), /fixture-key|private@example|cus_private|ba_private|sub_fixture|po_fixture|external_accounts/);
});
test('payout arrival cohort includes payouts created before the window and does not filter creation time', async () => {
  let query;
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ inspect: url => { if (url.pathname === '/v1/payouts') query = url.searchParams; } }) });
  assert.equal(query.get('status'), 'paid'); assert.equal(query.get('arrival_date[gte]'), String(now / 1000 - 30 * 86400)); assert.equal(query.get('arrival_date[lte]'), String(now / 1000)); assert.ok(![...query.keys()].some(key => key.startsWith('created')));
  assert.equal(result.payouts.count, 1); assert.match(result.payouts.message, /bank receipt not verified/);
});
test('active and trialing subscription counts are distinct and trials do not enter recurring amounts', async () => {
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ trialing: [subscription({ id: 'sub_trial', status: 'trialing' })] }) });
  assert.equal(result.subscriptions.activeCount, 1); assert.equal(result.subscriptions.trialingCount, 1); assert.equal(result.subscriptions.recurringTotals[0].listPriceMinor, 2400);
});
test('recurring totals preserve currencies, intervals and quantities without fabricated MRR', () => {
  const euro = subscription({ id: 'sub_eur', currency: 'eur', items: { has_more: false, data: [{ quantity: 3, price: { currency: 'eur', billing_scheme: 'per_unit', unit_amount: 700, recurring: { interval: 'month', interval_count: 2, usage_type: 'licensed' } } }] } });
  const result = summarizeSubscriptions([subscription(), euro]); assert.equal(result.recurringTotals.length, 2); assert.deepEqual(result.recurringTotals[0], { currency: 'eur', interval: 'month', intervalCount: 2, listPriceMinor: 2100, items: 1 }); assert.equal(result.recurringTotals[1].listPriceMinor, 2400); assert.ok(!Object.hasOwn(result, 'mrr'));
});
test('variable, transformed and incomplete items are reported instead of estimated', () => {
  const sub = subscription(); const fixed = sub.items.data[0];
  sub.items = { has_more: true, data: [fixed, { ...fixed, price: { ...fixed.price, billing_scheme: 'tiered' } }, { ...fixed, price: { ...fixed.price, recurring: { ...fixed.price.recurring, usage_type: 'metered' } } }, { ...fixed, price: { ...fixed.price, unit_amount: null } }, { ...fixed, price: { ...fixed.price, transform_quantity: { divide_by: 5 } } }] };
  const result = summarizeSubscriptions([sub]); assert.equal(result.unsupportedItems, 4); assert.equal(result.incompleteItemLists, 1); assert.equal(result.listPriceComplete, false); assert.equal(result.recurringTotals[0].listPriceMinor, 2400);
});
test('paused collection and scheduled cancellation remain explicit', () => {
  const result = summarizeSubscriptions([subscription({ cancel_at_period_end: true }), subscription({ id: 'sub_paused', pause_collection: { behavior: 'void' } })]);
  assert.equal(result.activeCount, 2); assert.equal(result.scheduledCancellationCount, 1); assert.equal(result.pausedCollectionCount, 1); assert.equal(result.recurringTotals[0].listPriceMinor, 2400); assert.equal(result.listPriceComplete, false);
});
test('partial pagination is bounded and never claims complete active or payout totals', async () => {
  const seen = {};
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: async url => {
    const u = new URL(url); const key = `${u.pathname}:${u.searchParams.get('status')}`; const page = (seen[key] || 0) + 1; seen[key] = page;
    if (u.pathname === '/v1/account') return json({ object: 'account', id: 'acct_fixture9' });
    if (u.searchParams.get('status') === 'trialing') return json(list());
    const prefix = u.pathname === '/v1/payouts' ? 'po' : 'sub'; if (page > 1) assert.equal(u.searchParams.get('starting_after'), `${prefix}_page${page - 1}`);
    return json(list([prefix === 'po' ? payout({ id: `${prefix}_page${page}` }) : subscription({ id: `${prefix}_page${page}` })], true));
  } });
  assert.equal(result.subscriptions.activeCount, 3); assert.equal(result.subscriptions.activeCountComplete, false); assert.equal(result.subscriptions.status, 'partial'); assert.equal(result.payouts.count, 3); assert.equal(result.payouts.status, 'partial'); assert.equal(result.payouts.complete, false); assert.ok(Object.values(seen).every(count => count <= 3));
});
test('account read failure does not invent identity or hide independently available billing', async () => {
  const normal = fixtureFetch(); const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: (url, options) => new URL(url).pathname === '/v1/account' ? new Response('sensitive error', { status: 403 }) : normal(url, options) });
  assert.equal(result.account.status, 'unavailable'); assert.equal(result.account.accountId, null); assert.equal(result.subscriptions.activeCount, 1); assert.equal(result.mode, 'live'); assert.doesNotMatch(JSON.stringify(result), /sensitive error/);
});
test('subscription permission failure stays null while accessible payout result remains usable', async () => {
  const normal = fixtureFetch(); const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: (url, options) => new URL(url).pathname === '/v1/subscriptions' ? new Response('no access', { status: 403 }) : normal(url, options) });
  assert.equal(result.subscriptions.status, 'unavailable'); assert.equal(result.subscriptions.activeCount, null); assert.equal(result.subscriptions.trialingCount, null); assert.equal(result.subscriptions.recurringTotals, null); assert.equal(result.payouts.count, 1);
});
test('empty lists verify zero counts but cannot prove live mode', async () => {
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ active: [], trialing: [], payouts: [] }) });
  assert.equal(result.subscriptions.activeCount, 0); assert.equal(result.subscriptions.trialingCount, 0); assert.equal(result.payouts.count, 0); assert.equal(result.mode, 'unverified');
});
test('mode evidence is obtained from returned objects and conflicts remain visible', async () => {
  assert.equal(observedMode(['live', 'unverified']), 'live'); assert.equal(observedMode(['test', 'live']), 'mixed');
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ active: [subscription({ livemode: false })], payouts: [] }) }); assert.equal(result.mode, 'test');
});
test('malformed payout windows/status/amounts fail closed, not zero', async () => {
  for (const changes of [{ status: 'pending' }, { arrival_date: now / 1000 - 86400 * 100 }, { amount: '5100' }, { currency: 'bad!' }, { livemode: null }]) {
    const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ payouts: [payout(changes)] }) }); assert.equal(result.payouts.status, 'unavailable'); assert.equal(result.payouts.totals, null);
  }
});
test('signed payout/reversal amounts are kept separate by currency', () => {
  const result = summarizePayouts([payout(), payout({ amount: -1100 }), payout({ currency: 'eur', amount: 500 })]); assert.deepEqual(result, [{ currency: 'eur', payouts: 1, amountMinor: 500 }, { currency: 'usd', payouts: 2, amountMinor: 4000 }]);
});
test('integrated owner overview exposes runtime aggregates but no customer/bank/private source values', async () => {
  const result = await readOverview({ STRIPE_SECRET_KEY: 'fixture-key', ASSETS: { fetch: async () => new Response() } }, { now, fetchImpl: fixtureFetch() });
  assert.equal(result.sources.stripe.connectionMode, 'live'); assert.equal(result.sources.stripe.billing.account.accountId, 'acct_fixture9'); assert.equal(result.sources.stripe.totals.length, 0);
  assert.match(result.sources.substack.message, /audience/); assert.match(result.sources.substack.message, /Stripe billing/); assert.doesNotMatch(JSON.stringify(result), /fixture-key|private@example|cus_private|ba_private/);
});


test('explicit cancellation timestamps are counted without double-counting period-end cancellation', () => {
  const result = summarizeSubscriptions([subscription({ cancel_at: now / 1000 + 86400 }), subscription({ cancel_at: now / 1000 + 86400, cancel_at_period_end: true })]); assert.equal(result.scheduledCancellationCount, 2);
});
test('empty/malformed active item lists do not become complete zero-price schedules', () => {
  assert.throws(() => summarizeSubscriptions([subscription({ items: { data: [], has_more: false } })]));
});
test('mixed modes within a resource or across billing resources withhold all financial aggregates', async () => {
  for (const setup of [{ active: [subscription(), subscription({ id: 'sub_test', livemode: false })] }, { payouts: [payout(), payout({ id: 'po_test', livemode: false })] }, { active: [subscription({ livemode: false })] }]) {
    const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch(setup) });
    assert.equal(result.mode, 'mixed'); assert.equal(result.subscriptions.activeCount, null); assert.equal(result.subscriptions.recurringTotals, null); assert.equal(result.payouts.count, null); assert.equal(result.payouts.totals, null);
  }
});


test('price-default currency mismatch is excluded, not substituted for subscription currency', () => {
  const result = summarizeSubscriptions([subscription({ currency: 'eur' })]); assert.equal(result.currencyMismatchItems, 1); assert.equal(result.unsupportedItems, 1); assert.equal(result.listPriceComplete, false); assert.deepEqual(result.recurringTotals, []);
  assert.throws(() => summarizeSubscriptions([subscription({ currency: undefined })]));
});
test('tax-inclusive catalog amount is preserved without claiming to exclude tax', async () => {
  const sub = subscription(); sub.items.data[0].price.tax_behavior = 'inclusive';
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: fixtureFetch({ active: [sub] }) }); assert.equal(result.subscriptions.recurringTotals[0].listPriceMinor, 2400); assert.match(result.subscriptions.scope, /tax-inclusive prices remain inclusive/); assert.doesNotMatch(result.subscriptions.scope, /Before .*taxes/);
});
test('integrated charge/billing mode conflicts withhold both types of financial totals', async () => {
  const normal = fixtureFetch(); const fetchImpl = (url, options) => new URL(url).pathname === '/v1/charges' ? json(list([{ id: 'ch_test', created: now / 1000, paid: true, captured: true, status: 'succeeded', livemode: false, currency: 'usd', amount_captured: 500, amount_refunded: 0 }])) : normal(url, options);
  const result = await readOverview({ STRIPE_SECRET_KEY: 'fixture-key', ASSETS: { fetch: async () => new Response() } }, { now, fetchImpl }); assert.equal(result.sources.stripe.connectionMode, 'mixed'); assert.equal(result.sources.stripe.totals, null); assert.equal(result.sources.stripe.billing.subscriptions.activeCount, null); assert.equal(result.sources.stripe.billing.payouts.totals, null);
});


test('safe diagnostics distinguish HTTP access failure from malformed data without raw provider text', async () => {
  const result = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: async () => new Response('private provider error secret', { status: 403 }) });
  assert.equal(result.account.reason, 'provider_http_403'); assert.equal(result.subscriptions.activeReason, 'provider_http_403'); assert.equal(result.subscriptions.trialingReason, 'provider_http_403'); assert.equal(result.payouts.reason, 'provider_http_403'); assert.doesNotMatch(JSON.stringify(result), /private provider error|secret|fixture-key/);
  const malformed = await readStripeBilling({ STRIPE_SECRET_KEY: 'fixture-key' }, { now, fetchImpl: async () => json({ bad: 'private' }) }); assert.equal(malformed.account.reason, 'unsupported_response'); assert.equal(malformed.payouts.reason, 'unsupported_response');
});
