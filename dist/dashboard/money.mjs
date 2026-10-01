// Stripe charge units differ from ISO display digits for ISK, UGX and MGA.
// https://docs.stripe.com/currencies#special-cases
const ZERO_DECIMAL = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'vnd', 'vuv', 'xaf', 'xof', 'xpf']);
export function stripeMajorAmount(amount, currency) {
  if (!Number.isSafeInteger(amount) || !/^[a-z]{3}$/i.test(currency)) throw Error('Invalid currency amount');
  const code = currency.toLowerCase();
  const exponent = ZERO_DECIMAL.has(code) ? 0 : ['isk', 'ugx', 'huf', 'twd'].includes(code) ? 2 : new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  return amount / 10 ** exponent;
}
export function formatStripeAmount(amount, currency, locale) {
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(stripeMajorAmount(amount, currency)); }
  catch { return `${amount} minor units ${String(currency).toUpperCase()}`; }
}
