/* =============================================================================
 * SECTION 17. CORRIDOR PANEL: dated paper rates vs executability, counterfactual
 * duty, and the release-lag replay (what was knowable on each date)
 * ===========================================================================*/

const COMPARE_ROWS = Object.freeze([
  { corridorId: 'NORMAL', metal: 'gold' }, { corridorId: 'CEPA_GOLD_TRQ', metal: 'gold' },
  { corridorId: 'NORMAL', metal: 'silver' }, { corridorId: 'CEPA_SILVER', metal: 'silver' }
]);
function compareRows(dateISO, overrides) {
  const ref = refFor(dateISO);
  const cfx = resolveCustomsFx(dateISO, ref);
  return COMPARE_ROWS.map(function (r) {
    const rule = ruleFor(r.corridorId, r.metal, dateISO);
    const R = ruleRateNodes(rule, overrides ? overrides[r.corridorId] : null);
    const N = ruleRateNodes(ruleFor('NORMAL', r.metal, dateISO), overrides ? overrides.NORMAL : null);
    const tv = resolveTariff(r.metal, dateISO, ref, '-' + r.corridorId);
    const cu = COMPARISON_UNIT[r.metal];
    const scale = cu.grams / CBIC_TARIFF_UNIT[r.metal].grams;
    const dUsd = mkDerived('dUsd-' + r.corridorId + r.metal, 'Duty in USD ' + cu.per, cu.usdLabel, 'F-M1-22', [tv, R.total], function (t, x) { return t * x * scale; });
    const nUsd = mkDerived('nUsd-' + r.corridorId + r.metal, 'Normal-route duty in USD', cu.usdLabel, 'F-M1-22', [tv, N.total], function (t, x) { return t * x * scale; });
    const edgeUsd = mkDerived('edgeUsd-' + r.corridorId + r.metal, 'Paper edge vs normal (USD ' + cu.per + ')', cu.usdLabel, 'F-M1-19', [nUsd, dUsd], function (a, b) { return a - b; });
    const edgeInr = mkDerived('edgeInr-' + r.corridorId + r.metal, 'Paper edge vs normal (INR ' + cu.per + ')', cu.label, 'F-M1-19', [edgeUsd, cfx], function (e, fx) { return e * fx; });
    const wedge = rateWedge(N.total, R.total, 'wedge-' + r.corridorId + r.metal, 'Rate wedge');
    return { row: r, rule: rule, R: R, wedge: wedge, dUsd: dUsd, edgeUsd: edgeUsd, edgeInr: edgeInr, exec: execInfo(execFor(r.corridorId, r.metal, dateISO)), tv: tv, cfx: cfx };
  });
}
function compareCard(dateISO) {
  const rows = compareRows(dateISO);
  const nodes = [];
  rows.forEach(function (x) { nodes.push(x.R.total, x.wedge, x.dUsd, x.edgeUsd, x.edgeInr); });
  const table = h('div', { class: 'tbl-wrap' }, h('table', { class: 't' },
    h('caption', null, 'Paper rates and executability in force on ' + fmtDate(dateISO)),
    h('thead', null, h('tr', null, ['Route', 'Paper rate', 'Wedge vs normal', 'Duty (USD)', 'Paper edge', 'Executability'].map(function (c) { return h('th', { scope: 'col' }, c); }))),
    h('tbody', null, rows.map(function (x) {
      const c = CORRIDOR_BY_ID[x.row.corridorId];
      return h('tr', null,
        h('th', { scope: 'row' }, c.name + (c.metals.length > 1 ? ' (' + x.row.metal + ')' : '')),
        h('td', null, valSpan(x.R.total), ' ', badgesForNode(x.R.total), x.rule && x.rule.bcd !== null ? h('div', { class: 'xs muted' }, fmtPct(x.rule.bcd, 0) + ' BCD + ' + fmtPct(x.rule.aidc, 0) + ' AIDC') : null),
        h('td', { class: 'num' }, x.row.corridorId === 'NORMAL' ? '' : valSpan(x.wedge)),
        h('td', { class: 'num' }, valSpan(x.dUsd)),
        h('td', { class: 'num' }, x.row.corridorId === 'NORMAL' ? '' : h('div', null, valSpan(x.edgeUsd), h('div', { class: 'xs' }, valSpan(x.edgeInr)))),
        h('td', null, execBadge(x.exec), ' ', badge(x.exec.verification), h('div', { class: 'xs muted' }, x.exec.note), x.exec.citations.length ? h('div', { class: 'xs' }, x.exec.citations.map(function (cid) { return citeLink(cid, true); })) : null));
    }))));
  return card({ id: 'card-cor-compare', title: 'Eligibility is not executability', nodes: nodes,
    sub: 'The paper edge is the duty saved per unit if the route were usable, at the tariff value in force. The executability column says whether it was: licences, quotas and channel rules are recorded as dated flags with their notifications, never netted into a number.',
    exports: [{ id: 'cor', name: 'Routes', build: function () { return { module: 'corridors', subject: 'routes-' + dateISO, columns: NODE_COLUMNS, rows: nodes.map(function (n) { return nodeRow(n); }), nodes: nodes,
      meta: { asOf: dateISO, executability: rows.map(function (x) { return x.row.corridorId + ' ' + x.row.metal + ': ' + x.exec.code + ' (' + x.exec.verification + ')'; }) } }; } }],
    body: [table, h('p', { class: 'muted' }, 'Rupee paper edge needs the customs exchange rate for the date: ' + (rows[0].cfx.value === null ? 'withheld (' + rows[0].cfx.note + ').' : fmtNode(rows[0].cfx) + '.')),
      details('Rules and citations behind this table', rows.map(function (x) { return h('div', { class: 'rulebox' }, h('strong', null, CORRIDOR_BY_ID[x.row.corridorId].name + ', ' + x.row.metal + ': '), x.rule ? (x.rule.label + '. ' + (x.rule.note || '')) : 'No rule documented for this date.', x.rule ? citeList(x.rule.citations) : null); }))] });
}
function stepFor(ep, dateISO) {
  let idx = 0;
  ep.steps.forEach(function (s, i) { if (s.date <= dateISO) idx = i; });
  return idx;
}
function factItem(f) {
  const n = factNode(f);
  return h('li', { class: 'fact' },
    h('div', { class: 'fl' }, f.label, f.period ? h('span', { class: 'muted' }, ' | ' + f.period) : null),
    h('div', { class: 'fv' }, f.text ? h('span', { class: 'txt' }, f.text) : (n.value === null ? nullSpan(n) : fmtNode(n))),
    h('div', { class: 'fm' }, badge(f.status), ' knowable from ' + fmtDate(f.knowableFrom), f.citation ? h('span', null, ' | ', citeLink(f.citation, true)) : null),
    f.note ? h('div', { class: 'xs muted' }, f.note) : null);
}
/* The replay view for an episode as known on a date (T12 checks its text). */
function episodeStepView(ep, dateISO, stepIdx) {
  const facts = factsKnowableOn(ep, dateISO).slice().sort(function (a, b) { return a.knowableFrom < b.knowableFrom ? 1 : -1; });
  const s = ep.steps[stepIdx];
  const rd = s && s.date === dateISO && s.ruleDate ? s.ruleDate : dateISO;
  const rates = ep.corridors.map(function (cid) {
    const metal = corridorMetal(cid, ep);
    const R = ruleRateNodes(ruleFor(cid, metal, rd));
    return { key: cid + metal, label: CORRIDOR_BY_ID[cid].short + (cid === 'NORMAL' ? ' (' + ep.metal + ')' : ''), value: R.total.value, display: R.total.value === null ? null : fmtPct(R.total.value, 0), slot: CORRIDOR_BY_ID[cid].slot, node: R.total };
  });
  if (ep.id === 'B') {
    const R = ruleRateNodes(ruleFor('NORMAL', 'gold', rd));
    rates.splice(1, 0, { key: 'NORMALgold', label: 'Normal (gold)', value: R.total.value, display: R.total.value === null ? null : fmtPct(R.total.value, 0), slot: 's1', node: R.total });
  }
  const execs = ep.corridors.filter(function (c) { return c !== 'NORMAL'; }).concat(['NORMAL']).map(function (cid) {
    const metal = corridorMetal(cid, ep);
    const ex = execInfo(execFor(cid, metal, rd, dateISO));
    return h('li', null, h('strong', null, CORRIDOR_BY_ID[cid].name + ' (' + metal + '): '), execBadge(ex), ' ', h('span', { class: 'xs muted' }, ex.note));
  });
  const idx = stepFor(ep, dateISO);
  const derived = episodeDerived(ep, idx).filter(function (n) { return n.value !== null || n.id.indexOf('wedge') >= 0; });
  const rows = episodeChartRows(ep, idx).filter(function (r) { return r.fact.knowableFrom <= dateISO; });
  const series = {};
  rows.forEach(function (r) { (series[r.series] = series[r.series] || []).push(r); });
  const seriesNames = { FY: 'Fiscal years (GTRI, Apr-Mar): average per month', CY: 'Calendar years (WITS / UN Comtrade): average per month', QG: 'UAE gold, April-June totals: average per month', GAP: 'UAE-only silver after May 2026' };
  const charts = Object.keys(series).map(function (k) {
    const el = h('div', { class: 'chart' });
    mountChart(el, function (e) { renderHBars(e, { rows: series[k].map(function (r) { return { key: r.key, label: r.label, value: r.value, display: r.value === null ? null : fmtUSDShort(r.value) + '/month', cls: k === 'CY' ? 's3' : 's2', nullText: 'UNAVAILABLE - not estimated' }; }), fmtAxis: function (v) { return fmtUSDShort(v); }, ariaLabel: seriesNames[k] }); });
    return h('div', null, h('h5', { class: 'subh' }, seriesNames[k]), el);
  });
  return h('div', { class: 'epview' },
    h('div', { class: 'stephead' }, h('span', { class: 'date' }, fmtDate(dateISO)), h('h4', null, s && s.date === dateISO ? s.title : 'Custom date: what was knowable on ' + fmtDate(dateISO)),
      s && s.date === dateISO && s.note ? h('p', { class: 'muted' }, s.note) : null),
    h('div', { class: 'twocol' },
      h('div', null, h('h5', { class: 'subh' }, 'Duty rates in force' + (rd !== dateISO ? ' on ' + fmtDate(rd) : '')), rateBars('ep' + ep.id, rates, 0.16),
        h('h5', { class: 'subh' }, 'Executability'), h('ul', { class: 'execs' }, execs)),
      h('div', null, h('h5', { class: 'subh' }, 'Published by this date (' + facts.length + ' of ' + ep.facts.length + ')'),
        facts.length ? h('ul', { class: 'facts' }, facts.map(factItem)) : h('p', { class: 'note' }, 'No flow or policy figure in this episode had been published yet. Only the rates were knowable.'))),
    derived.length ? h('div', null, h('h5', { class: 'subh' }, 'Derived checks (from what was knowable)'), legTable(derived, { shortCites: true }),
      h('p', { class: 'xs muted' }, 'Rates were legally knowable once notified. Where the evidence located today was published later, its citation is shown by document name and date only, so later figures do not leak into this date.')) : null,
    charts.length ? h('div', null, charts) : null);
}
function buildCorridor(root) {
  const p = PANELS.filter(function (x) { return x.id === 'corridor'; })[0];
  const rebuild = function () { buildPanel('corridor'); };
  const st = APP.state.replay;
  const ep = EPISODES.filter(function (e) { return e.id === st.episode; })[0];
  const boxCmp = h('div'), boxEp = h('div');
  const tabs = h('div', { class: 'eptabs', role: 'group', 'aria-label': 'Episode' }, EPISODES.map(function (e) {
    return h('button', { type: 'button', 'aria-pressed': e.id === ep.id ? 'true' : 'false', onclick: function () { st.episode = e.id; st.date = ''; rebuild(); saveSoon(); } }, e.id === 'A' ? 'A: 2023-24 silver wedge' : 'B: 2026 licensing choke');
  }));
  const curIdx = st.step[ep.id];
  const steps = h('ol', { class: 'steps' }, ep.steps.map(function (s, i) {
    return h('li', { class: i === curIdx && !st.date ? 'cur' : (i < curIdx ? 'past' : '') },
      h('button', { type: 'button', 'aria-current': i === curIdx && !st.date ? 'step' : null, onclick: function () { st.step[ep.id] = i; st.date = ''; rebuild(); saveSoon(); } },
        h('span', { class: 'date' }, fmtDate(s.date)), h('span', null, s.title)));
  }));
  const tm = dateField({ id: 'tm-date', label: 'Time machine: show what was knowable on', get: function () { return st.date || ep.steps[curIdx].date; }, set: function (v) { st.date = v; },
    min: '2023-01-01', max: todayIST(), onChange: function () { updatePanel('corridor'); saveSoon(); }, hint: 'Pick any date. Figures appear only from the date their source was published.' });
  const ov = st.overrides;
  const of = function (k, label) { return inputField({ id: 'ov-' + k, label: label, get: function () { return ov[k]; }, set: function (v) { ov[k] = v; }, rule: 'pct', unit: '%', status: 'SYNTHETIC' }); };
  const boxScn = h('div');
  const scnCard = card({ id: 'card-cor-scn', title: 'Counterfactual: what if the rates were different? (SYNTHETIC scenario)', forceSyn: true, labels: ['SYNTHETIC'], body: [
    h('p', null, 'Type scenario rates to see the paper edge per unit at the tariff value in force on the valuation date. Scenario outputs are labelled SYNTHETIC and never mixed with the dated registry.'),
    h('div', { class: 'formgrid' }, of('NORMAL', 'Normal route total rate'), of('CEPA_SILVER', 'CEPA silver rate'), of('CEPA_GOLD_TRQ', 'CEPA gold in-quota rate')), boxScn] });
  setKids(root, 
    panelHead(p, 'Two separate things: the dated duty wedge between routes (eligibility) and whether the route could actually be used (executability). The replay shows only what had been published on each date.'),
    h('div', { class: 'controls' }, valDateField(rebuild)),
    h('div', { class: 'outputs' }, boxCmp,
      card({ id: 'card-cor-replay', title: ep.title, sub: ep.tagline, body: [tabs, steps, tm, boxEp,
        (ep.gaps || []).length ? details('Not shown as fact: evidence gaps (' + ep.gaps.length + ')', h('ul', { class: 'gaps' }, ep.gaps.map(function (g) { return h('li', null, badge(g.status), ' ', g.label, h('div', { class: 'xs muted' }, g.note)); }))) : null] }),
      scnCard));
  const update = function () {
    setKids(boxCmp, compareCard(valDate()));
    const d = st.date || ep.steps[st.step[ep.id]].date;
    setKids(boxEp, episodeStepView(ep, d, st.date ? stepFor(ep, d) : st.step[ep.id]));
    const rows = compareRows(valDate(), ov).filter(function (x) { return x.row.corridorId !== 'NORMAL'; });
    setKids(boxScn, rows.map(function (x) {
      const ch = h('div', { class: 'chart' });
      const cu = COMPARISON_UNIT[x.row.metal];
      const nUsd = x.edgeUsd.value !== null && x.dUsd.value !== null ? x.dUsd.value + x.edgeUsd.value : null;
      mountChart(ch, function (el) {
        renderBridge(el, { rows: [{ label: 'Normal-route duty', value: nUsd, kind: 'total', display: nUsd === null ? null : fmtUSD(nUsd) },
          { label: 'Paper edge', value: x.edgeUsd.value === null ? null : -x.edgeUsd.value, kind: 'add', display: x.edgeUsd.value === null ? null : '-' + fmtUSD(x.edgeUsd.value), nullText: 'withheld' },
          { label: CORRIDOR_BY_ID[x.row.corridorId].short + ' duty', value: x.dUsd.value, kind: 'total', display: x.dUsd.value === null ? null : fmtUSD(x.dUsd.value) }],
          fmtAxis: function (v) { return fmtUSD(v).replace('.00', ''); }, axisLabel: cu.usdLabel, ariaLabel: 'Counterfactual duty waterfall' });
      });
      return h('div', null, h('h5', { class: 'subh' }, CORRIDOR_BY_ID[x.row.corridorId].name + ' (' + cu.per + ', US dollars)'), ch, legTable([x.R.total, x.wedge, x.edgeUsd, x.edgeInr]),
        h('p', { class: 'xs muted' }, 'Executability on the valuation date: ' + x.exec.label + '. A paper edge is not an executable route.'));
    }));
  };
  return { update: update };
}
