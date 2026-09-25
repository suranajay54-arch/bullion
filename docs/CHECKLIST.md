# Next-action checklist

In order. Dates assume you want the site live and current before 1 October 2026.

1. [x] **Published** 25 Sep 2026: https://suranajay54-arch.github.io/bullion/ (repository github.com/suranajay54-arch/bullion).
2. [x] **Customs exchange rate in force from 18 Sep 2026: 96.80** (ICEGATE Exchange Rate Notification No. 27/2026), with the six earlier fortnights back to 19 Jun 2026. Every rupee duty leg now computes.
3. [ ] **Open the site on your Android phone** in Chrome and once from a WhatsApp link. Tap through all seven panels and the demo. If anything looks wrong, take a screenshot.
4. [ ] **Glance at the automatic check now and then:** Actions > "Check the live site" > latest run (91 of 91 passed on 25 Sep) > Artifacts > live-site-check (screenshots and report).
5. [ ] **30 Sep evening or 1 Oct morning: add the tariff-value notification in force from 1 Oct 2026** to `data/registry/cbic-tariff-values.json` and set `lastReviewed`. Without it the site marks 75/2026 STALE from 1 Oct.
6. [ ] **1 Oct evening or 2 Oct: add the customs rate in force from 2 Oct 2026.** ICEGATE > View Exchange Rate Notifications > Download PDF on the newest line; add one line to `data/manual/customs-fx.csv` as shown in docs/OPERATIONS.md (effective date 2026-10-02, published 2026-10-01).
7. [ ] **Rehearse the live demo on your phone:** Parity > Your inputs > enter the latest COMEX December settlement you can see (contract GCZ26) with its date; Basis > load that day's MCX bhavcopy downloaded on the phone, or type the GOLD December close; the contract basis, carry and warnings appear, labelled USER-ENTERED. Use GOLD December rather than October: October enters its delivery period on 1 Oct and the page will say so.
8. [ ] **Decide on exchange prices** (docs/COSTS.md): keep visitor-entered only (recommended), write to MCX for end-of-day display permission, or license COMEX.
9. [ ] **Optional:** own web address (README, section G); CA review of the GST treatment (METHODOLOGY section 4); cost assumptions to publish as site defaults (`data/manual/local-costs.json`).
10. [ ] **Keep the two PRIVATE files off GitHub.** The reference exchange prices and the full reconciliation were delivered separately from the site folder. Keep them on your computer only. If you want the full reconciliation test to run on your computer, put them in a folder `tests/private/` inside your local copy; `.gitignore` keeps that folder out of GitHub Desktop commits, but a drag-and-drop upload on github.com ignores `.gitignore`, so never drag that folder onto the website.
