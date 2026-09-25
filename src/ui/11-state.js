/* =============================================================================
 * SECTION 11. APP STATE, LOCAL PERSISTENCE, INPUT FIELDS
 * State holds raw visitor strings (so an invalid entry is shown, never replaced).
 * Persistence is per-viewer, versioned, bounded and optional: private windows or
 * blocked storage simply start empty. Demo mode never persists anything.
 * ===========================================================================*/


const APP = { mode: 'public', panel: 'how', state: null, saveT: null, updT: null, lastTests: null, bootOk: false, file: null, rendered: {} };

function blankEntry() { return { price: '', date: '' }; }
function defaultState() {
  const mcx = {};
  return {
    v: BUILD.storageSchema, theme: null, valDate: '',
    metal: 'gold', corridor: { gold: 'NORMAL', silver: 'NORMAL' }, landedView: 'EX_COSTS',
    gst: { ratePct: fmtInput(GST_METHOD.defaultRatePct, 2), base: GST_METHOD.defaultBase, itcEnabled: GST_METHOD.itcDefaultEnabled, itcSharePct: String(GST_METHOD.itcDefaultSharePct) },
    user: {
      bench: { gold: { contract: 'GCZ26', price: '', date: '' }, silver: { contract: 'SIZ26', price: '', date: '' } },
      mcx: mcx,
      physical: { gold: { price: '', date: '', fineness: '999', source: '' }, silver: { price: '', date: '', fineness: '999', source: '' } },
      costs: { gold: { freight: '', assay: '', handling: '', finRate: '', finDays: '' }, silver: { freight: '', assay: '', handling: '', finRate: '', finDays: '' } },
      customsFx: { value: '', effectiveFrom: '' }
    },
    basis: { contract: { gold: 'GOLD:2026-10', silver: 'SILVER:2026-12' }, cmpDate: '', cmpBench: '', cmpMcx: '' },
    spread: { product: 'GOLD', near: 'GOLD:2026-10', far: 'GOLD:2026-12', lots: '1', finRatePct: '',
      margin: { nearSpanPct: '', farSpanPct: '', nearExposurePct: '', farExposurePct: '', spreadCreditPct: '', directSpreadMarginPct: '', additionalSpecialPct: '', brokerBufferPct: '' } },
    replay: { episode: 'A', step: { A: 1, B: 1 }, date: '', overrides: { NORMAL: '', CEPA_SILVER: '', CEPA_GOLD_TRQ: '' } }
  };
}
function fmtInput(v, dp) { if (v === null || v === undefined) return ''; return dp === undefined ? String(v) : Number(v).toFixed(dp); }
function mergeKnown(def, stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return def;
  const out = Object.assign({}, def);
  Object.keys(stored).forEach(function (k) {
    const dv = def[k], s0 = stored[k];
    if (dv && typeof dv === 'object' && !Array.isArray(dv)) {
      out[k] = (k === 'mcx') ? sanitizeMcxMap(s0) : mergeKnown(dv, s0);
    } else if (k in def && (dv === null ? (s0 === null || typeof s0 === 'string') : typeof dv === typeof s0) && (typeof s0 !== 'string' || s0.length <= 80)) out[k] = s0;
  });
  return out;
}
function sanitizeMcxMap(m) {
  const out = {};
  if (!m || typeof m !== 'object') return out;
  Object.keys(m).slice(0, 60).forEach(function (k) {
    if (!/^[A-Z]+:\d{4}-\d{2}$/.test(k)) return;
    const e = m[k] || {};
    out[k] = { price: typeof e.price === 'string' ? e.price.slice(0, 20) : '', date: typeof e.date === 'string' ? e.date.slice(0, 10) : '', file: typeof e.file === 'string' ? e.file.slice(0, 80) : '' };
  });
  return out;
}
function sanitizeState(st) {
  const ok = function (v, list) { return list.indexOf(v) >= 0; };
  if (!ok(st.metal, METALS)) st.metal = 'gold';
  METALS.forEach(function (m) {
    const cors = CORRIDORS.filter(function (c) { return c.metals.indexOf(m) >= 0; }).map(function (c) { return c.id; });
    if (!ok(st.corridor[m], cors)) st.corridor[m] = 'NORMAL';
  });
  if (!ok(st.landedView, LANDED_VIEWS.map(function (v) { return v.id; }))) st.landedView = 'EX_COSTS';
  if (!ok(st.gst.base, GST_METHOD.bases.map(function (b) { return b.id; }))) st.gst.base = GST_METHOD.defaultBase;
  if (st.valDate && parseISODate(st.valDate) === null) st.valDate = '';
  if (!ok(st.replay.episode, EPISODES.map(function (e) { return e.id; }))) st.replay.episode = 'A';
  EPISODES.forEach(function (ep) {
    const v = st.replay.step[ep.id];
    if (!(typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < ep.steps.length)) st.replay.step[ep.id] = 0;
  });
  if (st.replay.date && parseISODate(st.replay.date) === null) st.replay.date = '';
  if (!ok(st.spread.product, BULLION_PRODUCTS)) st.spread.product = 'GOLD';
  return st;
}
function cloneState(o) { return JSON.parse(JSON.stringify(o)); }
function loadState() {
  let st = defaultState();
  try {
    const raw = window.localStorage ? localStorage.getItem(BUILD.storageKey) : null;
    if (raw && raw.length <= BUILD.storageMaxBytes) {
      const o = JSON.parse(raw);
      if (o && o.schema === BUILD.storageSchema && o.state) st = mergeKnown(st, o.state);
    }
  } catch (e) { /* storage unavailable: start empty */ }
  return sanitizeState(st);
}
function saveState() {
  if (APP.mode !== 'public') return;
  try {
    const payload = JSON.stringify({ schema: BUILD.storageSchema, configVersion: BUILD.configVersion, savedAt: new Date().toISOString(), state: APP.state });
    if (payload.length > BUILD.storageMaxBytes) return;
    localStorage.setItem(BUILD.storageKey, payload);
  } catch (e) { /* persistence is a convenience */ }
}
function saveSoon() { clearTimeout(APP.saveT); APP.saveT = setTimeout(saveState, 300); }
function clearMyEntries() {
  const theme = APP.state.theme;
  APP.state = defaultState();
  APP.state.theme = theme;
  try { localStorage.removeItem(BUILD.storageKey); } catch (e) { /* ignore */ }
  APP.file = null;
  toast('Your entries were cleared from this browser');
  rebuildAll();
}

