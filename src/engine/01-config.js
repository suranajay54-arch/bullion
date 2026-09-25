/* =============================================================================
 * INDIA BULLION PARITY & CORRIDOR INTELLIGENCE - public site engine
 * SECTION 1. CONFIG (states, units, corridors, methodology, replay episodes)
 * -----------------------------------------------------------------------------
 * Build 3.0.0 extends Build 2.0.0. Figures that change over time (tariff values,
 * customs exchange rates, duty rules, contract calendars, market observations)
 * are NOT in this file: they arrive as typed records in the data snapshot built
 * by pipeline/run.js from data/ and config/. This file holds the fixed
 * vocabulary, the formula registry, the replay episodes and the limitations.
 * ===========================================================================*/

const BUILD = Object.freeze({
  app: 'India Bullion Parity & Corridor Intelligence',
  buildVersion: '3.0.0',
  configVersion: 'cfg-2026.09.25.1',
  sampleDataVersion: 'syn-2026.09.23.1',
  formulaVersion: 'F-3.0',
  snapshotSchema: 'ibpci.snapshot/1',
  storageKey: 'ibpci.site.v3',
  storageSchema: 3,
  storageMaxBytes: 60000,
  displayTz: 'Asia/Kolkata'
});

/* ---------- 1.1 VERIFICATION STATES (what kind of evidence stands behind a value) ----------
 * VERIFIED          primary document read on an official host
 * PRIMARY COPY      full primary text read on a third-party copy
 * SECONDARY         named secondary source; primary not located
 * CITATION PENDING  from the earlier evidence brief; no document located (never shown as fact)
 * OWNER-ENTERED     entered by the site owner from a named official source (admin file)
 * USER-ENTERED      typed or loaded by this visitor, local to this browser
 * ASSUMPTION        an editable cost or financing assumption
 * SYNTHETIC         demonstration value (demo mode and test fixtures only)
 * DERIVED           computed; label shows the weakest class of input
 * PROBABLE          a methodology or interpretation pending professional confirmation
 * PLACEHOLDER       not documented for this date; excluded, exported as null
 * UNAVAILABLE       a known gap that must not be estimated
 * INVALID           a rejected entry or an undefined result                        */
const ST = Object.freeze({
  VERIFIED: 'VERIFIED', COPY: 'PRIMARY COPY', SECONDARY: 'SECONDARY', PENDING: 'CITATION PENDING',
  OWNER: 'OWNER-ENTERED', USER: 'USER-ENTERED', ASSUMPTION: 'ASSUMPTION', SYNTHETIC: 'SYNTHETIC',
  DERIVED: 'DERIVED', PROBABLE: 'PROBABLE', PLACEHOLDER: 'PLACEHOLDER', UNAVAILABLE: 'UNAVAILABLE', INVALID: 'INVALID'
});

/* ---------- 1.2 FRESHNESS STATES (how current a real input is) ----------
 * LIVE and DELAYED are reserved for licensed feeds; nothing in this build is LIVE.
 * SNAPSHOT   a dated observation that is the newest the source cadence implies
 * STALE      an older observation kept visibly (never rolled forward as current)
 * UNAVAILABLE no usable observation                                               */
const FRESH = Object.freeze({ LIVE: 'LIVE', DELAYED: 'DELAYED', SNAPSHOT: 'SNAPSHOT', STALE: 'STALE', UNAVAILABLE: 'UNAVAILABLE', NA: 'N/A' });
const FRESH_RANK = Object.freeze({ 'N/A': 0, LIVE: 1, DELAYED: 2, SNAPSHOT: 3, STALE: 4, UNAVAILABLE: 5 });

const LABEL = Object.freeze({
  DERIVED_SYN: 'DERIVED FROM SYNTHETIC INPUTS',
  DERIVED_VER: 'DERIVED FROM VERIFIED INPUTS',
  DERIVED: 'DERIVED',
  PROBABLE_GST: 'PROBABLE - PENDING CA CONFIRMATION - NOT TAX ADVICE',
  MARGIN_HYP: 'HYPOTHETICAL - not an MCXCCL or broker margin. No sourced margin rule is loaded.',
  SYN_WM: 'SYNTHETIC - NOT LIVE DATA',
  NOT_LIVE: 'DAILY SNAPSHOT - NOT LIVE',
  DEMO: 'SYNTHETIC DEMO - NOT TODAY\'S DATA',
  LOCAL_ONLY: 'Entered in this browser only. Never uploaded.'
});

/* Executability codes. Eligibility (the paper rate) and executability are separate
 * fields by design; a flag is never netted into a number. Entries are dated in
 * data/registry/duty-rules.json (exec). */
const EXEC_CODES = Object.freeze({
  STANDARD: { label: 'STANDARD ROUTE', cls: 'x-open' },
  OPEN: { label: 'OPEN', cls: 'x-open' },
  LICENCE_GATED: { label: 'LICENCE-GATED', cls: 'x-gated' },
  CONSTRAINED: { label: 'CONSTRAINED', cls: 'x-constrained' },
  IN_USE: { label: 'IN USE', cls: 'x-inuse' },
  NOT_STATED: { label: 'NOT STATED', cls: 'x-ns' }
});

/* Internal pseudo-sources. Registry sources (ECB-EXR, CBIC-TV, ...) are merged in at
 * runtime from the snapshot; citations (C-...) come from data/registry/citations.json. */
