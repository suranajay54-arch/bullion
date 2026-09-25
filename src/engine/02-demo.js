/* =============================================================================
 * SECTION 2. SYNTHETIC DEMONSTRATION DATA (demo mode and test fixtures only)
 * -----------------------------------------------------------------------------
 * Every value below is SYNTHETIC: round numbers invented for demonstration.
 * They are used only (a) in demo mode (#demo/...), where every card, chart and
 * export carries the SYNTHETIC watermark, and (b) as deterministic test fixtures.
 * The public snapshot never contains these values (test T21 checks this).
 * ===========================================================================*/
const SAMPLE_DATA = Object.freeze({
  version: BUILD.sampleDataVersion,
  label: 'SYNTHETIC sample snapshot - demonstration values, not market data',
  benchmarkContract: { gold: 'GCZ26', silver: 'SIZ26' },
  comex: { gold: 4600.00, silver: 64.00 },            /* USD per troy oz */
  usdinr: 90.00,                                      /* INR per USD, market convention stand-in */
  customsFx: 91.00,                                   /* INR per USD, CBIC-notified import rate stand-in */
  tariffValue: { gold: 1470.00, silver: 2040.00 },    /* USD per 10 g (gold), USD per kg (silver) */
  localCosts: {                                        /* INR per comparison unit; rate % p.a.; days */
    gold:   { freight: 40, assay: 20, handling: 25, finRatePct: 8.00, finDays: 7 },
    silver: { freight: 450, assay: 200, handling: 250, finRatePct: 8.00, finDays: 10 }
  },
  demoRanges: {                                        /* guidance for the demo, not a market survey */
    gold:   { freight: [15, 60], assay: [0, 50], handling: [10, 50], finRatePct: [6, 11], finDays: [3, 30] },
    silver: { freight: [200, 800], assay: [0, 400], handling: [100, 500], finRatePct: [6, 11], finDays: [3, 30] }
  },
  physicalQuote: { gold: 153600, silver: 213500 },    /* INR per comparison unit; synthetic physical dealer quote */
  mcxQuote: {                                          /* native quotation unit of each contract */
    GOLD: 153900, GOLDM: 153850, GOLDGUINEA: 123100, GOLDPETAL: 15392,
    SILVER: 214900, SILVERM: 214850, SILVERMIC: 214820
  },
  spread: {
    valuationDate: '2026-10-01', nearExpiry: '2026-12-01', farExpiry: '2027-02-01', lots: 1,
    datesNote: 'Sample dates, not the MCX expiry calendar.',
    prices: {                                          /* native quotation unit */
      GOLD: { near: 153900, far: 155700 }, GOLDM: { near: 153850, far: 155640 },
      GOLDGUINEA: { near: 123100, far: 124530 }, GOLDPETAL: { near: 15392, far: 15571 },
      SILVER: { near: 214900, far: 217600 }, SILVERM: { near: 214850, far: 217540 },
      SILVERMIC: { near: 214820, far: 217500 }
    }
  },
  margin: {                                            /* percent; SYNTHETIC assumptions, not MCXCCL parameters */
    nearSpanPct: 6.00, farSpanPct: 6.00, nearExposurePct: 1.00, farExposurePct: 1.00,
    spreadCreditPct: 75.00, directSpreadMarginPct: null, additionalSpecialPct: 0.00,
    brokerBufferPct: 0.50, financingRatePct: 9.00
  },
  episodeC: {                                          /* synthetic start and end states for the demo basis-change decomposition */
    metal: 'gold', contractId: 'GOLD',
    startLabel: 'Day 1 (synthetic)', endLabel: 'Day 5 (synthetic)',
    usdinrOHLC: { open: 88.00, high: 90.40, low: 87.90, close: 90.00 },
    start: { comex: 4650.00, usdinr: 88.00, tv: 1470.00, customsFx: 89.00, dutyRate: 0.15, freight: 40, assay: 20, handling: 25, finRate: 0.08, finDays: 7, mcx: 150600 },
    end:   { comex: 4600.00, usdinr: 90.00, tv: 1470.00, customsFx: 91.00, dutyRate: 0.15, freight: 40, assay: 20, handling: 25, finRate: 0.08, finDays: 7, mcx: 153900 },
    catalyst: 'Synthetic demonstration: no real catalyst'
  }
});