/* ---------- input fields ---------- */
function inputField(o) {
  const inp = h('input', { type: 'text', inputmode: o.inputmode || 'decimal', id: o.id, autocomplete: 'off', spellcheck: 'false',
    placeholder: o.placeholder || '', 'aria-describedby': o.id + '-m ' + o.id + '-e' });
  inp.value = o.get();
  const err = h('div', { class: 'err', id: o.id + '-e', 'aria-live': 'polite' });
  const validate = function () {
    if (!o.rule) { err.textContent = ''; return; }
    const p = parseInput(inp.value, o.rule);
    if (p.state === 'INVALID') { inp.setAttribute('aria-invalid', 'true'); err.textContent = p.error + '. Dependent outputs are withheld.'; }
    else { inp.removeAttribute('aria-invalid'); err.textContent = ''; }
  };
  inp.addEventListener('input', function () { o.set(inp.value); validate(); scheduleUpdate(); });
  validate();
  return h('div', { class: 'field' + (o.wide ? ' wide' : '') },
    h('label', { for: o.id }, o.label),
    inp,
    h('div', { class: 'meta', id: o.id + '-m' }, o.status ? badge(o.status) : null, h('span', null, o.unit || ''), o.hint ? h('span', null, o.hint) : null),
    err);
}
function selectField(o) {
  const sel = h('select', { id: o.id }, o.options.map(function (op) {
    const el = h('option', { value: op.value }, op.label);
    if (op.value === o.get()) el.selected = true;
    return el;
  }));
  sel.addEventListener('change', function () { o.set(sel.value); if (o.onChange) o.onChange(sel.value); else scheduleUpdate(true); });
  return h('div', { class: 'field wide' }, h('label', { for: o.id }, o.label), sel, o.hint ? h('div', { class: 'meta' }, o.hint) : null);
}
function dateField(o) {
  const inp = h('input', { type: 'date', id: o.id, 'aria-describedby': o.id + '-m', min: o.min || null, max: o.max || null });
  inp.value = o.get();
  const onc = function () { o.set(inp.value); if (o.onChange) o.onChange(inp.value); else scheduleUpdate(); };
  inp.addEventListener('change', onc);
  return h('div', { class: 'field date' }, h('label', { for: o.id }, o.label), inp,
    o.hint ? h('div', { class: 'meta', id: o.id + '-m' }, o.hint) : null);
}
function segmented(o) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': o.label });
  o.options.forEach(function (op) {
    wrap.appendChild(h('button', { type: 'button', 'aria-pressed': op.value === o.get() ? 'true' : 'false',
      onclick: function () { o.set(op.value); if (o.onChange) o.onChange(op.value); } }, op.label));
  });
  return wrap;
}
function checkbox(o) {
  const c = h('input', { type: 'checkbox', id: o.id });
  c.checked = !!o.get();
  c.addEventListener('change', function () { o.set(c.checked); scheduleUpdate(true); });
  return h('label', { class: 'chk', for: o.id }, c, o.label);
}
function scheduleUpdate(immediate) {
  clearTimeout(APP.updT);
  const run = function () { updatePanel(APP.panel); saveSoon(); };
  if (immediate) run(); else APP.updT = setTimeout(run, 140);
}
