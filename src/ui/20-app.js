/* =============================================================================
 * SECTION 20. APP: boot with an error boundary, hash router, header, theme, demo
 * -----------------------------------------------------------------------------
 * The page ships fully readable without scripts (static prerender). The app only
 * replaces a panel after that panel has rendered successfully; any failure leaves
 * the static content in place and says so. Nothing is hidden before boot succeeds.
 * ===========================================================================*/

const BUILDERS = { how: buildHow, parity: buildParity, basis: buildBasis, spreads: buildSpreads, corridor: buildCorridor, evidence: buildEvidence, limits: buildLimits };

function polyfills() {
  if (!Element.prototype.replaceChildren) {
    Element.prototype.replaceChildren = function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (let i = 0; i < arguments.length; i++) { const a = arguments[i]; this.appendChild(a instanceof Node ? a : document.createTextNode(String(a))); }
    };
  }
  if (!Element.prototype.remove) Element.prototype.remove = function () { if (this.parentNode) this.parentNode.removeChild(this); };
}
function parseHash() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#\/?/, ''));
  let mode = 'public', rest = raw;
  if (raw === 'demo' || raw.indexOf('demo/') === 0) { mode = 'demo'; rest = raw.slice(5) || 'parity'; }
  const panel = PANELS.some(function (p) { return p.id === rest; }) ? rest : (mode === 'demo' ? 'parity' : 'how');
  return { mode: mode, panel: panel };
}
function panelError(el, e) {
  console.error('[ibpci] panel failed', e);
  const n = h('p', { class: 'note crit', role: 'alert' }, 'The interactive view of this panel could not start (' + (e && e.message ? e.message : 'error') + '). The static snapshot below is still accurate.');
  el.insertBefore(n, el.firstChild);
}
function buildPanel(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const tmp = h('div');
  try {
    const b = BUILDERS[id](tmp);
    APP.rendered[id] = { mode: APP.mode, b: b };
    b.update();
    setKids(el, Array.prototype.slice.call(tmp.childNodes));
    el.setAttribute('data-live', '1');
  } catch (e) {
    APP.rendered[id] = null;
    if (el.getAttribute('data-live') !== '1') panelError(el, e); else { console.error(e); toast('Could not update this panel: ' + e.message); }
  }
}
function updatePanel(id) {
  const r = APP.rendered[id];
  if (!r) return buildPanel(id);
  try { r.b.update(); } catch (e) { console.error('[ibpci] update failed', e); toast('Could not update: ' + e.message); }
}
function rebuildAll() { APP.rendered = {}; buildPanel(APP.panel); renderAsOf(); }
function showPanel(id) {
  PANELS.forEach(function (p) {
    const el = document.getElementById(p.id);
    if (el) { if (p.id === id) el.removeAttribute('hidden'); else el.setAttribute('hidden', ''); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('#modnav a'), function (a) {
    const pid = a.getAttribute('data-panel');
    a.setAttribute('href', '#' + (APP.mode === 'demo' ? 'demo/' : '') + pid);
    if (pid === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
function route(first) {
  const r = parseHash();
  const modeChanged = r.mode !== APP.mode;
  APP.mode = r.mode;
  APP.panel = r.panel;
  document.body.classList.toggle('demo', APP.mode === 'demo');
  const bar = document.getElementById('demo-bar');
  if (bar) {
    if (APP.mode === 'demo') {
      setKids(bar, h('strong', null, LABEL.DEMO), ' Every price is invented; rates and contract dates are real. ', h('a', { href: '#' + (APP.panel || 'how') }, 'Exit demo'));
      bar.removeAttribute('hidden');
    } else bar.setAttribute('hidden', '');
  }
  if (modeChanged) APP.rendered = {};
  if (!APP.rendered[APP.panel] || APP.rendered[APP.panel].mode !== APP.mode) buildPanel(APP.panel);
  showPanel(APP.panel);
  renderTools();
  renderAsOf();
  if (first !== true) { const m = document.getElementById('main'); if (m && m.scrollIntoView) window.scrollTo(0, 0); }
  document.title = PANELS.filter(function (p) { return p.id === APP.panel; })[0].label + ' | ' + BUILD.app + (APP.mode === 'demo' ? ' (synthetic demo)' : '');
}
function applyTheme() {
  const t = APP.state.theme;
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
function currentTheme() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function renderTools() {
  const tools = document.getElementById('tools');
  if (!tools) return;
  setKids(tools, 
    h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Switch colour theme', onclick: function () { APP.state.theme = currentTheme() === 'dark' ? 'light' : 'dark'; applyTheme(); saveSoon(); rerenderCharts(); renderTools(); } }, currentTheme() === 'dark' ? 'Light theme' : 'Dark theme'),
    APP.mode === 'demo' ? h('a', { class: 'btn sm', href: '#' + APP.panel }, 'Exit demo') : h('a', { class: 'btn sm demo-link', href: '#demo/' + APP.panel }, 'Demo (synthetic)'));
}
function renderAsOf() {
  const el = document.getElementById('asof');
  if (!el || !SNAP) return;
  const rows = statusBoardRows(refFor(null));
  const stale = rows.filter(function (r) { return /STALE/.test(r.state); }).length;
  const un = rows.filter(function (r) { return /UNAVAILABLE/.test(r.state); }).length;
  setKids(el, 
    h('span', { class: 'asof-main' }, APP.mode === 'demo' ? 'Synthetic demo' : 'Daily snapshot built ' + fmtDateTime(SNAP.generatedAt)),
    h('span', { class: 'asof-sub' }, APP.mode === 'demo' ? 'not market data' : 'Not live. Viewed ' + fmtDateTime(Date.now()) + '.'),
    APP.mode === 'demo' ? null : h('a', { class: 'asof-chips', href: '#how' }, stale ? badge(stale + ' inputs stale', 'b-stale') : null, un ? badge(un + ' inputs unavailable', 'b-un') : null, (!stale && !un) ? badge('all inputs current', 'b-ver') : null));
}
function showBootError(e) {
  console.error('[ibpci] boot failed', e);
  const n = document.getElementById('boot-note');
  if (n) {
    n.className = 'note crit';
    setKids(n, 'Interactive features could not start (' + (e && e.message ? e.message : 'unknown error') + '). You are seeing the static snapshot, which is complete and dated.');
    n.removeAttribute('hidden');
  }
}
function boot() {
  polyfills();
  try {
    APP.staticHtml = document.documentElement.outerHTML;
    const node = document.getElementById('snapshot-data');
    if (!node) throw new Error('snapshot data missing');
    const snap = JSON.parse(node.textContent);
    if (!snap || snap.schema !== BUILD.snapshotSchema) throw new Error('snapshot schema mismatch');
    loadRegistries(snap);
    APP.state = loadState();
    APP.mode = 'public';
    applyTheme();
    window.addEventListener('hashchange', function () { route(false); });
    route(true);
    document.documentElement.classList.add('app-ready');
    APP.bootOk = true;
    const n = document.getElementById('boot-note');
    if (n) n.setAttribute('hidden', '');
    window.IBPCI = { version: BUILD.buildVersion, runTests: function () { return runTests({ csp: (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '', html: APP.staticHtml, renderStepText: function (ep, i) { return episodeStepView(ep, ep.steps[i].date, i).textContent; } }); },
      state: function () { return APP.state; }, snapshotId: SNAP.id, buildExport: buildExport };
  } catch (e) { showBootError(e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
