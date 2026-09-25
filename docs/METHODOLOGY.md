# India Bullion Parity & Corridor Intelligence: methodology and provenance

Build 3.0.0 | config cfg-2026.09.25.1 | formulas F-3.0 | snapshot schema ibpci.snapshot/1 | demo sample syn-2026.09.23.1
Written 25 Sep 2026; replaces the Build 2.0.0 note (offline single-file dashboard, formulas F-2.0). DAILY SNAPSHOT, NOT LIVE.

Build 3.0.0 is a public educational website rebuilt from a daily data snapshot. `pipeline/run.js` fetches the only automated source (ECB reference rates), validates every registry and manual file and writes the snapshot, which `pipeline/build.js` prerenders into every panel; `tests/run-tests.js` runs the audit suite. Builds run at 21:11 and 08:11 IST, on every change and on demand; an invalid file or a failed test stops the run and the last good site stays online. The Content Security Policy (`default-src 'none'`, `script-src 'self'`, `connect-src 'none'`) blocks every network call, so visitor entries stay in the browser. COMEX and MCX prices are not published. No composite score, tightness index, prediction, forecast, trading signal or executable-arbitrage claim appears anywhere. The code and registries are the source of truth; corrections are recorded where they arise.

## 0. Information states, freshness and lineage

Every value is a node with value, status, flags, freshness and lineage (inputs, records, sources, citations, observation times, formula). Verification (the evidence behind a value) and freshness (how current it is) are separate dimensions.

### 0.1 Verification ladder

| State | Meaning |
|---|---|
| VERIFIED | Primary document read on an official host. |
| PRIMARY COPY | Full primary text read on a third-party copy; official host not reachable. |
| SECONDARY | Named secondary source; primary not located. |
| CITATION PENDING | From the earlier evidence brief; no document located. Never shown as fact. |
| OWNER-ENTERED | Entered by the site owner from a named official source (admin file). |
| USER-ENTERED | Typed or loaded by the visitor; local to that browser, never uploaded. |
| ASSUMPTION | An editable cost or financing assumption. |
| SYNTHETIC | Demonstration value: demo mode and test fixtures only. |
| DERIVED | Computed; the label shows the weakest class of input. |
| PROBABLE | Pending professional confirmation (GST base, rate and ITC; an inferred notification row; a rule-computed expiry). |
| PLACEHOLDER | Not documented for this date; excluded, exported as null, never zero. |
| UNAVAILABLE | A known gap that must not be estimated. |
| INVALID | A rejected entry (not a number, infinite, negative, bad date, percentage outside 0 to 100) or an undefined result; shown as INVALID INPUT, never defaulted. |

### 0.2 Freshness

LIVE and DELAYED are reserved for licensed feeds and unused: nothing is live. SNAPSHOT: a dated observation that is the newest its source cadence implies. STALE: an older observation kept visible because a newer one was due, never rolled forward as current. UNAVAILABLE: no usable observation; the value is withheld. Values without a market time carry N/A.

### 0.3 Propagation

Implemented once (`mkDerived`, `src/engine/03-core.js`); badges, watermarks and export flags are computed from the nodes shown, never by hand.

- Any SYNTHETIC ancestor: DERIVED FROM SYNTHETIC INPUTS.
- DERIVED FROM VERIFIED INPUTS only when every evidence-bearing input is VERIFIED (no PRIMARY COPY, SECONDARY, CITATION PENDING, OWNER-ENTERED, USER-ENTERED, ASSUMPTION or SYNTHETIC ancestor); a result is never VERIFIED itself.
- Otherwise DERIVED plus a badge per weaker input class (USER-ENTERED, OWNER-ENTERED, ASSUMPTION, PRIMARY-COPY or SECONDARY INPUT; CITATION PENDING). A PROBABLE ancestor adds a PROBABLE badge.
- Freshness is the worst of the inputs (STALE beats SNAPSHOT).
- A missing input withholds the output (INVALID, else PLACEHOLDER, else UNAVAILABLE), carrying root causes through every level: "Withheld: requires Customs exchange rate (No ICEGATE rate recorded)".
- A coherence rule (1.4) can withhold an output whose inputs are present, stating the rule.

### 0.4 Typed record contract

Time-varying figures arrive as typed records (`src/engine/05-records.js`): `{ id, kind, value, unit, metal, contract, expiry, date, observedAt, publishedAt, retrievedAt, effectiveFrom, validTo, sourceId, url, document, terms, verification, rawSha256, derivation: { formulaId, formulaVersion, inputs[] }, note }`. `observedAt` (market or in-force time) is never replaced by `retrievedAt` (when the pipeline fetched or read it; P01). ECB rates are observed at 14:15 Europe/Berlin with the SHA-256 of the file; the USD/INR cross records its derivation (F-FX-01, F-3.0, two ECB record ids). Tariff values and customs rates are observed at 00:00 IST on the effective date and carry `validTo`. Visitor entries (USER-ENTERED) state their assumed time and never enter the snapshot.

### 0.5 Freshness rules per source

Freshness is re-evaluated in the browser at view time (for a past valuation date, as at 23:59 IST that day), so a page not rebuilt for days shows STALE by itself. Times are held in UTC and shown in IST with the source zone alongside (N09).

- `businessDaily`: SNAPSHOT until the next business day's publish time plus grace hours, then STALE; never UNAVAILABLE by age. TARGET closes weekends, 1 Jan, Good Friday, Easter Monday, 1 May, 25 and 26 Dec; WEEKDAYS ignores exchange holidays (not loaded).
- `cbicTariffSchedule`: SNAPSHOT before a later notification or the next scheduled in-force date (the 1st or 16th after the later of the effective date and `lastReviewed`); STALE from 00:00 IST on that date unless the registry has been reviewed; UNAVAILABLE after 16 more days.
- `eramSchedule`: SNAPSHOT inside the row's fortnight; STALE for 16 days after it; then UNAVAILABLE.
- `maxAgeDays`: STALE when older than the stated days. `none`: SNAPSHOT while in force.

