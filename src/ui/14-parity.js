/* =============================================================================
 * SECTION 14. PARITY PANEL: evidence waterfall from the benchmark to landed cost
 * ===========================================================================*/

function metalSeg(onChange) {
  return segmented({ label: 'Metal', get: function () { return APP.state.metal; }, set: function (v) { APP.state.metal = v; },
    options: [{ value: 'gold', label: 'Gold (per 10 g)' }, { value: 'silver', label: 'Silver (per kg)' }], onChange: onChange });
}
function valDateField(onChange) {
  if (isDemo()) return h('div', { class: 'field date' }, h('span', { class: 'lbl' }, 'Valuation date'), h('div', { class: 'meta' }, fmtDate(valDate()) + ' (today; demo prices have no market time)'));
  return dateField({ id: 'valDate-' + APP.panel, label: 'Valuation date (IST)', get: function () { return APP.state.valDate || todayIST(); },
    set: function (v) { APP.state.valDate = (v === todayIST() ? '' : v); }, max: todayIST(), onChange: onChange,
    hint: 'Today by default. Earlier dates use the rules, tariff values and rates in force then.' });
}
function landedViewSelect(id, onChange) {
  return selectField({ id: id, label: 'Landed view', get: function () { return APP.state.landedView; }, set: function (v) { APP.state.landedView = v; },
    options: LANDED_VIEWS.map(function (v) { return { value: v.id, label: v.label }; }), onChange: onChange,
    hint: LANDED_VIEWS.filter(function (v) { return v.id === APP.state.landedView; })[0].note });
}
function corridorSelect(id, metal, onChange) {
  return selectField({ id: id, label: 'Route', get: function () { return APP.state.corridor[metal]; }, set: function (v) { APP.state.corridor[metal] = v; },
    options: CORRIDORS.filter(function (c) { return c.metals.indexOf(metal) >= 0; }).map(function (c) { return { value: c.id, label: c.name }; }), onChange: onChange });
}
/* Visitor entry forms (public mode only). */
function benchForm(metal) {
  const u = APP.state.user.bench[metal];
  return h('div', { class: 'formgrid' },
    inputField({ id: 'bench-c-' + metal, label: 'COMEX contract (or SPOT)', inputmode: 'text', get: function () { return u.contract; }, set: function (v) { u.contract = v; }, rule: null,
      hint: metal === 'gold' ? 'e.g. GCZ26 = Dec 2026' : 'e.g. SIZ26 = Dec 2026' }),
    inputField({ id: 'bench-p-' + metal, label: 'Price, USD per troy oz', get: function () { return u.price; }, set: function (v) { u.price = v; }, rule: 'price', status: 'USER-ENTERED' }),
    dateField({ id: 'bench-d-' + metal, label: 'Price date', get: function () { return u.date || valDate(); }, set: function (v) { u.date = v; }, max: todayIST() }));
}
function customsForm() {
  const u = APP.state.user.customsFx;
  return h('div', { class: 'formgrid' },
    inputField({ id: 'cfx-v', label: 'Customs import rate, INR per USD (from ICEGATE)', get: function () { return u.value; }, set: function (v) { u.value = v; }, rule: 'price', status: 'USER-ENTERED' }),
    dateField({ id: 'cfx-d', label: 'In force from', get: function () { return u.effectiveFrom || ''; }, set: function (v) { u.effectiveFrom = v; }, max: todayIST(),
      hint: 'The Friday after the 1st or 3rd Thursday' }));
}
function costsForm(metal) {
  const c = APP.state.user.costs[metal];
  const U = COMPARISON_UNIT[metal].label;
  const f = function (k, label, rule, unit) { return inputField({ id: 'cost-' + k + '-' + metal, label: label, get: function () { return c[k]; }, set: function (v) { c[k] = v; }, rule: rule, unit: unit }); };
  return h('div', { class: 'formgrid' }, f('freight', 'Freight and insurance', 'cost', U), f('assay', 'Assay and refining', 'cost', U), f('handling', 'Handling and clearing', 'cost', U),
    f('finRate', 'Financing rate', 'pct', '% per year'), f('finDays', 'Financing days', 'days', 'days'));
}
function yourInputsCard(metal, which) {
  if (isDemo()) return null;
  const parts = [h('p', { class: 'note' }, LABEL.LOCAL_ONLY + ' This page cannot send anything anywhere: its security policy blocks all network requests.')];
  if (which.indexOf('bench') >= 0) parts.push(details('Global benchmark (COMEX settlement you are entitled to use)', benchForm(metal), !String(APP.state.user.bench[metal].price).trim()));
  if (which.indexOf('customs') >= 0) parts.push(details('Customs exchange rate (only if the site does not have this fortnight\'s rate)', customsForm(), false));
  if (which.indexOf('costs') >= 0) parts.push(details('Your local cost and financing assumptions', costsForm(metal), false));
  parts.push(h('div', { class: 'btnrow' }, h('button', { class: 'btn sm danger', type: 'button', onclick: function () { if (confirmClear()) clearMyEntries(); } }, 'Clear all my entries')));
  return card({ id: 'card-yours-' + APP.panel, title: 'Your inputs (optional)', labels: ['LOCAL ONLY'], body: parts });
}
function confirmClear() { return true; }

