/* =============================================================================
 * SECTION 12. INPUT RESOLUTION: snapshot records, visitor entries, demo values
 * -----------------------------------------------------------------------------
 * Public mode: public records from the snapshot; exchange prices only if the
 * visitor enters them (USER-ENTERED, local only). Demo mode: SYNTHETIC values for
 * everything market-like, with the real registries (rates, contract calendar)
 * so the arithmetic is shown end to end. The two are never blended: in demo mode
 * no snapshot market record is used, and in public mode no synthetic value is.
 * ===========================================================================*/

function isDemo() { return APP.mode === 'demo'; }
function valDate() { return (!isDemo() && APP.state.valDate) ? APP.state.valDate : todayIST(); }
function viewRef() { return refFor(valDate()); }
function synLeaf(id, label, v, unit, extra) { return mkLeaf(id, label, v, unit, ST.SYNTHETIC, Object.assign({ sourceId: 'SRC-SYN', note: 'Synthetic demonstration value' }, extra || {})); }

/* Market USD/INR: ECB cross (derived from two VERIFIED ECB leaves), newest on or before the date. */
function resolveUsdinr(dateISO, ref, idSuffix) {
  const sfx = idSuffix || '';
  if (isDemo()) return synLeaf('usdinr' + sfx, 'USD/INR (market)', SAMPLE_DATA.usdinr, 'INR per USD');
  const rec = usdinrRecordAsOf(dateISO);
  if (!rec) return mkLeaf('usdinr' + sfx, 'USD/INR (ECB cross)', null, 'INR per USD', ST.UNAVAILABLE, { sourceId: 'ECB-EXR', note: 'No ECB observation on or before ' + fmtDate(dateISO) + ' in this snapshot' });
  const ri = REG.ecb['ecb-eurinr-' + rec.date], ru = REG.ecb['ecb-eurusd-' + rec.date];
  const li = leafFromRecord(ri, 'eurinr' + sfx, 'EUR/INR (ECB, ' + fmtDate(rec.date) + ')', 'INR per EUR', ref);
  const lu = leafFromRecord(ru, 'eurusd' + sfx, 'EUR/USD (ECB, ' + fmtDate(rec.date) + ')', 'USD per EUR', ref);
  return mkDerived('usdinr' + sfx, 'USD/INR (ECB cross, ' + fmtDate(rec.date) + ')', 'INR per USD', 'F-FX-01', [li, lu], function (i, u) { return i / u; },
    { note: 'Derived by this site from ECB reference rates; not an ECB publication of USD/INR and not FBIL.' });
}
function resolveTariff(metal, dateISO, ref, sfx) {
  const u = CBIC_TARIFF_UNIT[metal].unit;
  if (isDemo()) return synLeaf('tvUsd' + (sfx || ''), 'CBIC tariff value (synthetic)', SAMPLE_DATA.tariffValue[metal], u);
  const rec = tariffRecordFor(metal, dateISO);
  return leafFromRecord(rec, 'tvUsd' + (sfx || ''), 'CBIC tariff value' + (rec ? ' (' + rec.notification.replace('-Customs (N.T.)', ' N.T.') + ')' : ''), u, ref,
    { missingNote: 'No tariff value in the registry for ' + fmtDate(dateISO) + ' (registry coverage starts ' + fmtDate(REG.tariffMeta && REG.tariffMeta.coverageFrom) + ')', sourceId: 'CBIC-TV' });
}
function resolveCustomsFx(dateISO, ref, sfx) {
  const id = 'customsFx' + (sfx || '');
  if (isDemo()) return synLeaf(id, 'Customs exchange rate (synthetic)', SAMPLE_DATA.customsFx, 'INR per USD');
  const u = APP.state.user.customsFx;
  if (!sfx && String(u.value).trim() !== '') {
    const p = parseInput(u.value, 'price');
    if (p.state !== 'OK') return mkLeaf(id, 'Customs exchange rate (your entry)', null, 'INR per USD', ST.INVALID, { sourceId: 'VISITOR', error: p.error });
    if (p.value < 50 || p.value > 200) return mkLeaf(id, 'Customs exchange rate (your entry)', null, 'INR per USD', ST.INVALID, { sourceId: 'VISITOR', error: 'expected between 50 and 200 INR per USD' });
    const eff = u.effectiveFrom && parseISODate(u.effectiveFrom) !== null ? u.effectiveFrom : dateISO;
    const rec = { id: 'user-customsfx', kind: 'customsfx', value: p.value, unit: 'INR per USD', effectiveFrom: eff, validTo: nextEramEffectiveAfter(eff), sourceId: 'ICEGATE-ERAM',
      verification: 'USER-ENTERED', note: 'Entered in this browser for the ERAM fortnight from ' + fmtDate(eff) + '.' };
    return leafFromRecord(rec, id, 'Customs exchange rate (your entry)', 'INR per USD', ref);
  }
  const rec = customsFxRecordFor(dateISO);
  return leafFromRecord(rec, id, 'Customs exchange rate (ICEGATE ERAM)', 'INR per USD', ref,
    { missingNote: 'No ICEGATE customs rate is recorded on or before ' + fmtDate(dateISO), sourceId: 'ICEGATE-ERAM' });
}
function resolveRates(corridorId, metal, dateISO, overrideRaw) { return ruleRateNodes(ruleFor(corridorId, metal, dateISO), overrideRaw); }

