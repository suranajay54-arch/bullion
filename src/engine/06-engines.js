/* =============================================================================
 * SECTION 6. ENGINES (pure functions; no DOM)
 * -----------------------------------------------------------------------------
 * 6.1 Rule -> rate nodes (with optional SYNTHETIC scenario override)
 * 6.2 Parity engine: benchmark, duty base, duty legs, GST, landed views
 * 6.3 MCX normalisation, basis, carry to expiry
 * 6.4 Coherence rules: asynchronous inputs, contract and expiry pairing
 * 6.5 Spread / hypothetical-margin engine
 * 6.6 Replay helpers: release-lag visibility, wedges, derived checks
 * 6.7 Symmetric (Shapley) decomposition and basis-change attribution
 * Arithmetic is unchanged from Build 2.0.0 (T18/T19 prove parity); additions are
 * F-M1-21..25 and F-M2-23.
 * ===========================================================================*/

/* ---------- 6.1 rule -> rate nodes ---------- */
function ruleRateNodes(rule, overrideRaw) {
  if (overrideRaw !== undefined && overrideRaw !== null && String(overrideRaw).trim() !== '') {
    const p = parseInput(overrideRaw, 'pct');
    const total = p.state === 'OK'
      ? mkLeaf('rateTotal', 'Total duty rate (scenario override)', p.value / 100, 'rate', ST.SYNTHETIC, { sourceId: 'SRC-USER', note: 'Scenario value typed by the visitor' })
      : mkLeaf('rateTotal', 'Total duty rate (scenario override)', null, 'rate', ST.INVALID, { sourceId: 'SRC-USER', error: p.error });
    return {
      bcd: mkLeaf('rateBcd', 'BCD rate', null, 'rate', ST.PLACEHOLDER, { note: 'Split not applicable to a scenario override' }),
      aidc: mkLeaf('rateAidc', 'AIDC rate', null, 'rate', ST.PLACEHOLDER, { note: 'Split not applicable to a scenario override' }),
      total: total, overridden: true, rule: rule
    };
  }
  if (!rule) {
    const n = 'No dated rule in the registry for this route and date';
    return {
      bcd: mkLeaf('rateBcd', 'BCD rate', null, 'rate', ST.PLACEHOLDER, { note: n }),
      aidc: mkLeaf('rateAidc', 'AIDC rate', null, 'rate', ST.PLACEHOLDER, { note: n }),
      total: mkLeaf('rateTotal', 'Total duty rate', null, 'rate', ST.PLACEHOLDER, { note: n }),
      overridden: false, rule: null
    };
  }
  const st = stFromVerification(rule.verification);
  const x = { sourceId: 'DUTY-RULES', citations: rule.citations || [], prob: !!rule.inferred, fresh: FRESH.SNAPSHOT,
    note: (rule.label || rule.ruleId) + ', in force from ' + fmtDate(rule.effectiveFrom) + (rule.effectiveTo ? ' to ' + fmtDate(addDays(rule.effectiveTo, -1)) : '') + (rule.note ? '. ' + rule.note : '') };
  const split = function (id, lbl, v) {
    return v === null || v === undefined ? mkLeaf(id, lbl, null, 'rate', ST.PLACEHOLDER, Object.assign({}, x, { note: 'Component split not documented: total-rate fallback' }))
      : mkLeaf(id, lbl, v, 'rate', st, x);
  };
  return {
    bcd: split('rateBcd', 'BCD rate', rule.bcd),
    aidc: split('rateAidc', 'AIDC rate', rule.aidc),
    total: rule.total === null ? mkLeaf('rateTotal', 'Total duty rate', null, 'rate', ST.PLACEHOLDER, x) : mkLeaf('rateTotal', 'Total duty rate', rule.total, 'rate', st, x),
    overridden: false, rule: rule
  };
}

/* ---------- 6.2 parity engine ----------
 * I: { metal, comex, usdinr, customsFx, tvUsd, tvGrams, freight, assay, handling,
 *      finRate, finDays, gstRate, itcShare, gstBaseId, itcEnabled }  (nodes except metal/tvGrams/gstBaseId/itcEnabled)
 * R: output of ruleRateNodes()                                                      */
