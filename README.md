# Animesh / Lab

Source for the experiments intended for **animeshj9.com**. One repository, one folder per project. The personal home remains [animeshja.in](https://animeshja.in); writing remains [scaling-life.com](https://scaling-life.com).

## Experiments

| Route | Experiment | Status |
| --- | --- | --- |
| `/` | Lab catalogue | Galli Club featured first |
| `/galli-club/` | Original Hyderabad story-and-play adventures for ages 3–7 | Playable sample + finished printable edition; sales closed pending playtests |
| `/feedproof/` | Google Shopping feed preflight: local CSV/TSV checks, repair report and formatting fixes | Earlier experiment; free checker |
| `/long-arc/` | Local-first thesis notebook | Existing experiment preserved |

**Galli Club** is the current revenue experiment: Hyderabad at-home adventures for parents and little kids, with a proposed ₹299 three-story digital pack. The free sample has quiet-play and age-specific prompts. The 12-page full pack, four-page free kit, and actual-page preview are built. [Product thesis, alternatives, first-ten-family plan and launch notes](docs/GALLI_CLUB.md).

FeedProof remains available; its [earlier product research](docs/PRODUCT.md) is preserved. Neither product has validated paying demand yet.

## Run and verify

Node.js 22+, no application dependencies:

```bash
npm test
npm run check
```

Serve `dist/` with any static HTTP server to use the applications locally. ES modules require HTTP rather than opening the HTML directly from disk. Tests cover adventure variants, input escaping, feed parsing/rules, exports and asset integrity. Static checks validate routes/assets and DOM bindings; these are not visual/browser QA.

Galli Club's public story is `dist/galli-club/adventure.json`; `play.mjs` handles the pure story/keepsake logic and `app.mjs` handles the parent interface. The authored full pack and PDF live in `products/galli-club/`, outside public assets. Rebuild printables with `python scripts/build-galli-pdfs.py` (ReportLab, Pillow, pypdf and DejaVu fonts); the live site needs no Python.

## Deployment

GitHub Actions tests main/PR changes, validates the Cloudflare package and saves a static artifact. Deployments go to **user-owned Cloudflare Workers**, not OpenAI Sites, once explicitly enabled. Deployment, DNS and checkout setup are deferred. [Manual launch checklist](docs/LAUNCH.md).

Public assets live in `dist/`; documentation and tests stay outside it. The previous hosting manifest is retained for continuity but is not used by this GitHub Actions workflow. No private feeds, customer data, API keys or credentials belong in this repository.