| Source | Access and public display | Stale rule |
|---|---|---|
| ECB-EXR, USDINR-ECB-CROSS | Automated, derived; allowed with attribution | businessDaily, TARGET, 16:00 Europe/Berlin + 20 h |
| CBIC-TV | Registry; allowed (Gazette matter) | cbicTariffSchedule |
| ICEGATE-ERAM | Owner file each fortnight; allowed as one official rate with attribution | eramSchedule |
| DUTY-RULES; MCX-SPEC | Registries; allowed | none; maxAgeDays 60 |
| MCX-SETTLE | Owner or visitor file; blocked, rights not confirmed | businessDaily, WEEKDAYS, 23:59 IST + 30 h |
| COMEX-SETTLE | Visitor or owner file; blocked, CME licence required | businessDaily, WEEKDAYS, 15:00 New York + 30 h |
| LOCAL-COSTS | Owner file or visitor; none supplied | maxAgeDays 90 |
| VISITOR | Local only | businessDaily, WEEKDAYS, 23:59 IST + 30 h |
| KITE; SYN-DEMO | Not connected (terms forbid public display); demo only | none |

Failure handling: a failed ECB fetch (3 attempts) or parse carries the previous snapshot's observations forward (P04); a date missing a EUR leg gets no cross; a bad registry or manual file stops the run (P02). Scheduled builds can be delayed or dropped, and stop after 60 days without repository activity (C-GH-ACTIONS-SCHEDULE); view-time freshness exposes the lapse.

## 1. Parity formula chain (Module 1)

Units: 1 troy oz = 31.1034768 g. Gold is compared in INR/10g, silver in INR/kg, everywhere.

F-FX-01, market USD/INR = ECB EUR/INR / ECB EUR/USD for the same ECB date. It is a modification of ECB data, labelled as such; not FBIL (the Indian benchmark, whose reuse terms could not be read) and not a tradable quote. The newest ECB date on or before the valuation date is used; built from two VERIFIED leaves, the cross is DERIVED FROM VERIFIED INPUTS.

### 1.1 Formula chain (registry F-3.0)

```
F-M1-01 Benchmark INR/g        = benchmark (USD/troy oz) x USDINR / 31.1034768
F-M1-02 Benchmark value        = INR/g x 10 (gold) or x 1,000 (silver)
F-M1-03 Duty base              = CBIC tariff value (USD per 10 g gold, per kg silver)
    x customs exchange rate for imports (ICEGATE ERAM) x (comparison grams / published
    grams); never back-solved from the benchmark, never market USD/INR
F-M1-04 BCD                    = duty base x BCD rate
F-M1-05 AIDC                   = duty base x AIDC rate
F-M1-06 Customs duty           = BCD + AIDC when the split is documented, or duty base
    x documented total rate (split stays PLACEHOLDER)
F-M1-22 Customs duty in USD    = tariff value x total rate x (comparison grams /
    published grams); needs no exchange rate
F-M1-21 Landed before local costs = benchmark + customs duty
        Freight/insurance, assay/refining, local handling: inputs per comparison unit
F-M1-07 Financing              = (benchmark + customs duty) x annual rate x days / 365
F-M1-08 Pre-GST landed         = benchmark + duty + freight/insurance + assay/refining
    + financing + handling
F-M1-09 GST base (PROBABLE)    = selected methodology assumption (section 4)
F-M1-10 GST cash (PROBABLE)    = GST base x GST rate (3% default)
F-M1-11 Gross cash landed      = pre-GST landed + GST cash
F-M1-12 Recoverable ITC        = GST cash x recoverable share, only when the eligible-ITC
    assumption is switched on; otherwise nothing is subtracted
F-M1-13 Net economic landed    = gross landed - recoverable ITC
F-M1-14 MCX INR/g              = native quote / grams per quotation unit
F-M1-15 MCX standardized quote = MCX INR/g x comparison grams
F-M1-16 Lot notional           = native quote x lot multiplier
F-M1-17 Modeled basis          = standardized quote - selected landed view
    (positive: the quote sits above the modeled landed value)
F-M1-18 Modeled basis %        = modeled basis / selected landed view
F-M1-19 Paper edge             = normal-route duty - corridor duty (same duty base);
    rate wedge = normal total rate - corridor total rate
F-M1-20 Counterfactual duty    = benchmark x effective duty rate (incorrect method, shown
    only to size the error)
F-M1-23 Carry to expiry        = selected landed view x financing rate x days from the
    valuation date to expiry / 365
F-M1-24 Basis net of carry     = modeled basis - carry to expiry
F-M1-25 Basis change           = change in quote - sum of Shapley contributions of the
    benchmark, market FX, customs FX with tariff value and duty rate, local costs and
    financing to the change in landed value
```

Modeled basis is descriptive. It is not labelled arbitrage and is not a signal; basis net of carry is not a mispricing measure. Calculations run on raw decimals; only the display rounds (2 dp for per-unit INR, 0 dp for notionals). Totals are sums of unrounded legs, so displayed legs can differ from displayed totals by rounding (test T19). Without a customs rate, F-M1-22 still shows while F-M1-03 to F-M1-06 and everything downstream are withheld (N03).

### 1.2 Landed views

EX_COSTS (F-M1-21) is the default, used when local cost assumptions are not supplied; it is labelled as excluding freight, assay, handling and financing. PRE_GST (F-M1-08) is customs-only (a GST-registered buyer may take IGST as input credit, PROBABLE); GROSS (F-M1-11) adds GST; NET (F-M1-13) equals gross unless the eligible-ITC assumption is on. With no owner cost defaults, PRE_GST, GROSS, NET and carry to expiry are withheld until the visitor enters costs.

### 1.3 Futures basis, physical basis and decomposition