function computeParity(I, R) {
  const cu = COMPARISON_UNIT[I.metal];
  const U = cu.label;
  const N = {};
  const put = function (n) { N[n.id] = n; return n; };
  [I.comex, I.usdinr, I.customsFx, I.tvUsd, I.freight, I.assay, I.handling, I.finRate, I.finDays, I.gstRate, I.itcShare, R.bcd, R.aidc, R.total].forEach(put);

  const benchG = put(mkDerived('benchInrPerG', 'Benchmark per gram', 'INR/g', 'F-M1-01', [I.comex, I.usdinr],
    function (c, x) { return c * x / TROY_OUNCE_GRAMS; }));
  const bench = put(mkDerived('bench', 'Global benchmark value', U, 'F-M1-02', [benchG],
    function (g) { return g * cu.grams; }));
  const av = put(mkDerived('assessable', 'Duty base: CBIC tariff value x customs FX', U, 'F-M1-03', [I.tvUsd, I.customsFx],
    function (t, fx) { return t * fx * (cu.grams / I.tvGrams); }));
  const dutyUsd = put(mkDerived('dutyUsd', 'Customs duty in US dollars (tariff value x total rate)', cu.usdLabel, 'F-M1-22', [I.tvUsd, R.total],
    function (t, r) { return t * r * (cu.grams / I.tvGrams); }));

  const splitKnown = R.bcd.value !== null && R.aidc.value !== null;
  let bcd, aidc, duty, rateEff;
  if (splitKnown) {
    bcd = put(mkDerived('bcd', 'BCD', U, 'F-M1-04', [av, R.bcd], function (a, r) { return a * r; }));
    aidc = put(mkDerived('aidc', 'AIDC', U, 'F-M1-05', [av, R.aidc], function (a, r) { return a * r; }));
    duty = put(mkDerived('duty', 'Customs duty (BCD + AIDC)', U, 'F-M1-06', [bcd, aidc], function (a, b) { return a + b; }));
    rateEff = put(mkDerived('rateEff', 'Effective duty rate (BCD + AIDC)', 'rate', 'F-M1-06', [R.bcd, R.aidc], function (a, b) { return a + b; }));
  } else {
    bcd = put(mkLeaf('bcd', 'BCD', null, U, ST.PLACEHOLDER, { note: 'Component split not documented: total-rate fallback used' }));
    aidc = put(mkLeaf('aidc', 'AIDC', null, U, ST.PLACEHOLDER, { note: 'Component split not documented: total-rate fallback used' }));
    duty = put(mkDerived('duty', 'Customs duty (total-rate fallback)', U, 'F-M1-06', [av, R.total], function (a, r) { return a * r; }));
    rateEff = R.total;
  }
  const exCosts = put(mkDerived('exCosts', 'Landed before local costs (benchmark + duty)', U, 'F-M1-21', [bench, duty], function (b, d) { return b + d; }));
  const fin = put(mkDerived('financing', 'Financing', U, 'F-M1-07', [bench, duty, I.finRate, I.finDays],
    function (b, d, r, n) { return (b + d) * r * n / 365; }));
  const preGst = put(mkDerived('preGst', 'Pre-GST landed (customs-only)', U, 'F-M1-08', [bench, duty, I.freight, I.assay, fin, I.handling],
    function () { return sum(Array.prototype.slice.call(arguments)); }));

  const baseParts = {
    AV_DUTY: [av, duty],
    AV_DUTY_FI: [av, duty, I.freight],
    BENCH_DUTY_LANDED: [bench, duty, I.freight, I.assay, fin, I.handling],
    BENCH_ONLY: [bench]
  }[I.gstBaseId] || [av, duty];
  const gstBase = put(mkDerived('gstBase', 'GST base (methodology assumption)', U, 'F-M1-09', baseParts,
    function () { return sum(Array.prototype.slice.call(arguments)); }, { prob: true }));
  const gst = put(mkDerived('gst', 'GST cash', U, 'F-M1-10', [gstBase, I.gstRate], function (b, r) { return b * r; }, { prob: true }));
  const gross = put(mkDerived('gross', 'Gross cash landed (incl. GST)', U, 'F-M1-11', [preGst, gst], function (a, b) { return a + b; }));
  const itc = I.itcEnabled
    ? put(mkDerived('itc', 'Recoverable ITC (assumption ON)', U, 'F-M1-12', [gst, I.itcShare], function (g, s) { return g * s; }, { prob: true }))
    : put(mkLeaf('itc', 'Recoverable ITC (assumption OFF: nothing subtracted)', 0, U, ST.PROBABLE, { sourceId: 'SRC-METHOD', note: 'Eligible-ITC assumption is off.' }));
  const net = put(mkDerived('net', 'Net economic landed', U, 'F-M1-13', [gross, itc], function (g, i) { return g - i; }));
  const dutyOnBenchCF = put(mkDerived('dutyOnBenchCF', 'Counterfactual: duty if assessed on the benchmark (incorrect method)', U, 'F-M1-20', [bench, rateEff],
    function (b, r) { return b * r; }));
  const dutyBaseGap = put(mkDerived('dutyBaseGap', 'Duty base minus benchmark', U, 'F-M1-03', [av, bench], function (a, b) { return a - b; }));
  const dutyErr = put(mkDerived('dutyErr', 'Duty error from using the benchmark as base', U, 'F-M1-20', [dutyOnBenchCF, duty], function (c, d) { return c - d; }));
  return { metal: I.metal, unit: U, nodes: N, benchG: benchG, bench: bench, av: av, dutyUsd: dutyUsd, bcd: bcd, aidc: aidc, duty: duty, rateEff: rateEff,
    exCosts: exCosts, fin: fin, preGst: preGst, gstBase: gstBase, gst: gst, gross: gross, itc: itc, net: net, splitKnown: splitKnown, rates: R,
    dutyOnBenchCF: dutyOnBenchCF, dutyBaseGap: dutyBaseGap, dutyErr: dutyErr, input: I };
}

