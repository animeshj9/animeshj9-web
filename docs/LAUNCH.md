# Launch later — no setup blocks the code

The lab and FeedProof are static files. There is no database, model API key, account system or server upload endpoint to configure. Long Arc stays in its existing folder.

**Current featured project: Footpath Optional**, the free Hyderabad pedestrian evidence map at `/footpath-optional/`. It includes OSM data, local field-note exports and an archived photo/design comparison; it has no reviewed field surveys yet.

**Earlier project: Galli Club.** It uses the same static deployment, at `/galli-club/`, with a public free kit and preview. Its full paid-edition PDF stays outside `dist` in `products/galli-club/`. The FeedProof payment instructions below do not activate Galli Club; see [Galli Club's own launch and validation notes](GALLI_CLUB.md) for the proposed INR digital product. Verify the Galli Club route, nickname/age/quiet options, step navigation, keepsake and both PDF downloads before domain cutover. Family playtesting is still needed before accepting money.

## Local checks

Use Node.js 22 or newer:

```bash
npm test
npm run check
```

No dependency installation is required for application tests. To view the site locally, serve `dist` with an ordinary static HTTP server and open `/feedproof/`; ES modules need HTTP, not a `file://` double-click. Do not expose confidential feeds through a web server directory.

## GitHub Actions and GitHub Pages

The selected host is GitHub Pages as of 18 September 2026. Squarespace remains the domain registrar and DNS provider. The previous Cloudflare setup is no longer required; existing Cloudflare secrets/variables are unused. Do not change nameservers for this setup.

The workflow tests all projects, runs static checks, packages only `dist/` into `_site/`, and uploads a Pages artifact. Successful main pushes and manual runs deploy with `actions/deploy-pages`. Pull requests validate/package without deploying. Authentication uses GitHub's built-in token and OIDC; no personal token or hosting secret is needed.

### One-time owner setup

1. Open https://github.com/animeshj9/animeshj9-web/settings/pages . Set Build and deployment → Source to **GitHub Actions**. This private personal repository needs GitHub Pro (or another eligible paid plan). If Pages is unavailable, resolve the plan requirement; do not make the repository public without reviewing its private products and history.
2. In the same page, set Custom domain to **animeshj9.com** and save BEFORE changing DNS. With Actions deployments, a CNAME file is not required and does not configure the domain. Optionally verify domain ownership in account Settings → Pages using GitHub's exact TXT challenge.
3. In Squarespace, open Domains → animeshj9.com → DNS → DNS Settings. Replace old WEBSITE records for `@` and `www` with the entries below. Remove conflicting old A/AAAA/CNAME records for those hosts; retain mail and other unrelated records. Keep the current Squarespace nameservers. If nameservers were already moved elsewhere, these records must be changed at the authoritative DNS provider instead.

| Type | Host | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | animeshj9.github.io |

4. Open Actions → Lab checks and deployment → Run workflow → main (or rerun the failed deployment job after enabling Pages). The `github-pages` environment must permit main deployments. No separate starter workflow is needed.
5. Wait for DNS checks/certificate issuance, then enable **Enforce HTTPS** in Pages settings. DNS propagation can take up to 24 hours. Verify https://animeshj9.com/ and all four project folders, including https://animeshj9.com/footpath-optional/ . Verify www redirects to the configured apex domain. Do not modify the separate animeshja.in repository or domain.

A deployment attempted before owner setup can fail at Configure Pages; the check job and package still complete. The connector cannot change the repository's Pages admin setting, so it is a manual step.

References: [custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [custom domains and DNS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

### Packaging and policies

`npm run build` recreates `_site/` from public `dist/` only. Repository documents, tests and private paid-product files are not published. The package keeps folder URLs and the 404 page. No catch-all SPA rewrite is used. No database, server or API keys are needed.

GitHub Pages does not apply Cloudflare's `_headers` file. The packager carries browser-enforceable CSP directives and Referrer-Policy into early HTML meta tags, preserving the OSM tile origin/referrer and local application restrictions. CSP `frame-ancestors`, X-Frame-Options, Permissions-Policy and X-Content-Type-Options cannot be configured this way; no equivalent custom response-header enforcement is claimed. The package omits `_headers`. The retained `.openai/hosting.json` and `wrangler.jsonc` are historical and unused by this workflow.

Rollback: revert an offending commit normally and let the checks redeploy it. Disable the workflow in Actions if automatic deployments need to stop. A separate GitHub Release is not needed.

## Activating the $49 pilot

Leave it off until there is capacity to fulfil the exact offer. The free checker is fully usable without payments.

1. Confirm the business can accept the proposed USD payment method, and settle invoicing, tax, refund/cancellation terms, contact details and client-data handling with suitable advisers where needed. Existing Substack payments do not automatically cover a different business.
2. Validate the offer with a real buyer. Agree scope and turnaround in writing before payment. Use only the minimum catalogue facts needed; never request store passwords, Google account credentials or customer/order data.
3. Create an appropriate hosted payment link in the user's own payment account. Test the checkout, receipts, contact information and refund process. The present optional CTA supports an HTTPS `buy.stripe.com` link; use a separately reviewed integration if another provider is needed.
4. Update the site's commercial/privacy copy to the real fulfilment and retention policy. In `dist/feedproof/config.mjs`, set the public `checkoutURL` and `enabled: true` only after those steps. No secret keys go into this file. The checkout email provides follow-up contact; there is no automatic order fulfilment or catalogue transfer.
5. Push the change through the same test/deploy workflow. The disabled CTA should become an external checkout link; check its actual amount and currency. Don't fabricate orders, testimonials or successful repairs.

## Acceptance checklist before calling it live

- Unit/static checks green on GitHub; actual deployed origin verified, not just a queued Actions run.
- Desktop and mobile file selection, drag/drop where supported, paste, sample, filtering, clearing, modal keyboard use and downloads exercised in browsers.
- Report opens safely and can be printed; corrected TSV re-imports into the intended feed workflow. This build's automated tests do not replace that real-world check.
- No feed content in network requests; no analytics; no broken local routes.
- Public price and CTA reflect the actual launch state; checkout stays closed until commercial setup is ready.
- DNS points to the intended host and HTTPS works after propagation.

## Validation work

See [PRODUCT.md](PRODUCT.md) for the buyer, alternatives, five-part challenge, proposed pricing, first-ten-user sequence, and stop/pivot thresholds. No outreach or payments were performed as part of this implementation.