/* Benchmark: owner COMEX record (only if public display allowed), else the visitor's entry. */
function resolveBench(metal, dateISO, ref) {
  if (isDemo()) {
    const c = parseComexCode(SAMPLE_DATA.benchmarkContract[metal]);
    return { leaf: synLeaf('comex', 'Benchmark ' + c.code + ' (synthetic)', SAMPLE_DATA.comex[metal], 'USD/troy oz'), contract: c };
  }
  const own = REG.comex.filter(function (r) { return r.metal === metal && r.date <= dateISO; }).pop();
  if (own) return { leaf: leafFromRecord(own, 'comex', 'COMEX ' + own.contract + ' settlement', 'USD/troy oz', ref), contract: parseComexCode(own.contract) };
  const u = APP.state.user.bench[metal];
  const code = String(u.contract || '').trim().toUpperCase();
  const c = code === 'SPOT' || code === '' ? { code: 'generic', generic: true, metal: metal } : parseComexCode(code);
  if (String(u.price).trim() === '') {
    return { leaf: mkLeaf('comex', 'Global benchmark (USD/troy oz)', null, 'USD/troy oz', ST.UNAVAILABLE, { sourceId: 'COMEX-SETTLE',
      note: 'COMEX prices are not published on this site (a CME licence is required). Enter one below: it stays in your browser.' }), contract: c };
  }
  const p = parseInput(u.price, 'price');
  if (p.state !== 'OK' || !c || (c.metal && c.metal !== metal)) {
    return { leaf: mkLeaf('comex', 'Global benchmark (your entry)', null, 'USD/troy oz', ST.INVALID, { sourceId: 'VISITOR',
      error: p.state !== 'OK' ? p.error : 'Contract must look like ' + (metal === 'gold' ? 'GCZ26' : 'SIZ26') + ' or SPOT' }), contract: c };
  }
  const d = u.date && parseISODate(u.date) !== null ? u.date : dateISO;
  const rec = visitorRecord('benchmark.user', 'user-bench-' + metal, p.value, 'USD/troy oz', d, c.generic ? '12:00' : '13:30', c.generic ? 'Asia/Kolkata' : 'America/New_York',
    { contract: c.generic ? null : c.code, month: c.month || null, metal: metal });
  return { leaf: leafFromRecord(rec, 'comex', (c.generic ? 'Generic benchmark' : 'COMEX ' + c.code) + ' (your entry)', 'USD/troy oz', ref), contract: c };
}
function costLeaf(metal, field, id, label, unit, rule, pct) {
  const cu = COMPARISON_UNIT[metal];
  if (isDemo()) {
    const lc = SAMPLE_DATA.localCosts[metal];
    const v = { freight: lc.freight, assay: lc.assay, handling: lc.handling, finRate: lc.finRatePct / 100, finDays: lc.finDays }[field];
    return synLeaf(id, label, v, unit);
  }
  const raw = APP.state.user.costs[metal][field];
  if (String(raw).trim() !== '') {
    const p = parseInput(raw, rule);
    if (p.state !== 'OK') return mkLeaf(id, label + ' (your entry)', null, unit, ST.INVALID, { sourceId: 'VISITOR', error: p.error });
    return mkLeaf(id, label + ' (your assumption)', pct ? p.value / 100 : p.value, unit, ST.USER, { sourceId: 'VISITOR', fresh: FRESH.SNAPSHOT, note: LABEL.LOCAL_ONLY });
  }
  const key = { freight: 'freight', assay: 'assay', handling: 'handling', finRate: 'financingRatePct', finDays: 'financingDays' }[field];
  const rec = REG.costs.filter(function (r) { return r.metal === metal && r.field === key; })[0];
  if (rec) {
    return mkLeaf(id, label + ' (site assumption)', pct ? rec.value / 100 : rec.value, unit, ST.ASSUMPTION, { sourceId: 'LOCAL-COSTS', fresh: freshnessOf(rec, viewRef()).fresh, rec: rec, note: rec.note || 'Owner assumption' });
  }
  return mkLeaf(id, label, null, unit, ST.UNAVAILABLE, { sourceId: 'LOCAL-COSTS', note: 'Not supplied. Enter your own assumption ' + cu.per + '.' });
}
function resolveCosts(metal) {
  const U = COMPARISON_UNIT[metal].label;
  return {
    freight: costLeaf(metal, 'freight', 'freight', 'Freight and insurance', U, 'cost'),
    assay: costLeaf(metal, 'assay', 'assay', 'Assay and refining', U, 'cost'),
    handling: costLeaf(metal, 'handling', 'handling', 'Handling and clearing', U, 'cost'),
    finRate: costLeaf(metal, 'finRate', 'finRate', 'Financing rate', 'rate', 'pct', true),
    finDays: costLeaf(metal, 'finDays', 'finDays', 'Financing days', 'days', 'days')
  };
}
function resolveGst() {
  const g = APP.state.gst;
  const p = parseInput(g.ratePct, 'pct'), s = parseInput(g.itcSharePct, 'pct');
  return {
    gstRate: p.state === 'OK' ? mkLeaf('gstRate', 'GST rate (methodology default)', p.value / 100, 'rate', ST.PROBABLE, { sourceId: 'SRC-METHOD', note: GST_METHOD.defaultRateNote })
      : mkLeaf('gstRate', 'GST rate', null, 'rate', p.state === 'EMPTY' ? ST.PLACEHOLDER : ST.INVALID, { error: p.error }),
    itcShare: s.state === 'OK' ? mkLeaf('itcShare', 'Recoverable ITC share', s.value / 100, 'rate', ST.PROBABLE, { sourceId: 'SRC-METHOD' })
      : mkLeaf('itcShare', 'Recoverable ITC share', null, 'rate', ST.INVALID, { error: s.error }),
    gstBaseId: g.base, itcEnabled: !!g.itcEnabled
  };
}
/* Full parity for a metal and route on the valuation date. */
function parityFor(metal, corridorId, opts) {
  opts = opts || {};
  const d = opts.date || valDate(), ref = opts.ref || refFor(d);
  const bench = opts.bench || resolveBench(metal, d, ref);
  const costs = resolveCosts(metal), gst = resolveGst();
  const I = Object.assign({ metal: metal, comex: bench.leaf, usdinr: opts.usdinr || resolveUsdinr(d, ref), customsFx: resolveCustomsFx(d, ref),
    tvUsd: resolveTariff(metal, d, ref), tvGrams: CBIC_TARIFF_UNIT[metal].grams }, costs, gst);
  const R = resolveRates(corridorId, metal, d, opts.override);
  const par = computeParity(I, R);
  par.benchContract = bench.contract;
  par.valDate = d;
  par.corridorId = corridorId;
  return par;
}
/* MCX quote for a contract id ('GOLD:2026-10'): owner record (if public) or visitor entry. */
function resolveMcx(contractId, dateISO, ref, sfx) {
  const c = contractById(contractId);
  const id = 'mcx' + (sfx || '');
  if (!c) return { leaf: mkLeaf(id, 'MCX quote', null, 'native', ST.INVALID, { error: 'Unknown contract' }), contract: null };
  const spec = SPEC_BY_ID[c.product];
  const unit = spec.displayQuotation;
  const label = c.product + ' ' + fmtMonth(c.month) + ' (expiry ' + fmtDate(c.expiry) + ')';
  if (isDemo()) {
    const sp = SAMPLE_DATA.spread.prices[c.product];
    const v = sfx === '-far' ? sp.far : sfx === '-near' ? sp.near : SAMPLE_DATA.mcxQuote[c.product];
    return { leaf: synLeaf(id, label + ' (synthetic)', v, unit), contract: c };
  }
  const own = REG.mcx.filter(function (r) { return r.product === c.product && r.month === c.month && r.date <= dateISO; }).pop();
  if (own) return { leaf: leafFromRecord(own, id, label + ' ' + own.priceType.toLowerCase(), unit, ref), contract: c };
  const u = APP.state.user.mcx[contractId] || blankEntry();
  if (String(u.price).trim() === '') {
    return { leaf: mkLeaf(id, label, null, unit, ST.UNAVAILABLE, { sourceId: 'MCX-SETTLE', note: 'MCX prices are not published on this site (display rights not confirmed). Enter a price or load a bhavcopy file: it stays in your browser.' }), contract: c };
  }
  const p = parseInput(u.price, 'price');
  if (p.state !== 'OK') return { leaf: mkLeaf(id, label + ' (your entry)', null, unit, ST.INVALID, { sourceId: 'VISITOR', error: p.error }), contract: c };
  const d = u.date && parseISODate(u.date) !== null ? u.date : dateISO;
  const rec = visitorRecord('mcx.user', 'user-mcx-' + contractId, p.value, unit, d, '23:55', 'Asia/Kolkata', { product: c.product, month: c.month, expiry: c.expiry,
    document: u.file || null, note: u.file ? 'From ' + u.file + ', loaded in this browser.' : undefined });
  return { leaf: leafFromRecord(rec, id, label + (u.file ? ' (your file)' : ' (your entry)'), unit, ref), contract: c };
}
function resolvePhysical(metal, dateISO, ref) {
  const U = COMPARISON_UNIT[metal].label;
  if (isDemo()) return synLeaf('phys', 'Physical quote (synthetic)', SAMPLE_DATA.physicalQuote[metal], U);
  const u = APP.state.user.physical[metal];
  if (String(u.price).trim() === '') return mkLeaf('phys', 'Physical quote', null, U, ST.UNAVAILABLE, { sourceId: 'VISITOR', note: 'No licensed physical (IBJA or dealer) quote is connected. Enter one you are entitled to use; it stays in your browser.' });
  const p = parseInput(u.price, 'price');
  if (p.state !== 'OK') return mkLeaf('phys', 'Physical quote (your entry)', null, U, ST.INVALID, { sourceId: 'VISITOR', error: p.error });
  const d = u.date && parseISODate(u.date) !== null ? u.date : dateISO;
  const rec = visitorRecord('physical.quote', 'user-phys-' + metal, p.value, U, d, '12:00', 'Asia/Kolkata', { metal: metal, note: 'Physical ' + (u.fineness || '') + ' quote' + (u.source ? ' from ' + u.source : '') + ', entered in this browser (time assumed 12:00 IST).' });
  return leafFromRecord(rec, 'phys', 'Physical ' + (u.fineness || '') + ' quote (your entry)', U, ref);
}
/* Product options for selects */
function contractOptions(product) {
  return contractsFor(product, valDate(), 8).filter(function (c) { return c.expiry >= valDate(); }).map(function (c) {
    return { value: c.id, label: c.product + ' ' + fmtMonth(c.month) + ' (exp. ' + fmtDate(c.expiry) + (c.computed ? ', rule' : '') + ')' };
  });
}