/* Plain-number twin of the landed chain (used by the decomposition and a consistency test). */
function preGstLandedPlain(x, metal) {
  const cu = COMPARISON_UNIT[metal].grams;
  const tvG = CBIC_TARIFF_UNIT[metal].grams;
  const bench = x.comex * x.usdinr / TROY_OUNCE_GRAMS * cu;
  const duty = x.tv * x.customsFx * (cu / tvG) * x.dutyRate;
  const fin = (bench + duty) * x.finRate * x.finDays / 365;
  return bench + duty + x.freight + x.assay + fin + x.handling;
}
function exCostsLandedPlain(x, metal) {
  const cu = COMPARISON_UNIT[metal].grams;
  const tvG = CBIC_TARIFF_UNIT[metal].grams;
  return x.comex * x.usdinr / TROY_OUNCE_GRAMS * cu + x.tv * x.customsFx * (cu / tvG) * x.dutyRate;
}

/* ---------- 6.3 MCX normalisation, basis, carry ---------- */
function computeMcx(spec, quote) {
  const cu = COMPARISON_UNIT[spec.metal];
  const perG = mkDerived('mcxPerG', spec.id + ' per gram', 'INR/g', 'F-M1-14', [quote], function (q) { return q / spec.quoteGrams; });
  const std = mkDerived('mcxStd', spec.id + ' standardized', cu.label, 'F-M1-15', [perG], function (g) { return g * cu.grams; });
  const mult = mkLeaf('mult', spec.id + ' lot multiplier', spec.lotMultiplierFromQuote, 'x', spec.sourceStatus,
    { sourceId: spec.sourceId, citations: spec.citations, fresh: FRESH.SNAPSHOT, note: spec.lotSize + ' ' + spec.lotUnit + ' lot / ' + spec.quotationQuantity + ' ' + spec.quotationUnit + ' quotation' });
  const notional = mkDerived('lotNotional', spec.id + ' lot notional', 'INR per lot', 'F-M1-16', [quote, mult], function (q, m) { return q * m; });
  return { spec: spec, quote: quote, perG: perG, std: std, mult: mult, notional: notional };
}
function landedFor(par, view) {
  return view === 'GROSS' ? par.gross : view === 'NET' ? par.net : view === 'EX_COSTS' ? par.exCosts : par.preGst;
}
/* quoteStd: a standardized quote node (MCX futures or a physical quote, never mixed). */
function computeBasis(quoteStd, par, view, coh, tag) {
  const landed = landedFor(par, view);
  const t = tag || '';
  const inputs = [quoteStd, landed];
  const basis = coh && coh.withhold
    ? mkWithheld('basis' + t, 'Modeled basis (quote - landed)', par.unit, 'F-M1-17', inputs, coh.withhold)
    : mkDerived('basis' + t, 'Modeled basis (quote - landed)', par.unit, 'F-M1-17', inputs, function (m, l) { return m - l; }, { warnings: coh ? coh.warnings : [] });
  const basisPct = mkDerived('basisPct' + t, 'Modeled basis %', 'rate', 'F-M1-18', [basis, landed], function (b, l) { return l !== 0 ? b / l : NaN; });
  return { landed: landed, basis: basis, basisPct: basisPct, view: view };
}
function computeCarry(basisNode, landed, finRate, daysToExpiry, tag) {
  const t = tag || '';
  const carry = mkDerived('carryToExpiry' + t, 'Carry to futures expiry (financing only)', landed.unit, 'F-M1-23', [landed, finRate, daysToExpiry],
    function (l, r, d) { return l * r * d / 365; });
  const net = mkDerived('basisNetCarry' + t, 'Basis net of carry', landed.unit, 'F-M1-24', [basisNode, carry], function (b, c) { return b - c; });
  return { carry: carry, net: net };
}

/* ---------- 6.4 coherence rules ----------
 * Market inputs (benchmark, market FX, futures or physical quote) must be close in time.
 * Returns { warnings:[], withhold:null|string, spanHours }                          */