const INTERNAL_SOURCES = Object.freeze({
  'SRC-SYN':     { name: 'Synthetic demonstration value', citation: 'SYNTHETIC - not market data', url: null },
  'SRC-USER':    { name: 'Entered by the visitor in this browser', citation: 'Visitor entry (local only)', url: null },
  'SRC-METHOD':  { name: 'Methodology assumption of this site', citation: 'Methodology note, section 4 (GST) and section 1 (landed views)', url: null },
  'SRC-STATUTE': { name: 'Statutory structure referenced by the methodology', citation: 'Customs Act, 1962, s.14 (tariff values under s.14(2); rate of exchange determined by the Board); Customs Tariff Act, 1975, s.3(7)-(8) (IGST on imports and its value base)', url: null },
  'SRC-DERIVED': { name: 'Computed on this page from the listed inputs', citation: 'Formula registry', url: null },
  'CITATION':    { name: 'Cited document (see the citation list)', citation: 'See citations', url: null }
});

/* Public panels (deep-linkable as #id; demo as #demo/id). */
const PANELS = Object.freeze([
  { id: 'how', label: 'How to read', title: 'How to read this site' },
  { id: 'parity', label: 'Parity', title: 'Landed parity: from the global price to the rupee cost of importing' },
  { id: 'basis', label: 'Basis', title: 'MCX contract basis and physical basis' },
  { id: 'spreads', label: 'Spreads', title: 'Calendar spreads and carry' },
  { id: 'corridor', label: 'Corridors', title: 'Corridor rates, executability and replay' },
  { id: 'evidence', label: 'Evidence', title: 'Sources, records and audit' },
  { id: 'limits', label: 'Limitations', title: 'Limitations' }
]);

/* ---------- 1.3 UNITS ---------- */
const TROY_OUNCE_GRAMS = 31.1034768;
const UNIT_GRAMS = Object.freeze({ g: 1, kg: 1000 });
const METALS = Object.freeze(['gold', 'silver']);
const COMPARISON_UNIT = Object.freeze({
  gold: Object.freeze({ grams: 10, label: 'INR/10g', per: 'per 10 g', usdLabel: 'USD/10g' }),
  silver: Object.freeze({ grams: 1000, label: 'INR/kg', per: 'per kg', usdLabel: 'USD/kg' })
});
const CBIC_TARIFF_UNIT = Object.freeze({
  gold: Object.freeze({ unit: 'USD/10g', grams: 10 }),
  silver: Object.freeze({ unit: 'USD/kg', grams: 1000 })
});
/* COMEX month codes (CME convention). */
const MONTH_CODES = Object.freeze({ F: 1, G: 2, H: 3, J: 4, K: 5, M: 6, N: 7, Q: 8, U: 9, V: 10, X: 11, Z: 12 });

/* ---------- 1.4 CORRIDORS ---------- */
const CORRIDORS = Object.freeze([
  { id: 'NORMAL', name: 'Normal route', short: 'Normal', metals: ['gold', 'silver'], slot: 's1' },
  { id: 'CEPA_SILVER', name: 'CEPA-UAE silver', short: 'CEPA silver', metals: ['silver'], slot: 's2' },
  { id: 'CEPA_GOLD_TRQ', name: 'CEPA-UAE gold (tariff-rate quota)', short: 'CEPA gold TRQ', metals: ['gold'], slot: 's3' }
]);

/* ---------- 1.5 THRESHOLDS (documented in the methodology note, section 1.4) ---------- */
const THRESHOLDS = Object.freeze({
  asyncWarnHours: 12,        /* market inputs further apart than this: warning */
  asyncWithholdHours: 72,    /* further apart than this: basis, spread and decomposition withheld */
  valuationLagWarnBizDays: 1,/* a market input older than this many business days before the valuation date: warning */
  staleToUnavailableDays: 16 /* schedule-based registries: STALE for this many days past validity, then UNAVAILABLE */
});

/* ---------- 1.6 GST METHOD (PROBABLE) ---------- */
const GST_METHOD = Object.freeze({
  status: ST.PROBABLE,
  warning: LABEL.PROBABLE_GST,
  defaultRatePct: 3.00,
  defaultRateNote: 'IGST on gold and silver bars at 3% is a methodology default carried from Build 2.0.0; confirm against the current GST rate schedule.',
  defaultBase: 'AV_DUTY',
  itcDefaultEnabled: false,
  itcDefaultSharePct: 100,
  bases: Object.freeze([
    { id: 'AV_DUTY', label: 'Assessable value (tariff value x customs FX) + customs duty',
      note: 'Seeded assumption. Mirrors the import-IGST valuation structure (Customs Tariff Act, 1975, s.3(8)): assessable or tariff value plus customs duties. No landed additions, because the tariff value replaces transaction value.' },
    { id: 'AV_DUTY_FI', label: 'Assessable value + customs duty + freight/insurance',
      note: 'Alternative for review: adds freight and insurance to the seeded base.' },
    { id: 'BENCH_DUTY_LANDED', label: 'Benchmark bullion value + customs duty + all landed additions',
      note: 'Broad commercial reading of "assessable bullion value plus customs duty and applicable landed additions".' },
    { id: 'BENCH_ONLY', label: 'Benchmark bullion value only',
      note: 'Lower-bound comparison only.' }
  ])
});