function waterfallRows(par, view) {
  const add = function (n, label) { return { label: label || n.label, value: n.value, kind: 'add', display: n.value === null ? null : fmtNode(n), nullText: n.value === null ? statusLabel(n) : null }; };
  const tot = function (n, label) { return { label: label || n.label, value: n.value, kind: 'total', display: n.value === null ? null : fmtNode(n), nullText: n.value === null ? statusLabel(n) + ': ' + (n.causes && n.causes[0] ? n.causes[0].label : '') : null }; };
  const rows = [add(par.bench, 'Global benchmark'), add(par.duty, 'Customs duty')];
  if (view === 'EX_COSTS') { rows.push(tot(par.exCosts, 'Landed before local costs')); return rows; }
  rows.push(add(par.input.freight, 'Freight and insurance'), add(par.input.assay, 'Assay and refining'), add(par.fin, 'Financing'), add(par.input.handling, 'Handling'), tot(par.preGst, 'Pre-GST landed'));
  if (view === 'PRE_GST') return rows;
  rows.push(add(par.gst, 'GST (PROBABLE)'), tot(par.gross, 'Gross cash landed'));
  if (view === 'NET') rows.push({ label: 'Recoverable ITC (PROBABLE)', value: par.itc.value === null ? null : -par.itc.value, kind: 'add', display: fmtNode(par.itc) }, tot(par.net, 'Net economic landed'));
  return rows;
}
function waterfallNodes(par, view) {
  const base = [par.bench, par.benchG, par.input.comex, par.input.usdinr, par.av, par.input.tvUsd, par.input.customsFx, par.rates.bcd, par.rates.aidc, par.rates.total, par.bcd, par.aidc, par.duty, par.dutyUsd];
  if (view === 'EX_COSTS') return base.concat([par.exCosts]);
  const pre = base.concat([par.input.freight, par.input.assay, par.input.handling, par.input.finRate, par.input.finDays, par.fin, par.preGst]);
  if (view === 'PRE_GST') return pre;
  return pre.concat([par.gstBase, par.input.gstRate, par.gst, par.gross, par.itc, par.net]);
}
function parityExport(par, view) {
  const nodes = waterfallNodes(par, view);
  return { module: 'parity', subject: par.metal + '-' + par.corridorId + '-' + view, columns: NODE_COLUMNS, rows: nodes.map(function (n) { return nodeRow(n); }), nodes: nodes,
    meta: { metal: par.metal, route: par.corridorId, landedView: view, valuationDate: par.valDate, benchmarkContract: par.benchContract ? (par.benchContract.code || null) : null,
      comparisonUnit: par.unit, gstBasis: par.input.gstBaseId, gstWarning: LABEL.PROBABLE_GST, itcEnabled: par.input.itcEnabled, ruleId: par.rates.rule ? par.rates.rule.ruleId : null } };
}

