/* =============================================================================
 * SECTION 9. VIEW MODELS (pure; used by the page and by the static prerender)
 * The static prerender (pipeline/build.js) and the interactive page read the same
 * rows, so the no-JavaScript fallback can never disagree with the app.
 * ===========================================================================*/

/* Public-only parity (no visitor entries): what the snapshot alone supports. */
function publicUsdinr(dateISO, ref) {
  const rec = usdinrRecordAsOf(dateISO);
  if (!rec) return mkLeaf('usdinr', 'USD/INR (ECB cross)', null, 'INR per USD', ST.UNAVAILABLE, { sourceId: 'ECB-EXR', note: 'No ECB observation in this snapshot' });
  const li = leafFromRecord(REG.ecb['ecb-eurinr-' + rec.date], 'eurinr', 'EUR/INR (ECB, ' + fmtDate(rec.date) + ')', 'INR per EUR', ref);
  const lu = leafFromRecord(REG.ecb['ecb-eurusd-' + rec.date], 'eurusd', 'EUR/USD (ECB, ' + fmtDate(rec.date) + ')', 'USD per EUR', ref);
  return mkDerived('usdinr', 'USD/INR (ECB cross, ' + fmtDate(rec.date) + ')', 'INR per USD', 'F-FX-01', [li, lu], function (i, u) { return i / u; });
}
function publicParity(metal, corridorId, dateISO, ref) {
  const U = COMPARISON_UNIT[metal].label;
  const tvRec = tariffRecordFor(metal, dateISO);
  const cfRec = customsFxRecordFor(dateISO);
  const bRec = REG.comex.filter(function (r) { return r.metal === metal && r.date <= dateISO; }).pop();
  const costRec = function (k) { return REG.costs.filter(function (r) { return r.metal === metal && r.field === k; })[0]; };
  const cost = function (k, id, label, unit, pct) {
    const r = costRec(k);
    return r ? mkLeaf(id, label + ' (site assumption)', pct ? r.value / 100 : r.value, unit, ST.ASSUMPTION, { sourceId: 'LOCAL-COSTS', rec: r, fresh: FRESH.SNAPSHOT })
      : mkLeaf(id, label, null, unit, ST.UNAVAILABLE, { sourceId: 'LOCAL-COSTS', note: 'Not supplied' });
  };
  const I = {
    metal: metal,
    comex: bRec ? leafFromRecord(bRec, 'comex', 'COMEX ' + bRec.contract, 'USD/troy oz', ref) : mkLeaf('comex', 'Global benchmark (COMEX)', null, 'USD/troy oz', ST.UNAVAILABLE, { sourceId: 'COMEX-SETTLE', note: 'Not published here: CME licence required' }),
    usdinr: publicUsdinr(dateISO, ref),
    customsFx: leafFromRecord(cfRec, 'customsFx', 'Customs exchange rate (ICEGATE ERAM)', 'INR per USD', ref, { missingNote: 'No ICEGATE rate recorded', sourceId: 'ICEGATE-ERAM' }),
    tvUsd: leafFromRecord(tvRec, 'tvUsd', 'CBIC tariff value' + (tvRec ? ' (' + tvRec.notification.replace('-Customs (N.T.)', ' N.T.') + ')' : ''), CBIC_TARIFF_UNIT[metal].unit, ref, { missingNote: 'Outside registry coverage', sourceId: 'CBIC-TV' }),
    tvGrams: CBIC_TARIFF_UNIT[metal].grams,
    freight: cost('freight', 'freight', 'Freight and insurance', U), assay: cost('assay', 'assay', 'Assay and refining', U), handling: cost('handling', 'handling', 'Handling', U),
    finRate: cost('financingRatePct', 'finRate', 'Financing rate', 'rate', true), finDays: cost('financingDays', 'finDays', 'Financing days', 'days'),
    gstRate: mkLeaf('gstRate', 'GST rate (methodology default)', GST_METHOD.defaultRatePct / 100, 'rate', ST.PROBABLE, { sourceId: 'SRC-METHOD' }),
    itcShare: mkLeaf('itcShare', 'Recoverable ITC share', 1, 'rate', ST.PROBABLE, { sourceId: 'SRC-METHOD' }),
    gstBaseId: GST_METHOD.defaultBase, itcEnabled: false
  };
  const par = computeParity(I, ruleRateNodes(ruleFor(corridorId, metal, dateISO)));
  par.valDate = dateISO;
  return par;
}
function nodeState(n) { return statusLabels(n).join(' | '); }
function nodeValueText(n) { return n.value === null ? statusLabel(n) : fmtNode(n); }

