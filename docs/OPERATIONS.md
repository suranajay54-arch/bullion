# Operating guide (one page)

## What runs by itself

- **Twice a day** (about 21:11 and 08:11 IST) GitHub runs "Build and publish": it downloads the ECB
  rates, checks every file you maintain, runs 42 audit tests and republishes the site. If any
  file you edited is invalid, the run stops and the previous site stays online.
- **After each publish** "Check the live site" opens the site in a desktop browser and an Android
  phone emulation, runs the page's own tests and saves screenshots (Actions tab > the run >
  Artifacts > live-site-check).
- **In every visitor's browser** each input's state (SNAPSHOT, STALE, UNAVAILABLE) is recomputed
  when the page opens, so a stale page announces itself even if the daily job stops.

## What you do, and when

| When | Task | Time | How |
|---|---|---|---|
| 1st and 3rd Thursday evening (or Friday morning) | Add the customs exchange rate | 2 min | Open [ICEGATE](https://foservices.icegate.gov.in/#/services/viewExchangeRate) > **View Exchange Rate Notifications** > **Download PDF** on the newest line (no login or captcha). The PDF gives the notification number, the "w.e.f." date and the US Dollar row. On GitHub open `data/manual/customs-fx.csv`, click the pencil, add one line at the bottom, for example `2026-10-02,USD,<Rate Import>,<Rate Export>,2026-10-01,OWNER-ENTERED,https://foservices.icegate.gov.in/#/services/notifyPublishScreen,Jay,<today>,ICEGATE Exchange Rate Notification No. <number> w.e.f. 02-10-2026` then "Commit changes". A notification listed the day before that only repeats the previous rates needs no line. |
| Around the 15th and the last day of each month, and when news reports a revision | Add the new tariff-value notification | 5 min | Find the notification on the CBIC or a customs zone website. Open `data/registry/cbic-tariff-values.json`, copy the last entry, paste it below, change the number, dates, gold and silver figures and link, set `"verification"` to `VERIFIED` (official site) or `PRIMARY COPY` (other copy), and update `lastReviewed` to today. If no new notification was issued on a scheduled date, only update `lastReviewed`. |
| Weekly | Glance at the Actions tab | 1 min | A green tick means published. A yellow "warning" lists what needs attention (usually one of the two tasks above). A red cross means a file you edited has a mistake: the run page names the file and line. |
| When MCX launches new contract months | Add them to the calendar | 3 min | `data/registry/mcx-contracts.json`, `contracts` list: product, month, expiry and where you read it. |
| When a duty or DGFT notification changes | Update the rules | 10 min | `data/registry/duty-rules.json`: close the old rule with `effectiveTo`, add the new one with its citation id (add the citation to `data/registry/citations.json`). |
| Before 60 days pass with no edits | Keep the daily job alive | 1 min | Any commit counts (the fortnightly customs rate is enough). If GitHub has paused the schedule, Actions > Build and publish > Enable workflow. |

## What the warnings mean

| Warning in the build log | Meaning | Fix |
|---|---|---|
| ICEGATE-ERAM: no customs exchange rate for the ERAM fortnight in force today | The rupee duty legs are withheld (or STALE for up to 16 days) | Add the rate as above |
| CBIC-TV: a scheduled tariff-value revision was due | The tariff value is marked STALE on the site | Add the notification or update `lastReviewed` |
| ECB-EXR: fetch failed | The ECB file could not be downloaded; the last good rates are kept and age visibly | Nothing, unless it repeats for several days |
| CBIC-TV: document not retrievable this run | A document link could not be opened for its fingerprint check; values are unaffected | Nothing, unless a link is permanently dead: then replace it |
| MCX-SPEC: listed expiry differs from the rule-computed date | Probably an exchange holiday | Check the MCX circular and keep the listed date |

## Troubleshooting

- **Expired token.** Stage 1 uses no tokens. If you later add Kite Connect for a private view, its
  access token expires at 6 AM every day by regulation; log in again through Zerodha's login page.
  A lapsed token never affects the public site.
- **Changed bhavcopy format.** If MCX renames columns, loading the file (in the browser or in
  `data/inbox/mcx/`) stops with "Bhavcopy format not recognised: missing ..." and names the missing
  columns. Nothing is guessed. Send the new header line to whoever maintains the code; the column
  names live in `src/engine/07-parsers.js` (BHAV_REQUIRED).
- **Market closed.** Weekends and TARGET holidays produce no ECB rate; the last rate stays SNAPSHOT
  until the next business day's publication is due. MCX holidays are not loaded, so on an Indian
  exchange holiday a visitor's entry dated the previous day may show a 1-day-lag warning.
- **Stale values.** A STALE badge means a newer value was due and is missing. Check the Evidence
  panel's build log for the reason, then the Actions tab. Stale values are shown with their own
  dates; they are never presented as current.
- **Missing citations.** Items marked CITATION PENDING are listed under "Not shown as fact" in the
  replay and in docs/METHODOLOGY.md section 16. To add one, put the document in
  `data/registry/citations.json` with its URL and verification state and reference its id.
- **Failed mobile load.** The page is readable even with scripts off. If a phone shows only the
  static version with a red note, the note names the error; open the Evidence panel on a computer
  and run the tests. In-app browsers (WhatsApp, LinkedIn) sometimes block scripts: use "Open in
  Chrome". A blank screen should not happen: report it with the phone model.
- **A red cross on the Actions tab.** Open the failed run; the step "Build the data snapshot" lists
  lines starting with FATAL. Fix that file (usually a typo in a date or number) and commit again.

## Supplying a secret later (only if you add a paid feed)

Never paste a key or password into a chat, an email or a file in the repository. On GitHub go to
the repository's Settings > Secrets and variables > Actions > New repository secret, give it the
name the code expects, and paste the value there. GitHub encrypts it and hides it from logs. The
site's code runs in visitors' browsers and never sees secrets.