const LANDED_VIEWS = Object.freeze([
  { id: 'EX_COSTS', label: 'Landed before local costs (benchmark + customs duty)', note: 'Used when local cost assumptions are not supplied. Says nothing about freight, assay, handling or financing.' },
  { id: 'PRE_GST', label: 'Pre-GST landed (customs-only)', note: 'Benchmark + duty + local costs + financing. A GST-registered buyer may take IGST as input credit (PROBABLE).' },
  { id: 'GROSS', label: 'Gross cash landed (incl. GST)', note: 'Cash outlay including GST at the selected base.' },
  { id: 'NET', label: 'Net economic landed (after optional ITC)', note: 'Equals gross unless the eligible-ITC assumption is enabled.' }
]);

/* ---------- 1.7 CORRIDOR REPLAY EPISODES ----------
 * Each step has a date. A fact is shown at a step only if its knowableFrom date is on
 * or before the step date (release-lag time machine): the date the cited document was
 * published, or, where the release date is not documented, the date it was accessed.
 * Duty rates and executability flags come from the dated registry for the step date
 * (or ruleDate when a step looks back). Fiscal-year and calendar-year series have
 * separate series ids and are never spliced.                                          */
const EPISODES = Object.freeze([
  {
    id: 'A', title: 'Episode A: the UAE silver wedge opens, is used, and inverts (2023-2024)',
    tagline: 'A paper duty gap and the trade flow that followed it',
    metals: ['silver'], corridors: ['NORMAL', 'CEPA_SILVER'], metal: 'silver',
    chart: { title: 'UAE to India silver: average per month over each stated period', axis: 'USD per month (period total / months)' },
    steps: [
      { key: 'A0', date: '2023-02-02', title: 'Budget 2023 lifts normal-route silver bars to 15%',
        note: 'Normal-route silver bars move from 10.75% to 15%. The FY2022-23 CEPA silver rate is not in the registry, so the wedge on this date stays PLACEHOLDER.' },
      { key: 'A1', date: '2024-02-29', title: 'February 2024: the paper wedge is 7 points',
        note: 'At this date the February flow data had not been published. Only the rates were knowable.' },
      { key: 'A2', date: '2024-04-08', title: 'Reuters reports record February silver imports',
        note: 'First published volume figure for the surge.' },
      { key: 'A3', date: '2024-06-17', title: 'GTRI quantifies the FY2024 surge and the revenue cost',
        note: 'Fiscal-year figures from GTRI\'s report on official data.' },
      { key: 'A4', date: '2024-07-24', title: 'Budget 2024 cut inverts the wedge',
        note: 'Normal-route bars fall to 6% (5% BCD + 1% AIDC), below the reported CEPA rate.' },
      { key: 'A5', date: '2026-09-25', ruleDate: '2024-12-31', title: 'Hindsight: calendar-year series (WITS)',
        note: 'Calendar-year figures as accessed on 25 Sep 2026 (release dates not documented, so they are placed at the access date). Rates shown as in force on 31 Dec 2024.' }
    ],
    facts: [
      { id: 'A-F01', knowableFrom: '2024-04-08', type: 'volume', label: 'Silver imported from the UAE, February 2024', period: 'Feb 2024',
        value: 939, unit: 'tonnes', display: '939 tonnes', citation: 'C-REUTERS-FEB24', status: 'SECONDARY',
        note: 'Reuters quoting an unnamed government official. National total that month: a record 2,295 tonnes.' },
      { id: 'A-F02', knowableFrom: '2024-06-17', type: 'flow', label: 'UAE to India silver imports', period: 'FY2022-23 (Apr 2022 - Mar 2023)',
        value: 29.2e6, unit: 'USD', display: 'US$29.2 million', months: 12, series: 'FY', chartLabel: 'FY23',
        citation: 'C-GTRI-45', status: 'PRIMARY COPY' },
      { id: 'A-F03', knowableFrom: '2024-06-17', type: 'flow', label: 'UAE to India silver imports', period: 'FY2023-24 (Apr 2023 - Mar 2024)',
        value: 1.74e9, unit: 'USD', display: 'US$1.74 billion', months: 12, series: 'FY', chartLabel: 'FY24',
        citation: 'C-GTRI-45', status: 'PRIMARY COPY', note: 'GTRI: "increased by 5853%".' },
      { id: 'A-F04', knowableFrom: '2024-06-17', type: 'money', label: 'Revenue loss attributed to the CEPA silver concession (GTRI)', period: 'FY2023-24',
        value: 1010e7, unit: 'INR', display: 'Rs 1,010 crore', citation: 'C-GTRI-45', status: 'PRIMARY COPY',
        note: 'Replaces the earlier brief\'s "~$119M", which was not found in any publication.' },
      { id: 'A-F05', knowableFrom: '2024-07-25', type: 'policy', label: 'After the July 2024 cut', period: 'Jul 2024',
        text: 'Reuters reported that the duty cut removed the incentive to import silver under the CEPA concession.',
        citation: 'C-BS-JUL24-CEPA', status: 'SECONDARY' },
      { id: 'A-F06', knowableFrom: '2026-09-25', type: 'flow', label: 'India imports from the UAE, HS 7106 (calendar year)', period: 'CY2023',
        value: 339.84007e6, unit: 'USD', display: 'US$339.84 million (434,032 kg)', months: 12, series: 'CY', chartLabel: 'CY2023',
        citation: 'C-WITS-2023', status: 'VERIFIED', quantityKg: 434032 },
      { id: 'A-F07', knowableFrom: '2026-09-25', type: 'flow', label: 'India imports from the UAE, HS 7106 (calendar year)', period: 'CY2024',
        value: 1971.90086e6, unit: 'USD', display: 'US$1.97 billion (2,463,050 kg)', months: 12, series: 'CY', chartLabel: 'CY2024',
        citation: 'C-WITS-2024', status: 'VERIFIED', quantityKg: 2463050 },
      { id: 'A-F08', knowableFrom: '2026-09-25', type: 'caveat', label: 'Series caveat', period: null,
        text: 'Fiscal-year figures (GTRI, Apr-Mar) and calendar-year figures (WITS/UN Comtrade, Jan-Dec) are different series. They are charted separately and never spliced. "$29M in 2023 to $1.7bn in 2024" mislabels fiscal years as calendar years.',
        citation: null, status: 'DERIVED' }
    ],
    gaps: [
      { id: 'A-G01', label: 'Value of UAE silver imports, February 2024 ("$719M" in the earlier brief)', status: 'CITATION PENDING', note: 'Not found in any publication. Needs a TradeStat monthly query.' },
      { id: 'A-G02', label: 'UAE silver imports, Aug-Dec 2024 ("~$157M" in the earlier brief)', status: 'CITATION PENDING', note: 'Not found. Needs a TradeStat monthly query.' },
      { id: 'A-G03', label: '"The UAE barely refines silver; UAE-origin volume was rerouted metal"', status: 'CITATION PENDING', note: 'Claim from the earlier brief; no document located. Not shown as fact.' }
    ]
  },
  {
    id: 'B', title: 'Episode B: May 2026 restoration, then the licensing choke',
    tagline: 'The wedge reopened on paper; DGFT licensing decided executability',
    metals: ['silver', 'gold'], corridors: ['NORMAL', 'CEPA_SILVER', 'CEPA_GOLD_TRQ'], metal: 'silver',
    chart: { title: 'UAE gold sourcing: April-June totals, and the silver data gap', axis: 'USD, quarter total' },
    steps: [
      { key: 'B0', date: '2026-05-12', title: 'Before restoration: normal route at 6%', note: 'The CEPA silver rate (reported 7%) sits above the normal rate, so there is no wedge.' },
      { key: 'B1', date: '2026-05-13', title: 'Normal duty restored to 15%: the paper wedge reopens', note: 'Executability is not yet affected on this date.' },
      { key: 'B2', date: '2026-05-16', title: 'DGFT restricts silver bars for all origins', note: 'Bars move from Free to Restricted. The CEPA paper rate no longer implies a usable lane.' },
      { key: 'B3', date: '2026-06-02', title: 'DGFT: authorisation for unwrought, powder and grain', note: 'Even nominated agencies and IIBX qualified jewellers need an Import Authorisation.' },
      { key: 'B4', date: '2026-06-15', title: 'Official May data: silver imports at a three-year low', note: '' },
      { key: 'B5', date: '2026-07-23', title: 'Estimates: imports down to about 29 tonnes in June', note: 'Consultancy estimates, not official data.' },
      { key: 'B6', date: '2026-09-02', title: 'UAE gold sourcing up 124.8% in April-June', note: 'A 1-point CEPA gold margin; flows are not proof of quota use.' },
      { key: 'B7', date: '2026-09-16', title: 'August: silver imports rebound in value', note: 'Commerce Ministry data via Kitco.' }
    ],
    facts: [
      { id: 'B-F01', knowableFrom: '2026-05-16', type: 'policy', label: 'DGFT 17/2026-27 (16 May 2026)', period: 'From 16 May 2026',
        text: 'Silver bars (ITC(HS) 71069221 and 71069229) moved from Free to Restricted, with immediate effect, for all origins. Export units, SEZs and jewellery-export schemes exempt.',
        citation: 'C-DGFT-17-2026-27', status: 'PRIMARY COPY' },
      { id: 'B-F02', knowableFrom: '2026-06-02', type: 'policy', label: 'DGFT 19/2026-27 (2 Jun 2026)', period: 'From 2 Jun 2026',
        text: 'Unwrought, powder and grain forms (71061000, 71069110, 71069120, 71069190) permitted only against a DGFT Import Authorisation, including through nominated agencies and IIBX qualified jewellers.',
        citation: 'C-DGFT-19-2026-27', status: 'PRIMARY COPY' },
      { id: 'B-F03', knowableFrom: '2026-06-15', type: 'volume', label: 'India silver imports, May 2026 (all origins)', period: 'May 2026',
        value: 33, unit: 'tonnes', display: '33 tonnes (US$75.57 million)', citation: 'C-KITCO-MAY26', status: 'SECONDARY',
        note: 'Reuters citing trade ministry data.' },
      { id: 'B-F04', knowableFrom: '2026-07-06', type: 'policy', label: 'CEPA gold quota permits', period: 'FY2025-26 permits',
        text: 'DGFT Public Notice 18/2026-27 extended FY2025-26 gold quota permits to 30.09.2026.',
        citation: 'C-DGFT-PN18-2026-27', status: 'PRIMARY COPY', note: 'Dated 1 Jul 2026; placed at the gazette date, 6 Jul 2026.' },
      { id: 'B-F05', knowableFrom: '2026-07-23', type: 'volume', label: 'India silver imports, June 2026 (estimate)', period: 'Jan 2026 to Jun 2026',
        value: 29, unit: 'tonnes', display: 'about 29 tonnes in June, from 747 tonnes in January', citation: 'C-BS-METALSFOCUS-2026', status: 'SECONDARY',
        approx: true, note: 'Metals Focus estimates reported by Bloomberg. Not official data.' },
      { id: 'B-F06', knowableFrom: '2026-09-02', type: 'flow', label: 'Gold imports from the UAE', period: 'Apr-Jun 2026',
        value: 3.14e9, unit: 'USD', display: 'US$3.14 billion', months: 3, series: 'QG', chartLabel: 'Apr-Jun 2026',
        citation: 'C-ETV-GTRI-2026', status: 'SECONDARY', note: 'GTRI analysis reported by ETV Bharat. UAE share of gold imports 18.7% to 28.5%.' },
      { id: 'B-F07', knowableFrom: '2026-09-02', type: 'flow', label: 'Gold imports from the UAE', period: 'Apr-Jun 2025',
        value: 1.40e9, unit: 'USD', display: 'US$1.40 billion', months: 3, series: 'QG', chartLabel: 'Apr-Jun 2025',
        citation: 'C-ETV-GTRI-2026', status: 'SECONDARY', note: 'Prior-year base as reported (+124.8%).' },
      { id: 'B-F08', knowableFrom: '2026-09-02', type: 'caveat', label: 'Interpretation limit', period: null,
        text: 'The CEPA gold margin is 1 point (14% against 15%). Much of this can be normal-channel trade; it is not proof of quota use.',
        citation: null, status: 'DERIVED' },
      { id: 'B-F09', knowableFrom: '2026-09-16', type: 'flow', label: 'India silver imports, August 2026 (all origins)', period: 'Aug 2026',
        value: 1.02e9, unit: 'USD', display: 'US$1.02 billion (+127% year on year)', citation: 'C-KITCO-AUG26', status: 'SECONDARY',
        note: 'Commerce Ministry data via Kitco. Apr-Aug total US$1.74 billion (-8.81%). No official August tonnage found.' },
      { id: 'B-F10', knowableFrom: '2026-09-25', type: 'flow', label: 'UAE-only silver imports after May 2026', period: 'From 13 May 2026',
        value: null, unit: 'USD', display: null, series: 'GAP', chartLabel: 'UAE silver, post-May 2026',
        citation: null, status: 'UNAVAILABLE', note: 'No UAE-only post-May silver series was located. Never estimated.' },
      { id: 'B-F11', knowableFrom: '2026-09-25', type: 'policy', label: 'FY2026-27 CEPA gold quota allocation', period: 'As of 25 Sep 2026',
        text: 'No FY2026-27 allocation notice was found in the Commerce Ministry gazette listings up to 25 Sep 2026.',
        citation: 'C-DGFT-LISTINGS', status: 'SECONDARY' }
    ],
    gaps: [
      { id: 'B-G01', label: 'CEPA silver rate for FY2026-27 from the primary table (09/2026-Customs)', status: 'CITATION PENDING', note: 'Located but the silver row was not read. Secondary sources say 7%.' }
    ]
  }
]);