The contract basis (MCX futures standardized by F-M1-14 and F-M1-15) and the physical basis (a visitor's IBJA or dealer quote) are computed separately and never substituted for each other. Carry to expiry applies to the futures basis only; the physical basis warns when the benchmark is a COMEX contract month. F-M1-25 splits a change in contract basis into the change in the quote and, with a minus sign, the Shapley contribution (F-M3-08) of each landed group (benchmark; market USD/INR; customs rate, tariff value and duty rate; local costs; financing; EX_COSTS uses the first three). It is order-independent, sums exactly (T17, N14) and is not causal.

### 1.4 Coherence and pairing rules

From `THRESHOLDS`; tested by N07 and N08.

- Market inputs more than 12 hours apart: warning; more than 72 hours apart: basis withheld (the Parity panel only warns; the spread engine withholds the raw spread).
- A market input more than 1 business day older than the valuation date: warning.
- Contract past expiry on the valuation date: basis withheld. Valuation date inside the tender period, or a rule-computed expiry: warning.
- Generic benchmark, or a benchmark month different from the MCX month (GCZ26 against GOLD Oct 2026): term-structure warning.

Every market input carries its observation time into these checks: the ECB reference rates (14:15 Frankfurt time on their date), the visitor's benchmark, MCX and physical quotes. Registry inputs (tariff value, customs rate, duty rules) are checked by their validity dates instead.

### 1.5 Reference reconciliation, 24 Sep 2026 (test N15)

ECB EUR/USD 1.1367 and EUR/INR 109.0775 give USD/INR 95.9598 (FBIL on the RBI homepage: 95.8918 at 1.00 pm on 25 Sep 2026, for orientation only). Tariff value 75/2026: gold US$1,373 per 10 g, silver US$2,028 per kg; at 15% the duty is US$205.95 per 10 g and US$304.20 per kg. The customs rate in force from 18 Sep 2026 is 96.80 (ICEGATE Exchange Rate Notification No. 27/2026, VERIFIED), so the gold duty base is Rs 1,32,906.40 per 10 g and the duty Rs 19,935.96; for silver, Rs 1,96,310.40 and Rs 29,446.56 per kg. The test's COMEX price stays in the fixture: exchange prices are not published.

## 2. The duty base is the CBIC tariff value, not the benchmark

Indian customs duty on gold and silver is assessed on the CBIC notified tariff value (revised roughly fortnightly), not on the global transaction price. The global benchmark establishes market parity; the tariff value establishes the duty base. The model keeps them as two separate inputs, converts the USD tariff value at the customs exchange rate for imports (a separate input from market USD/INR), and never back-solves the tariff value from COMEX: test T14 moves COMEX and asserts that duty does not move. The Parity panel also sizes the error a calculator makes by applying the duty rate to the benchmark (F-M1-20), shown as a counterfactual, never as a result. Statutory structure referenced: Customs Act, 1962, s.14 (tariff values fixed under s.14(2); rate of exchange determined by the Board).

### 2.1 Customs exchange rate: ICEGATE ERAM

Customs exchange rates have not been notified since 4 Jul 2024: under Circular 07/2024-Customs they are published through ICEGATE's Exchange Rate Automation Module (PIB release, C-PIB-ERAM, VERIFIED) on the evening of the 1st and 3rd Thursday, in force from 00:00 IST the next day (4 and 18 Sep, 2 and 16 Oct 2026; N05). ICEGATE's date lookup needs a captcha, but its list of exchange-rate notifications (View Exchange Rate Notifications) needs neither login nor captcha and gives each notification as a PDF with its in-force date. ICEGATE documents no data feed, so the owner copies the unrounded US Dollar import rate into `data/manual/customs-fx.csv` each fortnight (OWNER-ENTERED); an invalid row stops the pipeline. Rows for 19 Jun to 1 Oct 2026 were read from ICEGATE notifications 18/2026 to 27/2026 on 25 Sep 2026 (VERIFIED): 95.30, 95.20, 97.20, 96.05, 96.50, 95.25 and 96.80. ICEGATE sometimes also lists a notification the day before a new one that only repeats the previous rates (20/2026, 21/2026, 26/2026); those need no row. A missing fortnight withholds the rupee duty legs (duty base, BCD, AIDC, duty, rupee paper edge and landed values), never back-filled from market USD/INR (N03); the USD duty still shows.

### 2.2 Tariff values

`data/registry/cbic-tariff-values.json` holds one entry per Customs (N.T.) notification (gold in US$ per 10 g, silver in US$ per kg), continuous from 60/2026 because each notification's "last amended vide" clause names the previous one. Before 1 Jul 2026 the value is UNAVAILABLE (N02).

Each notification is in force the day after it is dated; PRIMARY COPY rows were read on caalley.com.

| Notification | In force | Gold | Silver | Verification |
|---|---|---|---|---|
| 60/2026 | 1 Jul 2026 | 1,297 | 1,875 | PRIMARY COPY |
| 63/2026 | 16 Jul 2026 | 1,311 | 1,869 | PRIMARY COPY |
| 68/2026 | 1 Aug 2026 | 1,323 | 1,875 | PRIMARY COPY |
| 69/2026 | 11 Aug 2026 | 1,395 | 2,076 | PRIMARY COPY, ad hoc |
| 70/2026 | 15 Aug 2026 | 1,407 | 2,097 | PRIMARY COPY |
| 71/2026 | 26 Aug 2026 | 1,500 | 2,097 | PRIMARY COPY, ad hoc, gold only |
| 72/2026 | 1 Sep 2026 | 1,468 | 2,267 | PRIMARY COPY |
| 75/2026 | 16 Sep 2026 | 1,373 | 2,028 | VERIFIED, official Chennai customs copy (F.No. 467/01/2026-Cus.V) |

Last reviewed 25 Sep 2026 (nothing after 75/2026); the next scheduled revision is in force from 1 Oct 2026. The "(i.e., no change)" marker is unreliable: 72/2026 and 75/2026 print it next to silver although silver changed, so both numbers are copied from the text. Implausible values stop the pipeline (P02).

### 2.3 "Notification 27/2026 customs FX 96.80": the working note was right

ICEGATE numbers its exchange-rate notifications in a series of its own. ICEGATE Exchange Rate
Notification No. 27/2026, published 17 Sep 2026 and in force from 18 Sep 2026, gives the US Dollar at
96.80 for imports and 95.10 for exports, exactly as the working note said. An earlier version of this
section called the figure wrong because it read "27/2026" as Customs (N.T.) 27/2026, which is a
tariff-value notification dated 19 Mar 2026 (gold 1568, silver 2820). The site now uses 96.80 as
VERIFIED for the fortnight 18 Sep to 1 Oct 2026.

## 3. BCD, AIDC and the total-rate fallback

Rates live in one dated registry (`data/registry/duty-rules.json`). With both BCD and AIDC documented, duty = duty base x BCD + duty base x AIDC, checked to sum to the total (T03). Otherwise BCD and AIDC stay PLACEHOLDER (never zero) and duty = duty base x the documented total (T15). A date without a rule is PLACEHOLDER; a SYNTHETIC scenario override always uses the total-rate path.

| Rule | Route | In force | BCD + AIDC = total | Verification | Citations |
|---|---|---|---|---|---|
| R23-NORMAL | Normal | 2 Feb 2023 to 23 Jul 2024 | 10% + 5% = 15% | VERIFIED | C-CUS-02-2023, C-CUS-03-2023, C-CUS-04-2023, C-TRU-2023 |
| R24-NORMAL | Normal | 24 Jul 2024 to 12 May 2026 | 5% + 1% = 6% | VERIFIED | C-CUS-30-2024, C-CUS-32-2024, C-TRU-2024 |
| R26-NORMAL | Normal | from 13 May 2026 | 10% + 5% = 15% | PRIMARY COPY | C-CUS-15-2026, C-CUS-16-2026, C-CUS-45-2025 |
| RC-SILVER-FY24 | CEPA silver | 1 Apr 2023 to 31 Mar 2024 | total 8% | SECONDARY | C-GTRI-45 |
| RC-SILVER-FY25 | CEPA silver | 1 Apr 2024 to 31 Mar 2025 | total 8% | SECONDARY | C-BS-JUL24-CEPA |
| RC-SILVER-FY27 | CEPA silver | 1 Apr 2026 to 31 Mar 2027 | total 7% | SECONDARY, unconfirmed | C-JURISHOUR-2026, C-JEWELBUZZ-2026, C-CUS-09-2026 |
| RC-GOLD-2023 | CEPA gold, in quota | 2 Feb 2023 to 23 Jul 2024 | 10% + 4% = 14% | VERIFIED | C-CUS-08-2023, C-DGFT-PN06-2015-20 |
| RC-GOLD-2024 | CEPA gold, in quota | 24 Jul 2024 to 12 May 2026 | 4% + 1% = 5% | VERIFIED | C-CUS-31-2024, C-DGFT-PN06-2015-20 |
| RC-GOLD-2026 | CEPA gold, in quota | from 13 May 2026 | 10% + 4% = 14% | PRIMARY COPY, PROBABLE | C-CUS-18-2026, C-CUS-22-2022, C-DGFT-PN06-2015-20 |

Normal-route rules cover gold and silver bars. CEPA silver for FY2025-26 has no rule (21/2025-Customs located, silver row not read). Only BCD and AIDC are modeled; the SWS exemption for 7106 and 7108 is in C-CUS-04-2023, extended by C-CUS-16-2026.

Corrections:

- February 2023 silver moved from 10.75% (7.5% BCD + 2.5% AIDC + 0.75% SWS) to 15% (C-TRU-2023), not from 10% to 15%; gold stayed at 15% (12.5% + 2.5% became 10% + 5%).
- The DGFT silver notification is 17/2026-27 (S.O. 2537(E), 16 May 2026), not 7/2026-27.
- CEPA silver FY2026-27 is 7% only per secondary sources (JurisHour, JewelBuzz); the primary table 09/2026-Customs was located but its silver row not read, and a one-point annual step-down from 8% in FY2024-25 would imply 6%. Whether AIDC applies on top is unconfirmed (B-G01).
- The in-quota row set to 10 + 4 by 18/2026-Customs (CEPA Table III S.No. 12) is identified as gold by inference (08/2023 and 31/2024 set the same cells), so it carries PROBABLE.

## 4. GST and ITC (PROBABLE, pending CA confirmation, not tax advice)

The gross-cash landed view includes GST at the selected rate on the selected base. The net economic view subtracts recoverable ITC only when the eligible-ITC assumption is explicitly enabled; otherwise nothing is subtracted and net equals gross (test T16). The base is a configurable methodology assumption, not an assertion of the statutory base; every parity export records it with the ITC toggle and the warning `PROBABLE - PENDING CA CONFIRMATION - NOT TAX ADVICE`.

| Option | GST base |
|---|---|
| AV_DUTY | Assessable value (tariff value x customs FX) + customs duty |
| AV_DUTY_FI | Assessable value + customs duty + freight/insurance |
| BENCH_DUTY_LANDED | Benchmark bullion value + customs duty + all landed additions |
| BENCH_ONLY | Benchmark bullion value only |

Seeded default: AV_DUTY. It mirrors the import-IGST valuation structure (Customs Tariff Act, 1975, s.3(7)-(8): assessable or tariff value plus customs duties), with no landed additions because the tariff value replaces transaction value. It remains PROBABLE until a CA confirms it, as does the 3% default rate. ITC is off by default. The pre-GST (customs-only) view is offered as the cleaner trading benchmark on the premise that a GST-registered buyer may take IGST as input credit.

## 5. Eligibility versus executability

Eligibility is the paper rate a lane qualifies for. Executability is whether the lane can be used: licences and authorisations, quota allocations, litigation, origin and documentary requirements. They are stored in separate fields, shown in separate columns and badges, and never merged into one number; the paper edge (F-M1-19) is always shown beside its flag. STANDARD ROUTE is the default treatment of the normal route (PROBABLE: channel conditions are not modeled and no executability document is cited); IN USE is inferred from flows, not from quota or origin records; NOT STATED means nothing documented. Each dated `exec` entry has a `knowableFrom` date, so the replay cannot show later evidence early; where entries overlap, the later one applies once knowable.

| Route, metal | In force | Knowable from | Flag, verification | Citations |
|---|---|---|---|---|
| Normal, gold | from 2 Feb 2023 | 2 Feb 2023 | STANDARD ROUTE, PROBABLE | none |
| Normal, silver | 2 Feb 2023 to 15 May 2026 | 2 Feb 2023 | STANDARD ROUTE, PROBABLE | none |
| Normal, silver | 16 May to 1 Jun 2026 | 16 May 2026 | LICENCE-GATED, PRIMARY COPY | C-DGFT-17-2026-27, C-DGFT-03-2026-27 |
| Normal, silver | from 2 Jun 2026 | 2 Jun 2026 | LICENCE-GATED, PRIMARY COPY | C-DGFT-17-2026-27, C-DGFT-19-2026-27 |
| CEPA silver | 1 Apr 2023 to 23 Jul 2024 | 8 Apr 2024 (SECONDARY), 17 Jun 2024 (PRIMARY COPY) | IN USE | C-REUTERS-FEB24, then C-GTRI-45 |
| CEPA silver | 24 Jul 2024 to 12 May 2026 | 25 Jul 2024 | NOT STATED, SECONDARY | C-BS-JUL24-CEPA |
| CEPA silver | 13 to 15 May 2026 | 13 May 2026 | NOT STATED, PLACEHOLDER | none |
| CEPA silver | from 16 May 2026 | 16 May 2026 | LICENCE-GATED, PRIMARY COPY | C-DGFT-17-2026-27, C-DGFT-19-2026-27 |
| CEPA gold quota | 2 Feb 2023 to 30 Jun 2026 | 1 May 2022, 9 Jan 2025 | CONSTRAINED, VERIFIED | C-DGFT-PN06-2015-20, C-CUS-43-2022, then C-DHC-MANJALLY |
| CEPA gold quota | 1 Jul to 30 Sep 2026 | 6 Jul 2026, 25 Sep 2026 | CONSTRAINED, PRIMARY COPY | C-DGFT-PN18-2026-27, C-DGFT-PN53-2025-26, then C-DGFT-LISTINGS |
| CEPA gold quota | from 1 Oct 2026 | 25 Sep 2026 | NOT STATED, PRIMARY COPY | C-DGFT-PN18-2026-27, C-DGFT-LISTINGS |

- Correction: normal-route silver has also been LICENCE-GATED since 16 May 2026 (Build 2.0.0 showed it as OPEN with a note; the normal route is now shown as STANDARD ROUTE before 16 May 2026): the DGFT curbs (17/2026-27 on bars; 19/2026-27 on unwrought, powder and grain, including through nominated agencies and IIBX) apply to the goods whatever their origin.
- CEPA gold quota: FY2025-26 permits were extended to 30.09.2026 (PN 18/2026-27, gazetted 6 Jul 2026); no FY2026-27 allocation was found up to 25 Sep 2026, so from 1 Oct 2026 the flag is NOT STATED.

On 25 Sep 2026 the US dollar paper edge is US$13.73 per 10 g for CEPA gold (CONSTRAINED) and US$162.24 per kg for CEPA silver (LICENCE-GATED).

## 6. MCX contract specifications, calendar and bhavcopy

Specifications come from `data/registry/mcx-contracts.json` with their verification: MCX circulars read on copies (PRIMARY COPY) or broker pages (SECONDARY). Lot size and quotation unit are different concepts. Normalization runs from the native quote to INR per gram to the comparison unit; notional = native quote x multiplier; multiplier = lot grams / quotation grams (T02). Ticks are Re 1 per quotation unit.

| Contract | Lot | Quote per | Mult. | Quality | Expiry | Verification | Citation |
|---|---|---|---|---|---|---|---|
| GOLD | 1 kg | 10 g | x100 | 995 | 5th | PRIMARY COPY | C-MCX-TRD-040-2026 |
| GOLDM | 100 g | 10 g | x10 | 995 | 5th | PRIMARY COPY | C-MCX-TRD-041-2026 |
| GOLDGUINEA | 8 g | 8 g | x1 | 999 or 995 | last day | SECONDARY | C-DHAN-GOLDGUINEA |
| GOLDPETAL | 1 g | 1 g | x1 | 999 | last day | SECONDARY | C-MCX-SPEC-PETAL-2019 |
| SILVER | 30 kg | 1 kg | x30 | 999 | 5th | SECONDARY | C-DHAN-SILVER |
| SILVERM | 5 kg | 1 kg | x5 | 999 | last day | SECONDARY | C-MCX-TRD-372-2019 |
| SILVERMIC | 1 kg | 1 kg | x1 | 999 | last day | PRIMARY COPY | C-MCX-TRD-275-2025 |

Sources conflict on GOLDGUINEA quality and the SILVERM delivery unit; fineness differences are not adjusted. Expiry: the 5th of the month or the last calendar day, the preceding working day if a holiday. Tender period: the last 3 trading days including expiry, staggered delivery (MCX/TRD/383/2025, PRIMARY COPY).

Listed months (SECONDARY unless stated): GOLD Oct 2026, 5 Oct (Zerodha, IIFL); GOLD Dec 2026, 4 Dec (Groww); GOLDM Oct 2026, 5 Oct (Zerodha); GOLDM Nov 2026, 5 Nov (IIFL); SILVER Dec 2026, 4 Dec (Dhan); SILVERMIC Nov 2026, 30 Nov; SILVER Mar 2027, 5 Mar 2027 (PRIMARY COPY, MCX/TRD/090/2026).

The MCX holiday calendar is not loaded, so rule dates roll back over weekends only and every rule-computed expiry and tender start is PROBABLE; the pipeline warns when a listed date differs from the rule. Unlisted months are computed only within each product's listing cycle (GOLD: even months; GOLDM, GOLDGUINEA, GOLDPETAL: monthly; SILVER: Mar, May, Jul, Sep, Dec; SILVERM and SILVERMIC: Feb, Apr, Jun, Aug, Nov). The cycles come from general market knowledge, not a located circular, so such months are PROBABLE.

Bhavcopy parsing: a visitor's file is read in the browser and never uploaded; owner files in `data/inbox/mcx/` are hashed and withheld while display rights are off (P03). Column names follow a secondary source (C-BHAAVBRIEF); date, symbol, expiry and close (or settlement) are required, and a changed format is rejected with the missing columns named, never guessed (N12). Only bullion futures rows are kept.

## 7. Calendar spread, day count, fair carry and hypothetical margin (Module 2)

Expiries come from the contract calendar, not sample dates. GOLD Oct 2026 (expiring 5 Oct) to GOLD Dec 2026 (expiring 4 Dec) is 60 days; from 24 Sep 2026 the near expiry is 11 days away (N10). Leg prices are visitor entries or bhavcopy rows.

```
Day count: calendar days, ACT/365. Validation: valuation date <= near expiry < far expiry.
  spreadDays = far expiry - near expiry; days to each expiry are shown.
Direction:  buy near / sell far = far - near; sell near / buy far = near - far
            (exact sign opposites before costs; test T07).
  Annualized price carry       = directional spread / near x 365 / spreadDays
  Breakeven financing (Lens A) = (far - near) / near x 365 / spreadDays
  Rupee carry                  = directional spread x lot multiplier x lots
  Leg notional                 = leg price x lot multiplier x lots
  Modeled fair carry (F-M2-23) = near price x financing rate x spreadDays / 365
  Observed minus modeled       = raw spread - modeled fair carry
  Outright margin per leg      = leg notional x hypothetical outright rate
  Exposure per leg             = leg notional x hypothetical exposure rate
  Gross outright margin        = both outright legs + both exposure legs
  Spread margin, direct        = max(notional) x direct spread-margin rate (when entered)
  Spread margin, offset        = max(0, near + far outright - min(near, far outright) x credit)
  Additional/special margin    = max(notional) x rate
  Broker buffer                = max(notional) x rate
  Blocked capital              = max(0, spread margin + both exposures + additional + buffer)
  Period return                = rupee carry / blocked capital
  Annualized return            = period return x 365 / spreadDays
  Financing cost               = blocked capital x financing rate x spreadDays / 365
  Net rupee carry              = gross rupee carry - financing cost
  Net annualized return        = net rupee carry / blocked capital x 365 / spreadDays
  Notional leverage            = near notional / blocked capital
  Lens A delivery-funded carry = rupee carry (buy near / sell far)
                                 - near notional x financing rate x spreadDays / 365
```

- Legs more than 72 hours apart withhold the raw spread and all that follows; legs more than 12 hours apart, a near contract in its tender period or a rule-computed expiry give warnings.
- Modeled fair carry (visitor's financing rate, else the owner's) excludes storage, insurance and delivery costs; observed minus modeled is descriptive, not a mispricing signal.
- Margin is strictly HYPOTHETICAL: no sourced MCXCCL margin rule is loaded and the page never shows an exchange or broker margin. It shows a sensitivity grid of blocked capital with the outright rate at 4, 6, 8 or 10% per leg against a spread credit of 0, 50 or 75% (exposure, additional margin and buffer at zero), and runs the full chain only on hypothetical rates the visitor types (USER-ENTERED).
- The gap between price carry and blocked-capital return is leverage, not extra return; capturing the carry needs the near leg taken to delivery and funded in full (Lens A), and a futures-only spread closed before near expiry realises the change in the spread, not the carry. Annualization magnifies short-period spreads and is not a forecast.

## 8. Replay rules (Module 3)

Release-lag time machine: each fact carries `knowableFrom`, the publication date of the cited document or, where the release date is not documented, the access date, 25 Sep 2026. A step, or any date chosen in the time machine, shows only facts knowable on that date, and derived checks, charts and executability entries follow the same rule. Rates are legally knowable from notification, so they show by date (step A5 uses rates in force on 31 Dec 2024). Where the only evidence located for a rate is a later publication (the FY2023-24 CEPA silver 8% shown on 29 Feb 2024 comes from GTRI's report of 17 Jun 2024), its citation appears in short form (publisher or document and date), so later figures do not leak. Series are never spliced, and contemporaneous movement is never read as causation. Build 2.0.0's Episode C shell is removed; its synthetic states feed only the demo decomposition and T17.

Steps: A0 2 Feb 2023 (normal-route silver to 15%; wedge PLACEHOLDER), A1 29 Feb 2024 (wedge 7 points, only rates knowable), A2 8 Apr 2024 (record February imports), A3 17 Jun 2024 (GTRI report), A4 24 Jul 2024 (Budget 2024 cut inverts the wedge), A5 25 Sep 2026 (hindsight, calendar-year series); B0 12 May 2026 (normal route at 6%), B1 13 May (15% restored), B2 16 May (DGFT restricts bars), B3 2 Jun (authorisation for other forms), B4 15 Jun (May imports at a three-year low), B5 23 Jul (June estimate), B6 2 Sep (UAE gold up 124.8%), B7 16 Sep 2026 (August rebound).

## 9. Provenance table: every replay fact

From `EPISODES` in `src/engine/01-config.js`; text facts are condensed.

| Id | Label | Period | Value as displayed | Status | Citation | Knowable from |
|---|---|---|---|---|---|---|
| A-F01 | Silver imported from the UAE, February 2024 | Feb 2024 | 939 tonnes | SECONDARY | C-REUTERS-FEB24 | 8 Apr 2024 |
| A-F02 | UAE to India silver imports | FY2022-23 | US$29.2 million | PRIMARY COPY | C-GTRI-45 | 17 Jun 2024 |
| A-F03 | UAE to India silver imports | FY2023-24 | US$1.74 billion | PRIMARY COPY | C-GTRI-45 | 17 Jun 2024 |
| A-F04 | Revenue loss attributed to the CEPA silver concession (GTRI) | FY2023-24 | Rs 1,010 crore | PRIMARY COPY | C-GTRI-45 | 17 Jun 2024 |
| A-F05 | After the July 2024 cut | Jul 2024 | the cut removed the CEPA incentive | SECONDARY | C-BS-JUL24-CEPA | 25 Jul 2024 |
| A-F06 | India imports from the UAE, HS 7106 (calendar year) | CY2023 | US$339.84 million (434,032 kg) | VERIFIED | C-WITS-2023 | 25 Sep 2026 |
| A-F07 | India imports from the UAE, HS 7106 (calendar year) | CY2024 | US$1.97 billion (2,463,050 kg) | VERIFIED | C-WITS-2024 | 25 Sep 2026 |
| A-F08 | Series caveat | none | series never spliced (section 10) | DERIVED | none | 25 Sep 2026 |
| B-F01 | DGFT 17/2026-27 (16 May 2026) | From 16 May 2026 | silver bars Restricted, all origins | PRIMARY COPY | C-DGFT-17-2026-27 | 16 May 2026 |
| B-F02 | DGFT 19/2026-27 (2 Jun 2026) | From 2 Jun 2026 | Import Authorisation for unwrought, powder, grain | PRIMARY COPY | C-DGFT-19-2026-27 | 2 Jun 2026 |
| B-F03 | India silver imports, May 2026 (all origins) | May 2026 | 33 tonnes (US$75.57 million) | SECONDARY | C-KITCO-MAY26 | 15 Jun 2026 |
| B-F04 | CEPA gold quota permits | FY2025-26 permits | extended to 30.09.2026 | PRIMARY COPY | C-DGFT-PN18-2026-27 | 6 Jul 2026 |
| B-F05 | India silver imports, June 2026 (estimate) | Jan to Jun 2026 | about 29 tonnes in June, from 747 tonnes in January | SECONDARY | C-BS-METALSFOCUS-2026 | 23 Jul 2026 |
| B-F06 | Gold imports from the UAE | Apr to Jun 2026 | US$3.14 billion | SECONDARY | C-ETV-GTRI-2026 | 2 Sep 2026 |
| B-F07 | Gold imports from the UAE | Apr to Jun 2025 | US$1.40 billion | SECONDARY | C-ETV-GTRI-2026 | 2 Sep 2026 |
| B-F08 | Interpretation limit | none | 1-point margin, not proof of quota use | DERIVED | none | 2 Sep 2026 |
| B-F09 | India silver imports, August 2026 (all origins) | Aug 2026 | US$1.02 billion (+127% year on year) | SECONDARY | C-KITCO-AUG26 | 16 Sep 2026 |
| B-F10 | UAE-only silver imports after May 2026 | From 13 May 2026 | UNAVAILABLE, never estimated | UNAVAILABLE | none | 25 Sep 2026 |
| B-F11 | FY2026-27 CEPA gold quota allocation | As of 25 Sep 2026 | no allocation notice found | SECONDARY | C-DGFT-LISTINGS | 25 Sep 2026 |

Evidence gaps (CITATION PENDING, never shown as fact): A-G01, UAE silver imports in February 2024 ("$719M" in the earlier brief; not found, needs a TradeStat query); A-G02, Aug to Dec 2024 ("~$157M"; not found); A-G03, the claim that the UAE barely refines silver and its volume was rerouted metal; B-G01, the silver row of 09/2026-Customs (located, not read). The earlier "~$119M" was found in no publication and is replaced by GTRI's Rs 1,010 crore (A-F04).

Derived checks, once knowable: silver wedge +7 points (29 Feb 2024), then minus 2; FY2024 / FY2023 = 59.6x; wedge x flow = US$121.8 million (an upper bound, not a duty estimate); CY2024 / CY2023 = 5.8x and US$800.59 per kg (DERIVED FROM VERIFIED INPUTS); Episode B silver wedge minus 1 then +8 points; gold in-quota wedge +1 point; UAE gold 2.2x.

## 10. Fiscal-year versus calendar-year series

GTRI's fiscal-year figures (April to March): UAE to India silver imports of US$29.2 million in FY2023 and US$1.74 billion in FY2024. WITS (UN Comtrade) calendar-year figures for HS 7106 from the UAE: US$339.84 million and 434,032 kg in 2023; US$1,971.90 million and 2,463,050 kg in 2024. These correct the earlier wording "$338M to $2.0bn", whose year labels were PLACEHOLDER. The series have separate ids and chart groups and are never spliced: "$29M in 2023 to $1.7bn in 2024" mislabels fiscal years as calendar years.

## 11. Placeholders and gaps

PLACEHOLDER: duty rules before 2 Feb 2023; the CEPA silver rate before 1 Apr 2023 and for FY2025-26; every CEPA silver BCD/AIDC split; CEPA silver executability 13 to 15 May 2026; blank hypothetical margin rates.

UNAVAILABLE, never estimated: COMEX and MCX prices, not displayed for rights reasons; physical quotes; local cost assumptions (not supplied); the MCX holiday calendar (rule expiries PROBABLE); tariff values before 1 Jul 2026; UAE-only silver imports after May 2026; an FY2026-27 CEPA gold allocation; MCXCCL margin parameters; gaps A-G01, A-G02, A-G03 and B-G01.

Below VERIFIED: normal-route STANDARD ROUTE flags (PROBABLE); CEPA silver 7%; the 2026 CEPA gold row (PROBABLE); tariff values 60/2026 to 72/2026 (PRIMARY COPY).

## 12. Limitations

1. Not live. The public site is rebuilt from a daily data snapshot. Nothing on it is tick data, and the build time is shown on every page.
2. Exchange prices are not published here. MCX display rights are not confirmed and a CME licence is required for COMEX prices, so both appear as UNAVAILABLE unless you enter or load your own in your browser. Those entries never leave your device.
3. USD/INR is a cross rate derived from ECB reference rates (a daily fixing at about 14:15 Frankfurt time), not FBIL and not a tradable quote.
4. The customs exchange rate is entered by the site owner from ICEGATE each fortnight. When it is missing for a date, the rupee duty legs are withheld rather than estimated from market USD/INR.
5. Tariff values are kept in a registry the owner updates when CBIC issues a notification. After a scheduled revision date passes without a registry review, the tariff value is marked STALE.
6. No trading signal, prediction, forecast, composite score or executable-arbitrage claim. Basis, carry and spreads are descriptive.
7. Margin figures are hypothetical sensitivities. No MCXCCL margin file or broker policy is loaded, and the calculator does not replicate SPAN risk arrays, tender-period margins or intraday changes.
8. Not legal, customs, investment or tax advice. The GST base, the 3% default rate and ITC treatment are PROBABLE pending CA confirmation.
9. Contract specifications come from MCX circulars read on copies and from broker pages; the MCX holiday calendar is not loaded, so a rule-computed expiry is PROBABLE.
10. Fineness differences between the benchmark, the tariff value and each MCX contract (995 vs 999) are not adjusted.
11. Only BCD and AIDC are modeled. Other levies, exemptions, cess changes or social welfare surcharge must be added to the duty registry.
12. Eligibility (the paper rate) is not executability. Licences, quotas, origin rules and channel conditions appear only as dated qualitative flags with citations.
13. Trade figures are as published by the cited source. Revisions are not tracked; the replay places each figure at its publication date, or at the access date when the release date is not documented.
14. Local costs are assumptions per comparison unit. Financing is simple interest, ACT/365, on benchmark plus duty.
15. Excluded unless entered: brokerage, exchange and clearing fees, GST on fees, CTT, stamp duty, slippage, delivery, storage and operational costs.
16. Your entries persist only in this browser (versioned local storage) and can be cleared at any time. The page blocks all network requests (Content Security Policy connect-src 'none').

## 13. Synthetic sample (demo mode only, not market data)

The values in `src/engine/02-demo.js` are used only in demo mode (`#demo/...`) and as test fixtures. Demo mode uses SYNTHETIC market inputs with the real duty rules and calendar, shows the banner `SYNTHETIC DEMO - NOT TODAY'S DATA`, watermarks every card with a synthetic ancestor, marks exports SYNTHETIC and saves nothing. The public snapshot never contains these values: the pipeline stops on a synthetic record, and T21 checks that no public record is synthetic or equal to a sample value.

Sample: COMEX gold US$4,600.00/oz, silver US$64.00/oz; USD/INR 90.00; customs rate 91.00; tariff value gold US$1,470.00 per 10 g, silver US$2,040.00 per kg; gold costs per 10 g: freight 40, assay 20, handling 25, financing 8% for 7 days; silver per kg: 450, 200, 250, 8% for 10 days.

Worked demo example, normal route (10% BCD + 5% AIDC), GST base AV_DUTY. Gold per 10 g: benchmark Rs 1,33,104.09; duty base Rs 1,33,770.00; duty Rs 20,065.50; landed before local costs Rs 1,53,169.59; pre-GST landed Rs 1,53,489.59; GST Rs 4,615.07; gross Rs 1,58,104.66; duty charged on the benchmark would be Rs 99.89 lower. Silver per kg: benchmark Rs 1,85,188.30; duty base Rs 1,85,640.00; duty Rs 27,846.00; pre-GST landed Rs 2,14,401.22; gross Rs 2,20,805.80.

## 14. Exports

Client-side downloads only. Filename `module-subject-YYYYMMDD-HHMMSS-TOKEN.csv|json` (viewer's local time); TOKEN is the first that applies: SYNTHETIC, UNAVAILABLE or PLACEHOLDER (every value withheld), USER-ENTERED, STALE, else SNAPSHOT.

- Both formats carry `notLive: true`, a watermark (`SYNTHETIC - NOT LIVE DATA` or `DAILY SNAPSHOT - NOT LIVE`) and content flags (synthetic, user-entered, stale, placeholder, unavailable, probable, invalid).
- Meta: build, config, sample-data and formula versions; snapshot id and time; data mode; export time local and UTC; viewer and display time zones; panel fields such as metal, route, landed view, valuation date, GST base and ITC toggle.
- Rows: raw and formatted values, unit, status, badges, freshness, observation span, formula id and version, inputs and their statuses, records, sources, citations, notes (with withholding reasons) and warnings.
- Provenance: every record behind the values, with observed, published and retrieved times, source URL, verification and SHA-256 where available (ECB and bhavcopy files).
- CSV: UTF-8 BOM and `# key,value` header lines. Missing values are empty or null, never zero (T10); formula-like cells get an apostrophe (T11). The Evidence panel adds an audit bundle and a records export.

## 15. Audit tests

`tests/run-tests.js` runs the suite on a deterministic snapshot built from the ECB fixture (10 to 24 Sep 2026); T22 and N16 read the built page. The engine tests also run in the browser and before every publish, where a failure blocks deployment. The latest run passed 42 of 42.

- T01 `Troy-ounce conversion (1 troy oz = 31.1034768 g)`
- T02 `All seven contract multipliers, notionals and normalizations (registry specs)`: adapted, reads the registry specs.
- T03 `Duty legs sum: registry splits reconcile (10% + 5% = 15%; 5% + 1% = 6%)`: adapted, reads the registry rules.
- T04 `Episode A wedge: 15% - 8% = +7 points (Feb 2024); 6% - 8% = -2 points (after 24 Jul 2024)`: adapted, dated rules.
- T05 `Episode B wedges: silver 15% - 7% = +8 pts, gold TRQ 15% - 14% = +1 pt (13 May 2026); before: -1 and +1`: adapted, dated rules.
- T06 `Fixed-date day count and annualization`
- T07 `Opposite spread directions are exact sign inverses before costs`
- T08 `Hypothetical margin offset never creates negative blocked capital`
- T09 `Synthetic status propagates to outputs and exports`
- T10 `Missing values export as null, never zero`
- T11 `CSV escaping and formula-injection guard`
- T12 `Replay steps never show a figure before its publication date`: adapted, date-based visibility plus rendered-text leak checks.
- T13 `Validation rejects NaN, infinity, negatives, bad dates, out-of-range %`
- T14 `Tariff value is independent of the benchmark (never back-solved)`
- T15 `Total-rate fallback keeps the missing split as PLACEHOLDER`
- T16 `GST is PROBABLE; ITC subtracted only when enabled`
- T17 `Symmetric decomposition sums exactly (including the futures quote)`
- T18 `Plain-number twin matches the node engine`
- T19 `Totals use unrounded legs`
- T20 `Every replay fact and registry entry cites a located document; pending claims are never shown as facts`: adapted, citations must resolve with an http(s) URL.
- T21 `Demo data stays out of the public snapshot`: adapted, demo isolation replaces the Episode C check.
- T22 `No network and no eval: CSP forbids remote calls and inline scripts`: adapted, CSP with `script-src 'self'`.
- N01 `Unit conversions: oz, g, kg, tariff units`
- N02 `Tariff values selected by effective date; never by benchmark; coverage gaps are UNAVAILABLE`
- N03 `Customs FX is separate from market USD/INR: missing customs FX withholds rupee duty`
- N04 `Duty rules and executability by effective date`
- N05 `Publication schedules: ERAM fortnights and CBIC revision dates`
- N06 `Stale and missing sources: freshness from cadence, carried through derived values`
- N07 `Asynchronous inputs: warn beyond 12 h, withhold the basis beyond 72 h`
- N08 `Contract and expiry pairing`
- N09 `Time zones, daylight saving and holiday calendars`
- N10 `Real contract calendar in the spread engine (GOLD Oct to Dec 2026)`
- N11 `Lineage labels: user entries and synthetic inputs are never presented as verified`
- N12 `Parse failures are rejected with reasons, never guessed`
- N13 `Exports carry values, units, lineage, statuses, sources, timestamps and versions`
- N14 `Basis-change decomposition sums exactly (Shapley over benchmark, FX, customs duty, costs, financing, quote)`
- N15 `Reference reconciliation, 24 Sep 2026 (cited observations; hand-checkable)`: public legs always; the COMEX and MCX legs only when the owner's private reference file is present (exchange prices are kept out of the public bundle and repository)
- N16 `Static fallback: the page is readable without JavaScript and never blank`
- P01 `Pipeline reads the ECB fixture and derives USD/INR = EUR/INR / EUR/USD per date`
- P02 `A bad manual edit stops the pipeline (live site unchanged)`
- P03 `Manual MCX and COMEX rows are validated but withheld while display rights are off`
- P04 `ECB outage keeps the last valid observations and never invents new ones`

## 16. Open gaps and pending confirmations

1. Enter the ICEGATE US Dollar import rate each fortnight from 2 Oct 2026 (rows up to the fortnight from 18 Sep 2026 are VERIFIED).
2. Add the notification in force from 1 Oct 2026 (or move `lastReviewed`); official copies and hashes for 60/2026 to 72/2026.
3. Read the silver rows of 09/2026-Customs and 21/2025-Customs; confirm AIDC on CEPA silver.
4. Confirm the gold row in 18/2026-Customs; record any FY2026-27 CEPA gold allocation.
5. Cite a document for the normal-route standard treatment (who may import and through which channel).
6. TradeStat queries for A-G01 and A-G02; a source for A-G03 or its removal; a UAE-only silver series after May 2026.
7. Load MCX holidays and listed months; settle GOLDGUINEA quality, the SILVERM delivery unit and current GOLDPETAL and SILVERM specifications.
8. MCX permission and a CME licence before publishing exchange prices; FBIL, ICEGATE and MCX reuse terms are unread.
9. CA confirmation of the GST base, 3% rate and ITC.
10. No sourced MCXCCL margin rule; no owner cost defaults.
11. Load the MCX trading-holiday calendar so rule-computed expiries stop being PROBABLE.