/* Today's inputs at a glance (How-to-read panel and static page). */
function statusBoardRows(ref) {
  const d = ref.valDate;
  const rows = [];
  const fx = publicUsdinr(d, ref);
  const fxRec = usdinrRecordAsOf(d);
  rows.push({ item: 'Market USD/INR (ECB cross)', value: nodeValueText(fx), state: nodeState(fx), time: fxRec ? 'ECB reference of ' + fmtDateTime(fxRec.observedAt, 'Asia/Kolkata', 'Europe/Berlin') : '', source: 'ECB-EXR' });
  METALS.forEach(function (m) {
    const r = tariffRecordFor(m, d);
    const l = leafFromRecord(r, 'tv', 'Tariff value', CBIC_TARIFF_UNIT[m].unit, ref);
    rows.push({ item: 'CBIC tariff value, ' + m, value: nodeValueText(l), state: nodeState(l), time: r ? r.notification + ', in force from ' + fmtDate(r.effectiveFrom) : '', source: 'CBIC-TV', note: l.note });
  });
  const cr = customsFxRecordFor(d);
  const cl = leafFromRecord(cr, 'cfx', 'Customs FX', 'INR per USD', ref);
  rows.push({ item: 'Customs exchange rate (imports, USD)', value: nodeValueText(cl), state: nodeState(cl), time: cr ? 'last recorded fortnight from ' + fmtDate(cr.effectiveFrom) : 'none recorded', source: 'ICEGATE-ERAM', note: cl.note });
  METALS.forEach(function (m) {
    const R = ruleRateNodes(ruleFor('NORMAL', m, d));
    rows.push({ item: 'Normal-route duty, ' + m + ' bars', value: nodeValueText(R.total) + (R.rule && R.rule.bcd !== null ? ' (' + fmtPct(R.rule.bcd, 0) + ' BCD + ' + fmtPct(R.rule.aidc, 0) + ' AIDC)' : ''), state: nodeState(R.total), time: R.rule ? 'in force from ' + fmtDate(R.rule.effectiveFrom) : '', source: 'DUTY-RULES' });
  });
  ['COMEX-SETTLE', 'MCX-SETTLE'].forEach(function (id) {
    const s = REG.sources[id];
    if (s) rows.push({ item: id === 'COMEX-SETTLE' ? 'COMEX gold and silver settlements' : 'MCX bullion futures closes', value: s.publicDisplay.allowed ? 'published' : 'not published here', state: s.publicDisplay.allowed ? 'OWNER-ENTERED' : 'UNAVAILABLE', time: '', source: id, note: s.publicDisplay.reason });
  });
  const costs = REG.costs.length;
  rows.push({ item: 'Local cost and financing assumptions', value: costs ? costs + ' published' : 'not supplied', state: costs ? 'ASSUMPTION' : 'UNAVAILABLE', time: '', source: 'LOCAL-COSTS', note: costs ? '' : 'Landed values are shown before local costs.' });
  return rows;
}
const STATE_LEGEND = Object.freeze([
  ['VERIFIED', 'Read in the primary document on an official website.'],
  ['PRIMARY COPY', 'Read in the full text of the primary document, on a third-party copy (the official site could not be reached).'],
  ['SECONDARY', 'Reported by a named source such as a news agency or broker. The primary document was not located.'],
  ['CITATION PENDING', 'Claimed earlier but no document located. Never shown as a fact.'],
  ['OWNER-ENTERED', 'Entered by the site owner from a named official source.'],
  ['USER-ENTERED', 'Typed or loaded by you. Stays in your browser.'],
  ['ASSUMPTION', 'An editable cost or financing assumption, not market data.'],
  ['DERIVED', 'Calculated here. Extra labels name the weakest kind of input used. "Derived from verified inputs" appears only when every input is VERIFIED.'],
  ['PROBABLE', 'A method or reading that needs professional confirmation (for example the GST base).'],
  ['SYNTHETIC', 'Invented demonstration value. Only in demo mode and tests.'],
  ['PLACEHOLDER', 'Not documented for this date. Left out of every calculation, never treated as zero.'],
  ['UNAVAILABLE', 'A known gap. Not estimated.'],
  ['SNAPSHOT', 'A dated observation that is the newest its source schedule implies.'],
  ['STALE', 'An older observation kept visible because a newer one was due and is missing.'],
  ['LIVE / DELAYED', 'Reserved for licensed feeds. Nothing on this site is live.']
]);
/* Contract calendar rows (static page and spreads panel). */
function calendarRows(fromISO) {
  const out = [];
  REG.specs.forEach(function (s) {
    contractsFor(s.id, fromISO, 4).filter(function (c) { return c.expiry >= fromISO; }).slice(0, 3).forEach(function (c) {
      out.push({ product: s.id, month: fmtMonth(c.month), expiry: fmtDate(c.expiry), tender: fmtDate(tenderStart(c.expiry)), quote: s.displayQuotation || ('INR/' + s.quotationQuantity + s.quotationUnit),
        lot: s.lotSize + ' ' + s.lotUnit, evidence: c.computed ? 'PROBABLE (rule-computed)' : c.verification });
    });
  });
  return out;
}
function routeRows(dateISO) {
  return [{ c: 'NORMAL', m: 'gold' }, { c: 'CEPA_GOLD_TRQ', m: 'gold' }, { c: 'NORMAL', m: 'silver' }, { c: 'CEPA_SILVER', m: 'silver' }].map(function (x) {
    const rule = ruleFor(x.c, x.m, dateISO), nrule = ruleFor('NORMAL', x.m, dateISO);
    const tv = tariffRecordFor(x.m, dateISO);
    const scale = COMPARISON_UNIT[x.m].grams / CBIC_TARIFF_UNIT[x.m].grams;
    const ex = execInfo(execFor(x.c, x.m, dateISO));
    return { route: CORRIDOR_BY_ID[x.c].name + (x.c === 'NORMAL' ? ' (' + x.m + ')' : ''), rate: rule ? fmtPct(rule.total, 0) + ' [' + rule.verification + ']' : 'PLACEHOLDER',
      wedge: x.c !== 'NORMAL' && rule && nrule ? fmtPts(nrule.total - rule.total) : '',
      dutyUsd: rule && tv ? fmtUSD(tv.value * rule.total * scale) + ' ' + COMPARISON_UNIT[x.m].per : 'withheld',
      exec: ex.label + ' [' + ex.verification + ']: ' + ex.note };
  });
}

/* Plain-language staleness rule for a source (evidence panel, docs). */
function staleRuleText(rule) {
  if (!rule) return '';
  switch (rule.type) {
    case 'businessDaily': return 'STALE if no newer observation by ' + rule.publishLocal + ' ' + rule.tz + ' on the next ' + (rule.calendar === 'TARGET' ? 'TARGET' : 'weekday') + ' business day, plus ' + rule.graceHours + ' h grace.';
    case 'cbicTariffSchedule': return 'STALE from 00:00 IST on a scheduled revision date (the 1st or 16th) unless the registry has been reviewed; UNAVAILABLE ' + rule.staleDaysBeforeUnavailable + ' days after that.';
    case 'eramSchedule': return 'Each rate covers one ERAM fortnight; STALE for up to ' + rule.staleDaysBeforeUnavailable + ' days after its fortnight ends, then UNAVAILABLE.';
    case 'maxAgeDays': return 'STALE when older than ' + rule.days + ' days.';
    default: return 'In force until changed in the registry.';
  }
}
