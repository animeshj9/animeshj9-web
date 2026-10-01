// Read-only, owner-only Stripe billing. Raw objects never leave this module.
const MAX_PAGES = 3;
const CURRENCY = /^[a-z]{3}$/;
const ID = /^[a-z]+_[A-Za-z0-9_]+$/;
function checkedInteger(value, { negative = false } = {}) {
  if (!Number.isSafeInteger(value) || (!negative && value < 0)) throw Error('Invalid numeric field');
  return value;
}
export function observedMode(values) {
  const modes = new Set(values.filter(value => value === 'live' || value === 'test' || value === 'mixed'));
  return modes.has('mixed') || modes.size > 1 ? 'mixed' : [...modes][0] || 'unverified';
}
function objectMode(rows) { return observedMode(rows.map(row => row.livemode ? 'live' : 'test')); }
function unavailable(kind) {
  return { status: 'unavailable', mode: 'unverified', message: `${kind} could not be read with the existing connection. No scope or credential was changed.` };
}
async function stripeGet(path, params, context) {
  const query = new URLSearchParams(params);
  const response = await context.fetchImpl(`https://api.stripe.com/v1/${path}${query.size ? `?${query}` : ''}`, { method: 'GET', headers: { Authorization: `Bearer ${context.key}` }, signal: context.signal });
  if (!response.ok) throw Error('Stripe read unavailable');
  return response.json();
}
async function stripeList(path, params, context, validate) {
  const rows = []; const seen = new Set(); let cursor; let more = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await stripeGet(path, { ...params, limit: '100', ...(cursor ? { starting_after: cursor } : {}) }, context);
    if (data.object !== 'list' || !Array.isArray(data.data) || typeof data.has_more !== 'boolean') throw Error('Invalid list');
    for (const row of data.data) {
      if (!row || !ID.test(row.id || '') || seen.has(row.id) || typeof row.livemode !== 'boolean') throw Error('Invalid or repeated record');
      validate(row); seen.add(row.id); rows.push(row);
    }
    more = data.has_more;
    if (!more) break;
    cursor = data.data.at(-1)?.id;
    if (!cursor) throw Error('Invalid cursor');
  }
  return { rows, complete: !more, mode: objectMode(rows) };
}
export function summarizeSubscriptions(subscriptions) {
  const totals = new Map(); let unsupportedItems = 0; let currencyMismatchItems = 0; let incompleteItemLists = 0; let pausedCollectionCount = 0; let scheduledCancellationCount = 0;
  for (const subscription of subscriptions) {
    if (subscription.status !== 'active' || !CURRENCY.test(subscription.currency || '') || typeof subscription.cancel_at_period_end !== 'boolean' || !subscription.items || !Array.isArray(subscription.items.data) || typeof subscription.items.has_more !== 'boolean' || subscription.items.data.length === 0) throw Error('Invalid active subscription');
    if (subscription.cancel_at != null) checkedInteger(subscription.cancel_at);
    if (subscription.cancel_at_period_end || subscription.cancel_at != null) scheduledCancellationCount++;
    if (subscription.pause_collection != null) { pausedCollectionCount++; continue; }
    if (subscription.items.has_more) incompleteItemLists++;
    for (const item of subscription.items.data) {
      const price = item?.price;
      if (!price || !CURRENCY.test(price.currency || '') || !price.recurring || !['day', 'week', 'month', 'year'].includes(price.recurring.interval) || !Number.isSafeInteger(price.recurring.interval_count) || price.recurring.interval_count < 1) throw Error('Invalid recurring price');
      if (price.currency !== subscription.currency) { unsupportedItems++; currencyMismatchItems++; continue; }
      // A list-price subtotal is only meaningful for simple licensed per-unit prices.
      if (price.billing_scheme !== 'per_unit' || price.recurring.usage_type !== 'licensed' || price.transform_quantity != null || price.unit_amount == null) { unsupportedItems++; continue; }
      const amount = checkedInteger(price.unit_amount) * checkedInteger(item.quantity);
      checkedInteger(amount);
      const key = `${price.currency}:${price.recurring.interval}:${price.recurring.interval_count}`;
      const row = totals.get(key) || { currency: price.currency, interval: price.recurring.interval, intervalCount: price.recurring.interval_count, listPriceMinor: 0, items: 0 };
      row.listPriceMinor = checkedInteger(row.listPriceMinor + amount); row.items++; totals.set(key, row);
    }
  }
  return { activeCount: subscriptions.length, recurringTotals: [...totals.values()].sort((a, b) => `${a.currency}:${a.interval}:${a.intervalCount}`.localeCompare(`${b.currency}:${b.interval}:${b.intervalCount}`)), unsupportedItems, currencyMismatchItems, incompleteItemLists, pausedCollectionCount, scheduledCancellationCount, listPriceComplete: unsupportedItems === 0 && incompleteItemLists === 0 && pausedCollectionCount === 0 };
}
export function summarizePayouts(payouts) {
  const totals = new Map();
  for (const payout of payouts) {
    if (payout.status !== 'paid' || !CURRENCY.test(payout.currency || '')) throw Error('Invalid paid payout');
    const row = totals.get(payout.currency) || { currency: payout.currency, payouts: 0, amountMinor: 0 };
    row.payouts++; row.amountMinor = checkedInteger(row.amountMinor + checkedInteger(payout.amount, { negative: true }), { negative: true }); totals.set(payout.currency, row);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export function withholdConflictingBilling(billing) {
  const message = 'Live/test mode evidence conflicts. Counts and amounts are withheld until the runtime connection is verified.';
  return { ...billing, mode: 'mixed', subscriptions: { status: 'unavailable', mode: 'mixed', activeCount: null, trialingCount: null, recurringTotals: null, activeCountComplete: false, trialingCountComplete: false, listPriceComplete: false, message, scope: message }, payouts: { ...billing.payouts, status: 'unavailable', mode: 'mixed', count: null, totals: null, complete: false, message, scope: message } };
}

export async function readStripeBilling(env, { fetchImpl = fetch, now = Date.now() } = {}) {
  const from = Math.floor(now / 1000) - 30 * 86400; const to = Math.floor(now / 1000);
  const window = { windowStart: new Date(from * 1000).toISOString(), windowEnd: new Date(to * 1000).toISOString() };
  if (!env.STRIPE_SECRET_KEY) {
    const missing = { status: 'not_connected', mode: 'unverified', message: 'No existing Stripe runtime connection is available.' };
    return { account: { ...missing, accountId: null }, subscriptions: { ...missing, activeCount: null, trialingCount: null, recurringTotals: null }, payouts: { ...missing, ...window, count: null, totals: null }, mode: 'unverified' };
  }
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
  const context = { fetchImpl, key: env.STRIPE_SECRET_KEY, signal: controller.signal };
  try {
    const accountPromise = (async () => {
      try { const data = await stripeGet('account', {}, context); if (data.object !== 'account' || !/^acct_[A-Za-z0-9]+$/.test(data.id || '')) throw Error('Invalid account'); return { status: 'connected', accountId: data.id, message: 'Identity returned by the runtime connection. Only the account ID is displayed.' }; }
      catch { return { ...unavailable('Runtime account identity'), accountId: null }; }
    })();
    const activePromise = stripeList('subscriptions', { status: 'active' }, context, row => { if (row.object !== 'subscription' || row.status !== 'active') throw Error('Invalid subscription status'); }).then(result => result.mode === 'mixed' ? { mode: 'mixed' } : ({ ...result, ...summarizeSubscriptions(result.rows) })).catch(() => null);
    const trialPromise = stripeList('subscriptions', { status: 'trialing' }, context, row => { if (row.object !== 'subscription' || row.status !== 'trialing') throw Error('Invalid trial status'); }).catch(() => null);
    const payoutPromise = (async () => {
      try {
        // Filter by arrival_date only: payouts created before this window must remain eligible.
        const result = await stripeList('payouts', { status: 'paid', 'arrival_date[gte]': String(from), 'arrival_date[lte]': String(to) }, context, row => { if (row.object !== 'payout' || row.status !== 'paid' || !Number.isInteger(row.arrival_date) || row.arrival_date < from || row.arrival_date > to) throw Error('Invalid payout window'); });
        if (result.mode === 'mixed') return { ...unavailable('Payout mode verification'), ...window, mode: 'mixed', count: null, totals: null, complete: false };
        return { status: result.complete ? 'connected' : 'partial', ...window, mode: result.mode, count: result.rows.length, complete: result.complete, totals: summarizePayouts(result.rows), message: 'Stripe marked paid; bank receipt not verified.', scope: 'Payouts with expected arrival dates in the last 30 days. Separate from charge creation and subscription billing. Includes signed payout/reversal amounts; no bank details are displayed.' };
      } catch { return { ...unavailable('Payout reporting'), ...window, count: null, totals: null, complete: false }; }
    })();
    const [account, active, trialing, payouts] = await Promise.all([accountPromise, activePromise, trialPromise, payoutPromise]);
    if (observedMode([active?.mode, trialing?.mode, payouts.mode]) === 'mixed') return withholdConflictingBilling({ account, payouts: { ...payouts, ...window }, subscriptions: {}, checkedAt: new Date(now).toISOString() });
    const subscriptions = {
      status: !active && !trialing ? 'unavailable' : !active || !trialing || !active.complete || !trialing.complete || !active.listPriceComplete ? 'partial' : 'connected',
      activeCount: active?.activeCount ?? null, activeCountComplete: active?.complete ?? false,
      trialingCount: trialing?.rows.length ?? null, trialingCountComplete: trialing?.complete ?? false,
      recurringTotals: active?.recurringTotals ?? null, listPriceComplete: active ? active.complete && active.listPriceComplete : false,
      unsupportedItems: active?.unsupportedItems ?? null, currencyMismatchItems: active?.currencyMismatchItems ?? null, incompleteItemLists: active?.incompleteItemLists ?? null,
      pausedCollectionCount: active?.pausedCollectionCount ?? null, scheduledCancellationCount: active?.scheduledCancellationCount ?? null,
      mode: observedMode([active?.mode, trialing?.mode]),
      message: 'Current Stripe subscriptions. Active and trialing counts are separate; neither is a total audience count.',
      scope: 'Fixed licensed list-price subtotal × quantity, grouped by currency and billing interval. Catalog amounts without invoice-level adjustments for discounts, taxes, credits or fees; tax-inclusive prices remain inclusive; not cash collected, MRR or a revenue forecast. Metered, tiered, transformed, paused-collection or incomplete items are flagged rather than estimated. Subscriptions scheduled to cancel remain active until Stripe changes their status.',
    };
    return { account, subscriptions, payouts, mode: observedMode([subscriptions.mode, payouts.mode]), checkedAt: new Date(now).toISOString() };
  } finally { clearTimeout(timeout); }
}