/* ---------- 1.8 FORMULA REGISTRY ---------- */
const FORMULAS = Object.freeze([
  { id: 'F-FX-01', m: 'FX', name: 'USD/INR cross from ECB rates', formula: 'EUR/INR reference / EUR/USD reference (same ECB date)', inputs: 'ECB EUR/INR; ECB EUR/USD', units: 'INR per USD', output: 'usdinr', rounding: 'Raw carried; display 4 dp', note: 'A modification of ECB data, stated as such.' },
  { id: 'F-M1-01', m: 'M1', name: 'Benchmark INR per gram', formula: 'benchmark (USD/troy oz) x USDINR / 31.1034768', inputs: 'Benchmark; USDINR', units: 'INR/g', output: 'benchInrPerG', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-02', m: 'M1', name: 'Benchmark per comparison unit', formula: 'INR/g x comparison grams (10 g gold; 1,000 g silver)', inputs: 'Benchmark INR/g', units: 'INR/10g or INR/kg', output: 'bench', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-03', m: 'M1', name: 'Duty base (customs assessable value)', formula: 'CBIC tariff value (USD per published unit) x customs exchange rate x (comparison grams / published grams)', inputs: 'CBIC tariff value; customs exchange rate', units: 'INR/10g or INR/kg', output: 'assessable', rounding: 'Display 2 dp; raw carried', note: 'Never back-solved from the benchmark; never uses market USD/INR.' },
  { id: 'F-M1-04', m: 'M1', name: 'BCD', formula: 'Duty base x BCD rate', inputs: 'Duty base; BCD rate', units: 'INR per comparison unit', output: 'bcd', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-05', m: 'M1', name: 'AIDC', formula: 'Duty base x AIDC rate', inputs: 'Duty base; AIDC rate', units: 'INR per comparison unit', output: 'aidc', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-06', m: 'M1', name: 'Customs duty', formula: 'BCD + AIDC when the split is known; otherwise duty base x documented total rate (split stays PLACEHOLDER)', inputs: 'BCD, AIDC or total rate', units: 'INR per comparison unit', output: 'duty', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-07', m: 'M1', name: 'Financing', formula: '(benchmark + customs duty) x annual rate x days / 365', inputs: 'Benchmark; duty; financing rate; days', units: 'INR per comparison unit', output: 'financing', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-08', m: 'M1', name: 'Pre-GST landed (customs-only)', formula: 'benchmark + customs duty + freight/insurance + assay/refining + financing + handling', inputs: 'All legs above', units: 'INR per comparison unit', output: 'preGst', rounding: 'Sum of unrounded legs' },
  { id: 'F-M1-09', m: 'M1', name: 'GST base (PROBABLE)', formula: 'Per selected methodology assumption (see GST options)', inputs: 'Selected base components', units: 'INR per comparison unit', output: 'gstBase', rounding: 'Sum of unrounded legs' },
  { id: 'F-M1-10', m: 'M1', name: 'GST cash (PROBABLE)', formula: 'GST base x GST rate', inputs: 'GST base; GST rate', units: 'INR per comparison unit', output: 'gst', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-11', m: 'M1', name: 'Gross cash landed', formula: 'pre-GST landed + GST cash', inputs: 'Pre-GST landed; GST cash', units: 'INR per comparison unit', output: 'gross', rounding: 'Sum of unrounded legs' },
  { id: 'F-M1-12', m: 'M1', name: 'Recoverable ITC (PROBABLE, opt-in)', formula: 'GST cash x recoverable share, only when the eligible-ITC assumption is enabled; otherwise nothing is subtracted', inputs: 'GST cash; ITC share; ITC toggle', units: 'INR per comparison unit', output: 'itc', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-13', m: 'M1', name: 'Net economic landed', formula: 'gross landed - recoverable ITC', inputs: 'Gross landed; ITC', units: 'INR per comparison unit', output: 'net', rounding: 'Sum of unrounded legs' },
  { id: 'F-M1-14', m: 'M1', name: 'MCX quote per gram', formula: 'native quote / grams per quotation unit', inputs: 'MCX native quote; contract spec', units: 'INR/g', output: 'mcxPerG', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-15', m: 'M1', name: 'MCX standardized quote', formula: 'INR/g x comparison grams', inputs: 'MCX INR/g', units: 'INR/10g or INR/kg', output: 'mcxStd', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-16', m: 'M1', name: 'Lot notional', formula: 'native quote x lot multiplier (lot grams / quotation grams)', inputs: 'MCX native quote; contract spec', units: 'INR per lot', output: 'lotNotional', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M1-17', m: 'M1', name: 'Modeled basis', formula: 'quote (standardized) - selected landed view (positive: quote above modeled landed value)', inputs: 'Standardized quote; landed view', units: 'INR per comparison unit', output: 'basis', rounding: 'Display 2 dp; raw carried', note: 'Descriptive. Not arbitrage and not a signal. Futures and physical quotes are never mixed.' },
  { id: 'F-M1-18', m: 'M1', name: 'Modeled basis %', formula: 'modeled basis / selected landed view', inputs: 'Basis; landed view', units: 'percent', output: 'basisPct', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-19', m: 'M1', name: 'Paper edge vs normal route', formula: 'normal-route duty - corridor duty (same duty base); rate wedge = normal total rate - corridor total rate', inputs: 'Duty base; two rates', units: 'INR or USD per comparison unit; percentage points', output: 'edge', rounding: 'Display 2 dp; raw carried', note: 'Eligibility only. Executability is a separate flag.' },
  { id: 'F-M1-20', m: 'M1', name: 'Counterfactual duty on benchmark (incorrect method)', formula: 'benchmark x effective duty rate; shown only to size the error of using the benchmark as duty base', inputs: 'Benchmark; duty rate', units: 'INR per comparison unit', output: 'dutyOnBenchCF', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M1-21', m: 'M1', name: 'Landed before local costs', formula: 'benchmark + customs duty', inputs: 'Benchmark; customs duty', units: 'INR per comparison unit', output: 'exCosts', rounding: 'Sum of unrounded legs', note: 'Labelled as excluding freight, assay, handling and financing.' },
  { id: 'F-M1-22', m: 'M1', name: 'Customs duty in US dollars', formula: 'CBIC tariff value x total duty rate x (comparison grams / published grams)', inputs: 'Tariff value; total rate', units: 'USD per comparison unit', output: 'dutyUsd', rounding: 'Display 2 dp; raw carried', note: 'Needs no exchange rate: the legal duty before conversion at the customs rate.' },
  { id: 'F-M1-23', m: 'M1', name: 'Carry to futures expiry', formula: 'selected landed view x financing rate x days from valuation date to expiry / 365', inputs: 'Landed view; financing rate; expiry date', units: 'INR per comparison unit', output: 'carryToExpiry', rounding: 'Display 2 dp; raw carried', note: 'Simple interest, ACT/365. Compares basis with carry over the same period.' },
  { id: 'F-M1-24', m: 'M1', name: 'Basis net of carry', formula: 'modeled basis - carry to expiry', inputs: 'Basis; carry', units: 'INR per comparison unit', output: 'basisNetCarry', rounding: 'Display 2 dp; raw carried', note: 'Descriptive; not a mispricing measure.' },
  { id: 'F-M1-25', m: 'M1', name: 'Basis change decomposition', formula: 'change in basis = change in quote - sum of Shapley contributions of benchmark, market FX, customs FX and tariff duty, local costs and financing to the change in landed value', inputs: 'Two complete dated input sets', units: 'INR per comparison unit', output: 'contributions', rounding: 'Display 2 dp; sums exactly', note: 'Order-independent attribution; not causal.' },
  { id: 'F-M2-01', m: 'M2', name: 'Day counts', formula: 'spreadDays = far expiry - near expiry; daysToNear = near expiry - valuation date; daysToFar = far expiry - valuation date (calendar days, ACT/365)', inputs: 'Valuation date; near and far expiries from the contract calendar', units: 'days', output: 'spreadDays, daysToNear, daysToFar', rounding: 'Integer days' },
  { id: 'F-M2-02', m: 'M2', name: 'Directional spread', formula: 'raw spread = far - near; buy near / sell far = raw; sell near / buy far = -raw', inputs: 'Near price; far price', units: 'native quotation unit', output: 'dirBNSF, dirSNBF', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M2-03', m: 'M2', name: 'Annualized price carry', formula: 'directional spread / near price x 365 / spreadDays', inputs: 'Directional spread; near price; spreadDays', units: 'percent p.a.', output: 'carryBNSF, carrySNBF', rounding: 'Display 2 dp; raw carried', note: 'Descriptive annualization, not a return forecast.' },
  { id: 'F-M2-04', m: 'M2', name: 'Breakeven annualized financing rate (Lens A)', formula: '(far - near) / near x 365 / spreadDays', inputs: 'Near; far; spreadDays', units: 'percent p.a.', output: 'breakevenFin', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M2-05', m: 'M2', name: 'Rupee carry', formula: 'directional spread x lot multiplier x lots', inputs: 'Directional spread; multiplier; lots', units: 'INR', output: 'rupeeBNSF, rupeeSNBF', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-06', m: 'M2', name: 'Leg notionals', formula: 'price x lot multiplier x lots; max(notional) = larger of the two legs', inputs: 'Leg price; multiplier; lots', units: 'INR', output: 'nearNotional, farNotional, maxNotional', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-07', m: 'M2', name: 'Outright margin per leg (hypothetical)', formula: 'leg notional x hypothetical outright margin rate', inputs: 'Leg notional; hypothetical rate', units: 'INR', output: 'nearSpan, farSpan', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-08', m: 'M2', name: 'Exposure per leg (hypothetical)', formula: 'leg notional x hypothetical exposure rate', inputs: 'Leg notional; hypothetical rate', units: 'INR', output: 'nearExposure, farExposure', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-09', m: 'M2', name: 'Gross outright margin (hypothetical)', formula: 'near + far outright + near + far exposure', inputs: 'Four legs', units: 'INR', output: 'grossOutright', rounding: 'Sum of unrounded legs' },
  { id: 'F-M2-10', m: 'M2', name: 'Spread margin, offset method (hypothetical)', formula: 'offset = min(near, far outright) x spread credit; spread margin = max(0, near + far - offset)', inputs: 'Outright legs; hypothetical credit', units: 'INR', output: 'spanOffset, spreadSpan', rounding: 'Sum of unrounded legs' },
  { id: 'F-M2-11', m: 'M2', name: 'Spread margin, direct method (hypothetical)', formula: 'max(notional) x direct spread-margin rate (when supplied)', inputs: 'max(notional); hypothetical rate', units: 'INR', output: 'spreadSpan', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-12', m: 'M2', name: 'Additional / special margin (hypothetical)', formula: 'max(notional) x rate', inputs: 'max(notional); hypothetical rate', units: 'INR', output: 'addl', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-13', m: 'M2', name: 'Broker buffer (hypothetical)', formula: 'max(notional) x rate', inputs: 'max(notional); hypothetical rate', units: 'INR', output: 'buffer', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-14', m: 'M2', name: 'Blocked capital (hypothetical)', formula: 'max(0, spread margin + near exposure + far exposure + additional + buffer)', inputs: 'Margin legs', units: 'INR', output: 'blocked', rounding: 'Sum of unrounded legs; floored at 0' },
  { id: 'F-M2-15', m: 'M2', name: 'Period return on blocked capital', formula: 'rupee carry / blocked capital', inputs: 'Rupee carry; blocked capital', units: 'percent', output: 'periodBNSF, periodSNBF', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M2-16', m: 'M2', name: 'Annualized blocked-capital return', formula: 'period return x 365 / spreadDays', inputs: 'Period return; spreadDays', units: 'percent p.a.', output: 'annBNSF, annSNBF', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M2-17', m: 'M2', name: 'Financing cost on blocked capital', formula: 'blocked capital x financing rate x spreadDays / 365', inputs: 'Blocked capital; financing rate; spreadDays', units: 'INR', output: 'finCost', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-18', m: 'M2', name: 'Net rupee carry', formula: 'gross rupee carry - financing cost', inputs: 'Rupee carry; financing cost', units: 'INR', output: 'netBNSF, netSNBF', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-19', m: 'M2', name: 'Net annualized blocked-capital return', formula: 'net rupee carry / blocked capital x 365 / spreadDays', inputs: 'Net rupee carry; blocked capital; spreadDays', units: 'percent p.a.', output: 'netAnnBNSF, netAnnSNBF', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M2-20', m: 'M2', name: 'Notional leverage on blocked capital', formula: 'near notional / blocked capital', inputs: 'Near notional; blocked capital', units: 'x', output: 'leverage', rounding: 'Display 2 dp; raw carried' },
  { id: 'F-M2-21', m: 'M2', name: 'Financing on full near notional (Lens A)', formula: 'near notional x financing rate x spreadDays / 365', inputs: 'Near notional; financing rate; spreadDays', units: 'INR', output: 'finNotional', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-22', m: 'M2', name: 'Delivery-funded carry, buy near / sell far (Lens A)', formula: 'rupee carry (buy near / sell far) - financing on full near notional', inputs: 'Rupee carry; financing on notional', units: 'INR', output: 'lensA', rounding: 'Display 0 dp; raw carried' },
  { id: 'F-M2-23', m: 'M2', name: 'Modeled fair carry (financing only)', formula: 'near price x financing rate x spreadDays / 365', inputs: 'Near price; financing rate; spreadDays', units: 'native quotation unit', output: 'fairCarry', rounding: 'Display 2 dp; raw carried', note: 'Excludes storage, insurance and delivery costs. Observed spread minus this is descriptive only.' },
  { id: 'F-M3-01', m: 'M3', name: 'Rate wedge', formula: 'normal total rate - corridor total rate (percentage points)', inputs: 'Two dated rates', units: 'pts', output: 'wedge', rounding: 'Display up to 2 dp' },
  { id: 'F-M3-02', m: 'M3', name: 'Average per month over a period', formula: 'period total / months in period (same series only)', inputs: 'Period total; months', units: 'USD per month', output: 'monthly average', rounding: 'Display 3 significant figures' },
  { id: 'F-M3-03', m: 'M3', name: 'Growth multiple', formula: 'later period / earlier period (same series only)', inputs: 'Two values', units: 'x', output: 'multiple', rounding: 'Display 1 dp' },
  { id: 'F-M3-04', m: 'M3', name: 'Implied unit value', formula: 'value / quantity; USD/kg and USD/troy oz (1 kg = 1,000 / 31.1034768 oz)', inputs: 'Value; kilograms', units: 'USD/kg; USD/oz', output: 'unit value', rounding: 'Display 2 dp' },
  { id: 'F-M3-06', m: 'M3', name: 'Rate wedge x flow (arithmetic cross-check)', formula: 'rate wedge x fiscal-year flow; an upper-bound arithmetic check, not a duty estimate (duty is assessed on tariff value)', inputs: 'Wedge; FY flow', units: 'USD', output: 'cross-check', rounding: 'Display 3 significant figures' },
  { id: 'F-M3-08', m: 'M3', name: 'Symmetric (Shapley) decomposition', formula: 'phi_i = sum over S not containing i of |S|!(n-|S|-1)!/n! x [f(S with i) - f(S)]', inputs: 'Start and end states for the factor groups', units: 'INR per comparison unit', output: 'contributions', rounding: 'Display 2 dp; raw carried', note: 'Order-independent. Not a causal attribution.' }
]);

/* ---------- 1.9 LIMITATIONS (shown on the Limitations panel and in exports) ---------- */
const LIMITATIONS = Object.freeze([
  'Not live. The public site is rebuilt from a daily data snapshot. Nothing on it is tick data, and the build time is shown on every page.',
  'Exchange prices are not published here. MCX display rights are not confirmed and a CME licence is required for COMEX prices, so both appear as UNAVAILABLE unless you enter or load your own in your browser. Those entries never leave your device.',
  'USD/INR is a cross rate derived from ECB reference rates (a daily fixing at about 14:15 Frankfurt time), not FBIL and not a tradable quote.',
  'The customs exchange rate is entered by the site owner from ICEGATE each fortnight. When it is missing for a date, the rupee duty legs are withheld rather than estimated from market USD/INR.',
  'Tariff values are kept in a registry the owner updates when CBIC issues a notification. After a scheduled revision date passes without a registry review, the tariff value is marked STALE.',
  'No trading signal, prediction, forecast, composite score or executable-arbitrage claim. Basis, carry and spreads are descriptive.',
  'Margin figures are hypothetical sensitivities. No MCXCCL margin file or broker policy is loaded, and the calculator does not replicate SPAN risk arrays, tender-period margins or intraday changes.',
  'Not legal, customs, investment or tax advice. The GST base, the 3% default rate and ITC treatment are PROBABLE pending CA confirmation.',
  'Contract specifications come from MCX circulars read on copies and from broker pages; the MCX holiday calendar is not loaded, so a rule-computed expiry is PROBABLE.',
  'Fineness differences between the benchmark, the tariff value and each MCX contract (995 vs 999) are not adjusted.',
  'Only BCD and AIDC are modeled. Other levies, exemptions, cess changes or social welfare surcharge must be added to the duty registry.',
  'Eligibility (the paper rate) is not executability. Licences, quotas, origin rules and channel conditions appear only as dated qualitative flags with citations.',
  'Trade figures are as published by the cited source. Revisions are not tracked; the replay places each figure at its publication date, or at the access date when the release date is not documented.',
  'Local costs are assumptions per comparison unit. Financing is simple interest, ACT/365, on benchmark plus duty.',
  'Excluded unless entered: brokerage, exchange and clearing fees, GST on fees, CTT, stamp duty, slippage, delivery, storage and operational costs.',
  'Your entries persist only in this browser (versioned local storage) and can be cleared at any time. The page blocks all network requests (Content Security Policy connect-src \'none\').'
]);
