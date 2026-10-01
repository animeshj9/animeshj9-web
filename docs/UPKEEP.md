# Lab operations and upkeep

## Current deployment

The canonical repository is `animeshj9/animeshj9-web`. Cloudflare **Workers Builds** is connected to GitHub and publishes the host-routed Worker. The GitHub Actions workflow independently runs tests, static validation, Pages packaging and a Wrangler dry run, then deploys the public Pages artifact. A green Actions run alone does not prove the Cloudflare release succeeded.

The root `animeshj9.com` is the owner control plane. `lab.animeshj9.com` is public. Existing experiment subdomains remain public, and After the Demo is published at `lab.animeshj9.com/after-the-demo/` without new DNS or services. `api.animeshj9.com/health` is the public read-only liveness endpoint; it does not create a checkout or expose connection details.

## Dashboard boundaries

- `GET https://animeshj9.com/api/overview` is protected by the same existing Cloudflare Access JWT verification as the dashboard. Authentication runs before source access. The response is private/no-store, noindex, with no cross-origin read grant.
- Public lab paths `/dashboard` and `/api` are blocked, including encoded equivalents. Public Pages packaging excludes `dist/dashboard` entirely.
- The repository and all static browser source are public. Never commit credentials, customer records, private metrics, account exports or private personal details. Financial responses are runtime aggregates only, never bundled files.
- No Access policies, owner identity settings, credential scopes or new grants were changed for this release.
- Asset readiness means the asset is present in the deployed build. It does not measure external HTTP uptime, human visits or checkout success. Configured checkout is not a completed-payment test.

## Data definitions and current sources

### Traffic

The live lab had an injected Cloudflare Insights beacon during the 1 October 2026 audit. Its delivery and historical reports were not verified. No reporting connection is available to the dashboard, so pageviews and visitors are `null`, displayed as unknown. Do not replace missing data with zero.

Review Cloudflare Web Analytics collection and hostname coverage before adding a reporting adapter. Edge requests are not equivalent to human visits: bots, assets, monitoring and worker/API requests must not be labeled visitors. Keep self-generated smoke checks separate where the provider supports it. Enabling new credentials, grants or paid services requires separate authorization. Do not loosen every experiment's CSP to add tracking; FeedProof and local-first workspaces process private user input in-browser.

References: [Cloudflare Web Analytics collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/), [Cloudflare Web Analytics CSP requirements](https://developers.cloudflare.com/web-analytics/faq/).

### Stripe

The owner endpoint makes read-only calls using the pre-existing `STRIPE_SECRET_KEY` runtime binding. It does not retrieve that value into tooling, create credentials, change scopes, alter checkout or write to Stripe. If existing access cannot read charges, reporting remains unavailable and the dashboard identifies the next step separately.

Window: charge creation timestamps from the preceding 30 × 24 hours through retrieval time, UTC. Include only successful, paid, captured charges. Sum `amount_captured` and cumulative `amount_refunded`, separately per currency. Retained before fees = captured minus refunded. It is not accounting net revenue: fees, disputes, payouts and refunds against older charges are excluded. Scope is the connected Stripe account, not only the coffee product. Test data is explicitly marked. An empty response has unverified account mode.

Pagination reads at most three pages of 100 charge records with an 8-second overall timeout. More data is labeled partial. Errors, invalid data and missing scopes produce no totals. Only counts, currency aggregates, reporting scope and freshness are sent to the owner browser; never customer data, identifiers or raw provider errors. Manual Refresh is single-flight; there is no background polling.

Reference: [Stripe List charges](https://docs.stripe.com/api/charges/list).

### Substack and X

Reporting is not connected. Public essays and visible posts are not proxies for subscribers, email opens, impressions or revenue. Add only an authorized source, or an owner-provided aggregate export, behind the existing private boundary. Before rendering imported data, validate period, timezone, definitions, freshness, account identity and coverage. Never merge unlike metric definitions or upload private exports into this public repository.

## Cadence

A weekly read-only review is scheduled for Mondays. Review live routes, source freshness, deployment results, privacy boundaries, broken links and the next small useful improvement. Do not treat the schedule itself as authorization for new credentials, paid services or unrelated external actions.

- **After each release:** full test/static/build checks; exact remote commit; GitHub Actions result; Cloudflare Workers Builds result; live desktop/mobile smoke tests; owner endpoint authorization; public isolation; no private data bundled.
- **Weekly:** API health, public experiment load, missing/stale source states, useful traffic signals when connected, open bugs, and an evidence-backed improvement backlog.
- **Monthly:** dependencies, browser storage/export recovery, accessibility and mobile regressions, privacy text, and which experiments merit improvement or retirement. Do not remove user data or retire a live experiment without an appropriate decision.

## Release checklist

1. Check current main and concurrent work. Make focused changes; never force-update main.
2. Run `npm ci`, `npm test`, `npm run check`, `npm run build`, `npm run build:worker`, and `npx wrangler deploy --dry-run --config wrangler.subdomains.jsonc`.
3. Ensure `_site/dashboard` is absent. Test malformed/encoded public paths and unauthenticated owner requests.
4. Verify the intended exact commit on remote, then both separate deployment systems. Inspect failures and resolve within authorized scope.
5. Verify the public lab link and new experiment, private dashboard refresh, `/health`, and absence of `/dashboard/index.html` on the public lab. Check meaningful interaction flows, not just page loads.
6. Record limitations honestly. A missing metric connection is unfinished reporting, not a measured zero. A liveness response is not an uptime percentage.

## After the Demo

Local-first AI outcome measurement. Count baseline effort and all assisted effort, including review/rework; record quality gates and costs. The sample is synthetic and separate from real trials. Data stays in the browser, with export and clear controls. It makes no model calls and requests no account access. Never infer evidence of general AI productivity from a small or selectively chosen trial set.