function coherenceCheck(nodes, opts) {
  opts = opts || {};
  const obs = [];
  const seen = {};
  nodes.forEach(function (n) { (n && n.obs || []).forEach(function (o) { if (!seen[o.id]) { seen[o.id] = 1; obs.push(o); } }); });
  const out = { warnings: [], withhold: null, spanHours: null, obs: obs };
  if (obs.length >= 2) {
    const ms = obs.map(function (o) { return Date.parse(o.at); }).filter(isNum);
    const lo = Math.min.apply(null, ms), hi = Math.max.apply(null, ms);
    out.spanHours = (hi - lo) / 3600000;
    const oldest = obs[ms.indexOf(lo)], newest = obs[ms.indexOf(hi)];
    const desc = oldest.label + ' (' + fmtDateTime(lo) + ') and ' + newest.label + ' (' + fmtDateTime(hi) + ')';
    if (out.spanHours > THRESHOLDS.asyncWithholdHours) {
      out.withhold = 'inputs are ' + Math.round(out.spanHours) + ' hours apart, more than the ' + THRESHOLDS.asyncWithholdHours + '-hour limit: ' + desc;
    } else if (out.spanHours > THRESHOLDS.asyncWarnHours) {
      out.warnings.push('Asynchronous inputs: ' + Math.round(out.spanHours) + ' hours apart (' + desc + ').');
    }
  }
  if (opts.valDate) {
    obs.forEach(function (o) {
      const d = dateInZone(Date.parse(o.at), 'Asia/Kolkata');
      const lag = businessDaysBetween(d, opts.valDate, 'WEEKDAYS');
      if (lag > THRESHOLDS.valuationLagWarnBizDays) out.warnings.push(o.label + ' is ' + lag + ' business days older than the valuation date (' + fmtDate(opts.valDate) + ').');
      if (lag < 0) out.warnings.push(o.label + ' is dated after the valuation date.');
    });
  }
  return out;
}
/* Contract and expiry pairing between a benchmark contract, an MCX contract and the valuation date. */
function pairingCheck(benchContract, mcxContract, valDate) {
  const out = { warnings: [], withhold: null };
  if (mcxContract && valDate) {
    if (mcxContract.expiry && valDate > mcxContract.expiry) out.withhold = 'the ' + mcxContract.product + ' ' + fmtMonth(mcxContract.month) + ' contract expired on ' + fmtDate(mcxContract.expiry) + ', before the valuation date';
    else if (mcxContract.expiry && valDate >= tenderStart(mcxContract.expiry)) out.warnings.push('Valuation date falls in the tender (delivery) period of ' + mcxContract.product + ' ' + fmtMonth(mcxContract.month) + ' (from ' + fmtDate(tenderStart(mcxContract.expiry)) + '): prices can reflect delivery economics.');
    if (mcxContract.computed) out.warnings.push('Expiry of ' + mcxContract.product + ' ' + fmtMonth(mcxContract.month) + ' is computed from the rule (PROBABLE: MCX holidays not loaded).');
  }
  if (benchContract && benchContract.generic) out.warnings.push('Benchmark entered as a generic price, not a COMEX contract month.');
  else if (benchContract && mcxContract && benchContract.month !== mcxContract.month) {
    out.warnings.push('Delivery months differ: benchmark ' + benchContract.code + ' (' + fmtMonth(benchContract.month) + ') against MCX ' + fmtMonth(mcxContract.month) + '. The basis then includes term-structure carry between the two months.');
  }
  return out;
}

/* ---------- 6.5 spread and hypothetical-margin engine ----------
 * P: { spec, near, far, lots, valDate, nearExp, farExp (ISO), dateStatus, dateCitations,
 *      m: { nearSpan, farSpan, nearExp, farExp, credit, direct, addl, buffer, fin } (rate nodes) } */
