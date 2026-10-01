import { formatStripeAmount as money } from './money.mjs';
const $ = id => document.getElementById(id);
const label = { connected: 'Connected', partial: 'Partial result', unavailable: 'Unavailable', not_connected: 'Not connected' };
const text = (id, value) => { $(id).textContent = value; };
function badge(id, state, override) {
  const el = $(id); el.textContent = override || label[state] || state;
  el.className = `pill ${state === 'connected' ? 'good' : 'warning'}`;
}

function appendAmount(container, caption, amount, currency) {
  const row = document.createElement('div'); row.className = 'money-row';
  const name = document.createElement('span'); name.textContent = caption;
  const value = document.createElement('strong'); value.textContent = money(amount, currency);
  row.append(name, value); container.append(row);
}
function renderBilling(billing, mode) {
  if (!billing) return;
  const { account, subscriptions, payouts } = billing;
  badge('billing-mode', mode === 'live' ? 'connected' : 'partial', mode === 'live' ? 'Live connection' : mode === 'test' ? 'TEST DATA' : mode === 'mixed' ? 'Conflicting modes' : 'Mode unverified');
  text('billing-account', account.accountId ? `Runtime Stripe account: ${account.accountId}. Source: existing server-side connection.` : account.message);
  badge('subscriptions-status', subscriptions.status);
  const count = (value, complete) => value === null ? '—' : `${value}${complete ? '' : '+'}`;
  text('active-count', count(subscriptions.activeCount, subscriptions.activeCountComplete));
  text('trialing-count', count(subscriptions.trialingCount, subscriptions.trialingCountComplete));
  text('subscriptions-message', subscriptions.message);
  text('subscriptions-scope', subscriptions.scope || 'Subscription reporting is unavailable with the existing connection. No broader access was requested.');
  const subtotals = $('subscription-totals'); subtotals.replaceChildren();
  for (const row of subscriptions.recurringTotals || []) {
    const interval = row.intervalCount === 1 ? `per ${row.interval}` : `every ${row.intervalCount} ${row.interval}s`;
    appendAmount(subtotals, `Fixed list-price subtotal · ${interval}`, row.listPriceMinor, row.currency);
  }
  const caveats = [];
  if (!subscriptions.activeCountComplete) caveats.push('Active count is incomplete or unavailable');
  if (!subscriptions.trialingCountComplete) caveats.push('Trialing count is incomplete or unavailable');
  if (subscriptions.unsupportedItems) caveats.push(`${subscriptions.unsupportedItems} variable or unsupported price items excluded`);
  if (subscriptions.currencyMismatchItems) caveats.push(`${subscriptions.currencyMismatchItems} price currencies differ from the subscription currency; default-currency amounts were not substituted`);
  if (subscriptions.incompleteItemLists) caveats.push(`${subscriptions.incompleteItemLists} item lists truncated`);
  if (subscriptions.pausedCollectionCount) caveats.push(`${subscriptions.pausedCollectionCount} active subscriptions have collection paused; excluded from price totals`);
  if (subscriptions.scheduledCancellationCount) caveats.push(`${subscriptions.scheduledCancellationCount} active subscriptions are scheduled to cancel`);
  text('subscriptions-coverage', caveats.length ? `${caveats.join('. ')}. A + marks an incomplete count; list-price amounts are observed subtotals.` : subscriptions.activeCount === 0 ? 'No active subscriptions returned. A zero active count does not imply no historical subscribers or revenue.' : 'Complete returned active/trialing lists and supported fixed-price items. Catalog amounts only; no invoice-level adjustments applied.');
  badge('payouts-status', payouts.status); text('payout-count', count(payouts.count, payouts.complete)); text('payouts-message', payouts.message);
  const payoutTotals = $('payout-totals'); payoutTotals.replaceChildren();
  for (const row of payouts.totals || []) appendAmount(payoutTotals, `${row.payouts} Stripe-paid payout ${row.payouts === 1 ? 'record' : 'records'}`, row.amountMinor, row.currency);
  text('payouts-window', `Expected arrival window (UTC): ${payouts.windowStart.replace('T', ' ').replace('.000Z', '')} to ${payouts.windowEnd.replace('T', ' ').replace('.000Z', '')}`);
  text('payouts-scope', `${payouts.scope || 'Payout reporting is unavailable with the existing connection.'} ${payouts.complete ? 'All returned pages were read.' : 'Incomplete or unavailable: a + marks only the observed lower-bound count; no full total is claimed.'}`);
}