function tariffSeries(metal) {
  const recs = REG.tariff.filter(function (r) { return r.metal === metal; });
  return recs.map(function (r) { return [r.effectiveFrom, r.value]; });
}
function usdinrSeries() {
  if (isDemo()) return [];
  const s = (SNAP && SNAP.series && SNAP.series.usdinr) || [];
  return s.slice(-31);
}

function buildParity(root) {
  const p = PANELS.filter(function (x) { return x.id === 'parity'; })[0];
  const rebuild = function () { buildPanel('parity'); };
  const metal = APP.state.metal;
  const boxTiles = h('div'), boxWf = h('div'), boxSrc = h('div'), boxBase = h('div'), boxGst = h('div');
  const g = APP.state.gst;
  const gstCard = card({ id: 'card-par-gst', title: 'GST and input tax credit (PROBABLE)', labels: ['PROBABLE'], sub: LABEL.PROBABLE_GST,
    body: [
      h('div', { class: 'formgrid' },
        selectField({ id: 'gst-base', label: 'GST base (methodology assumption)', get: function () { return g.base; }, set: function (v) { g.base = v; }, options: GST_METHOD.bases.map(function (b) { return { value: b.id, label: b.label }; }) }),
        inputField({ id: 'gst-rate', label: 'GST rate', get: function () { return g.ratePct; }, set: function (v) { g.ratePct = v; }, rule: 'pct', unit: '%', status: 'PROBABLE' }),
        checkbox({ id: 'gst-itc', label: 'Subtract recoverable ITC (assumption; off by default)', get: function () { return g.itcEnabled; }, set: function (v) { g.itcEnabled = v; } }),
        inputField({ id: 'gst-share', label: 'Recoverable share', get: function () { return g.itcSharePct; }, set: function (v) { g.itcSharePct = v; }, rule: 'pct', unit: '%' })),
      boxGst] });
  setKids(root, 
    panelHead(p, 'How a global gold or silver price becomes a rupee landed cost in India. The duty is charged on the CBIC tariff value converted at the customs exchange rate, not on the market price. Every leg shows its source, its time and whether it is current.'),
    h('div', { class: 'controls' }, metalSeg(rebuild), corridorSelect('par-route', metal, rebuild), valDateField(rebuild), landedViewSelect('par-view', rebuild)),
    h('div', { class: 'outputs' }, boxTiles, boxWf, yourInputsCard(metal, ['bench', 'customs', 'costs']), boxSrc, boxBase, gstCard));
  const update = function () {
    const m = APP.state.metal, view = APP.state.landedView, cor = APP.state.corridor[m];
    const par = parityFor(m, cor);
    const cu = COMPARISON_UNIT[m];
    const coh = coherenceCheck([par.input.comex, par.input.usdinr], { valDate: par.valDate });
    const pair = pairingCheck(par.benchContract, null, par.valDate);
    const landed = landedFor(par, view);
    const warns = coh.warnings.concat(pair.warnings);
    if (coh.withhold) warns.unshift('Benchmark and USD/INR are too far apart: ' + coh.withhold + '.');
    setKids(boxTiles, h('div', { class: 'tiles' },
      tile({ label: 'Customs duty in US dollars', node: par.dutyUsd, sub: 'Tariff value x ' + (par.rates.total.value !== null ? fmtPct(par.rates.total.value, 0) : 'rate') + '. Needs no exchange rate.' }),
      tile({ label: 'Duty base in rupees', node: par.av, sub: 'Tariff value x customs exchange rate' }),
      tile({ label: 'Customs duty in rupees', node: par.duty, sub: par.splitKnown ? 'BCD + AIDC' : 'Total-rate fallback' }),
      tile({ label: LANDED_VIEWS.filter(function (v) { return v.id === view; })[0].label, node: landed, hl: true, sub: cu.per })));
    const bridge = h('div', { class: 'chart', 'aria-label': 'Evidence waterfall' });
    setKids(boxWf, card({ id: 'card-par-wf', title: 'Evidence waterfall (' + cu.per + ')', nodes: waterfallNodes(par, view),
      sub: 'Tap a line to see its formula, inputs, source documents and timestamps. A withheld leg says exactly what it is missing.',
      exports: [{ id: 'par-wf', name: 'Waterfall', build: function () { return parityExport(par, view); } }],
      body: [warnList(warns), bridge, legTable(waterfallNodes(par, view).filter(function (n) { return ['comex', 'benchInrPerG', 'tvUsd', 'rateBcd', 'rateAidc', 'rateTotal'].indexOf(n.id) < 0; }), { totals: ['exCosts', 'preGst', 'gross', 'net'] })] }));
    mountChart(bridge, function (el) { renderBridge(el, { rows: waterfallRows(par, view), ariaLabel: 'Landed parity waterfall', axisLabel: cu.label }); });
    setKids(boxSrc, card({ id: 'card-par-inputs', title: 'Inputs, states and sources', nodes: [par.input.comex, par.input.usdinr, par.input.tvUsd, par.input.customsFx, par.rates.total],
      body: [srcStrip([par.input.comex, par.input.usdinr, par.input.tvUsd, par.input.customsFx, par.rates.bcd, par.rates.aidc, par.rates.total, par.input.freight, par.input.assay, par.input.handling, par.input.finRate, par.input.finDays])] }));
    const tvOz = par.input.tvUsd.value !== null ? par.input.tvUsd.value / CBIC_TARIFF_UNIT[m].grams * TROY_OUNCE_GRAMS : null;
    const tvChart = h('div', { class: 'chart' });
    const fxChart = h('div', { class: 'chart' });
    setKids(boxBase, card({ id: 'card-par-base', title: 'The duty base is the tariff value, not the market price', nodes: [par.input.tvUsd, par.av, par.bench, par.dutyBaseGap, par.dutyErr],
      body: [
        h('p', null, 'CBIC notifies a tariff value in US dollars (gold per 10 g, silver per kg) roughly twice a month. Customs duty is that value, converted at the customs exchange rate, times the duty rate. It does not move when the global price moves until the next notification.'),
        h('div', { class: 'tiles' },
          tile({ label: 'Tariff value in force', node: par.input.tvUsd, sub: tvOz !== null ? 'equals ' + fmtUSD(tvOz) + ' per troy oz' : '' }),
          tile({ label: 'Duty base minus benchmark', node: par.dutyBaseGap, sub: 'Needs a benchmark and the customs rate' }),
          tile({ label: 'Error if duty were charged on the benchmark', node: par.dutyErr, sub: 'F-M1-20, shown only to size the mistake' })),
        h('h4', { class: 'subh' }, 'Tariff values notified since ' + fmtDate(REG.tariffMeta && REG.tariffMeta.coverageFrom) + ' (' + CBIC_TARIFF_UNIT[m].unit + ')'),
        tvChart,
        isDemo() ? null : h('h4', { class: 'subh' }, 'USD/INR, ECB cross rate, last 31 ECB days'),
        isDemo() ? null : fxChart] }));
    if (!isDemo()) {
      mountChart(tvChart, function (el) { renderLine(el, { series: [{ label: 'Tariff value', points: tariffSeries(m), step: true, cls: 's2' }], xTo: todayIST(), fmtY: function (v) { return fmtUSD(v).replace('.00', ''); }, ariaLabel: 'Tariff value step chart' }); });
      mountChart(fxChart, function (el) { renderLine(el, { series: [{ label: 'USD/INR (ECB cross)', points: usdinrSeries(), cls: 's1' }], fmtY: function (v) { return v.toFixed(2); }, ariaLabel: 'USD/INR line chart', emptyText: 'No ECB observations in this snapshot' }); });
    } else setKids(tvChart, h('p', { class: 'note' }, 'Tariff history is shown with real data outside demo mode.'));
    setKids(boxGst, h('p', { class: 'muted' }, GST_METHOD.bases.filter(function (b) { return b.id === g.base; })[0].note), legTable([par.gstBase, par.gst, par.itc, par.gross, par.net]));
  };
  return { update: update };
}