function computeSpread(P) {
  const spec = P.spec;
  const unit = spec.displayQuotation;
  const N = {};
  const put = function (n) { N[n.id] = n; return n; };
  const dErr = [];
  const tv = parseISODate(P.valDate), tn = parseISODate(P.nearExp), tf = parseISODate(P.farExp);
  if (tv === null) dErr.push('Valuation date is not a valid date');
  if (tn === null) dErr.push('Near expiry is not a valid date');
  if (tf === null) dErr.push('Far expiry is not a valid date');
  if (!dErr.length) {
    if (!(tv <= tn)) dErr.push('Valuation date must be on or before the near expiry');
    if (!(tn < tf)) dErr.push('Near expiry must be before the far expiry');
  }
  const dateOk = dErr.length === 0;
  const dst = P.dateStatus || ST.SYNTHETIC;
  const mkDay = function (id, label, v) {
    return dateOk ? mkLeaf(id, label, v, 'days', dst, { sourceId: dst === ST.SYNTHETIC ? 'SRC-SYN' : 'MCX-SPEC', citations: P.dateCitations || [], note: 'Calendar days, ACT/365', fresh: dst === ST.SYNTHETIC ? FRESH.NA : FRESH.SNAPSHOT, prob: !!P.dateProbable })
                  : mkLeaf(id, label, null, 'days', ST.INVALID, { error: dErr.join('; ') });
  };
  const spreadDays = put(mkDay('spreadDays', 'Spread days (far expiry - near expiry)', dateOk ? dayDiff(P.nearExp, P.farExp) : null));
  const daysToNear = put(mkDay('daysToNear', 'Days to near expiry', dateOk ? dayDiff(P.valDate, P.nearExp) : null));
  const daysToFar = put(mkDay('daysToFar', 'Days to far expiry', dateOk ? dayDiff(P.valDate, P.farExp) : null));
  const mult = put(mkLeaf('mult', 'Lot multiplier (' + spec.id + ')', spec.lotMultiplierFromQuote, 'x', spec.sourceStatus, { sourceId: spec.sourceId, citations: spec.citations, fresh: spec.sourceStatus === ST.SYNTHETIC ? FRESH.NA : FRESH.SNAPSHOT }));
  [P.near, P.far, P.lots].forEach(put);
  Object.keys(P.m).forEach(function (k) { put(P.m[k]); });
  const coh = coherenceCheck([P.near, P.far]);
  const raw = put(coh.withhold
    ? mkWithheld('rawSpread', 'Raw spread (far - near)', unit, 'F-M2-02', [P.near, P.far], coh.withhold)
    : mkDerived('rawSpread', 'Raw spread (far - near)', unit, 'F-M2-02', [P.near, P.far], function (n, f) { return f - n; }, { warnings: coh.warnings }));
  const dirBN = put(mkDerived('dirBNSF', 'Directional spread: buy near / sell far', unit, 'F-M2-02', [raw], function (r) { return r; }));
  const dirSN = put(mkDerived('dirSNBF', 'Directional spread: sell near / buy far', unit, 'F-M2-02', [raw], function (r) { return -r; }));
  const carry = function (id, label, d) {
    return put(mkDerived(id, label, 'rate-p.a.', 'F-M2-03', [d, P.near, spreadDays], function (x, n, t) { return t > 0 ? x / n * 365 / t : NaN; }));
  };
  const carryBN = carry('carryBNSF', 'Annualized price carry: buy near / sell far', dirBN);
  const carrySN = carry('carrySNBF', 'Annualized price carry: sell near / buy far', dirSN);
  const breakeven = put(mkDerived('breakevenFin', 'Breakeven annualized financing rate (Lens A)', 'rate-p.a.', 'F-M2-04', [raw, P.near, spreadDays],
    function (r, n, t) { return t > 0 ? r / n * 365 / t : NaN; }));
  const fairCarry = put(mkDerived('fairCarry', 'Modeled fair carry (financing only)', unit, 'F-M2-23', [P.near, P.m.fin, spreadDays], function (n, r, t) { return n * r * t / 365; }));
  const spreadVsFair = put(mkDerived('spreadVsFair', 'Observed spread minus modeled fair carry', unit, 'F-M2-23', [raw, fairCarry], function (a, b) { return a - b; }));
  const rupee = function (id, label, d) {
    return put(mkDerived(id, label, 'INR', 'F-M2-05', [d, mult, P.lots], function (x, m, l) { return x * m * l; }));
  };
  const rupeeBN = rupee('rupeeBNSF', 'Rupee carry: buy near / sell far', dirBN);
  const rupeeSN = rupee('rupeeSNBF', 'Rupee carry: sell near / buy far', dirSN);
  const nearNotional = put(mkDerived('nearNotional', 'Near-leg notional', 'INR', 'F-M2-06', [P.near, mult, P.lots], function (p, m, l) { return p * m * l; }));
  const farNotional = put(mkDerived('farNotional', 'Far-leg notional', 'INR', 'F-M2-06', [P.far, mult, P.lots], function (p, m, l) { return p * m * l; }));
  const maxNotional = put(mkDerived('maxNotional', 'max(notional)', 'INR', 'F-M2-06', [nearNotional, farNotional], function (a, b) { return Math.max(a, b); }));
  const nearSpan = put(mkDerived('nearSpan', 'Near-leg outright margin (hypothetical)', 'INR', 'F-M2-07', [nearNotional, P.m.nearSpan], function (a, r) { return a * r; }));
  const farSpan = put(mkDerived('farSpan', 'Far-leg outright margin (hypothetical)', 'INR', 'F-M2-07', [farNotional, P.m.farSpan], function (a, r) { return a * r; }));
  const nearExpo = put(mkDerived('nearExposure', 'Near-leg exposure (hypothetical)', 'INR', 'F-M2-08', [nearNotional, P.m.nearExp], function (a, r) { return a * r; }));
  const farExpo = put(mkDerived('farExposure', 'Far-leg exposure (hypothetical)', 'INR', 'F-M2-08', [farNotional, P.m.farExp], function (a, r) { return a * r; }));
  const grossOutright = put(mkDerived('grossOutright', 'Gross outright margin (both legs, no offset)', 'INR', 'F-M2-09', [nearSpan, farSpan, nearExpo, farExpo],
    function (a, b, c, d) { return a + b + c + d; }));
  const directMode = P.m.direct.value !== null || P.m.direct.status === ST.INVALID;
  let spanOffset = null, spreadSpan;
  if (directMode) {
    spreadSpan = put(mkDerived('spreadSpan', 'Spread margin, direct rate (hypothetical)', 'INR', 'F-M2-11', [maxNotional, P.m.direct], function (a, r) { return Math.max(0, a * r); }));
  } else {
    spanOffset = put(mkDerived('spanOffset', 'Spread credit offset (hypothetical)', 'INR', 'F-M2-10', [nearSpan, farSpan, P.m.credit], function (a, b, c) { return Math.min(a, b) * c; }));
    spreadSpan = put(mkDerived('spreadSpan', 'Spread margin, offset method (hypothetical)', 'INR', 'F-M2-10', [nearSpan, farSpan, spanOffset], function (a, b, o) { return Math.max(0, a + b - o); }));
  }
  const addl = put(mkDerived('addl', 'Additional / special margin (hypothetical)', 'INR', 'F-M2-12', [maxNotional, P.m.addl], function (a, r) { return a * r; }));
  const buffer = put(mkDerived('buffer', 'Broker buffer (hypothetical)', 'INR', 'F-M2-13', [maxNotional, P.m.buffer], function (a, r) { return a * r; }));
  const blocked = put(mkDerived('blocked', 'Blocked capital (hypothetical)', 'INR', 'F-M2-14', [spreadSpan, nearExpo, farExpo, addl, buffer],
    function (s, a, b, c, d) { return Math.max(0, s + a + b + c + d); }));
  const zeroNote = 'Blocked capital is zero: return on blocked capital is undefined.';
  const period = function (id, label, r) {
    return put(mkDerived(id, label, 'rate', 'F-M2-15', [r, blocked], function (x, b) { return b > 0 ? x / b : NaN; }, { undefinedNote: zeroNote }));
  };
  const periodBN = period('periodBNSF', 'Period return on blocked capital: buy near / sell far', rupeeBN);
  const periodSN = period('periodSNBF', 'Period return on blocked capital: sell near / buy far', rupeeSN);
  const ann = function (id, label, p) {
    return put(mkDerived(id, label, 'rate-p.a.', 'F-M2-16', [p, spreadDays], function (x, t) { return t > 0 ? x * 365 / t : NaN; }));
  };
  const annBN = ann('annBNSF', 'Annualized blocked-capital return: buy near / sell far', periodBN);
  const annSN = ann('annSNBF', 'Annualized blocked-capital return: sell near / buy far', periodSN);
  const finCost = put(mkDerived('finCost', 'Financing cost on blocked capital', 'INR', 'F-M2-17', [blocked, P.m.fin, spreadDays], function (b, r, t) { return b * r * t / 365; }));
  const netR = function (id, label, r) { return put(mkDerived(id, label, 'INR', 'F-M2-18', [r, finCost], function (x, f) { return x - f; })); };
  const netBN = netR('netBNSF', 'Net rupee carry: buy near / sell far', rupeeBN);
  const netSN = netR('netSNBF', 'Net rupee carry: sell near / buy far', rupeeSN);
  const netAnn = function (id, label, n) {
    return put(mkDerived(id, label, 'rate-p.a.', 'F-M2-19', [n, blocked, spreadDays], function (x, b, t) { return (b > 0 && t > 0) ? x / b * 365 / t : NaN; }, { undefinedNote: zeroNote }));
  };
  const netAnnBN = netAnn('netAnnBNSF', 'Net annualized blocked-capital return: buy near / sell far', netBN);
  const netAnnSN = netAnn('netAnnSNBF', 'Net annualized blocked-capital return: sell near / buy far', netSN);
  const leverage = put(mkDerived('leverage', 'Notional leverage on blocked capital', 'x', 'F-M2-20', [nearNotional, blocked], function (n, b) { return b > 0 ? n / b : NaN; }, { undefinedNote: zeroNote }));
  const finNotional = put(mkDerived('finNotional', 'Financing on full near notional (Lens A)', 'INR', 'F-M2-21', [nearNotional, P.m.fin, spreadDays], function (n, r, t) { return n * r * t / 365; }));
  const lensA = put(mkDerived('lensA', 'Delivery-funded carry, buy near / sell far (Lens A)', 'INR', 'F-M2-22', [rupeeBN, finNotional], function (r, f) { return r - f; }));
  return { N: N, spec: spec, unit: unit, dateOk: dateOk, dateErrors: dErr, directMode: directMode, coherence: coh,
    spreadDays: spreadDays, daysToNear: daysToNear, daysToFar: daysToFar, mult: mult, raw: raw,
    dirBN: dirBN, dirSN: dirSN, carryBN: carryBN, carrySN: carrySN, breakeven: breakeven, fairCarry: fairCarry, spreadVsFair: spreadVsFair,
    rupeeBN: rupeeBN, rupeeSN: rupeeSN, nearNotional: nearNotional, farNotional: farNotional, maxNotional: maxNotional,
    nearSpan: nearSpan, farSpan: farSpan, nearExpo: nearExpo, farExpo: farExpo, grossOutright: grossOutright,
    spanOffset: spanOffset, spreadSpan: spreadSpan, addl: addl, buffer: buffer, blocked: blocked,
    periodBN: periodBN, periodSN: periodSN, annBN: annBN, annSN: annSN, finCost: finCost, netBN: netBN, netSN: netSN,
    netAnnBN: netAnnBN, netAnnSN: netAnnSN, leverage: leverage, finNotional: finNotional, lensA: lensA, P: P };
}

