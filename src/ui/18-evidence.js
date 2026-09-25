/* =============================================================================
 * SECTION 18. EVIDENCE PANEL: snapshot log, source registry, records, citations,
 * formulas, in-page tests and the audit bundle
 * ===========================================================================*/

function latestRecordFor(sourceId) {
  const recs = (SNAP && SNAP.records || []).filter(function (r) { return r.sourceId === sourceId; });
  if (!recs.length) return null;
  return recs.slice().sort(function (a, b) { return (a.date || a.effectiveFrom || '') < (b.date || b.effectiveFrom || '') ? -1 : 1; }).pop();
}
function sourceRows() {
  const ref = refFor(null);
  return Object.keys(REG.sources).map(function (id) {
    const s = REG.sources[id];
    let r = latestRecordFor(id);
    let f = r ? freshnessOf(r, ref) : null;
    const R0 = SNAP && SNAP.registries ? SNAP.registries : {};
    const reviewed = id === 'DUTY-RULES' ? (R0.dutyRules || {}).lastReviewed : id === 'MCX-SPEC' ? (R0.contracts || {}).lastReviewed : null;
    if (!r && reviewed) { f = freshnessOf({ id: id, sourceId: id, enteredOn: reviewed, effectiveFrom: reviewed }, ref); r = { effectiveFrom: reviewed }; f.reason = 'Registry reviewed ' + fmtDate(reviewed) + '. ' + f.reason; }
    const fixedState = { 'SYN-DEMO': 'DEMO ONLY', 'KITE': 'NOT CONNECTED', 'VISITOR': 'LOCAL ONLY', 'COMEX-SETTLE': 'DISPLAY BLOCKED', 'MCX-SETTLE': 'DISPLAY BLOCKED', 'LOCAL-COSTS': 'NOT SUPPLIED' }[id];
    return { id: id, name: s.name, access: s.access + ' | ' + s.status, display: s.publicDisplay.allowed ? 'Allowed: ' + s.publicDisplay.reason : 'BLOCKED: ' + s.publicDisplay.reason,
      cadence: s.cadence, stale: staleRuleText(s.staleRule), latest: r ? (r.date ? fmtDate(r.date) : (reviewed && r.effectiveFrom === reviewed ? 'reviewed ' : 'in force ') + fmtDate(r.effectiveFrom)) : 'none in snapshot', fresh: f ? f.fresh : (fixedState || 'UNAVAILABLE'),
      freshWhy: f ? f.reason : '', terms: s.terms, url: s.url, failure: (s.failureModes || []).join(' | ') };
  });
}
function recordRows() {
  const ref = refFor(null);
  return (SNAP && SNAP.records || []).map(function (r) {
    return { record_id: r.id, kind: r.kind, value_raw: isNum(r.value) ? r.value : null, unit: r.unit, metal: r.metal || null, contract: r.contract || r.notification || null,
      observed_at: r.observedAt || null, effective_from: r.effectiveFrom || null, valid_to: r.validTo || null, published_at: r.publishedAt || null, retrieved_at: r.retrievedAt || null,
      verification: r.verification, freshness_now: freshnessOf(r, ref).fresh, source_id: r.sourceId, url: r.url || null, raw_sha256: r.rawSha256 || null,
      derivation: r.derivation ? r.derivation.formulaId + ' ' + r.derivation.formulaVersion + ' from ' + r.derivation.inputs.join(' + ') : null, note: r.note || null };
  });
}
const RECORD_COLUMNS = Object.freeze(['record_id', 'kind', 'value_raw', 'unit', 'metal', 'contract', 'observed_at', 'effective_from', 'valid_to', 'published_at', 'retrieved_at',
  'verification', 'freshness_now', 'source_id', 'url', 'raw_sha256', 'derivation', 'note'].map(function (k) { return { key: k, label: k }; }));
