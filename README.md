# Animesh / Lab

Source for the experiments intended for **animeshj9.com**. One repository, one folder per project. The personal home remains [animeshja.in](https://animeshja.in); writing remains [scaling-life.com](https://scaling-life.com).

## Experiments

| Route | Experiment | Status |
| --- | --- | --- |
| `/` | Lab catalogue | Existing index, updated with FeedProof |
| `/feedproof/` | Google Shopping feed preflight: local CSV/TSV checks, repair report and formatting fixes | MVP; paid pilot intentionally closed |
| `/long-arc/` | Local-first thesis notebook | Existing experiment preserved |

FeedProof is a narrow revenue experiment for small WooCommerce agencies. The free checker powers a proposed $49 assisted feed-repair service. Willingness to pay has not been validated. See [product thesis, competitor research and first-ten-user plan](docs/PRODUCT.md).

## Run and verify

Node.js 22+, no application dependencies:

```bash
npm test
npm run check
```

Serve `dist/` with any static HTTP server to use the application locally. ES modules require HTTP rather than opening the HTML directly from disk. `core.mjs` is the pure validation/export engine; `app.mjs` handles UI; `config.mjs` holds non-secret pilot settings. Tests cover parsing, rules, fix round trips and export security. Static checks validate routes/assets and DOM bindings; these are not visual/browser QA.

## Deployment

GitHub Actions tests main/PR changes, validates the Cloudflare package and saves a static artifact. Deployments go to **user-owned Cloudflare Workers**, not OpenAI Sites, once explicitly enabled. Deployment, DNS and checkout setup are deferred. [Manual launch checklist](docs/LAUNCH.md).

Public assets live in `dist/`; documentation and tests stay outside it. The previous hosting manifest is retained for continuity but is not used by this GitHub Actions workflow. No private feeds, customer data, API keys or credentials belong in this repository.