/* ---------- 6.6 replay helpers (release-lag time machine) ---------- */
function stepDate(ep, stepIdx) { const s = ep.steps[stepIdx]; return s ? s.date : null; }
function stepRuleDate(ep, stepIdx) { const s = ep.steps[stepIdx]; return s ? (s.ruleDate || s.date) : null; }
/* Facts whose cited document was published (knowable) on or before the date. */
function factsKnowableOn(ep, dateISO) { return ep.facts.filter(function (f) { return f.knowableFrom <= dateISO; }); }
function visibleFacts(ep, stepIdx) { return factsKnowableOn(ep, stepDate(ep, stepIdx)); }
function factNode(f) {
  const st = stFromVerification(f.status);
  const x = { sourceId: f.citation ? 'CITATION' : 'SRC-METHOD', citations: f.citation ? [f.citation] : [], note: f.note || '', fresh: FRESH.SNAPSHOT };
  if ((f.value === null || f.value === undefined) && f.text) {
    return mkLeaf(f.id, f.label, null, 'text', st, Object.assign(x, { display: f.text }));
  }
  if (f.value === null || f.value === undefined) {
    return mkLeaf(f.id, f.label, null, f.unit, ST.UNAVAILABLE, x);
  }
  return mkLeaf(f.id, f.label, f.value, f.unit, st, Object.assign(x, { approx: f.approx, display: f.display }));
}
function corridorMetal(corridorId, ep) {
  const c = CORRIDOR_BY_ID[corridorId];
  return c && c.metals.length === 1 ? c.metals[0] : ep.metal;
}
function stepRule(ep, stepIdx, corridorId) { return ruleFor(corridorId, corridorMetal(corridorId, ep), stepRuleDate(ep, stepIdx)); }
function stepExec(ep, stepIdx, corridorId) { return execInfo(execFor(corridorId, corridorMetal(corridorId, ep), stepRuleDate(ep, stepIdx), stepDate(ep, stepIdx))); }
function rateWedge(normalTotalNode, corridorTotalNode, id, label) {
  return mkDerived(id || 'wedge', label || 'Rate wedge (normal - corridor)', 'pts', 'F-M3-01', [normalTotalNode, corridorTotalNode], function (a, b) { return a - b; });
}
/* Derived checks per step, built only from facts knowable at that step and rules in force. */
function episodeDerived(ep, stepIdx) {
  const vis = {};
  visibleFacts(ep, stepIdx).forEach(function (f) { vis[f.id] = factNode(f); });
  const out = [];
  const wedgeFor = function (corr, metal, id, label) {
    const n = ruleFor('NORMAL', metal, stepRuleDate(ep, stepIdx)), c = ruleFor(corr, metal, stepRuleDate(ep, stepIdx));
    return rateWedge(ruleRateNodes(n).total, ruleRateNodes(c).total, id, label);
  };
  if (ep.id === 'A') {
    out.push(wedgeFor('CEPA_SILVER', 'silver', 'A-D-wedge', 'Silver paper wedge: normal - CEPA'));
    if (vis['A-F02'] && vis['A-F03']) out.push(mkDerived('A-D-mult', 'FY24 / FY23 multiple (same fiscal-year series)', 'x1', 'F-M3-03', [vis['A-F03'], vis['A-F02']], function (b, a) { return b / a; }));
    if (vis['A-F06'] && vis['A-F07']) out.push(mkDerived('A-D-multcy', 'CY2024 / CY2023 multiple (same calendar-year series)', 'x1', 'F-M3-03', [vis['A-F07'], vis['A-F06']], function (b, a) { return b / a; }));
    if (vis['A-F07']) {
      const kg = mkLeaf('A-F07-kg', 'Quantity CY2024', 2463050, 'kg', ST.VERIFIED, { citations: ['C-WITS-2024'], sourceId: 'CITATION', fresh: FRESH.SNAPSHOT });
      const perKg = mkDerived('A-D-unitkg', 'Implied unit value, HS 7106 from UAE, CY2024 (USD/kg)', 'USD/kg-v', 'F-M3-04', [vis['A-F07'], kg], function (v, q) { return v / q; });
      out.push(perKg);
      out.push(mkDerived('A-D-unitoz', 'Implied unit value, CY2024 (USD/troy oz)', 'USD/oz-v', 'F-M3-04', [perKg], function (k) { return k * TROY_OUNCE_GRAMS / 1000; }));
    }
    if (vis['A-F03']) {
      const fy = '2024-02-29';
      const w24 = rateWedge(ruleRateNodes(ruleFor('NORMAL', 'silver', fy)).total, ruleRateNodes(ruleFor('CEPA_SILVER', 'silver', fy)).total, 'A-D-w24', 'FY24 silver wedge');
      out.push(mkDerived('A-D-xcheck', 'Cross-check: FY24 wedge x FY24 flow (upper-bound arithmetic, not a duty estimate)', 'USD', 'F-M3-06', [w24, vis['A-F03']], function (a, b) { return a * b; }));
    }
  }
  if (ep.id === 'B') {
    out.push(wedgeFor('CEPA_SILVER', 'silver', 'B-D-wedge-silver', 'Silver paper wedge: normal - CEPA'));
    out.push(wedgeFor('CEPA_GOLD_TRQ', 'gold', 'B-D-wedge-gold', 'Gold TRQ paper wedge: normal - in-quota'));
    if (vis['B-F06'] && vis['B-F07']) out.push(mkDerived('B-D-growth', 'UAE gold, Apr-Jun 2026 / Apr-Jun 2025', 'x1', 'F-M3-03', [vis['B-F06'], vis['B-F07']], function (b, a) { return b / a; }));
  }
  return out;
}
/* Chart rows at a step: average per month for each visible flow, grouped by series.
 * Series are never spliced; the renderer draws each series as its own group. */
