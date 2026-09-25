# Reference reconciliation: 24 September 2026 (public version)

This is the end-to-end check on real, dated, cited observations, separate from the synthetic
test fixtures. Every step can be checked with a calculator. Test N15 asserts these numbers in
the page and in Node; test P01 asserts the pipeline's USD/INR.

Exchange prices (COMEX settlements and MCX closes) for this date are kept out of the public
repository and the public site until display rights are settled. The owner has a private copy of
this document with those legs filled in (tests/private/, not uploaded); when that file is present,
N15 also checks the benchmark and basis arithmetic.

Reference date: **Thursday 24 September 2026**.

## 1. Public inputs and their evidence

| Input | Value | Unit | Source (document) | State |
|---|---|---|---|---|
| EUR/USD reference rate | 1.1367 | USD per EUR | ECB euro reference rates, 90-day file ([link](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml)); concertation about 14:15 Frankfurt time | VERIFIED |
| EUR/INR reference rate | 109.0775 | INR per EUR | same file | VERIFIED |
| CBIC tariff value, gold | 1,373 | USD per 10 g | Notification 75/2026-Customs (N.T.), dated 15 Sep 2026, in force 16 Sep 2026, F.No. 467/01/2026-Cus.V ([official Chennai customs copy](https://chennaicustoms.gov.in/wp-content/uploads/2026/09/English-version-of-Notification-75-2026-CUS-NT-dt-15.09.2026-PDF.pdf)) | VERIFIED |
| CBIC tariff value, silver | 2,028 | USD per kg | same notification | VERIFIED |
| Normal-route duty, gold and silver bars | 10% BCD + 5% AIDC = 15% | rate | Notifications 15/2026-Customs and 16/2026-Customs, dated 12 May 2026, in force 13 May 2026 (read on [gazettetracker](https://gazettetracker.com/g/CG-DL-E-12052026-272489) and [worldtradescanner](https://worldtradescanner.com/cst-15-2026.pdf) copies) | PRIMARY COPY |
| Customs exchange rate (imports, USD) in force 18 Sep to 1 Oct 2026 | 96.80 (export 95.10) | INR per USD | ICEGATE Exchange Rate Notification No. 27/2026, published 17 Sep 2026, in force from 18 Sep 2026 ([ICEGATE: View Exchange Rate Notifications](https://foservices.icegate.gov.in/#/services/notifyPublishScreen)) | VERIFIED |

## 2. The working note's reference points

| Working-note point | Finding | Status in the build |
|---|---|---|
| Notification 75/2026 tariff values, gold US$1,373 per 10 g, silver US$2,028 per kg | Confirmed on the official copy: dated 15 Sep 2026, in force 16 Sep 2026 | VERIFIED, in the registry |
| "Notification 27/2026 customs import FX 96.80" | Confirmed. ICEGATE numbers its exchange-rate notifications in a series of its own, and its No. 27/2026 (in force from 18 Sep 2026) gives US Dollar 96.80 for imports. It is not Customs (N.T.) 27/2026, a tariff-value notification of 19 Mar 2026; an earlier version of this document confused the two and called the figure wrong | VERIFIED, in data/manual/customs-fx.csv |
| USD/INR 95.96 on 24 Sep | Matches the ECB cross, 109.0775 / 1.1367 = 95.9598. FBIL's USD/INR reference on 25 Sep at 1 pm was 95.8918 (RBI homepage) | ECB cross used, labelled as derived from ECB data |
| MCX closes of 22 Sep (four contracts) | Two confirmed by news reports; two (GOLD Dec, SILVER Mar) not found in any source | Not used on the public site (display rights) |
| COMEX delayed quotes of 25 Sep | No timestamped match found | Not used; the private copy uses 24 Sep settlements |

## 3. Arithmetic, gold, per 10 g (normal route)

1. Market USD/INR (F-FX-01): 109.0775 / 1.1367 = **95.959796** (display 95.9598).
2. Benchmark per 10 g (F-M1-01/02): B x 95.959796 / 31.1034768 x 10, where B is the COMEX settlement in USD per troy oz. Each US$1 on B adds Rs 30.8522 per 10 g.
3. Customs duty in US dollars (F-M1-22): 1,373 x 15% = **US$205.95 per 10 g**. This needs no exchange rate.
4. Duty base in rupees (F-M1-03): 1,373 x 96.80 = **Rs 1,32,906.40**.
5. BCD 10% = Rs 13,290.64; AIDC 5% = Rs 6,645.32; customs duty = **Rs 19,935.96** per 10 g.
6. Landed before local costs (F-M1-21) = benchmark + customs duty. A 1% change in the customs rate moves the gold duty by about Rs 199 per 10 g.
7. The tariff value in ounce terms: 1,373 / 10 x 31.1034768 = **US$4,270.51 per troy oz**. Comparing it with the benchmark shows how far the duty base lags or leads the market between notifications (F-M1-20 sizes the error of charging duty on the benchmark instead).

## 4. Arithmetic, silver, per kg (normal route)

1. Customs duty in US dollars: 2,028 x 15% = **US$304.20 per kg**.
2. Duty base at 96.80: 2,028 x 96.80 = **Rs 1,96,310.40**; BCD Rs 19,631.04 + AIDC Rs 9,815.52 = **Rs 29,446.56** per kg.
3. Tariff value in ounce terms: 2,028 / 1,000 x 31.1034768 = **US$63.08 per troy oz**.
4. A 1% change in the customs rate moves the silver duty by about Rs 294 per kg.

## 5. Corridor figures that need no exchange rate (valuation date 25 Sep 2026)

| Route | Paper rate | Wedge vs normal | Duty in USD | Paper edge | Executability |
|---|---|---|---|---|---|
| CEPA-UAE gold in-quota | 14% (10% + 4% AIDC; row inferred, PROBABLE) | +1 pt | US$192.22 per 10 g | **US$13.73 per 10 g** | CONSTRAINED: FY2025-26 permits extended to 30.09.2026; no FY2026-27 allocation found up to 25 Sep 2026 |
| CEPA-UAE silver | 7% (SECONDARY; primary row not read) | +8 pts | US$141.96 per kg | **US$162.24 per kg** | LICENCE-GATED since 16 May 2026 |

## 6. Calendar check used by the spread engine

GOLD October 2026 expires 5 Oct 2026 and GOLD December 2026 expires 4 Dec 2026 (the 5th fell on a
Saturday, so the preceding working day applies): 60 days between expiries. The tender period of the
October contract starts 1 Oct 2026 (last 3 trading days including expiry; MCX holidays not loaded).

## 7. What the production site shows for this date

With only public data: USD/INR 95.9598 (DERIVED FROM VERIFIED INPUTS), tariff values 1,373 and 2,028
(VERIFIED), rates 15% (PRIMARY COPY), customs rate 96.80 (VERIFIED), duty US$205.95 per 10 g and
US$304.20 per kg, rupee duty Rs 19,935.96 per 10 g and Rs 29,446.56 per kg, and the CEPA paper edges
above. The benchmark, landed and MCX legs are UNAVAILABLE on the public page because they need an
exchange price; a visitor can enter or load one in their own browser.

## 8. How to re-run

    node pipeline/run.js --ecb-file data/fixtures/ecb-hist-90d-fixture-20260924.xml --now 2026-09-25T09:00:00Z
    node pipeline/build.js
    node tests/run-tests.js
