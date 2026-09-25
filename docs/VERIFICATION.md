# Verification record (25 Sep 2026)

## What was run

| Check | Environment | Result |
|---|---|---|
| Node audit suite (`node tests/run-tests.js`): T01-T22 ported from Build 2.0.0, N01-N16 new, P01-P04 pipeline | Node 22, deterministic snapshot built from the ECB fixture | **42 of 42 pass** (N15 also checked the exchange-price legs with the owner's private reference file present) |
| Browser check (`tests/e2e_check.py --interact`) on the built site served over HTTP | Chromium 141, desktop 1366 x 900 | 38 of 38 checks pass |
| Same | Android phone emulation: Playwright "Pixel 7" profile (412 x 839 CSS px, device scale 2.625, touch, Chrome for Android 141 user agent) | 38 of 38 checks pass |
| Same | Android phone emulation with JavaScript switched off | 12 of 12 checks pass (static snapshot readable, all 7 panels present) |
| Outage drill: ECB and every document host unreachable, no previous snapshot | Pipeline and page | Pipeline exits normally, logs the errors, USD/INR shown as UNAVAILABLE with reasons; browser check 76 of 76 pass |
| Bad edits: tariff value 13.73, customs rate "abc" | Pipeline (P02) | Run stops with exit code 1, no snapshot written, live site would be unchanged |

Each browser profile checked: readable text at first paint (no blank screen); the app boots; the
in-page audit tests (38) pass in that browser; every panel renders interactively and alone; no
"null", "undefined" or "NaN" text; demo mode is labelled SYNTHETIC and leaving it restores public
data; no request to any other host; no failed or 4xx/5xx request; no console or page errors. With
interaction: a visitor benchmark computes the benchmark leg, rupee duty stays withheld without a
customs rate, a customs rate of 96.80 gives duty Rs 19,935.96 per 10 g, the CSV export carries the
watermark, the USER-ENTERED token and the provenance section, a bhavcopy file is parsed in the
browser (4 bullion futures rows from a synthetic test file), and "Clear all my entries" restores
the public state.

Screenshots (build/e2e/, delivered separately): desktop and Android for every panel, the full
parity and corridor pages, the demo, the basis panel with visitor entries, and the no-JavaScript
static page.

## What was not verified

1. **The published URL.** Nothing was deployed: this environment has no access to your GitHub
   account, and it cannot reach github.io addresses. The workflow "Check the live site" runs the
   same browser check against the real address after your first publish.
2. **A physical Android phone.** Only Chrome's engine with an Android phone profile was used. Real
   handsets differ in fonts, in-app browsers (WhatsApp, LinkedIn) and data-saver modes.
3. **GitHub Actions itself.** The workflow files were validated as YAML and every step was run
   locally, but not on GitHub's runners. The action versions (checkout v4, setup-node v4,
   configure-pages v5, upload-pages-artifact v3, deploy-pages v4, setup-python v5,
   upload-artifact v4) could not be checked against GitHub from here.
4. **Live ECB download.** This environment's network blocks ecb.europa.eu, so the ECB adapter was
   tested on a saved copy of the 10 to 24 Sep 2026 values. The first GitHub run will be the first
   live download; if it fails, the log says so and the site shows USD/INR as UNAVAILABLE rather
   than guessing.
5. **Document fingerprints.** The optional SHA-256 check of the CBIC documents could not reach the
   document hosts from here; hashes are recorded by the first GitHub run that can.
6. **Real bhavcopy files.** The parser follows column names from a secondary description of the
   MCX file; it was tested on a synthetic file with that layout, not on a file downloaded from MCX.
