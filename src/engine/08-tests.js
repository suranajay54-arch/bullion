/* =============================================================================
 * SECTION 8. AUDIT TEST SUITE (runs in Node: tests/run-tests.js, and in the page:
 * Evidence panel > Run tests). T01-T22 are the Build 2.0.0 tests, ported; N01-N16
 * cover the live-data layer. Fixtures are SYNTHETIC except the reference
 * reconciliation (N15), which uses dated, cited observations of 24 Sep 2026.
 * ctx (optional): { html, csp, renderStepText(ep, stepIdx) }
 * ===========================================================================*/

function tLeaf(v, st, unit) { return mkLeaf('t', 't', v, unit || 'n', st || ST.SYNTHETIC); }
function testInputs(metal, o) {
  o = o || {};
  const L = function (id, v, unit, st) { return mkLeaf(id, id, v, unit || 'n', v === null ? ST.PLACEHOLDER : (st || ST.SYNTHETIC), { sourceId: 'SRC-SYN' }); };
  const g = function (k, d) { return k in o ? o[k] : d; };
  return { metal: metal, comex: L('comex', g('comex', 4600)), usdinr: L('usdinr', g('usdinr', 90)), customsFx: L('customsFx', g('customsFx', 91)),
    tvUsd: L('tvUsd', g('tv', 1470)), tvGrams: CBIC_TARIFF_UNIT[metal].grams,
    freight: L('freight', g('freight', 40)), assay: L('assay', g('assay', 20)), handling: L('handling', g('handling', 25)),
    finRate: L('finRate', g('finRate', 0.08)), finDays: L('finDays', g('finDays', 7)),
    gstRate: L('gstRate', g('gstRate', 0.03), 'rate', ST.PROBABLE), itcShare: L('itcShare', g('itcShare', 1), 'rate', ST.PROBABLE),
    gstBaseId: g('gstBase', 'AV_DUTY'), itcEnabled: g('itc', false) };
}
function testRates(bcd, aidc, total) {
  return ruleRateNodes({ ruleId: 'TEST', corridorId: 'NORMAL', metals: ['gold', 'silver'], effectiveFrom: '2000-01-01', effectiveTo: null, bcd: bcd, aidc: aidc, total: total, verification: 'SYNTHETIC', citations: [] });
}
function testSpreadParams(o) {
  o = o || {};
  const P = function (v) { return mkLeaf('p', 'p', v, 'rate', ST.SYNTHETIC); };
  const g = function (k, d) { return k in o ? o[k] : d; };
  return { spec: SPEC_BY_ID[g('contract', 'GOLD')], near: tLeaf(g('near', 153900)), far: tLeaf(g('far', 155700)), lots: tLeaf(g('lots', 1)),
    valDate: g('val', '2026-10-01'), nearExp: g('nearExp', '2026-12-01'), farExp: g('farExp', '2027-02-01'),
    m: { nearSpan: P(g('nearSpan', 0.06)), farSpan: P(g('farSpan', 0.06)), nearExp: P(g('nearExpo', 0.01)), farExp: P(g('farExpo', 0.01)),
      credit: P(g('credit', 0.75)), direct: g('direct', null) === null ? mkLeaf('d', 'd', null, 'rate', ST.PLACEHOLDER) : P(o.direct),
      addl: P(g('addl', 0)), buffer: P(g('buffer', 0.005)), fin: P(g('fin', 0.09)) } };
}
/* Reference snapshot for N15: dated, cited public observations (not synthetic). Exchange prices
 * (COMEX, MCX) are not kept in the public bundle or repository: the Node runner passes them in
 * ctx.referencePrices from tests/private/ when that file is present on the owner's computer. */
const REFERENCE_20260924 = Object.freeze({
  date: '2026-09-24',
  ecb: { eurusd: 1.1367, eurinr: 109.0775, citation: 'C-ECB-EXR', observedAt: '2026-09-24T14:15:00+02:00' },
  tariff: { gold: 1373, silver: 2028, notification: '75/2026-Customs (N.T.)', citation: 'C-NT75-2026' },
  rule: { bcd: 0.10, aidc: 0.05, total: 0.15, citations: ['C-CUS-15-2026', 'C-CUS-16-2026'] },
  customsFx: { value: 96.80, effectiveFrom: '2026-09-18', notification: 'ICEGATE Exchange Rate Notification No. 27/2026', note: 'ICEGATE numbers exchange-rate notifications in its own series; not Customs (N.T.) 27/2026, which is a tariff-value notification.' }
});