function testsView(box) {
  const run = function () {
    const csp = (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '';
    const res = runTests({ csp: csp, html: APP.staticHtml || '', renderStepText: function (ep, i) { return episodeStepView(ep, ep.steps[i].date, i).textContent; } });
    APP.lastTests = res;
    const fails = res.filter(function (r) { return !r.pass && !r.skipped; }).length;
    setKids(box, 
      h('p', null, badge(fails ? 'TEST FAILURES' : 'ALL TESTS PASS'), ' ', (res.length - fails) + ' of ' + res.length + ' passed in this browser at ' + fmtDateTime(Date.now()) + '.'),
      h('ul', { class: 'tests' }, res.map(function (r) {
        return h('li', null, h('span', { class: r.skipped ? 'd' : (r.pass ? 'ok' : 'no') }, r.skipped ? 'SKIP' : (r.pass ? 'PASS' : 'FAIL')), ' ', h('strong', null, r.id), ' ', r.name, h('div', { class: 'd' }, r.detail));
      })),
      h('div', { class: 'btnrow' }, exportButtons('Test results', [{ id: 'tests', name: 'Tests', build: function () {
        return { module: 'evidence', subject: 'tests', columns: [{ key: 'id', label: 'id' }, { key: 'name', label: 'name' }, { key: 'pass', label: 'pass' }, { key: 'skipped', label: 'skipped' }, { key: 'detail', label: 'detail' }], rows: res, nodes: [], noProvenance: true, meta: { userAgent: navigator.userAgent } };
      } }])));
  };
  return run;
}
function auditBundle() {
  const gold = parityFor('gold', 'NORMAL'), silver = parityFor('silver', 'NORMAL');
  const nodes = waterfallNodes(gold, 'PRE_GST').concat(waterfallNodes(silver, 'PRE_GST'));
  return { module: 'evidence', subject: 'audit-bundle', columns: NODE_COLUMNS, rows: nodes.map(function (n) { return nodeRow(n, { label: n.label + ' [' + (gold.nodes[n.id] === n ? 'gold' : 'silver') + ']' }); }), nodes: nodes,
    meta: { valuationDate: valDate(), snapshot: SNAP ? { id: SNAP.id, generatedAt: SNAP.generatedAt, pipeline: SNAP.pipeline } : null },
    extraJson: { sources: SNAP.registries.sources, citations: REG.citations, dutyRules: SNAP.registries.dutyRules, contracts: SNAP.registries.contracts, tariffMeta: SNAP.registries.tariffMeta,
      records: recordRows(), checks: SNAP.checks, formulas: FORMULAS, limitations: LIMITATIONS, thresholds: THRESHOLDS, tests: APP.lastTests },
    extraCsvSections: [{ title: 'records', columns: RECORD_COLUMNS, rows: recordRows() }] };
}
function buildEvidence(root) {
  const p = PANELS.filter(function (x) { return x.id === 'evidence'; })[0];
  const testBox = h('div', null, h('p', { class: 'muted' }, 'Runs the same audit suite that runs before every publish.'));
  const run = testsView(testBox);
  const snap = SNAP || {};
  const pl = snap.pipeline || {};
  const ageH = snap.generatedAt ? (Date.now() - Date.parse(snap.generatedAt)) / 3600000 : null;
  const checks = (snap.checks || []).slice().sort(function (a, b) { const o = { fatal: 0, error: 1, warn: 2, info: 3 }; return o[a.level] - o[b.level]; });
  setKids(root, 
    panelHead(p, 'Every number on this site traces to a record, and every record to a source with its time and terms. This page shows the build log, the source registry, all public records, the citation list, the formulas and the audit tests.'),
    h('div', { class: 'outputs' },
      card({ id: 'card-ev-snap', title: 'This snapshot', labels: [LABEL.NOT_LIVE], body: [
        tableOf([{ key: 'k', label: 'Field' }, { key: 'v', label: 'Value' }], [
          { k: 'Snapshot', v: snap.id || 'missing' },
          { k: 'Built', v: snap.generatedAt ? fmtDateTime(snap.generatedAt) + (ageH !== null ? ' (' + (ageH < 1 ? 'under an hour' : Math.round(ageH) + ' hours') + ' ago)' : '') : 'unknown' },
          { k: 'Pipeline run', v: (pl.trigger || 'local') + (pl.runId ? ', run ' + pl.runId : '') + (pl.commit ? ', commit ' + String(pl.commit).slice(0, 7) : '') },
          { k: 'ECB data in this run', v: pl.ecbSource === 'fetched' ? 'fetched from the ECB' : pl.ecbSource === 'file' ? 'read from a saved file (test or manual fallback)' : pl.ecbSource === 'carried-forward' ? 'carried forward from the previous snapshot (fetch failed)' : 'none' },
          { k: 'Engine', v: BUILD.buildVersion + ' / ' + BUILD.configVersion + ' / formulas ' + BUILD.formulaVersion }], { id: 'tbl-snap' }),
        h('p', null, 'Download: ', h('a', { href: 'data/snapshot.json', download: '' }, 'snapshot.json'), ' | ', h('a', { href: 'data/run-log.json', download: '' }, 'run-log.json'), ' | ',
          h('button', { class: 'btn sm', type: 'button', onclick: function () { doExport(auditBundle, 'json'); } }, 'Audit bundle (JSON)'), ' ',
          h('button', { class: 'btn sm', type: 'button', onclick: function () { doExport(auditBundle, 'csv'); } }, 'Audit bundle (CSV)')),
        h('h4', { class: 'subh' }, 'Build log (' + checks.length + ' checks)'),
        h('ul', { class: 'checks' }, checks.map(function (c) { return h('li', { class: 'lvl-' + c.level }, h('span', { class: 'badge ' + (c.level === 'info' ? 'b-plain' : c.level === 'warn' ? 'b-stale' : 'b-un') }, c.level.toUpperCase()), ' ', h('strong', null, c.source + ': '), c.message); }))] }),
      card({ id: 'card-ev-sources', title: 'Source registry', body: [
        tableOf([{ key: 'name', label: 'Source' }, { key: 'access', label: 'Access and status' }, { key: 'display', label: 'Public display' }, { key: 'cadence', label: 'Cadence' }, { key: 'stale', label: 'Goes stale when' },
          { key: 'latest', label: 'Latest in snapshot', render: function (r) { return h('span', null, r.latest, ' ', badge(r.fresh), h('div', { class: 'xs muted' }, r.freshWhy)); } },
          { key: 'terms', label: 'Terms' }, { key: 'url', label: 'Where', render: function (r) { return r.url && /^https?:/.test(r.url) ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'link') : (r.url || ''); } },
          { key: 'failure', label: 'Failure handling' }], sourceRows(), { id: 'tbl-sources' })] }),
      card({ id: 'card-ev-records', title: 'All public records (' + recordRows().length + ')', exports: [{ id: 'records', name: 'Records', build: function () { return { module: 'evidence', subject: 'records', columns: RECORD_COLUMNS, rows: recordRows(), nodes: [], noProvenance: true, meta: {} }; } }],
        body: [details('Show records', tableOf(RECORD_COLUMNS.slice(0, 12).map(function (c) { return { key: c.key, label: c.label, num: c.key === 'value_raw' }; }), recordRows(), { id: 'tbl-records' }), false)] }),
      card({ id: 'card-ev-cites', title: 'Citations (' + Object.keys(REG.citations).length + ')', body: [
        h('p', { class: 'muted' }, 'Verification ladder: VERIFIED (official host), PRIMARY COPY (full text on a third-party copy), SECONDARY (reported by a named source), CITATION PENDING (not located; never shown as fact).'),
        details('Show citations', h('ul', { class: 'cites' }, Object.keys(REG.citations).map(function (k) { return h('li', null, h('span', { class: 'mono xs' }, k + ' '), citeLink(k)); })), false)] }),
      card({ id: 'card-ev-formulas', title: 'Formula registry (' + BUILD.formulaVersion + ')', body: [details('Show formulas', tableOf([{ key: 'id', label: 'Id' }, { key: 'name', label: 'Name' }, { key: 'formula', label: 'Formula' }, { key: 'units', label: 'Units' }, { key: 'note', label: 'Note' }], FORMULAS, { id: 'tbl-formulas' }), false)] }),
      card({ id: 'card-ev-tests', title: 'Audit tests', body: [h('div', { class: 'btnrow' }, h('button', { class: 'btn', type: 'button', id: 'run-tests', onclick: run }, 'Run the tests in this browser')), testBox] })));
  return { update: function () { } };
}
