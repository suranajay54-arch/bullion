# Verification record (25 Sep 2026)

Live site: **https://suranajay54-arch.github.io/bullion/** (repository github.com/suranajay54-arch/bullion).

## 1. The published site

| Check | Environment | Result |
|---|---|---|
| Repository contents | github.com/suranajay54-arch/bullion, uploaded through github.com | 55 files, byte-identical to the package (git blob hashes compared file by file); nothing from `tests/private/` uploaded |
| First "Build and publish" run (push, run 36151495177) | GitHub Actions, Node 22 | Build 15 s, deploy to GitHub Pages; ECB rates downloaded live (65 dates, newest 25 Sep 2026); all 8 CBIC tariff-value documents retrieved and fingerprinted (SHA-256 in the build log); 42 of 42 audit tests passed on GitHub; no warnings in the data checks |
| "Check the live site" on the published address | GitHub Actions: desktop Chromium 1366 x 900; Playwright "Pixel 7" Android emulation; the same phone with JavaScript off | First publish: 76 of 76 checks. After the fixes below: **91 of 91** (run 36154842838), including "no sideways scrolling" on every panel |
| Owner's own Chrome, desktop | Chrome on the owner's computer, 1440 px wide | 38 of 38 in-page audit tests; every panel and the synthetic demo render; no console errors; the rupee duty legs show Rs 1,32,906.40 (duty base) and Rs 19,935.96 (duty) per 10 g |
| Phone width on the owner's computer | Claude's built-in browser pane emulating 412 x 915 with an Android Chrome user agent and touch | 38 of 38 in-page tests; all 7 panels and the demo; no sideways scrolling after the fix below |

Defects found on the live site and fixed the same evening:

1. **Evidence panel, phone width:** the build log overflowed sideways by 76 px because the document
   fingerprints (64-character hashes, present only on GitHub where the documents can be fetched)
   could not wrap. Fixed in `src/ui/site.css`; the browser check now fails any panel that scrolls
   sideways, and it caught the defect when the fix was removed.
2. **Customs rate shown as 96.8000:** ICEGATE notifies rates to 2 decimals; the site now shows 96.80
   (market USD/INR keeps 4 decimals).
3. **GitHub's Node.js 20 deprecation warning** on every run: actions moved to the current Node 24
   releases (checkout v7, setup-node v7, setup-python v7, configure-pages v6, upload-pages-artifact
   v5, deploy-pages v5, upload-artifact v7) and runners pinned to Ubuntu 24.04, ahead of GitHub's
   move of `ubuntu-latest` to Ubuntu 26 on 19 Oct 2026. Runs after the change: build, deploy and live
   check all green.

## 2. The package (before upload, repeated after the ICEGATE update)

| Check | Environment | Result |
|---|---|---|
| Node audit suite (`node tests/run-tests.js`): T01-T22 ported from Build 2.0.0, N01-N16 new, P01-P04 pipeline | Node 22, deterministic snapshot built from the ECB fixture | **42 of 42 pass**, with and without the owner's private reference file (N15 then also checks the benchmark, landed and basis legs) |
| Browser check (`tests/e2e_check.py --interact`) on the built site served over HTTP | Chromium, desktop 1366 x 900 | 45 of 45 |
| Same | Android phone emulation (Playwright "Pixel 7": 412 x 839 CSS px, device scale 2.625, touch, Chrome for Android user agent) | 45 of 45 |
| Same | Android phone emulation with JavaScript switched off | 13 of 13 (static snapshot readable, all 7 panels present, no sideways scrolling) |
| Outage drill: ECB and every document host unreachable, no previous snapshot | Pipeline and page | Pipeline exits normally, logs the errors, USD/INR shown as UNAVAILABLE with reasons |
| Bad edits: tariff value 13.73, customs rate "abc" | Pipeline (P02) | Run stops with exit code 1, no snapshot written, live site unchanged |

Each browser profile checks: readable text at first paint (no blank screen); the app boots; the
in-page audit tests (38) pass in that browser; every panel renders interactively and alone, with no
"null", "undefined" or "NaN" text and no sideways scrolling; demo mode is labelled SYNTHETIC and
leaving it restores public data; no request to any other host; no failed or 4xx/5xx request; no
console or page errors. With interaction: a visitor benchmark computes the benchmark leg; the
published ICEGATE rate (96.80) gives duty Rs 19,935.96 per 10 g; a visitor customs rate of 97.00
overrides it (Rs 19,977.15); the CSV export carries the watermark, the USER-ENTERED token and the
provenance section; a bhavcopy file is parsed in the browser (4 bullion futures rows from a
synthetic test file); "Clear all my entries" restores the public state.

## 3. Customs exchange rates

Read on 25 Sep 2026 from ICEGATE's list of exchange-rate notifications (View Currency Exchange
Rate > View Exchange Rate Notifications), which needs no login or captcha: US Dollar import and
export rates for notifications 18/2026 to 27/2026, in force 19 Jun to 1 Oct 2026. The 17 Jul 2026 row
previously held as SECONDARY matched ICEGATE exactly (97.20 / 95.45) and is now VERIFIED. ICEGATE's
exchange-rate notifications are numbered in a series of their own: No. 27/2026 (96.80, in force
from 18 Sep 2026) is not Customs (N.T.) 27/2026.

## 4. What is still not verified

1. **A physical Android phone.** Only Chrome's engine with Android phone emulation was used (on
   GitHub and on the owner's computer). Real handsets differ in fonts, in-app browsers (WhatsApp,
   LinkedIn) and data-saver modes.
2. **The twice-daily schedule.** The first scheduled run is due at 21:11 IST on 25 Sep 2026. GitHub
   can start scheduled runs late when busy; the page's own freshness labels cover a missed run.
3. **Real bhavcopy files.** The parser follows column names from a secondary description of the
   MCX file; it was tested on a synthetic file with that layout, not on a file downloaded from MCX.
