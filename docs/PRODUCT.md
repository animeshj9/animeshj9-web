# FeedProof: the first revenue experiment

Decision date: 9 September 2026. Working name, not trademark-cleared. No customer interviews, paid customers, or validated willingness to pay yet.

## Specific buyer and job

A 1–5 person WooCommerce implementation/maintenance agency handling a small merchant's Google Shopping feed. The initial job is a feed handoff or feed-plugin migration, not ongoing ad optimization. Target a single catalogue of fewer than 1,000 products with ordinary retail items; exclude apparel-specific compliance, restricted goods, account suspensions, and complex international feeds at first.

Pain hypothesis: the agency spends billable time tracing basic feed errors across product records, then explaining repairs to a client. They want a concrete field-level handoff and help correcting source formatting, without connecting another SaaS product or handing over store credentials. This is plausible but unvalidated; the build is a cheap test, not evidence of demand.

## Product and pricing

- Free local checker: CSV/TSV input, row-level findings, HTML handoff report, issue CSV, reviewable formatting fixes and TSV recheck. No signup, catalogue upload, AI calls, telemetry, or paid gate.
- Proposed first offer: **$49 USD per assisted repair pilot**, one feed, up to 1,000 products, repair notes plus corrected values where facts are supplied, and one follow-up check. This is a productized service powered by the checker, not passive SaaS income.
- Scope/turnaround confirmed before accepting money. No approval guarantee, account access, Google appeals, automatic product-fact invention, or unlimited support. If a job is not deliverable within scope, don't accept payment.
- Potential later offer, only if pilot demand repeats: $99 for a more complete handoff or a prepaid agency bundle. Neither is sold or advertised as available in the MVP.
- Start in USD because the initial prospecting segment is English-speaking overseas agencies and the intended revenue is export income. Don't maintain parallel INR/USD pricing until Indian buyers demonstrate demand. Payment eligibility, invoicing, and tax handling must be checked separately before accepting money; a previous Substack setup is not proof this business can use it.

## Alternatives researched

| Alternative | What it already does | Our narrow reason to exist — and weakness |
| --- | --- | --- |
| Google Merchant Center and its [product specification](https://support.google.com/merchants/answer/7052112?hl=en) | The source of truth for feed attributes and the final platform where account/product issues must be checked. | A client-ready local preflight before handoff; absolutely not a replacement for Google's actual approval checks. Google's existing checks may be sufficient, which can kill demand. |
| [DataFeedWatch](https://www.datafeedwatch.com/pricing) | Feed transformations, validation and store/channel integrations. Listed Shop plan: $64/month for 1,000 SKUs, 3 feeds, 1 shop. Also offers feed coaching and managed services. | One-off, small repair job with no subscription or store connection. Their product is far broader; agencies already using it are poor prospects. |
| [Channable](https://www.channable.com/pricing) | Feed platform priced by package, Core plan and modules; item/project/channel counts drive scope. Testing is possible in a free trial; activating channels needs a paid subscription. | No platform onboarding for a one-off file check. This is convenience and service packaging, not a technical moat. Numerical pricing wasn't reliably exposed by its interactive calculator, so none is quoted here. |
| Spreadsheet formulas, custom scripts, or ChatGPT-assisted debugging | Flexible ways to inspect and repair an export; a technical agency can build similar checks. | Repeatable rules, record references, explicit fix previews, privacy by default, and a reusable handoff report. Experienced technical agencies may reasonably prefer their own scripts. |

Competitor facts were checked on the linked primary pages on the decision date. This is a bounded scan, not an exhaustive market survey. The existence of paid feed-management products supports the category, not demand for our particular offer.

## Challenge the idea before investing further

1. **Why pay?** For an agreed repair deliverable that removes a small but annoying agency task, not for generic warnings. Hypothesis: avoiding one billable-hour detour can justify $49. Measure actual time and ask for actual payment; don't mistake praise for demand.
2. **Why not ChatGPT or SaaS?** The free checker provides deterministic checks and exports without sending catalogue data to an AI service. A person can inspect the exact fix before downloading. Full SaaS wins for ongoing sync/multichannel management; do not target those users.
3. **Can one person operate it?** The application has no database, authentication, model bill, crawler, or upload pipeline. The paid service does consume time. Cap pilots at five per week, aim for <=45 minutes per job, and stop accepting work when capacity is unavailable. Learn Merchant Center edge cases before selling broader work.
4. **Reach without heavy marketing?** Agency directories, WordPress/WooCommerce communities and relevant professional contacts can surface the buyer. Access to buyers is not yet proven. No bulk scraping, mass outreach, invented testimonials, or reliance on a general personal audience converting.
5. **First $1 / $100 / $1,000?** One $49 pilot crosses $1; three cross $100 ($147); 21 cross $1,000 ($1,029), gross before fees/tax/refunds and founder time. At 45 minutes each, 21 repairs consume 15.75 delivery hours plus sales/support. This is feasible arithmetic, not a forecast or recurring revenue claim.

The weakest point is acquisition and one-off service demand, not engineering. Limit the next investment to discovery and paid pilots. Do not build recurring monitoring, Google OAuth, AI title generation, or a multi-tenant platform before payment evidence.

## First 10 users: a concrete validation sequence

1. Build a prospect list of 30 small agencies whose own sites mention WooCommerce and Shopping/feed setup. Record public business URL, relevant service, contact method and reason for fit. Do not buy a mailing list. No prospects have been contacted by this build.
2. Invite five suitable warm contacts or community peers to a 15-minute live test. Ask them to run a real, non-sensitive feed locally; no catalogue needs to be sent to us. Observe export compatibility and whether the report changes their work.
3. Send up to ten individually written messages to well-matched agencies through permitted business contact channels. Offer the free checker first and ask about the last feed handoff they had to repair. Seek the next three users here.
4. Publish one factual before/after example using fictional data and a short “feed handoff checklist” in a relevant community where promotion is allowed. Seek two more testers; don't spam general AI communities.
5. After a successful test, offer a clearly scoped $49 repair pilot. Agree on inputs, outcome and turnaround, then invoice or send an approved checkout link. Do not charge someone simply to receive the free automated report.

Activation = runs a real feed and exports a report or inspected correction, not a page view. Track manually, with consent, without embedding catalogue telemetry. For the first ten testers capture: source, store/feed plugin, successful import, unexpected false positives, errors fixed, time spent/saved, handoff usefulness, offer made, and payment/refusal reason. No public customer claims without permission.

**Decision gates:** within 14 days of beginning outreach, target 10 real-feed users and at least 3 paid pilots. If fewer than 3 of the first 10 activated users pay, inspect refusals before extending the build. If most feeds are XML or raw inventory exports, address input fit before adding checks. If buyers only want account-suspension appeals, reject that segment. If 30 tailored contacts yield fewer than 5 relevant conversations, reconsider the channel or buyer. If Google/free plugins already solve the pain, retire the offer and keep the checker as a useful lab experiment.

## MVP boundaries

Built: responsive file/paste/drop checker, fictional example, strict CSV/TSV parser, input limits, core format rules, severity/search/pagination, safe-fix review, downloadable report/issue CSV/fixed TSV, privacy page, lab routing, automated tests and Cloudflare GitHub Actions configuration.

Not built or claimed: XML or Excel import, WooCommerce raw-column mapping, full Google compliance, remote URL fetching, scheduled sync, account access, payments backend, accepted orders, email delivery, customer portal or browser-tested deployment. Paid CTA is intentionally disabled by public configuration until the manual launch checklist is complete.
