/* =============================================================================
 * SECTION 16. SPREADS PANEL: calendar spread on real expiries, descriptive carry,
 * modeled fair carry, hypothetical margin sensitivity
 * ===========================================================================*/

function spreadContracts() {
  const s = APP.state.spread;
  const opts = contractOptions(s.product);
  const ids = opts.map(function (o) { return o.value; });
  if (ids.indexOf(s.near) < 0) s.near = ids[0] || '';
  if (ids.indexOf(s.far) < 0 || s.far <= s.near) s.far = ids.filter(function (x) { return x > s.near; })[0] || '';
  return { opts: opts, near: s.near, far: s.far };
}
function hypLeaf(id, label, raw) {
  const p = parseInput(raw, 'pct');
  if (p.state === 'EMPTY') return mkLeaf(id, label, null, 'rate', ST.PLACEHOLDER, { note: 'Hypothetical rate not entered' });
  if (p.state !== 'OK') return mkLeaf(id, label, null, 'rate', ST.INVALID, { error: p.error });
  return mkLeaf(id, label + ' (hypothetical)', p.value / 100, 'rate', isDemo() ? ST.SYNTHETIC : ST.USER, { sourceId: isDemo() ? 'SRC-SYN' : 'VISITOR', note: LABEL.MARGIN_HYP, fresh: FRESH.NA });
}
function spreadParams(near, far, ncon, fcon, lotsRaw, m, finRaw) {
  const lotsP = parseInput(lotsRaw, 'lots');
  const lots = lotsP.state === 'OK' ? mkLeaf('lots', 'Lots', lotsP.value, 'lots', isDemo() ? ST.SYNTHETIC : ST.USER, { sourceId: 'VISITOR', fresh: FRESH.NA }) : mkLeaf('lots', 'Lots', null, 'lots', ST.INVALID, { error: lotsP.error });
  const worst = [ncon, fcon].some(function (c) { return c && c.computed; }) ? ST.PROBABLE : stFromVerification([ncon, fcon].some(function (c) { return c && c.verification === 'SECONDARY'; }) ? 'SECONDARY' : 'PRIMARY COPY');
  return { spec: SPEC_BY_ID[ncon.product], near: near, far: far, lots: lots, valDate: valDate(), nearExp: ncon.expiry, farExp: fcon.expiry,
    dateStatus: worst, dateCitations: (ncon.citations || []).concat(fcon.citations || []), dateProbable: worst === ST.PROBABLE,
    m: { nearSpan: hypLeaf('mNearSpan', 'Near outright margin', m.nearSpanPct), farSpan: hypLeaf('mFarSpan', 'Far outright margin', m.farSpanPct),
      nearExp: hypLeaf('mNearExp', 'Near exposure', m.nearExposurePct), farExp: hypLeaf('mFarExp', 'Far exposure', m.farExposurePct),
      credit: hypLeaf('mCredit', 'Spread credit', m.spreadCreditPct),
      direct: String(m.directSpreadMarginPct || '').trim() === '' ? mkLeaf('mDirect', 'Direct spread margin', null, 'rate', ST.PLACEHOLDER) : hypLeaf('mDirect', 'Direct spread margin', m.directSpreadMarginPct),
      addl: hypLeaf('mAddl', 'Additional margin', m.additionalSpecialPct), buffer: hypLeaf('mBuffer', 'Broker buffer', m.brokerBufferPct),
      fin: finRaw } };
}
function financingLeaf(metal) {
  const raw = APP.state.spread.finRatePct;
  if (isDemo()) return synLeaf('fin', 'Financing rate', SAMPLE_DATA.margin.financingRatePct / 100, 'rate');
  if (String(raw).trim() !== '') {
    const p = parseInput(raw, 'pct');
    return p.state === 'OK' ? mkLeaf('fin', 'Financing rate (your assumption)', p.value / 100, 'rate', ST.USER, { sourceId: 'VISITOR', fresh: FRESH.NA }) : mkLeaf('fin', 'Financing rate', null, 'rate', ST.INVALID, { error: p.error });
  }
  return costLeaf(metal, 'finRate', 'fin', 'Financing rate', 'rate', 'pct', true);
}
function sensitivityGrid(P) {
  const rates = [0.04, 0.06, 0.08, 0.10], credits = [0, 0.5, 0.75];
  if (P.near.value === null || P.far.value === null) return h('p', { class: 'note' }, 'Needs both leg prices.');
  const H0 = function (v) { return mkLeaf('h', 'h', v, 'rate', ST.PROBABLE, { note: 'grid value' }); };
  const rows = rates.map(function (r) {
    const row = { rate: fmtPct(r, 0) };
    credits.forEach(function (c, i) {
      const sp = computeSpread(Object.assign({}, P, { m: { nearSpan: H0(r), farSpan: H0(r), nearExp: H0(0), farExp: H0(0), credit: H0(c), direct: mkLeaf('d', 'd', null, 'rate', ST.PLACEHOLDER), addl: H0(0), buffer: H0(0), fin: P.m.fin } }));
      row['c' + i] = sp.blocked.value === null ? 'withheld' : fmtINRShort(sp.blocked.value);
    });
    return row;
  });
  return h('div', null,
    tableOf([{ key: 'rate', label: 'Outright margin rate (each leg)' }].concat(credits.map(function (c, i) { return { key: 'c' + i, label: 'Spread credit ' + fmtPct(c, 0), num: true }; })), rows, { id: 'tbl-sens' }),
    h('p', { class: 'muted' }, 'Blocked capital for the spread under each hypothetical pair of rates, with exposure, additional margin and buffer set to zero. These are not MCXCCL parameters; the exchange computes margins from SPAN risk arrays that change daily.'));
}
function buildSpreads(root) {
  const p = PANELS.filter(function (x) { return x.id === 'spreads'; })[0];
  const rebuild = function () { buildPanel('spreads'); };
  const s = APP.state.spread;
  const sc = spreadContracts();
  const boxA = h('div'), boxB = h('div'), boxC = h('div');
  const m = s.margin;
  const mf = function (k, label) { return inputField({ id: 'mg-' + k, label: label, get: function () { return m[k]; }, set: function (v) { m[k] = v; }, rule: 'pct', unit: '%', status: 'HYPOTHETICAL' }); };
  const hypCard = card({ id: 'card-sp-hyp-in', title: 'Your hypothetical margin parameters (optional)', labels: ['HYPOTHETICAL'], body: [
    h('p', { class: 'note warn' }, LABEL.MARGIN_HYP + ' Leave blank to see only the sensitivity grid.'),
    h('div', { class: 'formgrid' }, mf('nearSpanPct', 'Near outright margin'), mf('farSpanPct', 'Far outright margin'), mf('nearExposurePct', 'Near exposure'), mf('farExposurePct', 'Far exposure'),
      mf('spreadCreditPct', 'Spread credit'), mf('directSpreadMarginPct', 'Direct spread margin (optional)'), mf('additionalSpecialPct', 'Additional / special'), mf('brokerBufferPct', 'Broker buffer'))] });
  const yours = isDemo() ? null : card({ id: 'card-sp-in', title: 'Your leg prices (optional; stay in this browser)', labels: ['LOCAL ONLY'], body: [
    h('p', { class: 'note' }, 'MCX prices are not published on this site. Enter the two legs or load a bhavcopy; both stay in your browser.'),
    bhavLoader(rebuild),
    sc.near ? details('Near leg: ' + sc.near.replace(':', ' '), mcxForm(sc.near), true) : null,
    sc.far ? details('Far leg: ' + sc.far.replace(':', ' '), mcxForm(sc.far), true) : null,
    details('Your financing rate (for fair carry and Lens A)', h('div', { class: 'formgrid' }, inputField({ id: 'sp-fin', label: 'Financing rate', get: function () { return s.finRatePct; }, set: function (v) { s.finRatePct = v; }, rule: 'pct', unit: '% per year', status: 'USER-ENTERED' })), false)] });
  setKids(root, 
    panelHead(p, 'The price difference between two MCX contract months of the same product, on the exchange\'s actual expiry dates. Annualized figures describe the spread; they are not return forecasts. Margin appears only as a hypothetical sensitivity because no sourced margin rule is loaded.'),
    h('div', { class: 'controls' },
      selectField({ id: 'sp-prod', label: 'Product', get: function () { return s.product; }, set: function (v) { s.product = v; s.near = ''; s.far = ''; }, options: BULLION_PRODUCTS.map(function (x) { return { value: x, label: SPEC_BY_ID[x] ? SPEC_BY_ID[x].displayName + ' (' + x + ')' : x }; }), onChange: rebuild }),
      selectField({ id: 'sp-near', label: 'Near contract', get: function () { return sc.near; }, set: function (v) { s.near = v; }, options: sc.opts, onChange: rebuild }),
      selectField({ id: 'sp-far', label: 'Far contract', get: function () { return sc.far; }, set: function (v) { s.far = v; }, options: sc.opts.filter(function (o) { return o.value > sc.near; }), onChange: rebuild }),
      inputField({ id: 'sp-lots', label: 'Lots', get: function () { return s.lots; }, set: function (v) { s.lots = v; }, rule: 'lots', inputmode: 'numeric' }),
      valDateField(rebuild)),
    h('div', { class: 'outputs' }, boxA, yours, boxB, hypCard, boxC));
  const update = function () {
    if (!sc.near || !sc.far) { setKids(boxA, h('p', { class: 'note' }, 'This product needs two open contract months in the calendar.')); setKids(boxB, ); setKids(boxC, ); return; }
    const d = valDate(), ref = refFor(d);
    const n = resolveMcx(sc.near, d, ref, '-near'), f = resolveMcx(sc.far, d, ref, '-far');
    const metal = SPEC_BY_ID[s.product].metal;
    const sm = SAMPLE_DATA.margin;
    const demoMargin = { nearSpanPct: String(sm.nearSpanPct), farSpanPct: String(sm.farSpanPct), nearExposurePct: String(sm.nearExposurePct), farExposurePct: String(sm.farExposurePct),
      spreadCreditPct: String(sm.spreadCreditPct), directSpreadMarginPct: '', additionalSpecialPct: String(sm.additionalSpecialPct), brokerBufferPct: String(sm.brokerBufferPct) };
    const P = spreadParams(n.leaf, f.leaf, n.contract, f.contract, isDemo() ? '1' : s.lots, isDemo() ? demoMargin : s.margin, financingLeaf(metal));
    const sp = computeSpread(P);
    const cu = COMPARISON_UNIT[metal];
    const perUnit = mkDerived('spreadStd', 'Spread per ' + cu.per.replace('per ', ''), cu.label, 'F-M1-15', [sp.raw], function (r) { return r / P.spec.quoteGrams * cu.grams; });
    const warns = sp.dateErrors.concat(sp.coherence.warnings);
    [n.contract, f.contract].forEach(function (c) { if (c && c.computed) warns.push(c.product + ' ' + fmtMonth(c.month) + ' expiry is rule-computed (PROBABLE).'); });
    if (d >= tenderStart(n.contract.expiry)) warns.push('The near contract is in its tender (delivery) period.');
    const obsNodes = [n.leaf, f.leaf, sp.raw, perUnit, sp.dirBN, sp.dirSN, sp.rupeeBN, sp.rupeeSN, sp.spreadDays, sp.daysToNear, sp.daysToFar, sp.carryBN, sp.carrySN, sp.breakeven];
    setKids(boxA, card({ id: 'card-sp-obs', title: 'Observed spread: ' + s.product + ' ' + fmtMonth(n.contract.month) + ' to ' + fmtMonth(f.contract.month), nodes: obsNodes,
      exports: [{ id: 'sp', name: 'Spread', build: function () {
        const nodes = Object.keys(sp.N).map(function (k) { return sp.N[k]; }).concat([perUnit]);
        return { module: 'spreads', subject: s.product + '-' + n.contract.month + '-' + f.contract.month, columns: NODE_COLUMNS, rows: nodes.map(function (x) { return nodeRow(x); }), nodes: nodes,
          meta: { product: s.product, near: sc.near, far: sc.far, nearExpiry: n.contract.expiry, farExpiry: f.contract.expiry, valuationDate: d, marginWarning: LABEL.MARGIN_HYP, marginInputsPct: s.margin } };
      } }],
      body: [warnList(warns),
        h('div', { class: 'tiles' },
          tile({ label: 'Spread (far minus near), ' + P.spec.displayQuotation, node: sp.raw, hl: true }),
          P.spec.quoteGrams !== cu.grams ? tile({ label: 'Spread ' + cu.per, node: perUnit }) : null,
          tile({ label: 'Rupees per position: buy near / sell far', node: sp.rupeeBN }),
          tile({ label: 'Rupees per position: sell near / buy far', node: sp.rupeeSN })),
        h('div', { class: 'tiles' },
          tile({ label: 'Days between expiries', node: sp.spreadDays, sub: fmtDate(n.contract.expiry) + ' to ' + fmtDate(f.contract.expiry) }),
          tile({ label: 'Annualized price carry (buy near / sell far)', node: sp.carryBN, sub: 'Descriptive only' }),
          tile({ label: 'Breakeven financing rate (Lens A)', node: sp.breakeven })),
        legTable(obsNodes)] }));
    const fairNodes = [P.m.fin, sp.fairCarry, sp.spreadVsFair, sp.finNotional, sp.lensA];
    setKids(boxB, card({ id: 'card-sp-fair', title: 'Observed spread against modeled fair carry', nodes: fairNodes, body: [
      h('p', null, 'Modeled fair carry is the near price times a financing rate over the days between expiries. It leaves out storage, insurance and delivery costs, so the gap is descriptive, not a mispricing signal.'),
      h('div', { class: 'tiles' }, tile({ label: 'Modeled fair carry', node: sp.fairCarry }), tile({ label: 'Observed minus modeled', node: sp.spreadVsFair }), tile({ label: 'Delivery-funded carry (Lens A)', node: sp.lensA })),
      legTable(fairNodes)] }));
    const hypNodes = [sp.nearSpan, sp.farSpan, sp.nearExpo, sp.farExpo, sp.grossOutright, sp.spanOffset, sp.spreadSpan, sp.addl, sp.buffer, sp.blocked, sp.periodBN, sp.annBN, sp.netBN, sp.netAnnBN, sp.leverage].filter(Boolean);
    setKids(boxC, card({ id: 'card-sp-hyp', title: 'Hypothetical margin sensitivity (not an exchange or broker margin)', labels: ['HYPOTHETICAL'].concat(cardLabels(aggregate([sp.raw]))), body: [
      sensitivityGrid(P),
      h('h4', { class: 'subh' }, 'With your hypothetical parameters'),
      legTable(hypNodes)] }));
  };
  return { update: update };
}
