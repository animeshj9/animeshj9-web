import { createRemoteJWKSet, jwtVerify } from 'jose';
import { sites } from './sites.mjs';
const keySets = new Map();
export async function verifyDashboard(request, env, keyResolver) {
  const issuer = env.ACCESS_ISSUER;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') || !env.ACCESS_AUD || !env.DASHBOARD_EMAIL) return false;
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return false;
  try {
    if (!keyResolver && !keySets.has(issuer)) keySets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, keyResolver || keySets.get(issuer), { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub', 'email'] });
    return typeof payload.email === 'string' && payload.email.toLowerCase() === env.DASHBOARD_EMAIL.toLowerCase();
  } catch { return false; }
}
const fail = (status, message) => new Response(message, { status, headers: { 'Cache-Control': 'no-store' } });
export async function handle(request, env, authorize = verifyDashboard) {
  const url = new URL(request.url);
  if (url.hostname === 'api.animeshj9.com') {
    const cors = { 'Access-Control-Allow-Origin': 'https://animeshja.in', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin', 'Cache-Control': 'no-store' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== '/coffee/checkout' || request.method !== 'POST') return new Response('Not found', { status: 404, headers: cors });
    if (request.headers.get('Origin') !== 'https://animeshja.in') return new Response('Forbidden', { status: 403, headers: cors });
    if (!env.STRIPE_SECRET_KEY) return new Response('Stripe is not configured', { status: 503, headers: cors });
    const body = new URLSearchParams();
    body.set('mode', 'payment');
    body.set('ui_mode', 'embedded');
    body.set('line_items[0][price]', 'price_1UI4r5G6T0Jc0sjIXNGR6KVk');
    body.set('line_items[0][quantity]', '1');
    body.set('return_url', 'https://animeshja.in/?coffee=complete&session_id={CHECKOUT_SESSION_ID}');
    const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const data = await stripe.json();
    if (!stripe.ok || !data.client_secret) return new Response(JSON.stringify({ error: 'Unable to start checkout' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ clientSecret: data.client_secret }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  const lab = url.hostname === 'lab.animeshj9.com';
  const folder = Object.hasOwn(sites, url.hostname) ? sites[url.hostname] : null;
  const dashboard = url.hostname === 'animeshj9.com';
  if (!folder && !lab && !dashboard && url.hostname !== 'www.animeshj9.com') return fail(404, 'Not found');
  if (!['GET', 'HEAD'].includes(request.method)) return fail(405, 'Method not allowed');
  if (url.hostname === 'www.animeshj9.com') { url.hostname = 'animeshj9.com'; url.protocol = 'https:'; return Response.redirect(url, 302); }
  if (/%(?:2e|2f|5c|25)|\\/.test(url.pathname.toLowerCase())) return fail(400, 'Invalid path');
  if (dashboard) {
    for (const [host, slug] of Object.entries(sites)) {
      if (url.pathname === `/${slug}` || url.pathname.startsWith(`/${slug}/`)) {
        url.hostname = host; url.protocol = 'https:'; url.pathname = url.pathname.slice(slug.length + 1) || '/';
        return Response.redirect(url, 302);
      }
    }
    if (!await authorize(request, env)) return fail(403, 'Dashboard access requires the owner’s Cloudflare Access login.');
    if (!['/', '/index.html', '/dashboard.css', '/dashboard-favicon.svg'].includes(url.pathname)) return fail(404, 'Not found');
  }
  const internal = new URL(url);
  internal.pathname = (dashboard ? '/dashboard' : folder ? `/${folder}` : '') + url.pathname;
  if (internal.pathname.endsWith('/')) internal.pathname += 'index.html';
  const response = await env.ASSETS.fetch(new Request(internal, { method: request.method }));
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const map = folder === 'footpath-optional';
  const fonts = folder === 'long-arc';
  headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self'${map ? " 'unsafe-inline'" : ''}${fonts ? ' https://fonts.googleapis.com' : ''}; font-src 'self'${fonts ? ' https://fonts.gstatic.com' : ''}; img-src 'self' data:${map ? ' https://tile.openstreetmap.org' : ''}; connect-src ${folder === 'feedproof' ? "'none'" : "'self'"}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'`);
  if (dashboard) { headers.set('Cache-Control', 'private, no-store'); headers.set('X-Robots-Tag', 'noindex, nofollow'); }
  return new Response(response.body, { status: response.status, headers });
}
// Cloudflare passes ExecutionContext as the third fetch argument, not an authorizer.
export default { fetch(request, env) { return handle(request, env); } };
