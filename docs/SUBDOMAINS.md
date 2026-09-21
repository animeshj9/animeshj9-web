# Subdomains and owner-only dashboard

Prepared migration; nothing changes in production until the Cloudflare setup and deployment below are completed. Site names, copy, design and application code remain unchanged. One repository and one Worker serve the existing four apps.

| Host | Existing app | Access |
| --- | --- | --- |
| animeshj9.com | Existing lab dashboard | Owner only |
| www.animeshj9.com | Redirect to root | Dashboard requires login |
| feedproof.animeshj9.com | FeedProof | Public |
| galli-club.animeshj9.com | Galli Club | Public |
| footpath-optional.animeshj9.com | Footpath Optional | Public |
| long-arc.animeshj9.com | Long Arc | Public; notebook data stays in each browser |

## 1. Prepare Cloudflare DNS

Add `animeshj9.com` to Cloudflare. Keep domain registration at Squarespace. Review imported DNS records, especially any MX/TXT/email records, then replace Squarespace's nameservers with the two assigned by Cloudflare. Keep the existing GitHub Pages records until the Worker is ready for cutover. Wait until Cloudflare marks the zone Active.

## 2. Configure dashboard login

In Cloudflare Zero Trust, create a self-hosted Access application for exactly `animeshj9.com`, all paths (do NOT use `*.animeshj9.com`). Add an Allow policy with your exact email address only. Email one-time PIN is sufficient. Record the team URL (`https://YOUR-TEAM.cloudflareaccess.com`, no trailing slash) and application audience (AUD) tag.

The root's old app paths need more-specific Bypass applications so public bookmarks can redirect without a login. For each slug in the table, add a Bypass application covering BOTH `animeshj9.com/SLUG` and `animeshj9.com/SLUG/*`, with Everyone as the selector. Do not bypass `/` or the entire domain. The Worker only redirects these paths; it never serves dashboard files through them. Verify both slash and no-slash URLs after deployment. If you skip these bypass rules, public subdomains still work but old root-domain links will first ask for login.

## 3. Install and configure the Worker

After merging this PR, clone/pull the repository locally (Node 22+):

```sh
npm ci
npm test
npm run check
npm run build:worker
npx wrangler login
```

The separate config is intentional: the old unused `wrangler.jsonc` and the GitHub Pages deployment remain untouched while preparing the migration. Always supply `--config wrangler.subdomains.jsonc`.

In a terminal, run the following; each prompts for one value. Do not put tokens or email addresses in source control:

```sh
npx wrangler secret put ACCESS_ISSUER --config wrangler.subdomains.jsonc
npx wrangler secret put ACCESS_AUD --config wrangler.subdomains.jsonc
npx wrangler secret put DASHBOARD_EMAIL --config wrangler.subdomains.jsonc
```

If Wrangler asks to create the missing Worker, accept. Values are respectively the team URL, the Access application's AUD, and the same email allowed by the policy. The Worker denies dashboard requests if any setting is missing or the signed token does not match that email, issuer and audience.

## 4. Cut over

First preserve any Long Arc data: browser storage belongs to the old origin and cannot automatically follow to the new subdomain. Use its existing Markdown export for a readable backup. For a restorable backup, on the OLD Long Arc page open browser DevTools Console and run `copy(localStorage.getItem('long-arc.theses.v1'))`, then save the copied JSON privately. Do this in every browser/profile holding a notebook. After cutover, on the NEW Long Arc page use DevTools > Application > Local Storage to set key `long-arc.theses.v1` to the saved JSON and reload. Do not overwrite an existing new-origin notebook; merge/backup first. Do not clear old-origin browser storage until the migration is checked.

At cutover, remove only conflicting DNS records for `@` and `www` that point to GitHub Pages (the four GitHub A records and GitHub CNAME; check for corresponding AAAA records too). Leave unrelated records untouched. Then run:

```sh
npm run deploy:worker
```

Wrangler creates the six custom-domain records from its configuration and Cloudflare provisions TLS. There may be a brief interruption while routes/certificates activate. If deployment fails, restore the previous GitHub records; keep a DNS export before changes.

## 5. Verify and retire the public dashboard origin

- In a signed-out/private window, each experiment and its assets load publicly. Test Galli Club's story JSON/PDF, FeedProof's sample/export, the map tiles and Long Arc's save/export.
- The root asks for login; the authorized email can see it, another identity cannot. `/index.html` and `/lab.css` are protected too.
- Public app URLs cannot retrieve dashboard files. Alternate `workers.dev` and preview URLs are disabled. Keep `run_worker_first: true`.
- Old app links redirect to their matching subdomains, preserving nested paths and queries.
- Once verified, disable the old GitHub Pages deployment workflow and unpublish the Pages site in repository Settings > Pages. Otherwise the old publicly hosted dashboard has not been fully retired. Remove any previous Sites/Cloudflare deployments if they still expose a copy of the dashboard.
- The repository itself is public. Authentication protects the deployed dashboard, not the source and historical copies of its current static catalogue. Do not add confidential dashboard content to this public repository; use a private repository or authenticated backend for that later.

Future deployments: `npm ci && npm test && npm run check && npm run deploy:worker`. Automated Cloudflare deployment can be connected after the initial cutover; the existing Pages workflow deliberately continues until then.

## Implementation and checks

`build:worker` copies existing `dist` assets, changes only deployment links and favicon locations, and leaves original files unchanged. Worker routes are allowlisted by hostname; each public host sees only its own asset directory. Dashboard requests validate the Access JWT signature with Cloudflare's JWKS via `jose`, issuer, audience, expiry and exact owner email, and return private/no-store responses. No email is committed. Missing auth fails closed. Tests cover route isolation, authentication failures, signed JWT claims, redirects and existing application regressions.

References: [Worker static-asset routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/), [Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/), [Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
