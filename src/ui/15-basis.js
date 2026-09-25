/* =============================================================================
 * SECTION 15. BASIS PANEL: MCX futures basis and physical basis, kept separate;
 * carry to expiry; basis-change decomposition
 * ===========================================================================*/

function metalContracts(metal) {
  const out = [];
  REG.specs.filter(function (s) { return s.metal === metal; }).forEach(function (s) { contractOptions(s.id).forEach(function (o) { out.push(o); }); });
  return out;
}
function selectedContract(metal) {
  const opts = metalContracts(metal).map(function (o) { return o.value; });
  let id = APP.state.basis.contract[metal];
  if (opts.indexOf(id) < 0) { id = opts[0] || null; APP.state.basis.contract[metal] = id; }
  return id;
}
function mcxForm(contractId) {
  if (!contractId) return h('p', { class: 'note' }, 'No open contract in the calendar for this date.');
  if (!APP.state.user.mcx[contractId]) APP.state.user.mcx[contractId] = { price: '', date: '', file: '' };
  const u = APP.state.user.mcx[contractId];
  const spec = SPEC_BY_ID[contractId.split(':')[0]];
  return h('div', { class: 'formgrid' },
    inputField({ id: 'mcx-p-' + contractId, label: 'MCX close or settlement, ' + spec.displayQuotation, get: function () { return u.price; }, set: function (v) { u.price = v; u.file = ''; }, rule: 'price', status: 'USER-ENTERED' }),
    dateField({ id: 'mcx-d-' + contractId, label: 'Price date', get: function () { return u.date || valDate(); }, set: function (v) { u.date = v; }, max: todayIST() }));
}
function physForm(metal) {
  const u = APP.state.user.physical[metal];
  return h('div', { class: 'formgrid' },
    inputField({ id: 'phys-p-' + metal, label: 'Physical quote, ' + COMPARISON_UNIT[metal].label, get: function () { return u.price; }, set: function (v) { u.price = v; }, rule: 'price', status: 'USER-ENTERED' }),
    inputField({ id: 'phys-f-' + metal, label: 'Fineness', inputmode: 'text', get: function () { return u.fineness; }, set: function (v) { u.fineness = v; }, rule: null }),
    inputField({ id: 'phys-s-' + metal, label: 'Quote source (for your own record)', inputmode: 'text', get: function () { return u.source; }, set: function (v) { u.source = v; }, rule: null }),
    dateField({ id: 'phys-d-' + metal, label: 'Quote date', get: function () { return u.date || valDate(); }, set: function (v) { u.date = v; }, max: todayIST() }));
}
/* Local bhavcopy loader: parsed in the browser, never uploaded. */
function bhavLoader(onDone) {
  const status = h('div', { class: 'meta', 'aria-live': 'polite' }, APP.file ? 'Loaded ' + APP.file.name + ': ' + APP.file.count + ' bullion futures rows for ' + fmtDate(APP.file.date) + '.' : '');
  const inp = h('input', { type: 'file', accept: '.csv,text/csv', id: 'bhav-file' });
  inp.addEventListener('change', function () {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 5e6) { status.textContent = 'File too large for a bhavcopy (over 5 MB).'; return; }
    const r = new FileReader();
    r.onload = function () {
      try {
        const res = parseBhavcopy(String(r.result), f.name);
        res.rows.forEach(function (row) {
          const id = row.product + ':' + row.month;
          APP.state.user.mcx[id] = { price: String(row.price), date: row.date, file: f.name };
        });
        const dates = res.rows.map(function (x) { return x.date; }).sort();
        APP.file = { name: f.name, count: res.rows.length, date: dates.length ? dates[dates.length - 1] : null, errors: res.errors };
        status.textContent = 'Loaded ' + f.name + ': ' + res.rows.length + ' bullion futures rows' + (APP.file.date ? ' for ' + fmtDate(APP.file.date) : '') + (res.errors.length ? '. ' + res.errors.length + ' row(s) skipped: ' + res.errors.slice(0, 2).join('; ') : '.');
        toast('Bhavcopy read in your browser; nothing was uploaded');
        saveSoon();
        if (onDone) onDone();
      } catch (e) { status.textContent = e.message + ' Nothing was loaded.'; }
    };
    r.onerror = function () { status.textContent = 'Could not read the file.'; };
    r.readAsText(f);
  });
  return h('div', { class: 'field wide' }, h('label', { for: 'bhav-file' }, 'Load an MCX bhavcopy CSV you downloaded (read in this browser only)'), inp, status);
}
function basisCardFor(kind, quoteLeaf, stdNode, par, view, coh, contract) {
  const tag = kind === 'phys' ? 'P' : 'F';
  const b = computeBasis(stdNode, par, view, coh, tag);
  const days = contract ? mkLeaf('daysToExpiry', 'Days from valuation date to expiry', dayDiff(par.valDate, contract.expiry), 'days',
    stFromVerification(contract.verification), { citations: contract.citations || [], fresh: FRESH.SNAPSHOT, sourceId: 'MCX-SPEC', prob: !!contract.computed }) : null;
  const carry = contract ? computeCarry(b.basis, b.landed, par.input.finRate, days, tag) : null;
  const nodes = [quoteLeaf, stdNode, b.landed, b.basis, b.basisPct].concat(carry ? [days, carry.carry, carry.net] : []);
  const title = kind === 'phys' ? 'Physical basis: physical quote minus modeled landed' : 'Contract basis: MCX futures minus modeled landed';
  const body = [
    warnList(coh.warnings.concat(coh.pairWarnings || [])),
    h('div', { class: 'tiles' },
      tile({ label: kind === 'phys' ? 'Physical quote (standardized)' : 'MCX quote (standardized)', node: stdNode }),
      tile({ label: 'Modeled landed (' + LANDED_VIEWS.filter(function (v) { return v.id === view; })[0].label.split(' (')[0] + ')', node: b.landed }),
      tile({ label: 'Basis', node: b.basis, hl: true }),
      tile({ label: 'Basis %', node: b.basisPct })),
    carry ? h('div', { class: 'tiles' },
      tile({ label: 'Carry to expiry (' + (days.value !== null ? days.value + ' days' : 'days') + ')', node: carry.carry, sub: 'Financing only, on the landed value' }),
      tile({ label: 'Basis net of carry', node: carry.net, sub: 'Descriptive, not a mispricing measure' })) : null,
    legTable(nodes)];
  return { card: card({ id: 'card-basis-' + kind, title: title, nodes: nodes, body: body,
    exports: [{ id: 'basis-' + kind, name: 'Basis', build: function () {
      return { module: 'basis', subject: kind + '-' + par.metal + '-' + view, columns: NODE_COLUMNS, rows: nodes.map(function (n) { return nodeRow(n); }), nodes: nodes,
        meta: { metal: par.metal, landedView: view, valuationDate: par.valDate, contract: contract ? contract.id : null, contractExpiry: contract ? contract.expiry : null, quoteKind: kind === 'phys' ? 'physical' : 'futures', warnings: coh.warnings.concat(coh.pairWarnings || []) } };
    } }] }), basis: b };
}
function decompositionCard(metal, view, par, mcxRes) {
  const vd = par.valDate;
  const unit = COMPARISON_UNIT[metal].label;
  const box = h('div');
  const decView = view === 'EX_COSTS' ? 'EX_COSTS' : 'PRE_GST';
  const spec = mcxRes.contract ? SPEC_BY_ID[mcxRes.contract.product] : null;
  const std = function (native) { return spec ? native / spec.quoteGrams * COMPARISON_UNIT[metal].grams : null; };
  let x0 = null, x1 = null, missing = [], leaves = [];
  if (isDemo()) {
    x0 = SAMPLE_DATA.episodeC.start; x1 = SAMPLE_DATA.episodeC.end;
    leaves = [synLeaf('d0', 'Start state (synthetic)', 1, 'n'), synLeaf('d1', 'End state (synthetic)', 1, 'n')];
  } else {
    const s = APP.state.basis;
    const d0 = s.cmpDate && parseISODate(s.cmpDate) !== null ? s.cmpDate : null;
    if (!d0) missing.push('an earlier comparison date');
    if (d0 && d0 >= vd) missing.push('a comparison date before the valuation date');
    const b0 = parseInput(s.cmpBench, 'price'), m0 = parseInput(s.cmpMcx, 'price');
    if (b0.state !== 'OK') missing.push('the benchmark on the earlier date');
    if (m0.state !== 'OK') missing.push('the MCX price on the earlier date');
    const L1 = { comex: par.input.comex, usdinr: par.input.usdinr, tv: par.input.tvUsd, cfx: par.input.customsFx, rate: par.rates.total, mcx: mcxRes.leaf };
    Object.keys(L1).forEach(function (k) { if (L1[k].value === null) missing.push(L1[k].label + ' on the valuation date'); });
    if (d0 && !missing.length) {
      const ref0 = refFor(d0);
      const L0 = { usdinr: resolveUsdinr(d0, ref0, '-0'), tv: resolveTariff(metal, d0, ref0, '-0'), cfx: resolveCustomsFx(d0, ref0, '-0'), rate: resolveRates(APP.state.corridor[metal], metal, d0).total };
      Object.keys(L0).forEach(function (k) { if (L0[k].value === null) missing.push(L0[k].label + ' on ' + fmtDate(d0) + ' (' + (L0[k].note || statusLabel(L0[k])) + ')'); });
      if (!missing.length) {
        const c = { freight: par.input.freight.value, assay: par.input.assay.value, handling: par.input.handling.value, finRate: par.input.finRate.value, finDays: par.input.finDays.value };
        if (decView === 'PRE_GST' && Object.keys(c).some(function (k) { return c[k] === null; })) missing.push('local cost and financing assumptions (or choose the "before local costs" view)');
        Object.keys(c).forEach(function (k) { if (c[k] === null) c[k] = 0; });
        x0 = Object.assign({ comex: b0.value, usdinr: L0.usdinr.value, tv: L0.tv.value, customsFx: L0.cfx.value, dutyRate: L0.rate.value, mcx: std(m0.value) }, c);
        x1 = Object.assign({ comex: par.input.comex.value, usdinr: par.input.usdinr.value, tv: par.input.tvUsd.value, customsFx: par.input.customsFx.value, dutyRate: par.rates.total.value, mcx: std(mcxRes.leaf.value) }, c);
        const cb = mkLeaf('cmpBench', 'Benchmark on ' + fmtDate(d0) + ' (your entry)', b0.value, 'USD/troy oz', ST.USER, { obsAt: isoInZone(zonedToUTC(d0, '13:30', 'America/New_York'), 'America/New_York'), fresh: FRESH.SNAPSHOT, rec: { id: 'user-cmp-bench' } });
        const cm0 = mkLeaf('cmpMcx', 'MCX on ' + fmtDate(d0) + ' (your entry)', m0.value, spec.displayQuotation, ST.USER, { obsAt: isoInZone(zonedToUTC(d0, '23:55', 'Asia/Kolkata'), 'Asia/Kolkata'), fresh: FRESH.SNAPSHOT, rec: { id: 'user-cmp-mcx' } });
        const c0 = coherenceCheck([cb, L0.usdinr, cm0]), c1 = coherenceCheck([par.input.comex, par.input.usdinr, mcxRes.leaf]);
        if (c0.withhold) missing.push('coherent inputs on ' + fmtDate(d0) + ' (' + c0.withhold + ')');
        if (c1.withhold) missing.push('coherent inputs on the valuation date (' + c1.withhold + ')');
        leaves = [L0.usdinr, L0.tv, L0.cfx, L0.rate, par.input.comex, par.input.usdinr, par.input.tvUsd, par.input.customsFx, par.rates.total, mcxRes.leaf, cb, cm0];
      }
    }
  }
  if (missing.length && x0) { x0 = null; }
  if (missing.length || !x0) {
    box.appendChild(h('p', { class: 'note' }, 'Decomposition withheld. It needs ' + missing.join('; ') + '.'));
  } else {
    const dec = decomposeBasisChange(x0, x1, metal, decView);
    const agg = mkDerived('decomp', 'Change in basis', unit, 'F-M1-25', leaves, function () { return dec.change; });
    const rows = [{ label: 'Basis at start', value: dec.basis0, kind: 'total', display: fmtINR(dec.basis0) }]
      .concat(dec.rows.map(function (r) { return { label: r.label, value: r.value, kind: 'add', display: fmtSignedINR(r.value) }; }))
      .concat([{ label: 'Basis at end', value: dec.basis1, kind: 'total', display: fmtINR(dec.basis1) }]);
    const ch = h('div', { class: 'chart' });
    mountChart(ch, function (el) { renderBridge(el, { rows: rows, ariaLabel: 'Basis change decomposition', axisLabel: unit }); });
    box.appendChild(h('div', { class: 'card-badges' }, badgesForNode(agg)));
    box.appendChild(ch);
    box.appendChild(tableOf([{ key: 'label', label: 'Factor' }, { key: 'v', label: 'Contribution to basis change', num: true }],
      dec.rows.map(function (r) { return { label: r.label, v: fmtSignedINR(r.value) }; }).concat([{ label: 'Total change in basis', v: fmtSignedINR(dec.change), _cls: 'sub' }]), { id: 'tbl-decomp' }));
    box.appendChild(h('p', { class: 'muted' }, 'Order-independent (Shapley) attribution over the ' + (decView === 'EX_COSTS' ? 'before-costs' : 'pre-GST') + ' landed value; the futures quote enters directly. Contributions sum exactly to the change. This describes arithmetic, not causes.'));
    APP.lastDecomp = { dec: dec, agg: agg, metal: metal, view: decView, x0: x0, x1: x1 };
  }
  return box;
}
function buildBasis(root) {
  const p = PANELS.filter(function (x) { return x.id === 'basis'; })[0];
  const rebuild = function () { buildPanel('basis'); };
  const metal = APP.state.metal;
  const cid = selectedContract(metal);
  const boxWarn = h('div'), boxF = h('div'), boxP = h('div'), boxN = h('div'), boxD = h('div');
  const inputsCard = isDemo() ? null : card({ id: 'card-basis-in', title: 'Your quotes (optional; stay in this browser)', labels: ['LOCAL ONLY'], body: [
    h('p', { class: 'note' }, 'MCX and COMEX prices are not published on this site: MCX display rights are not confirmed and CME requires a licence. You can enter prices you are entitled to use, or load a bhavcopy you downloaded. They are processed only in this browser.'),
    bhavLoader(rebuild),
    details('MCX price for the selected contract', mcxForm(cid), true),
    details('Global benchmark (COMEX)', benchForm(metal), !String(APP.state.user.bench[metal].price).trim()),
    details('Physical quote (IBJA or dealer, only if you are entitled to use it)', physForm(metal), false),
    details('Local costs and financing (needed for pre-GST views and carry)', costsForm(metal), false)] });
  const s = APP.state.basis;
  const decInputs = isDemo() ? h('p', { class: 'note' }, 'Demo: the synthetic start and end states from the demonstration data are used.') : h('div', { class: 'formgrid' },
    dateField({ id: 'cmp-date', label: 'Earlier date', get: function () { return s.cmpDate; }, set: function (v) { s.cmpDate = v; }, max: todayIST() }),
    inputField({ id: 'cmp-bench', label: 'Benchmark on that date, USD/oz', get: function () { return s.cmpBench; }, set: function (v) { s.cmpBench = v; }, rule: 'price', status: 'USER-ENTERED' }),
    inputField({ id: 'cmp-mcx', label: 'MCX price on that date (same contract)', get: function () { return s.cmpMcx; }, set: function (v) { s.cmpMcx = v; }, rule: 'price', status: 'USER-ENTERED' }));
  const decCard = card({ id: 'card-basis-dec', title: 'Explain a change in basis between two dates', body: [
    h('p', null, 'Splits the change in contract basis into the global benchmark, market USD/INR, the customs exchange rate with tariff value and duty rate, local costs, financing and the MCX quote itself. Public legs for the earlier date come from the dated registries and ECB history.'),
    decInputs, boxD] });
  setKids(root, 
    panelHead(p, 'Basis compares a domestic quote with the modeled landed cost. The MCX futures basis and the physical basis are computed separately and never substituted for each other. Where inputs are far apart in time or contract month, the result carries a warning or is withheld.'),
    h('div', { class: 'controls' }, metalSeg(rebuild),
      selectField({ id: 'basis-contract', label: 'MCX contract', get: function () { return cid || ''; }, set: function (v) { APP.state.basis.contract[metal] = v; }, options: metalContracts(metal), onChange: rebuild }),
      valDateField(rebuild), landedViewSelect('basis-view', rebuild)),
    h('div', { class: 'outputs' }, boxWarn, boxF, boxP, inputsCard, boxN, decCard));
  const update = function () {
    const m = APP.state.metal, view = APP.state.landedView;
    const par = parityFor(m, APP.state.corridor[m]);
    const d = par.valDate, ref = refFor(d);
    const mcx = resolveMcx(selectedContract(m), d, ref);
    const spec = mcx.contract ? SPEC_BY_ID[mcx.contract.product] : null;
    const cm = spec ? computeMcx(spec, mcx.leaf) : null;
    const pairF = pairingCheck(par.benchContract, mcx.contract, d);
    const cohF = coherenceCheck([par.input.comex, par.input.usdinr, mcx.leaf], { valDate: d });
    cohF.pairWarnings = pairF.warnings;
    if (pairF.withhold && !cohF.withhold) cohF.withhold = pairF.withhold;
    const phys = resolvePhysical(m, d, ref);
    const cohP = coherenceCheck([par.input.comex, par.input.usdinr, phys], { valDate: d });
    cohP.pairWarnings = par.benchContract && !par.benchContract.generic ? ['The physical quote is spot; the benchmark is ' + par.benchContract.code + ' (' + fmtMonth(par.benchContract.month) + ' delivery): the physical basis includes that carry.'] : [];
    setKids(boxWarn, par.rates.rule ? null : h('p', { class: 'note warn' }, 'No duty rule is documented for this route and date.'));
    setKids(boxF, cm ? basisCardFor('fut', mcx.leaf, cm.std, par, view, cohF, mcx.contract).card : h('p', { class: 'note' }, 'Select a contract.'));
    setKids(boxP, basisCardFor('phys', phys, phys, par, view, cohP, null).card);
    if (cm) {
      const c = mcx.contract;
      setKids(boxN, card({ id: 'card-basis-norm', title: 'Contract normalization: ' + spec.id, nodes: [cm.perG, cm.std, cm.mult, cm.notional], body: [
        tableOf([{ key: 'k', label: 'Field' }, { key: 'v', label: 'Value' }], [
          { k: 'Quotation', v: 'INR per ' + spec.quotationQuantity + ' ' + spec.quotationUnit }, { k: 'Lot', v: spec.lotSize + ' ' + spec.lotUnit + ' (multiplier ' + spec.lotMultiplierFromQuote + ')' },
          { k: 'Tick', v: spec.tick }, { k: 'Quality', v: spec.quality }, { k: 'Delivery centre', v: spec.deliveryCentre },
          { k: 'Expiry', v: fmtDate(c.expiry) + (c.computed ? ' (rule-computed, PROBABLE)' : '') }, { k: 'Tender period starts', v: fmtDate(tenderStart(c.expiry)) + ' (last 3 trading days; holidays not loaded)' },
          { k: 'Specification evidence', v: spec.verification }], { id: 'tbl-spec' }),
        citeList(spec.citations.concat(c.citations || [])),
        legTable([cm.perG, cm.std, cm.notional])] }));
    } else setKids(boxN, );
    setKids(boxD, cm ? decompositionCard(m, view, par, mcx) : h('p', { class: 'note' }, 'Select a contract.'));
  };
  return { update: update };
}