function render(data) {
  text('site-count', data.sites.length);
  const ready = data.sites.filter(site => site.state === 'asset_ready').length;
  text('asset-count', `${ready} packaged assets ready`);
  text('api-state', data.api.ownerOverview === 'responding' ? 'Responding' : 'Unknown'); text('api-caption', `Coffee checkout: ${data.api.checkout === 'configured' ? 'configured' : 'not configured'}`);
  const list = $('sites'); list.replaceChildren();
  for (const site of data.sites) {
    const row = document.createElement('a'); row.className = 'site-row'; row.href = site.url; row.target = '_blank'; row.rel = 'noopener noreferrer';
    const name = document.createElement('span'); const strong = document.createElement('strong'); strong.textContent = site.name; const kind = document.createElement('small'); kind.textContent = `${site.kind} →`; name.append(strong, kind);
    const description = document.createElement('span'); description.className = 'site-description'; description.textContent = site.description;
    const status = document.createElement('span'); status.className = `pill ${site.state === 'asset_ready' ? 'good' : site.state === 'external' ? 'neutral' : 'warning'}`; status.textContent = ({ asset_ready: 'Asset ready', external: 'External site', asset_missing: 'Asset missing', asset_unavailable: 'Check unavailable' })[site.state] || 'Unknown';
    const visits = document.createElement('span'); visits.className = 'site-visits'; const value = document.createElement('b'); value.textContent = '—'; visits.append(value, 'Visits unknown'); row.append(name, description, status, visits); list.append(row);
  }
  const { traffic, stripe, substack, x } = data.sources;
  const mode = stripe.connectionMode || stripe.mode;
  renderBilling(stripe.billing, mode);
  text('traffic-message', traffic.message); text('traffic-collection', traffic.collection); text('traffic-next', traffic.nextStep);
  for (const [id, source] of [['substack', substack], ['x', x]]) { text(`${id}-message`, source.message); text(`${id}-next`, source.nextStep); }
  badge('stripe-status', stripe.status); badge('stripe-source-status', stripe.status);
  text('stripe-message', stripe.message); text('stripe-next', stripe.nextStep || stripe.scope); text('stripe-scope', 'Only aggregate totals reach this page. Customer details, identifiers and credentials remain off the dashboard.');
  const totals = $('stripe-totals'); totals.replaceChildren();
  if (Array.isArray(stripe.totals)) {
    const count = stripe.totals.reduce((sum, row) => sum + row.payments, 0); text('stripe-count', `${count}${stripe.status === 'partial' ? '+' : ''}`);
    text('stripe-caption', `${mode === 'test' ? 'TEST DATA · ' : mode === 'live' ? 'Live · ' : mode === 'mixed' ? 'Mixed modes · ' : 'Mode unverified · '}${count === 1 ? 'captured payment' : 'captured payments'}`);
    if (mode === 'test' || mode === 'mixed') badge('stripe-source-status', 'partial', mode === 'test' ? 'Test data' : 'Mixed modes');
    for (const row of stripe.totals) {
      const el = document.createElement('div'); el.className = 'money-row';
      for (const [caption, value] of [['Captured', row.capturedMinor], ['Refunded from these payments', row.refundedMinor], ['Retained before fees', row.retainedMinor]]) { const name = document.createElement('span'); name.textContent = caption; const amount = document.createElement('strong'); amount.textContent = money(value, row.currency); el.append(name, amount); }
      totals.append(el);
    }
  } else { text('stripe-count', '—'); text('stripe-caption', 'Payment totals unavailable'); }
  text('upkeep-cadence', data.upkeep.cadence); const checks = $('upkeep-checks'); checks.replaceChildren(); for (const item of data.upkeep.checks) { const li = document.createElement('li'); li.textContent = item; checks.append(li); }
  text('updated', `Checked ${new Date(data.generatedAt).toLocaleString(undefined, { timeZoneName: 'short' })}`);
  text('notice', 'Owner overview loaded. Missing reporting stays unknown; asset readiness is not uptime.'); $('notice').classList.remove('error');
}
let loading = false;
async function refresh() {
  if (loading) return; loading = true; $('refresh').disabled = true; text('notice', 'Refreshing the private overview…');
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/overview', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw Error('Owner overview unavailable. Your login may have expired; reload this page to sign in again.');
    const data = await response.json(); if (!Array.isArray(data.sites) || !data.sources?.stripe || !data.upkeep) throw Error('The overview response could not be read.'); render(data);
  } catch (error) {
    text('notice', error.name === 'AbortError' ? 'The overview timed out. Try Refresh again; no zero values have been inferred.' : error.message); $('notice').classList.add('error'); text('updated', 'Refresh failed; any displayed values are from the last successful check');
  } finally { clearTimeout(timeout); loading = false; $('refresh').disabled = false; }
}
$('refresh').addEventListener('click', refresh);
refresh();
