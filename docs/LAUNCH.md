# Launch later — no setup blocks the code

The lab and FeedProof are static files. There is no database, model API key, account system or server upload endpoint to configure. Long Arc stays in its existing folder.

## Local checks

Use Node.js 22 or newer:

```bash
npm test
npm run check
```

No dependency installation is required for application tests. To view the site locally, serve `dist` with an ordinary static HTTP server and open `/feedproof/`; ES modules need HTTP, not a `file://` double-click. Do not expose confidential feeds through a web server directory.

## GitHub Actions and Cloudflare

`.github/workflows/lab.yml` runs tests, validates static assets, dry-runs the Cloudflare package, and uploads a tested static artifact on main-branch pushes and pull requests. Deployment is gated by `CLOUDFLARE_DEPLOY_ENABLED=true`. Without that variable, the deployment job skips rather than failing over missing credentials. No OpenAI Sites deployment is performed by this workflow.

When ready:

1. Sign into the Cloudflare account that should own the Worker. The ChatGPT Cloudflare plugin is unnecessary. Obtain its account ID and create a scoped Workers deployment API token following [Cloudflare's GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/). Restrict the token to the intended account; do not use a global API key. Do not paste tokens in chat or commit them.
2. In this GitHub repository, add Actions secrets named `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The deploy job uses the `production` environment; create it explicitly and restrict it to main if desired. Ensure repository Actions policies permit the referenced GitHub-maintained actions.
3. Confirm the Worker name `animeshj9-lab` is unused in that account or belongs to this project before first deployment. Change `wrangler.jsonc` if it would collide with another application.
4. Add repository Actions variable `CLOUDFLARE_DEPLOY_ENABLED` with value `true`. Run “Lab checks and deployment” manually on main. Later main pushes deploy automatically after successful checks.
5. Verify the returned `workers.dev` URL first: root lab, `/long-arc/`, `/feedproof/`, `/feedproof/privacy.html`, and an unknown URL (should return 404). Run the fictional sample, a clean real export, fixes, and all downloads on desktop and mobile. Verify response headers include the FeedProof CSP.
6. Only after the replacement works, attach `animeshj9.com` using the current Cloudflare custom-domain setup supported by the account. Squarespace can remain the registrar. This may require changing authoritative nameservers and carefully migrating existing DNS records; don't assume the earlier OpenAI Sites A/TXT records configure your own Cloudflare Worker. Preserve mail records and do not replace DNS blindly. Domain cutover is a separate manual task.

For routing, see [Cloudflare static assets HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/). Each project is a folder, so its index receives a trailing-slash URL. No catch-all SPA rewrite swallows the other experiments.

The retained `.openai/hosting.json` records the previous host's identity only. GitHub Actions uses `wrangler.jsonc`; do not use the old host's credentials for Cloudflare. Existing hosting/DNS was not changed by this build.

Rollback: disable `CLOUDFLARE_DEPLOY_ENABLED` to stop new deployments. Revert the offending commit with a normal GitHub revert, review tests, then re-enable deployment; or use Cloudflare's supported deployment rollback. Do not force-push/reset unrelated history. Keep the old host until the domain cutover has been verified.

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