function episodeChartRows(ep, stepIdx) {
  const rows = [];
  visibleFacts(ep, stepIdx).forEach(function (f) {
    if (f.type !== 'flow' || !f.series) return;
    const n = factNode(f);
    if (f.value === null || f.value === undefined) { rows.push({ key: f.id, series: f.series, label: f.chartLabel || f.label, value: null, status: n.status, node: n, fact: f }); return; }
    if (!f.months) return;
    const months = mkLeaf(f.id + '-m', 'Months in period', f.months, 'months', stFromVerification(f.status), { citations: f.citation ? [f.citation] : [], sourceId: 'CITATION' });
    const avg = mkDerived(f.id + '-avg', 'Average per month: ' + (f.chartLabel || f.period), 'USD', 'F-M3-02', [n, months], function (v, m) { return v / m; });
    rows.push({ key: f.id, series: f.series, label: f.chartLabel || f.period, value: avg.value, node: avg, total: n, fact: f });
  });
  return rows;
}

/* ---------- 6.7 symmetric decomposition ---------- */
const DECOMP_GROUPS = Object.freeze({
  benchmark: ['comex'],
  usdinr: ['usdinr'],
  customsDuty: ['tv', 'customsFx', 'dutyRate'],
  localCosts: ['freight', 'assay', 'handling'],
  financing: ['finRate', 'finDays']
});
const DECOMP_LABELS = Object.freeze({
  benchmark: 'Global benchmark (COMEX)', usdinr: 'Market USD/INR', customsDuty: 'Customs FX, tariff value and duty rate',
  localCosts: 'Local costs', financing: 'Financing', quote: 'Futures quote (MCX)'
});
function factorial(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }
function shapleyDecompose(startX, endX, f, groups) {
  const G = groups || DECOMP_GROUPS;
  const keys = Object.keys(G);
  const n = keys.length;
  const phi = {};
  keys.forEach(function (k) { phi[k] = 0; });
  const evalMask = function (mask) {
    const x = Object.assign({}, startX);
    keys.forEach(function (k, i) { if (mask & (1 << i)) G[k].forEach(function (fld) { x[fld] = endX[fld]; }); });
    return f(x);
  };
  const cache = {};
  const ev = function (m) { if (!(m in cache)) cache[m] = evalMask(m); return cache[m]; };
  for (let i = 0; i < n; i++) {
    for (let mask = 0; mask < (1 << n); mask++) {
      if (mask & (1 << i)) continue;
      let s = 0; for (let b = 0; b < n; b++) if (mask & (1 << b)) s++;
      const w = factorial(s) * factorial(n - s - 1) / factorial(n);
      phi[keys[i]] += w * (ev(mask | (1 << i)) - ev(mask));
    }
  }
  return { phi: phi, fStart: ev(0), fEnd: ev((1 << n) - 1) };
}
/* Basis change between two complete input sets (plain numbers, including mcx std quote).
 * view: 'EX_COSTS' (benchmark + duty) or 'PRE_GST'. Returns contributions to the BASIS:
 * quote change, and minus each landed group's Shapley share. Sums exactly to the basis change. */
function decomposeBasisChange(x0, x1, metal, view) {
  const exOnly = view === 'EX_COSTS';
  const groups = exOnly ? { benchmark: DECOMP_GROUPS.benchmark, usdinr: DECOMP_GROUPS.usdinr, customsDuty: DECOMP_GROUPS.customsDuty } : DECOMP_GROUPS;
  const f = function (x) { return exOnly ? exCostsLandedPlain(x, metal) : preGstLandedPlain(x, metal); };
  const dec = shapleyDecompose(x0, x1, f, groups);
  const rows = [{ key: 'quote', label: DECOMP_LABELS.quote, value: x1.mcx - x0.mcx }];
  Object.keys(groups).forEach(function (k) { rows.push({ key: k, label: DECOMP_LABELS[k], value: -dec.phi[k] }); });
  const basis0 = x0.mcx - dec.fStart, basis1 = x1.mcx - dec.fEnd;
  return { rows: rows, basis0: basis0, basis1: basis1, change: basis1 - basis0, landed0: dec.fStart, landed1: dec.fEnd, phi: dec.phi, view: exOnly ? 'EX_COSTS' : 'PRE_GST' };
}
