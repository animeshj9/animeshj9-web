import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { handle, verifyDashboard } from '../worker/index.mjs';
import { sites } from '../worker/sites.mjs';
const request = (host, path = '/', options) => new Request(`https://${host}${path}`, options);
const assetPaths = [];
const env = { ASSETS: { async fetch(req) { assetPaths.push(new URL(req.url).pathname); return new Response('asset'); } } };
test('each public host only routes into its own directory', async () => {
  for (const [host, slug] of Object.entries(sites)) {
    const res = await handle(request(host), env);
    assert.equal(res.status, 200);
    assert.equal(assetPaths.at(-1), `/${slug}/index.html`);
    await handle(request(host, '/lab.css'), env);
    assert.equal(assetPaths.at(-1), `/${slug}/lab.css`);
  }
});
test('dashboard and its assets deny missing authentication before asset lookup', async () => {
  const before = assetPaths.length;
  for (const path of ['/', '/index.html', '/lab.css', '/lab-favicon.svg']) assert.equal((await handle(request('animeshj9.com', path), env)).status, 403);
  assert.equal(assetPaths.length, before);
});
test('authenticated dashboard is never cacheable and restricts asset paths', async () => {
  const res = await handle(request('animeshj9.com'), env, async () => true);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal((await handle(request('animeshj9.com', '/docs/secret'), env, async () => true)).status, 404);
});
test('legacy links redirect preserving nested paths and query strings', async () => {
  for (const [host, slug] of Object.entries(sites)) {
    const res = await handle(request('animeshj9.com', `/${slug}/privacy.html?q=1`), env);
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), `https://${host}/privacy.html?q=1`);
  }
});
test('unknown host, encoded traversal and non-read requests cannot retrieve assets', async () => {
  assert.equal((await handle(request('random.workers.dev'), env)).status, 404);
  assert.equal((await handle(request('feedproof.animeshj9.com', '/%252e%252e/index.html'), env)).status, 400);
  assert.equal((await handle(request('feedproof.animeshj9.com', '/', { method: 'POST' }), env)).status, 405);
});
test('Long Arc font policy preserves existing external fonts', async () => {
  const res = await handle(request('long-arc.animeshj9.com'), env);
  assert.match(res.headers.get('content-security-policy'), /font-src 'self' https:\/\/fonts.gstatic.com/);
});
test('Access JWT verification rejects forged, expired, wrong audience, issuer and user tokens', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const settings = { ACCESS_ISSUER: 'https://example.cloudflareaccess.com', ACCESS_AUD: 'dashboard', DASHBOARD_EMAIL: 'owner@example.com' };
  const sign = (changes = {}, key = privateKey) => new SignJWT({ email: 'owner@example.com', ...changes }).setProtectedHeader({ alg: 'RS256' }).setSubject('owner').setIssuedAt().setIssuer(changes.iss || settings.ACCESS_ISSUER).setAudience(changes.aud || settings.ACCESS_AUD).setExpirationTime(changes.exp || '5m').sign(key);
  const verify = async token => verifyDashboard(request('animeshj9.com', '/', { headers: { 'Cf-Access-Jwt-Assertion': token } }), settings, publicKey);
  assert.equal(await verify(await sign()), true);
  for (const changes of [{ email: 'other@example.com' }, { aud: 'other' }, { iss: 'https://other.cloudflareaccess.com' }, { exp: 1 }]) assert.equal(await verify(await sign(changes)), false);
  const other = await generateKeyPair('RS256');
  assert.equal(await verify(await sign({}, other.privateKey)), false);
  assert.equal(await verify('fake.jwt.token'), false);
  assert.equal(await verifyDashboard(request('animeshj9.com'), {}), false);
});