function runTests(ctx) {
  ctx = ctx || {};
  const R = [];
  const t = function (id, name, fn) {
    try {
      const out = fn();
      const pass = out === true || !!(out && out.pass === true);
      R.push({ id: id, name: name, pass: pass, skipped: !!(out && out.skipped), detail: (out && out.detail) || (pass ? 'ok' : 'failed') });
    } catch (e) { R.push({ id: id, name: name, pass: false, detail: 'Exception: ' + e.message }); }
  };
  const close = function (a, b, eps) { return isNum(a) && isNum(b) && Math.abs(a - b) <= (eps || 1e-9) * Math.max(1, Math.abs(a), Math.abs(b)); };
  const refAt = function (valDate, isoNow) { return refFor(valDate, Date.parse(isoNow)); };

  /* ---------------- ported Build 2.0.0 tests ---------------- */
  t('T01', 'Troy-ounce conversion (1 troy oz = 31.1034768 g)', function () {
    const one = computeParity(testInputs('gold', { comex: TROY_OUNCE_GRAMS, usdinr: 1 }), testRates(0.10, 0.05, 0.15)).benchG.value;
    const g = computeParity(testInputs('gold', { comex: 4600, usdinr: 90 }), testRates(0.10, 0.05, 0.15));
    const kg = computeParity(testInputs('silver', { comex: 64, usdinr: 90, tv: 2040 }), testRates(0.10, 0.05, 0.15)).bench.value;
    const ok = TROY_OUNCE_GRAMS === 31.1034768 && close(one, 1) && close(g.benchG.value, 4600 * 90 / 31.1034768) && close(g.bench.value, 4600 * 90 / 31.1034768 * 10) && close(kg, 64 * 90 / 31.1034768 * 1000);
    return { pass: ok, detail: 'INR/g at $4,600 x 90 = ' + g.benchG.value.toFixed(6) + '; gold per 10 g = ' + g.bench.value.toFixed(4) + '; silver per kg = ' + kg.toFixed(4) };
  });
  t('T02', 'All seven contract multipliers, notionals and normalizations (registry specs)', function () {
    const exp = { GOLD: 100, GOLDM: 10, GOLDGUINEA: 1, GOLDPETAL: 1, SILVER: 30, SILVERM: 5, SILVERMIC: 1 };
    const std = { GOLD: [10000, 10000], GOLDM: [10000, 10000], GOLDGUINEA: [8000, 10000], GOLDPETAL: [1000, 10000], SILVER: [100000, 100000], SILVERM: [100000, 100000], SILVERMIC: [100000, 100000] };
    const bad = [];
    Object.keys(exp).forEach(function (id) {
      const sp = SPEC_BY_ID[id];
      if (!sp) { bad.push(id + ' missing'); return; }
      if (sp.lotMultiplierFromQuote !== exp[id]) bad.push(id + ' multiplier ' + sp.lotMultiplierFromQuote);
      const m = computeMcx(sp, tLeaf(std[id][0]));
      if (!close(m.std.value, std[id][1])) bad.push(id + ' normalization ' + m.std.value);
      if (!close(m.notional.value, std[id][0] * exp[id])) bad.push(id + ' notional');
    });
    return { pass: bad.length === 0 && Object.keys(SPEC_BY_ID).length === 7, detail: bad.length ? bad.join('; ') : '7 of 7: multiplier = lot grams / quote grams; Guinea 8,000 per 8 g = 10,000 per 10 g; Petal 1,000 per g = 10,000 per 10 g' };
  });
  t('T03', 'Duty legs sum: registry splits reconcile (10% + 5% = 15%; 5% + 1% = 6%)', function () {
    const a = RULE_BY_ID['R26-NORMAL'], b = RULE_BY_ID['R24-NORMAL'];
    const every = REG.rules.every(function (r) { return r.bcd === null || r.aidc === null || close(r.bcd + r.aidc, r.total, 1e-12); });
    const par = computeParity(testInputs('gold'), ruleRateNodes(a));
    const legs = close(par.duty.value, par.av.value * 0.10 + par.av.value * 0.05) && close(par.duty.value, par.av.value * 0.15);
    return { pass: !!a && !!b && a.total === 0.15 && b.total === 0.06 && every && legs, detail: REG.rules.length + ' rules: every documented split reconciles to its total' };
  });
  t('T04', 'Episode A wedge: 15% - 8% = +7 points (Feb 2024); 6% - 8% = -2 points (after 24 Jul 2024)', function () {
    const A = EPISODES[0];
    const w1 = episodeDerived(A, 1).filter(function (n) { return n.id === 'A-D-wedge'; })[0];
    const w2 = episodeDerived(A, 4).filter(function (n) { return n.id === 'A-D-wedge'; })[0];
    const w0 = episodeDerived(A, 0).filter(function (n) { return n.id === 'A-D-wedge'; })[0];
    const secBadge = w1 && statusLabels(w1).indexOf('SECONDARY INPUT') >= 0;
    return { pass: !!w1 && !!w2 && close(w1.value, 0.07, 1e-12) && close(w2.value, -0.02, 1e-12) && w0.value === null && secBadge,
      detail: 'Feb 2024 ' + fmtPts(w1 && w1.value) + '; after the cut ' + fmtPts(w2 && w2.value) + '; 2 Feb 2023 withheld (CEPA FY23 rate not in registry); badges: ' + (w1 ? statusLabels(w1).join(', ') : '') };
  });
  t('T05', 'Episode B wedges: silver 15% - 7% = +8 pts, gold TRQ 15% - 14% = +1 pt (13 May 2026); before: -1 and +1', function () {
    const B = EPISODES[1];
    const pick = function (i, id) { return episodeDerived(B, i).filter(function (n) { return n.id === id; })[0]; };
    const s1 = pick(1, 'B-D-wedge-silver'), g1 = pick(1, 'B-D-wedge-gold'), s0 = pick(0, 'B-D-wedge-silver'), g0 = pick(0, 'B-D-wedge-gold');
    return { pass: close(s1.value, 0.08, 1e-12) && close(g1.value, 0.01, 1e-12) && close(s0.value, -0.01, 1e-12) && close(g0.value, 0.01, 1e-12),
      detail: '13 May: silver ' + fmtPts(s1.value) + ', gold ' + fmtPts(g1.value) + '; 12 May: silver ' + fmtPts(s0.value) + ', gold ' + fmtPts(g0.value) };
  });
  t('T06', 'Fixed-date day count and annualization', function () {
    const d1 = dayDiff('2026-10-01', '2026-12-01'), d2 = dayDiff('2026-12-01', '2027-02-01'), d3 = dayDiff('2028-02-01', '2028-03-01');
    const sp = computeSpread(testSpreadParams());
    const expCarry = 1800 / 153900 * 365 / 62;
    return { pass: d1 === 61 && d2 === 62 && d3 === 29 && sp.spreadDays.value === 62 && sp.daysToNear.value === 61 && sp.daysToFar.value === 123 && close(sp.carryBN.value, expCarry) && close(sp.breakeven.value, expCarry),
      detail: 'days 61 / 62 / 29 (leap); carry ' + fmtPct(sp.carryBN.value, 4) + ' p.a. = 1800 / 153900 x 365 / 62' };
  });
  t('T07', 'Opposite spread directions are exact sign inverses before costs', function () {
    const sp = computeSpread(testSpreadParams());
    const pairs = [[sp.dirBN, sp.dirSN], [sp.carryBN, sp.carrySN], [sp.rupeeBN, sp.rupeeSN], [sp.periodBN, sp.periodSN], [sp.annBN, sp.annSN]];
    return { pass: pairs.every(function (p) { return p[0].value !== null && p[0].value === -p[1].value; }), detail: 'rupee carry ' + fmtINR(sp.rupeeBN.value, 0) + ' vs ' + fmtINR(sp.rupeeSN.value, 0) };
  });
  t('T08', 'Hypothetical margin offset never creates negative blocked capital', function () {
    const cases = [testSpreadParams({ credit: 1 }), testSpreadParams({ credit: 1, nearSpan: 0 }), testSpreadParams({ credit: 1, farSpan: 0.5, nearSpan: 0.0001 }),
      testSpreadParams({ credit: 1, nearExpo: 0, farExpo: 0, buffer: 0, addl: 0 }), testSpreadParams({ direct: 0 }), testSpreadParams({ direct: 0, nearExpo: 0, farExpo: 0, buffer: 0 })];
    const vals = cases.map(function (c) { const sp = computeSpread(c); return [sp.blocked.value, sp.spreadSpan.value]; });
    const ok = vals.every(function (v) { return v[0] !== null && v[0] >= 0 && v[1] >= 0; });
    const rejects = parseInput('150', 'pct').state === 'INVALID' && parseInput('-1', 'pct').state === 'INVALID';
    return { pass: ok && rejects, detail: 'blocked capital across 6 stress cases: ' + vals.map(function (v) { return fmtINRShort(v[0]); }).join(', ') + '; credit > 100% rejected' };
  });
  t('T09', 'Synthetic status propagates to outputs and exports', function () {
    const par = computeParity(testInputs('gold'), testRates(0.10, 0.05, 0.15));
    const ver = rateWedge(mkLeaf('a', 'a', 0.15, 'rate', ST.VERIFIED), mkLeaf('b', 'b', 0.07, 'rate', ST.VERIFIED));
    const p = buildExport({ module: 'parity', subject: 'test', columns: NODE_COLUMNS, rows: [nodeRow(par.preGst)], nodes: [par.preGst], meta: {} }, new Date(2026, 8, 23, 10, 0, 0));
    const ok = par.preGst.status === ST.DERIVED && par.preGst.flags.syn && statusLabel(par.preGst) === LABEL.DERIVED_SYN && par.gst.flags.prob && statusLabels(par.gst).indexOf('PROBABLE') >= 0 &&
      statusLabel(ver) === LABEL.DERIVED_VER && p.filenameBase === 'parity-test-20260923-100000-SYNTHETIC' && p.json.notLive === true && p.json.watermark === LABEL.SYN_WM &&
      p.json.containsSynthetic === true && p.csvText.indexOf(LABEL.SYN_WM) > 0 && p.csvText.charCodeAt(0) === 0xFEFF;
    return { pass: ok, detail: p.filenameBase + '.json; watermark "' + p.json.watermark + '"; pre-GST landed ' + statusLabel(par.preGst) };
  });
  t('T10', 'Missing values export as null, never zero', function () {
    const ph = mkLeaf('ph', 'Missing', null, 'INR/10g', ST.PLACEHOLDER);
    const d = mkDerived('dd', 'Derived', 'INR/10g', 'F-M1-08', [ph, tLeaf(5)], function (a, b) { return a + b; });
    const par = computeParity(testInputs('gold', { comex: null }), testRates(0.10, 0.05, 0.15));
    const p = buildExport({ module: 'parity', subject: 'ph', columns: NODE_COLUMNS, rows: [nodeRow(ph), nodeRow(d), nodeRow(par.preGst)], nodes: [ph, d, par.preGst], meta: {} });
    const dataLine = p.csvText.split('\r\n').filter(function (l) { return l.indexOf('ph,Missing,') === 0; })[0] || '';
    const ok = d.value === null && d.status === ST.PLACEHOLDER && par.preGst.value === null && p.json.rows[0].value_raw === null && p.json.rows[1].value_raw === null &&
      p.json.rows[2].value_raw === null && dataLine.indexOf('ph,Missing,,') === 0 && p.json.containsPlaceholder === true;
    return { pass: ok, detail: 'JSON value_raw null; CSV cell empty; landed withheld when the benchmark is missing (' + statusLabel(par.preGst) + ')' };
  });
  t('T11', 'CSV escaping and formula-injection guard', function () {
    const ok = csvCell('a,b') === '"a,b"' && csvCell('say "hi"') === '"say ""hi"""' && csvCell('line1\nline2') === '"line1\nline2"' &&
      csvCell('=SUM(A1)') === "'=SUM(A1)" && csvCell('@x') === "'@x" && csvCell(null) === '' && csvCell(-2.5) === '-2.5' && csvCell(true) === 'true' && csvCell(' pad') === '" pad"';
    return { pass: ok, detail: 'commas, quotes, newlines, leading =/@ and padding handled' };
  });
  t('T12', 'Replay steps never show a figure before its publication date', function () {
    const leaks = [];
    EPISODES.forEach(function (ep) {
      ep.steps.forEach(function (s, i) {
        visibleFacts(ep, i).forEach(function (f) { if (f.knowableFrom > s.date) leaks.push(ep.id + i + ':' + f.id); });
      });
    });
    const A = EPISODES[0], B = EPISODES[1];
    const a1 = visibleFacts(A, 1).map(function (f) { return f.id; });
    const a2 = visibleFacts(A, 2).map(function (f) { return f.id; });
    const b1 = visibleFacts(B, 1).map(function (f) { return f.id; });
    const exA1 = stepExec(A, 1, 'CEPA_SILVER'), exA2 = stepExec(A, 2, 'CEPA_SILVER'), exA3 = stepExec(A, 3, 'CEPA_SILVER'), exB6 = stepExec(B, 6, 'CEPA_GOLD_TRQ');
    const execOk = exA1.code === 'NOT_STATED' && exA2.code === 'IN_USE' && exA2.note.indexOf('1.74') < 0 && exA3.note.indexOf('1.74') >= 0 && exB6.note.indexOf('25 Sep') < 0;
    const structural = a1.length === 0 && a2.join() === 'A-F01' && b1.length === 0 && ruleFor('NORMAL', 'silver', B.steps[0].date).ruleId === 'R24-NORMAL' && execOk;
    let textOk = true, textDetail = '';
    if (ctx.renderStepText) {
      const txtA1 = ctx.renderStepText(A, 1), txtB1 = ctx.renderStepText(B, 1);
      ['939', '1.74', '29.2', '1,010', '339.84', '1.97'].forEach(function (x) { if (txtA1.indexOf(x) >= 0) { textOk = false; textDetail += ' A1:' + x; } });
      ['Restricted', 'Authorisation', '33 tonnes', '3.14', '1.02'].forEach(function (x) { if (txtB1.indexOf(x) >= 0) { textOk = false; textDetail += ' B1:' + x; } });
    }
    return { pass: leaks.length === 0 && structural && textOk, detail: leaks.length ? 'Leaks: ' + leaks.join(', ') : ('Feb 2024 step shows rates only; 8 Apr 2024 shows the 939 t report only; 13 May 2026 shows no licensing' + (ctx.renderStepText ? '; rendered text checked' + textDetail : '')) };
  });
  t('T13', 'Validation rejects NaN, infinity, negatives, bad dates, out-of-range %', function () {
    const bad = [['abc', 'price'], ['NaN', 'price'], ['Infinity', 'price'], ['1e400', 'price'], ['-5', 'price'], ['0', 'price'], ['-1', 'cost'], ['101', 'pct'], ['2.5', 'lots'], ['0', 'lots'], ['1.5', 'days']];
    const allBad = bad.every(function (b) { return parseInput(b[0], b[1]).state === 'INVALID'; });
    const okGood = parseInput('1,00,000', 'price').value === 100000 && parseInput('', 'price').state === 'EMPTY' && parseInput('0', 'cost').value === 0;
    const dates = parseISODate('2026-02-30') === null && parseISODate('2026-13-01') === null && parseISODate('26-01-01') === null && parseISODate('2028-02-29') !== null;
    const order = computeSpread(testSpreadParams({ nearExp: '2027-03-01' })).blocked.value !== null && computeSpread(testSpreadParams({ nearExp: '2027-03-01' })).carryBN.value === null;
    return { pass: allBad && okGood && dates && order, detail: bad.length + ' invalid entries rejected; empty = PLACEHOLDER; near >= far expiry withholds day-dependent outputs' };
  });
  t('T14', 'Tariff value is independent of the benchmark (never back-solved)', function () {
    const a = computeParity(testInputs('gold', { comex: 4600 }), testRates(0.10, 0.05, 0.15));
    const b = computeParity(testInputs('gold', { comex: 5200 }), testRates(0.10, 0.05, 0.15));
    const c = computeParity(testInputs('gold', { tv: 1500 }), testRates(0.10, 0.05, 0.15));
    return { pass: a.duty.value === b.duty.value && a.bench.value !== b.bench.value && c.duty.value !== a.duty.value && close(a.av.value, 1470 * 91), detail: 'duty unchanged when the benchmark moves (' + fmtINR(a.duty.value) + '); moves with the tariff value' };
  });
  t('T15', 'Total-rate fallback keeps the missing split as PLACEHOLDER', function () {
    const par = computeParity(testInputs('silver', { comex: 64, tv: 2040 }), ruleRateNodes(RULE_BY_ID['RC-SILVER-FY27']));
    return { pass: !par.splitKnown && par.bcd.value === null && par.bcd.status === ST.PLACEHOLDER && par.aidc.value === null && close(par.duty.value, 2040 * 91 * 0.07), detail: 'CEPA silver duty = duty base x 7% = ' + fmtINR(par.duty.value) + '; BCD and AIDC PLACEHOLDER' };
  });
  t('T16', 'GST is PROBABLE; ITC subtracted only when enabled', function () {
    const off = computeParity(testInputs('gold', { itc: false }), testRates(0.10, 0.05, 0.15));
    const on = computeParity(testInputs('gold', { itc: true, itcShare: 1 }), testRates(0.10, 0.05, 0.15));
    const base = close(off.gstBase.value, off.av.value + off.duty.value);
    return { pass: off.net.value === off.gross.value && close(on.net.value, on.preGst.value) && off.gst.flags.prob && off.itc.value === 0 && base, detail: 'ITC off: net = gross = ' + fmtINR(off.gross.value) + '; ITC on at 100%: net = pre-GST landed' };
  });
  t('T17', 'Symmetric decomposition sums exactly (including the futures quote)', function () {
    const D = SAMPLE_DATA.episodeC;
    const dec = decomposeBasisChange(D.start, D.end, 'gold', 'PRE_GST');
    const tot = dec.rows.reduce(function (s0, r) { return s0 + r.value; }, 0);
    const exDec = decomposeBasisChange(D.start, D.end, 'gold', 'EX_COSTS');
    const tot2 = exDec.rows.reduce(function (s0, r) { return s0 + r.value; }, 0);
    return { pass: close(tot, dec.change, 1e-9) && close(tot2, exDec.change, 1e-9) && dec.rows.length === 6 && exDec.rows.length === 4, detail: 'six contributions sum to the basis change ' + fmtSignedINR(dec.change) + '; before-costs view uses four' };
  });
  t('T18', 'Plain-number twin matches the node engine', function () {
    const par = computeParity(testInputs('silver', { comex: 64, tv: 2040, finDays: 10, freight: 450, assay: 200, handling: 250 }), testRates(0.10, 0.05, 0.15));
    const x = { comex: 64, usdinr: 90, tv: 2040, customsFx: 91, dutyRate: 0.15, freight: 450, assay: 200, handling: 250, finRate: 0.08, finDays: 10 };
    return { pass: close(par.preGst.value, preGstLandedPlain(x, 'silver'), 1e-12) && close(par.exCosts.value, exCostsLandedPlain(x, 'silver'), 1e-12), detail: 'pre-GST landed ' + fmtINR(par.preGst.value) + ' and before-costs landed agree in both engines' };
  });
  t('T19', 'Totals use unrounded legs', function () {
    const par = computeParity(testInputs('gold'), testRates(0.10, 0.05, 0.15));
    const legs = par.bench.value + par.duty.value + par.input.freight.value + par.input.assay.value + par.fin.value + par.input.handling.value;
    return { pass: par.preGst.value === legs && close(par.gross.value, legs + par.gst.value), detail: 'pre-GST landed equals the raw sum of legs to the last bit' };
  });
  t('T20', 'Every replay fact and registry entry cites a located document; pending claims are never shown as facts', function () {
    const bad = [];
    EPISODES.forEach(function (ep) {
      ep.facts.forEach(function (f) {
        if (f.status === 'CITATION PENDING') bad.push(f.id + ' pending shown as fact');
        if (['VERIFIED', 'PRIMARY COPY', 'SECONDARY'].indexOf(f.status) >= 0 && (!f.citation || !REG.citations[f.citation])) bad.push(f.id + ' citation');
      });
      (ep.gaps || []).forEach(function (g) { if (g.status !== 'CITATION PENDING') bad.push(g.id + ' gap status'); });
    });
    REG.exec.forEach(function (x) { if (x.verification === 'CITATION PENDING') bad.push('exec ' + x.corridorId + ' ' + x.metal + ' ' + x.from + ' is CITATION PENDING'); });
    REG.rules.concat(REG.exec).forEach(function (r) { (r.citations || []).forEach(function (c) { if (!REG.citations[c] || !/^https?:\/\//.test(REG.citations[c].url)) bad.push((r.ruleId || r.corridorId) + ':' + c); }); });
    const facts = EPISODES.reduce(function (s0, ep) { return s0 + ep.facts.length; }, 0);
    return { pass: bad.length === 0, detail: bad.length ? bad.join('; ') : facts + ' replay facts and ' + (REG.rules.length + REG.exec.length) + ' registry entries resolve to citations with URLs' };
  });
  t('T21', 'Demo data stays out of the public snapshot', function () {
    const recs = (SNAP && SNAP.records) || [];
    const synVals = [SAMPLE_DATA.usdinr, SAMPLE_DATA.customsFx, SAMPLE_DATA.tariffValue.gold, SAMPLE_DATA.tariffValue.silver];
    const bad = recs.filter(function (r) { return r.verification === 'SYNTHETIC' || r.sourceId === 'SYN-DEMO' || ((r.kind === 'customsfx' || r.kind === 'tv' || r.kind === 'fx.usdinr') && synVals.indexOf(r.value) >= 0); });
    return { pass: recs.length > 0 && bad.length === 0, detail: bad.length ? 'Synthetic-looking records: ' + bad.map(function (r) { return r.id; }).join(', ') : recs.length + ' public records, none synthetic' };
  });
  t('T22', 'No network and no eval: CSP forbids remote calls and inline scripts', function () {
    const c = ctx.csp || '';
    if (!c) return { pass: false, skipped: true, detail: 'Built page not found: run node pipeline/build.js first' };
    return { pass: /connect-src 'none'/.test(c) && !/unsafe-eval/.test(c) && /default-src 'none'/.test(c) && /script-src 'self'/.test(c) && !/script-src[^;]*unsafe-inline/.test(c), detail: 'CSP: connect-src none; script-src self; no unsafe-eval or inline scripts' };
  });

  /* ---------------- new coverage for the live-data layer ---------------- */
  t('N01', 'Unit conversions: oz, g, kg, tariff units', function () {
    const perOz = 1373 / 10 * TROY_OUNCE_GRAMS;
    const kgOz = 1000 / TROY_OUNCE_GRAMS;
    return { pass: close(perOz, 4270.50736464, 1e-11) && close(kgOz, 32.150746568627980, 1e-12) && COMPARISON_UNIT.gold.grams === 10 && CBIC_TARIFF_UNIT.silver.grams === 1000,
      detail: 'tariff value 1,373 USD/10 g = ' + perOz.toFixed(4) + ' USD/oz; 1 kg = ' + kgOz.toFixed(6) + ' oz' };
  });
  t('N02', 'Tariff values selected by effective date; never by benchmark; coverage gaps are UNAVAILABLE', function () {
    const a = tariffRecordFor('gold', '2026-09-15'), b = tariffRecordFor('gold', '2026-09-16'), c = tariffRecordFor('silver', '2026-08-26'), d = tariffRecordFor('gold', '2026-06-30');
    const leaf = leafFromRecord(d, 'tv', 'Tariff value', 'USD/10g', refFor('2026-06-30', Date.parse('2026-09-25T04:00:00Z')));
    return { pass: a && a.value === 1468 && b && b.value === 1373 && c && c.value === 2097 && d === null && leaf.value === null && leaf.status === ST.UNAVAILABLE,
      detail: '15 Sep: 72/2026 gold 1,468; 16 Sep: 75/2026 gold 1,373; 26 Aug: 71/2026 silver 2,097; 30 Jun 2026 (before coverage): UNAVAILABLE' };
  });
  t('N03', 'Customs FX is separate from market USD/INR: missing customs FX withholds rupee duty', function () {
    const I = testInputs('gold', { customsFx: null });
    const I2 = Object.assign({}, I, { customsFx: mkLeaf('customsFx', 'Customs exchange rate', null, 'INR per USD', ST.UNAVAILABLE, { note: 'No ICEGATE rate recorded' }) });
    const p = computeParity(I2, testRates(0.10, 0.05, 0.15));
    const q1 = computeParity(testInputs('gold', { usdinr: 90 }), testRates(0.10, 0.05, 0.15)), q2 = computeParity(testInputs('gold', { usdinr: 99 }), testRates(0.10, 0.05, 0.15));
    const cf = customsFxRecordFor('2026-07-20');
    return { pass: p.duty.value === null && p.av.value === null && p.bench.value !== null && p.dutyUsd.value !== null && /ICEGATE/.test(p.duty.note) && q1.duty.value === q2.duty.value && cf && cf.kind === 'customsfx' && cf.sourceId === 'ICEGATE-ERAM',
      detail: 'benchmark computed, duty withheld (' + p.duty.note.slice(0, 70) + '...); duty unchanged when market USD/INR moves 90 to 99; USD duty still shown' };
  });
  t('N04', 'Duty rules and executability by effective date', function () {
    const r = function (c, m, d) { const x = ruleFor(c, m, d); return x ? x.ruleId : null; };
    const e = function (c, m, d) { return execInfo(execFor(c, m, d)).code; };
    const ok = r('NORMAL', 'gold', '2026-05-12') === 'R24-NORMAL' && r('NORMAL', 'gold', '2026-05-13') === 'R26-NORMAL' && r('NORMAL', 'silver', '2024-07-23') === 'R23-NORMAL' &&
      r('NORMAL', 'silver', '2024-07-24') === 'R24-NORMAL' && r('NORMAL', 'gold', '2023-02-01') === null && r('CEPA_SILVER', 'silver', '2025-06-01') === null &&
      e('NORMAL', 'silver', '2026-05-15') === 'STANDARD' && e('NORMAL', 'silver', '2026-05-16') === 'LICENCE_GATED' && e('CEPA_GOLD_TRQ', 'gold', '2026-09-30') === 'CONSTRAINED' && e('CEPA_GOLD_TRQ', 'gold', '2026-10-01') === 'NOT_STATED';
    return { pass: ok, detail: '12/13 May 2026 switch 6% to 15%; 23/24 Jul 2024 switch 15% to 6%; FY2025-26 CEPA silver gap = PLACEHOLDER; silver licence-gated from 16 May 2026; FY26 gold quota permits lapse after 30 Sep 2026' };
  });
  t('N05', 'Publication schedules: ERAM fortnights and CBIC revision dates', function () {
    const ok = eramEffectiveDatesForMonth(2026, 9).join() === '2026-09-04,2026-09-18' && eramEffectiveDatesForMonth(2026, 10).join() === '2026-10-02,2026-10-16' &&
      nextEramEffectiveAfter('2026-07-17') === '2026-08-07' && nextTariffScheduledInForce('2026-09-25') === '2026-10-01' && nextTariffScheduledInForce('2026-10-01') === '2026-10-16';
    return { pass: ok, detail: 'ERAM in force 4 and 18 Sep, 2 and 16 Oct 2026; next CBIC revision after 25 Sep: 1 Oct' };
  });
  t('N06', 'Stale and missing sources: freshness from cadence, carried through derived values', function () {
    const ecb = REG.usdinr.filter(function (x) { return x.date === '2026-09-24'; })[0] || { id: 'x', kind: 'fx.usdinr', date: '2026-09-24', sourceId: 'USDINR-ECB-CROSS', verification: 'VERIFIED', value: 95.96, observedAt: '2026-09-24T14:15:00+02:00' };
    const f1 = freshnessOf(ecb, refAt(null, '2026-09-25T04:30:00Z')).fresh;
    const f2 = freshnessOf(ecb, refAt(null, '2026-09-28T06:30:00Z')).fresh;
    const tv = tariffRecordFor('gold', '2026-09-24');
    const t1 = freshnessOf(tv, refAt('2026-09-24', '2026-09-25T04:30:00Z')).fresh;
    const t2 = freshnessOf(tv, refAt(null, '2026-10-02T06:30:00Z')).fresh;
    const t3 = freshnessOf(tv, refAt(null, '2026-10-20T06:30:00Z')).fresh;
    /* The 17 Jul 2026 row judged on its own (as if it were the latest): in force, then STALE, then UNAVAILABLE. */
    const cf = Object.assign({}, customsFxRecordFor('2026-07-20') || { id: 'cfx-t', kind: 'customsfx', sourceId: 'ICEGATE-ERAM', verification: 'VERIFIED', value: 97.2, effectiveFrom: '2026-07-17' }, { validTo: null });
    const c1 = freshnessOf(cf, refAt('2026-07-20', '2026-09-25T04:30:00Z')).fresh, c2 = freshnessOf(cf, refAt('2026-08-10', '2026-09-25T04:30:00Z')).fresh, c3 = freshnessOf(cf, refAt('2026-09-24', '2026-09-25T04:30:00Z')).fresh;
    const cfNow = customsFxRecordFor('2026-09-24');
    const c4 = cfNow ? freshnessOf(cfNow, refAt('2026-09-24', '2026-09-25T04:30:00Z')).fresh : 'MISSING';
    const staleLeaf = mkLeaf('s', 'Stale input', 5, 'n', ST.VERIFIED, { fresh: FRESH.STALE });
    const d = mkDerived('d', 'Derived', 'n', 'F-M1-21', [staleLeaf, tLeaf(1, ST.VERIFIED)], function (a, b) { return a + b; });
    const ok = f1 === 'SNAPSHOT' && f2 === 'STALE' && t1 === 'SNAPSHOT' && t2 === 'STALE' && t3 === 'UNAVAILABLE' && c1 === 'SNAPSHOT' && c2 === 'STALE' && c3 === 'UNAVAILABLE' &&
      c4 === 'SNAPSHOT' && cfNow.effectiveFrom === '2026-09-18' && d.fresh === 'STALE' && statusLabels(d).indexOf('STALE') >= 0;
    return { pass: ok, detail: 'ECB 24 Sep: ' + f1 + ' on 25 Sep, ' + f2 + ' on 28 Sep; tariff 75/2026: ' + t1 + ' / ' + t2 + ' after 1 Oct / ' + t3 + ' by 20 Oct; customs FX 17 Jul row alone: ' + c1 + ' / ' + c2 + ' / ' + c3 +
      '; customs FX on 24 Sep: row from ' + (cfNow ? cfNow.effectiveFrom : 'none') + ', ' + c4 + '; derived from a stale input is ' + d.fresh };
  });
  t('N07', 'Asynchronous inputs: warn beyond 12 h, withhold the basis beyond 72 h', function () {
    const mk = function (id, iso) { return mkLeaf(id, id, 100, 'n', ST.USER, { obsAt: iso, rec: { id: id } }); };
    const bench = mk('bench', '2026-09-24T13:30:00-04:00'), fx = mk('fx', '2026-09-24T14:15:00+02:00'), mcxSame = mk('mcx', '2026-09-24T23:55:00+05:30');
    const c1 = coherenceCheck([bench, fx, mcxSame]);
    const c2 = coherenceCheck([bench, fx, mk('mcx2', '2026-09-25T23:55:00+05:30')]);
    const c3 = coherenceCheck([bench, mk('fxOld', '2026-09-18T14:15:00+02:00'), mcxSame]);
    const par = computeParity(testInputs('gold'), testRates(0.10, 0.05, 0.15));
    const b = computeBasis(tLeaf(150000), par, 'EX_COSTS', c3);
    return { pass: !c1.withhold && c1.warnings.length === 0 && c2.warnings.length === 1 && !c2.withhold && !!c3.withhold && b.basis.value === null && /hours apart/.test(b.basis.note),
      detail: 'same session: ' + c1.spanHours.toFixed(1) + ' h, no warning; next-day MCX: warning; 6-day-old FX: basis withheld ("' + b.basis.note.slice(0, 60) + '...")' };
  });
  t('N08', 'Contract and expiry pairing', function () {
    const oct = contractById('GOLD:2026-10'), dec = contractById('GOLD:2026-12');
    const p1 = pairingCheck(parseComexCode('GCZ26'), oct, '2026-09-24');
    const p2 = pairingCheck(parseComexCode('GCZ26'), dec, '2026-09-24');
    const p3 = pairingCheck(parseComexCode('GCZ26'), oct, '2026-10-06');
    const p4 = pairingCheck(parseComexCode('GCZ26'), oct, '2026-10-01');
    const ruleOk = expiryByRule('DAY5_PRECEDING', '2026-12') === '2026-12-04' && expiryByRule('DAY5_PRECEDING', '2027-03') === '2027-03-05' && oct.expiry === '2026-10-05';
    return { pass: p1.warnings.length === 1 && /Delivery months differ/.test(p1.warnings[0]) && p2.warnings.length === 0 && !!p3.withhold && p4.warnings.some(function (w) { return /tender/.test(w); }) && ruleOk && parseComexCode('GCZ26').month === '2026-12' && parseComexCode('XXZ26') === null,
      detail: 'GCZ26 vs GOLD Oct: month warning; vs GOLD Dec: none; after 5 Oct expiry: withheld; 1 Oct: tender-period warning; rule expiries 4 Dec 2026, 5 Mar 2027' };
  });
  t('N09', 'Time zones, daylight saving and holiday calendars', function () {
    const a = new Date(zonedToUTC('2026-10-23', '14:15', 'Europe/Berlin')).toISOString(), b = new Date(zonedToUTC('2026-10-26', '14:15', 'Europe/Berlin')).toISOString();
    const c = new Date(zonedToUTC('2026-10-30', '13:30', 'America/New_York')).toISOString(), d = new Date(zonedToUTC('2026-11-02', '13:30', 'America/New_York')).toISOString();
    const hol = !isBusinessDay('2027-03-26', 'TARGET') && !isBusinessDay('2027-03-29', 'TARGET') && isBusinessDay('2027-03-26', 'WEEKDAYS') && nextBusinessDay('2027-03-25', 'TARGET') === '2027-03-30';
    const easterRec = { id: 'e', kind: 'fx.usdinr', date: '2027-03-25', sourceId: 'USDINR-ECB-CROSS', verification: 'VERIFIED' };
    const fe = freshnessOf(easterRec, refAt(null, '2027-03-29T06:30:00Z')).fresh;
    const wk = freshnessOf(Object.assign({}, easterRec, { date: '2026-09-25' }), refAt(null, '2026-09-27T06:30:00Z')).fresh;
    const ist = isoInZone(Date.parse('2026-09-24T18:25:00Z'), 'Asia/Kolkata') === '2026-09-24T23:55:00+05:30';
    return { pass: a === '2026-10-23T12:15:00.000Z' && b === '2026-10-26T13:15:00.000Z' && c === '2026-10-30T17:30:00.000Z' && d === '2026-11-02T18:30:00.000Z' && hol && fe === 'SNAPSHOT' && wk === 'SNAPSHOT' && ist,
      detail: 'ECB 14:15 is 12:15 UTC before and 13:15 UTC after 25 Oct; COMEX 13:30 ET shifts on 1 Nov; Easter 2027: Thursday rate still current on Easter Monday; weekend keeps Friday current' };
  });
  t('N10', 'Real contract calendar in the spread engine (GOLD Oct to Dec 2026)', function () {
    const oct = contractById('GOLD:2026-10'), dec = contractById('GOLD:2026-12');
    const sp = computeSpread(testSpreadParams({ val: '2026-09-24', nearExp: oct.expiry, farExp: dec.expiry, near: 150000, far: 152000 }));
    return { pass: sp.spreadDays.value === 60 && sp.daysToNear.value === 11 && sp.raw.value === 2000 && close(sp.carryBN.value, 2000 / 150000 * 365 / 60),
      detail: '5 Oct to 4 Dec 2026 = 60 days; valuation 24 Sep to near expiry = 11 days; carry = 2,000 / 1,50,000 x 365 / 60 = ' + fmtPct(sp.carryBN.value, 3) + ' p.a. (synthetic prices)' };
  });
  t('N11', 'Lineage labels: user entries and synthetic inputs are never presented as verified', function () {
    const v = mkLeaf('v', 'v', 1, 'n', ST.VERIFIED), u = mkLeaf('u', 'u', 2, 'n', ST.USER), s = mkLeaf('s', 's', 3, 'n', ST.SYNTHETIC), o = mkLeaf('o', 'o', 4, 'n', ST.OWNER);
    const du = mkDerived('du', 'du', 'n', 'F-M1-21', [v, u], function (a, b) { return a + b; });
    const ds = mkDerived('ds', 'ds', 'n', 'F-M1-21', [v, u, s], function (a, b, c) { return a + b + c; });
    const dv = mkDerived('dv', 'dv', 'n', 'F-M1-21', [v, v], function (a, b) { return a + b; });
    const dow = mkDerived('do', 'do', 'n', 'F-M1-21', [v, o], function (a, b) { return a + b; });
    const tok = exportStatusToken(aggregate([du]));
    return { pass: statusLabel(du) === 'DERIVED' && statusLabels(du).indexOf('USER-ENTERED INPUT') >= 0 && statusLabel(ds) === LABEL.DERIVED_SYN && statusLabel(dv) === LABEL.DERIVED_VER && statusLabels(dow).indexOf('OWNER-ENTERED INPUT') >= 0 && tok === 'USER-ENTERED',
      detail: 'verified + user = DERIVED + USER-ENTERED INPUT; any synthetic = DERIVED FROM SYNTHETIC INPUTS; export token ' + tok };
  });
  t('N12', 'Parse failures are rejected with reasons, never guessed', function () {
    let e1 = '', e2 = '', e3 = '';
    try { parseEcbXml('<html><body>Service unavailable</body></html>'); } catch (e) { e1 = e.message; }
    try { parseBhavcopy('Trade Date,Commodity,Contract,Settle\n24-09-2026,GOLD,05OCT2026,123456\n', 'x.csv'); } catch (e) { e2 = e.message; }
    const cf = parseCustomsFxCsv('effective_from,currency,import_rate\n2026-09-18,USD,9.68\n2026-10-02,USD,97.1\n');
    try { parseCustomsFxCsv('date,rate\n2026-09-18,96.8\n'); } catch (e) { e3 = e.message; }
    const good = parseBhavcopy('Date,Instrument Name,Symbol,Expiry Date,Option Type,Strike Price,Open,High,Low,Close,Previous Close\n24 Sep 2026,FUTCOM,GOLD,05OCT2026,-,0,1,1,1,123456,123000\n24 Sep 2026,OPTFUT,GOLD,05OCT2026,CE,150000,1,1,1,999,999\n24 Sep 2026,FUTCOM,CRUDEOIL,19OCT2026,-,0,1,1,1,5000,5000\n', 'b.csv');
    const dates = parseLooseDate('05OCT2026') === '2026-10-05' && parseLooseDate('24/09/2026') === '2026-09-24' && parseLooseDate('24 Sep 2026') === '2026-09-24' && parseLooseDate('31/02/2026') === null;
    return { pass: /not recognised/.test(e1) && /missing/.test(e2) && cf.rows.length === 1 && cf.errors.length === 1 && /missing columns/.test(e3) && good.rows.length === 1 && good.rows[0].price === 123456 && good.rows[0].month === '2026-10' && dates,
      detail: 'HTML error page rejected; renamed bhavcopy columns rejected; 9.68 rejected as out of range; options and non-bullion rows skipped; 4 date formats read, 31/02 rejected' };
  });
  t('N13', 'Exports carry values, units, lineage, statuses, sources, timestamps and versions', function () {
    const recFx = { id: 'ecb-usdinr-2026-09-24', kind: 'fx.usdinr', value: 95.9598, unit: 'INR per USD', date: '2026-09-24', observedAt: '2026-09-24T14:15:00+02:00', retrievedAt: '2026-09-25T02:40:00Z', sourceId: 'USDINR-ECB-CROSS', url: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml', verification: 'VERIFIED' };
    const fx = leafFromRecord(recFx, 'usdinr', 'USD/INR', 'INR per USD', refAt('2026-09-24', '2026-09-25T04:00:00Z'));
    const d = mkDerived('x', 'x', 'INR/10g', 'F-M1-01', [tLeaf(4000, ST.SECONDARY), fx], function (a, b) { return a * b / TROY_OUNCE_GRAMS; });
    const p = buildExport({ module: 'parity', subject: 'gold', columns: NODE_COLUMNS, rows: [nodeRow(d)], nodes: [d], meta: { valuationDate: '2026-09-24' } }, new Date(2026, 8, 25, 9, 0, 0));
    const row = p.json.rows[0];
    const ok = row.value_raw === d.value && row.value_formatted && row.unit === 'INR/10g' && row.formula_version === BUILD.formulaVersion && row.records === recFx.id &&
      p.json.provenance.length === 1 && p.json.provenance[0].observed_at === recFx.observedAt && p.json.provenance[0].retrieved_at === recFx.retrievedAt && p.json.provenance[0].source_url === recFx.url &&
      p.json.meta.configVersion === BUILD.configVersion && p.csvText.indexOf('# section,provenance') >= 0 && row.input_statuses.indexOf('SECONDARY') >= 0;
    return { pass: ok, detail: 'row + provenance: ' + p.json.provenance[0].record_id + ' observed ' + p.json.provenance[0].observed_at + ', retrieved ' + p.json.provenance[0].retrieved_at + '; formula ' + row.formula_id + ' ' + row.formula_version };
  });
  t('N14', 'Basis-change decomposition sums exactly (Shapley over benchmark, FX, customs duty, costs, financing, quote)', function () {
    const x0 = { comex: 4300, usdinr: 95.741, tv: 1373, customsFx: 96.8, dutyRate: 0.15, freight: 0, assay: 0, handling: 0, finRate: 0, finDays: 0, mcx: 151000 };
    const x1 = { comex: 4300, usdinr: 95.9598, tv: 1373, customsFx: 96.8, dutyRate: 0.15, freight: 0, assay: 0, handling: 0, finRate: 0, finDays: 0, mcx: 150500 };
    const d = decomposeBasisChange(x0, x1, 'gold', 'EX_COSTS');
    const s0 = d.rows.reduce(function (a, r) { return a + r.value; }, 0);
    const fxRow = d.rows.filter(function (r) { return r.key === 'usdinr'; })[0];
    const expectFx = -(4300 * (95.9598 - 95.741) / TROY_OUNCE_GRAMS * 10);
    return { pass: close(s0, d.change, 1e-9) && close(fxRow.value, expectFx, 1e-9) && d.rows.filter(function (r) { return r.key === 'customsDuty'; })[0].value === 0,
      detail: 'FX-only move of +0.2188 contributes ' + fmtSignedINR(fxRow.value) + ' per 10 g to the basis; contributions sum to ' + fmtSignedINR(d.change) };
  });
  t('N15', 'Reference reconciliation, 24 Sep 2026 (cited observations; hand-checkable)', function () {
    const RF = REFERENCE_20260924;
    const usdinr = RF.ecb.eurinr / RF.ecb.eurusd;
    const priv = ctx.referencePrices || null;
    const bUsd = priv ? priv.comex.GCZ26 : null;
    const par = computeParity({ metal: 'gold', comex: bUsd === null ? mkLeaf('comex', 'COMEX GCZ26 settlement', null, 'USD/troy oz', ST.UNAVAILABLE, { note: 'Not in the public bundle' }) : mkLeaf('comex', 'COMEX GCZ26 settlement', bUsd, 'USD/troy oz', ST.SECONDARY),
      usdinr: mkLeaf('usdinr', 'USD/INR (ECB cross)', usdinr, 'INR per USD', ST.VERIFIED),
      customsFx: mkLeaf('customsFx', 'Customs exchange rate (' + RF.customsFx.notification + ')', RF.customsFx.value, 'INR per USD', ST.VERIFIED), tvUsd: mkLeaf('tv', 'Tariff value 75/2026', 1373, 'USD/10g', ST.VERIFIED), tvGrams: 10,
      freight: mkLeaf('f', 'Freight', null, 'INR/10g', ST.UNAVAILABLE), assay: mkLeaf('a', 'Assay', null, 'INR/10g', ST.UNAVAILABLE), handling: mkLeaf('h', 'Handling', null, 'INR/10g', ST.UNAVAILABLE),
      finRate: mkLeaf('r', 'Financing rate', null, 'rate', ST.UNAVAILABLE), finDays: mkLeaf('d', 'Financing days', null, 'days', ST.UNAVAILABLE),
      gstRate: mkLeaf('g', 'GST', 0.03, 'rate', ST.PROBABLE), itcShare: mkLeaf('i', 'ITC', 1, 'rate', ST.PROBABLE), gstBaseId: 'AV_DUTY', itcEnabled: false },
      ruleRateNodes({ ruleId: 'R26-NORMAL', bcd: 0.10, aidc: 0.05, total: 0.15, verification: 'PRIMARY COPY', citations: RF.rule.citations, effectiveFrom: '2026-05-13', effectiveTo: null }));
    const avExp = 1373 * 96.80, dutyExp = avExp * 0.15;
    const cfRec = customsFxRecordFor(RF.date);
    let ok = close(usdinr, 95.95979590041347, 1e-13) && close(par.dutyUsd.value, 205.95, 1e-12) && close(avExp, 132906.4, 1e-12) && close(dutyExp, 19935.96, 1e-12) &&
      close(par.av.value, avExp, 1e-12) && close(par.bcd.value, 13290.64, 1e-12) && close(par.aidc.value, 6645.32, 1e-12) && close(par.duty.value, dutyExp, 1e-12) &&
      !!cfRec && cfRec.value === RF.customsFx.value && cfRec.effectiveFrom === RF.customsFx.effectiveFrom;
    let detail = 'USD/INR ' + usdinr.toFixed(4) + '; duty USD ' + par.dutyUsd.value.toFixed(2) + ' per 10 g; customs rate ' + RF.customsFx.value.toFixed(2) + ' (' + RF.customsFx.notification + ', in force ' + fmtDate(RF.customsFx.effectiveFrom) +
      (cfRec ? '; registry row matches' : '; REGISTRY ROW MISSING') + '): duty base ' + fmtINR(par.av.value) + ', BCD ' + fmtINR(par.bcd.value) + ', AIDC ' + fmtINR(par.aidc.value) + ', duty ' + fmtINR(par.duty.value) + ' per 10 g';
    if (priv) {
      const bench = bUsd * usdinr / TROY_OUNCE_GRAMS * 10;
      const landed = bench + dutyExp, basis = priv.mcx.goldOct - landed;
      const expBasis = priv.expected.goldBasis !== undefined ? priv.expected.goldBasis : priv.expected.goldBasisWhatIf;
      ok = ok && close(par.bench.value, bench, 1e-12) && close(par.bench.value, priv.expected.goldBench, 1e-12) && close(par.exCosts.value, landed, 1e-12) && close(basis, expBasis, 1e-9) && statusLabel(par.bench) === 'DERIVED';
      detail += '; with the private reference prices: benchmark ' + fmtINR(par.bench.value) + ', landed before local costs ' + fmtINR(par.exCosts.value) + ', basis ' + fmtSignedINR(basis) + ' per 10 g';
    } else {
      ok = ok && par.exCosts.value === null;
      detail += '; landed and basis legs need an exchange price, checked only where tests/private/ is present (kept out of the public bundle)';
    }
    return { pass: ok, detail: detail };
  });
  t('N16', 'Static fallback: the page is readable without JavaScript and never blank', function () {
    const html = ctx.html || '';
    if (!html) return { pass: false, skipped: true, detail: 'Built HTML not supplied (run tests/run-tests.js after pipeline/build.js)' };
    const panels = ['how', 'parity', 'basis', 'spreads', 'corridor', 'evidence', 'limits'];
    const missing = panels.filter(function (p) { return html.indexOf('id="' + p + '"') < 0; });
    const hiddenMain = /<section[^>]*class="view[^"]*"[^>]*\shidden/.test(html);
    const viewport = /name="viewport"/.test(html), text = (html.match(/<td/g) || []).length;
    return { pass: missing.length === 0 && !hiddenMain && viewport && text > 40 && html.indexOf('SNAPSHOT') > 0, detail: missing.length ? 'Missing panels: ' + missing.join(', ') : '7 panels prerendered with ' + text + ' table cells; no panel hidden before scripts run; viewport meta present' };
  });
  return R;
}
