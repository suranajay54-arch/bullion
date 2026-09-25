/* =============================================================================
 * SECTION 5. UI KIT (DOM helpers, badges, cards, tables, charts, exports)
 * No HTML-string injection anywhere: every node is created with createElement/textContent,
 * so user-entered strings can never become markup.
 * ===========================================================================*/

const SVGNS = 'http://www.w3.org/2000/svg';
function appendKids(el, kids) {
  kids.forEach(function (c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { appendKids(el, c); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return el;
}
/* Replace an element's children, skipping null/false and flattening arrays (never renders "null"). */
function setKids(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return appendKids(el, Array.prototype.slice.call(arguments, 1));
}
function h(tag, props) {
  const el = document.createElement(tag);
  if (props) {
    Object.keys(props).forEach(function (k) {
      const v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    });
  }
  return appendKids(el, Array.prototype.slice.call(arguments, 2));
}
function sv(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== null && attrs[k] !== undefined) el.setAttribute(k, String(attrs[k])); });
  Array.prototype.slice.call(arguments, 2).forEach(function (c) {
    if (c === null || c === undefined) return;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return el;
}

/* ---------- badges ---------- */
const BADGE_CLASS = {
  'VERIFIED': 'b-ver', 'PRIMARY COPY': 'b-copy', 'SECONDARY': 'b-sec', 'CITATION PENDING': 'b-pend', 'OWNER-ENTERED': 'b-owner',
  'USER-ENTERED': 'b-user', 'ASSUMPTION': 'b-asm', 'SYNTHETIC': 'b-syn', 'PROBABLE': 'b-prob', 'PLACEHOLDER': 'b-ph', 'UNAVAILABLE': 'b-un',
  'INVALID INPUT': 'b-inv', 'ALL TESTS PASS': 'b-ver', 'TEST FAILURES': 'b-inv', 'HYPOTHETICAL': 'b-prob', 'DERIVED': 'b-der',
  'SNAPSHOT': 'b-snap', 'STALE': 'b-stale', 'LIVE': 'b-live', 'DELAYED': 'b-snap', 'NOT LIVE': 'b-plain',
  'USER-ENTERED INPUT': 'b-user', 'OWNER-ENTERED INPUT': 'b-owner', 'ASSUMPTION INPUT': 'b-asm', 'PRIMARY-COPY INPUT': 'b-copy', 'SECONDARY INPUT': 'b-sec',
  'DISPLAY BLOCKED': 'b-un', 'CONNECTED': 'b-ver', 'MANUAL': 'b-owner', 'LOCAL ONLY': 'b-user', 'NOT CONNECTED': 'b-ph'
};
BADGE_CLASS[LABEL.DERIVED_SYN] = 'b-dsyn';
BADGE_CLASS[LABEL.DERIVED_VER] = 'b-dver';
BADGE_CLASS[LABEL.PROBABLE_GST] = 'b-prob';
function badge(text, cls) { return h('span', { class: 'badge ' + (cls || BADGE_CLASS[text] || 'b-plain') }, text); }
function badgesForNode(n) { return statusLabels(n).map(function (l) { return badge(l); }); }
function execBadge(ex) { return h('span', { class: 'badge ' + ex.cls, title: ex.note }, ex.label); }
function execStatusLabel(ex) {
  if (ex.status === ST.DERIVED) return LABEL.DERIVED_VER;
  return ex.status;
}
function nullSpan(n) {
  const st = n ? n.status : ST.PLACEHOLDER;
  const cls = st === ST.UNAVAILABLE ? 'nullv un' : st === ST.INVALID ? 'nullv inv' : 'nullv';
  const txt = st === ST.UNAVAILABLE ? 'UNAVAILABLE' : st === ST.INVALID ? 'INVALID INPUT' : 'PLACEHOLDER';
  return h('span', { class: cls, title: n ? (n.note || n.error || '') : '' }, txt);
}
function valSpan(n, text) {
  if (!n || n.value === null) return nullSpan(n);
  return h('span', { title: traceText(n) }, text !== undefined ? text : fmtNode(n));
}
function sourceName(id) {
  if (REG.sources[id]) return REG.sources[id].name;
  if (INTERNAL_SOURCES[id]) return INTERNAL_SOURCES[id].name;
  return id;
}
function srcCite(ids) { return (ids || []).map(sourceName).join('; '); }
/* A citation as a link (opens the document in a new tab) with its verification state. */
function citeShort(c) { return String(c.title).split(':')[0] + (c.date ? ', ' + c.date : ''); }
function citeLink(cid, short) {
  const c = REG.citations[cid];
  if (!c) return h('span', { class: 'cite' }, cid);
  return h('span', { class: 'cite' },
    h('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer', title: short ? null : c.title }, short ? citeShort(c) : c.title),
    ' ', badge(c.verification));
}
function citeList(ids, short) {
  const list = (ids || []).filter(function (x, i, a) { return a.indexOf(x) === i; });
  if (!list.length) return null;
  return h('ul', { class: 'cites' }, list.map(function (cid) { return h('li', null, citeLink(cid, short)); }));
}

/* ---------- card ---------- */
function card(o) {
  const agg = aggregate(o.nodes || []);
  const labels = o.labels || cardLabels(agg);
  const cls = ['card', 'span-' + (o.span || 12)];
  if (agg.syn || o.forceSyn) cls.push('wm-syn');
  if (o.cls) cls.push(o.cls);
  const head = h('div', { class: 'card-h' },
    h('h3', { id: o.id + '-t' }, o.title),
    h('div', { class: 'card-badges' }, labels.map(function (l) { return badge(l); }), o.extraBadges || null),
    (o.exports && o.exports.length) ? h('div', { class: 'card-actions' }, exportButtons(o.title, o.exports)) : null);
  return h('section', { class: cls.join(' '), id: o.id, 'aria-labelledby': o.id + '-t' },
    head, o.sub ? h('p', { class: 'card-sub' }, o.sub) : null, h('div', { class: 'card-b' }, o.body));
}
function details(summary, body, open) {
  const d = h('details', { class: 'drawer' }, h('summary', null, summary), h('div', { class: 'drawer-b' }, body));
  if (open) d.open = true;
  return d;
}

/* ---------- exports ---------- */
function download(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, class: 'vh' });
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
}
function doExport(build, fmt) {
  try {
    const p = buildExport(build());
    if (fmt === 'csv') download(p.filenameBase + '.csv', 'text/csv;charset=utf-8', p.csvText);
    else download(p.filenameBase + '.json', 'application/json;charset=utf-8', p.jsonText);
    toast('Exported ' + p.filenameBase + '.' + fmt);
    return p;
  } catch (e) {
    toast('Export failed: ' + e.message);
    return null;
  }
}
function exportButtons(title, exports) {
  const out = [];
  exports.forEach(function (x) {
    const pre = exports.length > 1 ? x.name + ' ' : '';
    out.push(h('button', { class: 'btn sm', type: 'button', 'data-export': x.id + ':csv', 'aria-label': 'Export ' + (x.name || title) + ' as CSV', onclick: function () { doExport(x.build, 'csv'); } }, pre + 'CSV'));
    out.push(h('button', { class: 'btn sm', type: 'button', 'data-export': x.id + ':json', 'aria-label': 'Export ' + (x.name || title) + ' as JSON', onclick: function () { doExport(x.build, 'json'); } }, pre + 'JSON'));
  });
  return out;
}
function toTSV(spec) {
  const lines = [spec.columns.map(function (c) { return c.label || c.key; }).join('\t')];
  spec.rows.forEach(function (r) {
    lines.push(spec.columns.map(function (c) {
      const v = r[c.key];
      return v === null || v === undefined ? '' : String(v).replace(/[\t\r\n]+/g, ' ');
    }).join('\t'));
  });
  return lines.join('\n');
}
function copyText(text, okMsg) {
  const done = okMsg || 'Copied table to clipboard (tab-separated)';
  const fallback = function () {
    try {
      const ta = h('textarea', { class: 'vh', 'aria-hidden': 'true' });
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      toast(ok ? done : 'Copy blocked by the browser');
    } catch (e) { toast('Copy blocked by the browser'); }
  };
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { toast(done); }, fallback);
      return;
    }
  } catch (e) { /* fall through */ }
  fallback();
}
/* Copy / JSON / CSV tool row for a data table. build() returns an export spec. */
function tableTools(id, build) {
  return h('div', { class: 'tbl-tools' },
    h('button', { class: 'btn sm', type: 'button', 'data-copy': id, onclick: function () { copyText(toTSV(build())); } }, 'Copy'),
    h('button', { class: 'btn sm', type: 'button', 'data-export': id + ':json', onclick: function () { doExport(build, 'json'); } }, 'JSON'),
    h('button', { class: 'btn sm', type: 'button', 'data-export': id + ':csv', onclick: function () { doExport(build, 'csv'); } }, 'CSV'));
}

let TOAST_T = null;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(TOAST_T);
  TOAST_T = setTimeout(function () { el.classList.remove('show'); }, 2600);
}

/* ---------- tables ---------- */
/* columns: [{ key, label, num, f, render(row) }]; rows: array of objects */
function tableEl(o) {
  const thead = h('thead', null, h('tr', null, o.columns.map(function (c) {
    return h('th', { scope: 'col', class: c.num ? 'num' : null }, c.label);
  })));
  const tbody = h('tbody', null, o.rows.map(function (r) {
    return h('tr', { class: r._cls || null }, o.columns.map(function (c, i) {
      const content = c.render ? c.render(r) : (r[c.key] === null || r[c.key] === undefined ? '' : String(r[c.key]));
      const tag = (i === 0 && o.rowHeader) ? 'th' : 'td';
      return h(tag, { class: c.num ? 'num' : (c.f ? 'f' : (c.nw ? 'nowrap' : null)), scope: tag === 'th' ? 'row' : null, 'data-label': c.label }, content);
    }));
  }));
  return h('div', { class: 'tbl-wrap', id: o.id || null },
    h('table', { class: 't' + (o.noStack ? '' : ' stack') }, o.caption ? h('caption', null, o.caption) : null, thead, tbody));
}
function whyText(n) {
  if (!n) return '';
  if (n.causes && n.causes.length) return 'Needs ' + n.causes.map(function (c) { return c.label + (c.why ? ' (' + c.why + ')' : ''); }).join('; ');
  return n.error || n.note || '';
}
function tile(o) {
  const n = o.node;
  const isNull = !n || n.value === null;
  const valText = !isNull ? (o.text !== undefined ? o.text : fmtNode(n)) : null;
  return h('div', { class: 'tile' + (o.hl ? ' hl' : '') + (isNull ? ' null' : '') },
    h('div', { class: 'lbl' }, h('span', null, o.label), n && !isNull ? badgesForNode(n) : null),
    h('div', { class: 'val', title: n ? traceText(n) : '' }, isNull ? nullSpan(n) : h('span', { class: 'n' }, valText), !isNull && o.unit ? h('span', { class: 'u' }, o.unit) : null),
    isNull && whyText(n) ? h('div', { class: 'why' }, whyText(n)) : null,
    o.sub ? h('div', { class: 'sub' }, o.sub) : null);
}

/* ---------- charts ---------- */
const CHART_FNS = new Map();
const CHART_W = new WeakMap();
let RO = null;
let PRUNE_T = null;
/* Drop charts whose elements left the DOM. Deferred so that charts built in the same
 * render pass (not yet attached) are never pruned by their siblings. */
function schedulePrune() {
  clearTimeout(PRUNE_T);
  PRUNE_T = setTimeout(function () {
    CHART_FNS.forEach(function (f, e) { if (!e.isConnected) { CHART_FNS.delete(e); if (RO) RO.unobserve(e); } });
  }, 0);
}
function mountChart(el, fn) {
  schedulePrune();
  CHART_FNS.set(el, fn);
  if (!RO && typeof ResizeObserver !== 'undefined') {
    RO = new ResizeObserver(function (entries) {
      entries.forEach(function (e) {
        const f = CHART_FNS.get(e.target);
        const w = Math.floor(e.contentRect.width);
        if (f && w > 10 && CHART_W.get(e.target) !== w) { f(e.target); }
      });
    });
  }
  if (RO) RO.observe(el);
  else setTimeout(function () { fn(el); }, 0);
  fn(el);
  return el;
}
function rerenderCharts() {
  CHART_FNS.forEach(function (fn, el) {
    if (!el.isConnected) { CHART_FNS.delete(el); if (RO) RO.unobserve(el); return; }
    fn(el);
  });
}
function chartFont() {
  const v = parseFloat(getComputedStyle(document.body).getPropertyValue('--fs-chart'));
  return isNum(v) && v > 6 ? v : 12;
}
let MEASURE_CTX = null;
function measureText(text, fs, weight) {
  if (!MEASURE_CTX) { const c = document.createElement('canvas'); MEASURE_CTX = c.getContext('2d'); }
  if (!MEASURE_CTX) return String(text).length * fs * 0.56;
  MEASURE_CTX.font = (weight || 400) + ' ' + fs + 'px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
  return MEASURE_CTX.measureText(String(text)).width;
}
function wrapLabel(text, maxW, fs) {
  const words = String(text).split(/\s+/);
  const lines = [''];
  words.forEach(function (w) {
    const cur = lines[lines.length - 1];
    const trial = cur ? cur + ' ' + w : w;
    if (measureText(trial, fs) <= maxW || !cur) lines[lines.length - 1] = trial;
    else lines.push(w);
  });
  if (lines.length > 2) {
    let second = lines.slice(1).join(' ');
    while (second.length > 1 && measureText(second + '...', fs) > maxW) second = second.slice(0, -1);
    return [lines[0], second + '...'];
  }
  return lines;
}
function niceTicks(min, max, count) {
  const span = (max - min) || 1;
  const step0 = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const t0 = Math.floor(min / step) * step;
  const t1 = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = t0; t <= t1 + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : Number(t.toPrecision(12)));
  return { ticks: ticks, min: t0, max: t1 };
}
function fmtAxisINR(v) {
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 1e7) return sg + '₹' + Number((a / 1e7).toPrecision(3)) + ' cr';
  if (a >= 1e5) return sg + '₹' + Number((a / 1e5).toPrecision(3)) + ' L';
  return sg + '₹' + NF.inr0.format(a);
}
let HATCH_SEQ = 0;
function hatchDefs(id) {
  return sv('defs', null,
    sv('pattern', { id: id, width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      sv('rect', { width: 6, height: 6, fill: 'transparent' }),
      sv('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: 'var(--b-un)', 'stroke-width': 2 })));
}

/* Horizontal bridge (waterfall) chart. Rows: { label, value|null, kind:'add'|'total', display, nullText }.
 * refs: [{ label, value }] drawn as reference lines. Axis values are relative to spec.zeroLabel. */
function renderBridge(el, spec) {
  const W = Math.floor(el.clientWidth);
  if (W < 20) return;
  CHART_W.set(el, W);
  const fs = chartFont();
  const rowH = Math.round(fs * 2.3), barH = Math.min(22, Math.round(fs * 1.3));
  const labelW = Math.round(Math.min(Math.max(W * 0.30, 104), 250));
  const padR = Math.round(Math.min(W * 0.2, fs * 8.5));
  const refs = (spec.refs || []).filter(function (r) { return isNum(r.value); });
  const padT = Math.round(fs * (refs.length ? 2.2 : 0.6));
  const padB = Math.round(fs * (spec.axisLabel ? 3.7 : 2.4));
  if (!spec.rows.some(function (r) { return isNum(r.value); })) {
    setKids(el, h('p', { class: 'note' }, spec.emptyText || 'Nothing to chart yet: every leg above is withheld until its input is available.'));
    return;
  }
  let cum = 0; const geo = [];
  spec.rows.forEach(function (r) {
    if (!isNum(r.value)) { geo.push({ r: r, nul: true }); return; }
    if (r.kind === 'total') { geo.push({ r: r, a: 0, b: r.value }); cum = r.value; }
    else { geo.push({ r: r, a: cum, b: cum + r.value }); cum += r.value; }
  });
  let lo = 0, hi = 0;
  geo.forEach(function (g) { if (!g.nul) { lo = Math.min(lo, g.a, g.b); hi = Math.max(hi, g.a, g.b); } });
  refs.forEach(function (r) { lo = Math.min(lo, r.value); hi = Math.max(hi, r.value); });
  if (hi === lo) hi = lo + 1;
  const nt = niceTicks(lo, hi, W < 520 ? 3 : 5);
  const x0 = labelW + 10, x1 = W - padR;
  const X = function (v) { return x0 + (v - nt.min) / (nt.max - nt.min) * (x1 - x0); };
  const H = padT + geo.length * rowH + padB;
  const svg = sv('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.ariaLabel || 'Bridge chart', focusable: 'false' });
  nt.ticks.forEach(function (t) {
    const x = X(t);
    svg.appendChild(sv('line', { class: t === 0 ? 'ax' : 'gl', x1: x, x2: x, y1: padT - 2, y2: H - padB + 3 }));
    svg.appendChild(sv('text', { x: x, y: H - padB + fs + 5, 'text-anchor': 'middle', 'font-size': fs * 0.9 }, (spec.fmtAxis || fmtAxisINR)(t)));
  });
  if (spec.axisLabel) svg.appendChild(sv('text', { x: x1, y: H - 3, 'text-anchor': 'end', 'font-size': fs * 0.85 }, spec.axisLabel));
  refs.forEach(function (r, k) {
    const x = X(r.value);
    svg.appendChild(sv('line', { class: 'ref', x1: x, x2: x, y1: padT - fs * 0.4, y2: H - padB }));
    const lw = measureText(r.label, fs * 0.9, 600);
    const anchor = x + lw / 2 > W ? 'end' : (x - lw / 2 < 0 ? 'start' : 'middle');
    svg.appendChild(sv('text', { class: 'reflab', x: anchor === 'end' ? W - 2 : x, y: fs * (1 + k * 1.1), 'text-anchor': anchor, 'font-size': fs * 0.9, 'font-weight': 600 }, r.label));
  });
  let prevEnd = null;
  geo.forEach(function (g, i) {
    const yTop = padT + i * rowH;
    const yMid = yTop + rowH / 2;
    const lines = wrapLabel(g.r.label, labelW, fs);
    const t = sv('text', { x: labelW, y: yMid - (lines.length - 1) * fs * 0.55, 'text-anchor': 'end', 'font-size': fs, 'dominant-baseline': 'middle' });
    lines.forEach(function (ln, k) { t.appendChild(sv('tspan', { x: labelW, dy: k === 0 ? 0 : fs * 1.1 }, ln)); });
    t.appendChild(sv('title', null, g.r.label));
    svg.appendChild(t);
    if (g.nul) {
      svg.appendChild(sv('text', { x: x0 + 4, y: yMid, 'font-size': fs * 0.9, 'dominant-baseline': 'middle' }, g.r.nullText || 'PLACEHOLDER'));
      return;
    }
    const xa = X(Math.min(g.a, g.b)), xb = X(Math.max(g.a, g.b));
    const cls = g.r.kind === 'total' ? 'tot' : (g.r.value < 0 ? 'sub' : 'add');
    const rect = sv('rect', { class: cls, x: xa, y: yMid - barH / 2, width: Math.max(1.5, xb - xa), height: barH, rx: 2 });
    rect.appendChild(sv('title', null, g.r.label + ': ' + (g.r.display || '')));
    svg.appendChild(rect);
    if (prevEnd !== null && g.r.kind !== 'total') {
      svg.appendChild(sv('line', { class: 'gl', x1: X(g.a), x2: X(g.a), y1: yTop - rowH / 2 + barH / 2, y2: yMid - barH / 2 }));
    }
    prevEnd = g.b;
    const txt = g.r.display || '';
    const tw = measureText(txt, fs * 0.95, 650);
    let tx = xb + 6, anchor = 'start';
    if (tx + tw > W - 2) { tx = xa - 6; anchor = 'end'; if (tx - tw < x0) { tx = W - 2; anchor = 'end'; } }
    svg.appendChild(sv('text', { class: 'v', x: tx, y: yMid, 'text-anchor': anchor, 'font-size': fs * 0.95, 'dominant-baseline': 'middle' }, txt));
  });
  setKids(el, svg);
}

/* Horizontal bars from zero. Rows: { key, label, value|null, display, cls, nullText, fresh }. */
function renderHBars(el, spec) {
  const W = Math.floor(el.clientWidth);
  if (W < 20) return;
  CHART_W.set(el, W);
  const fs = chartFont();
  if (!spec.rows.length) {
    setKids(el, h('p', { class: 'note' }, spec.emptyText || 'Nothing revealed at this step'));
    return;
  }
  const rowH = Math.round(fs * 2.3), barH = Math.min(22, Math.round(fs * 1.3));
  const labelW = Math.round(Math.min(Math.max(W * 0.30, 100), 230));
  const padR = Math.round(Math.min(W * 0.18, fs * 7));
  const padB = Math.round(fs * (spec.axisLabel ? 3.7 : 2.3)), padT = 4;
  let hi = spec.max || 0;
  spec.rows.forEach(function (r) { if (isNum(r.value)) hi = Math.max(hi, r.value); });
  if (hi <= 0) hi = 1;
  const nt = niceTicks(0, hi, W < 520 ? 3 : 4);
  const x0 = labelW + 10, x1 = W - padR;
  const X = function (v) { return x0 + (v - nt.min) / (nt.max - nt.min) * (x1 - x0); };
  const H = padT + Math.max(1, spec.rows.length) * rowH + padB;
  const svg = sv('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.ariaLabel || 'Bar chart', focusable: 'false' });
  const hid = 'hatch-un-' + (++HATCH_SEQ);
  svg.appendChild(hatchDefs(hid));
  nt.ticks.forEach(function (t) {
    const x = X(t);
    svg.appendChild(sv('line', { class: t === 0 ? 'ax' : 'gl', x1: x, x2: x, y1: padT, y2: H - padB + 3 }));
    svg.appendChild(sv('text', { x: x, y: H - padB + fs + 5, 'text-anchor': 'middle', 'font-size': fs * 0.9 }, (spec.fmtAxis || fmtAxisINR)(t)));
  });
  if (spec.axisLabel) svg.appendChild(sv('text', { x: x1, y: H - 3, 'text-anchor': 'end', 'font-size': fs * 0.85 }, spec.axisLabel));
  if (!spec.rows.length) {
    svg.appendChild(sv('text', { x: x0 + 4, y: padT + rowH / 2, 'font-size': fs * 0.9, 'dominant-baseline': 'middle' }, spec.emptyText || 'Nothing revealed at this step'));
  }
  spec.rows.forEach(function (r, i) {
    const yMid = padT + i * rowH + rowH / 2;
    const lines = wrapLabel(r.label, labelW, fs);
    const t = sv('text', { x: labelW, y: yMid - (lines.length - 1) * fs * 0.55, 'text-anchor': 'end', 'font-size': fs, 'dominant-baseline': 'middle' });
    lines.forEach(function (ln, k) { t.appendChild(sv('tspan', { x: labelW, dy: k === 0 ? 0 : fs * 1.1 }, ln)); });
    svg.appendChild(t);
    if (!isNum(r.value)) {
      const w = (x1 - x0) * 0.42;
      svg.appendChild(sv('rect', { x: x0, y: yMid - barH / 2, width: w, height: barH, rx: 2, stroke: 'var(--b-un)', 'stroke-width': 1, fill: 'url(#' + hid + ')' }));
      svg.appendChild(sv('text', { x: x0 + w + 6, y: yMid, 'font-size': fs * 0.9, 'dominant-baseline': 'middle', 'font-weight': 650 }, r.nullText || 'UNAVAILABLE - not estimated'));
      return;
    }
    const xb = X(r.value);
    const rect = sv('rect', { class: (r.cls || 's1') + (r.fresh ? ' grow' : ''), x: x0, y: yMid - barH / 2, width: Math.max(1.5, xb - x0), height: barH, rx: 2 });
    rect.appendChild(sv('title', null, r.label + ': ' + (r.display || '')));
    svg.appendChild(rect);
    const txt = r.display || '';
    const tw = measureText(txt, fs * 0.95, 650);
    let tx = xb + 6, anchor = 'start';
    if (tx + tw > W - 2) { tx = W - 2; anchor = 'end'; }
    svg.appendChild(sv('text', { class: 'v', x: tx, y: yMid, 'text-anchor': anchor, 'font-size': fs * 0.95, 'dominant-baseline': 'middle' }, txt));
  });
  setKids(el, svg);
}

/* HTML rate bars; widths animate from the previous step's width (memoised per key). */
const RATE_MEMO = {};
function rateBars(memoKey, rows, maxRate) {
  const max = maxRate || 0.16;
  const prev = RATE_MEMO[memoKey] || {};
  const next = {};
  const wrap = h('div', { class: 'rbwrap', role: 'list' });
  rows.forEach(function (r) {
    const w = isNum(r.value) ? Math.max(0, Math.min(100, r.value / max * 100)) : 0;
    const from = prev[r.key] !== undefined ? prev[r.key] : 0;
    next[r.key] = w;
    const fill = isNum(r.value) ? h('div', { class: 'fill ' + r.slot, style: '--w:' + w.toFixed(2) + '%;--from:' + from.toFixed(2) + '%' }) : null;
    wrap.appendChild(h('div', { class: 'rb', role: 'listitem' },
      h('div', { class: 'lab' }, h('i', { class: 'sw-' + r.slot, style: 'width:10px;height:10px;border-radius:2px;display:inline-block' }), r.label),
      h('div', { class: 'track', 'aria-hidden': 'true' }, fill),
      h('div', { class: 'val' }, isNum(r.value) ? r.display : h('span', { class: 'nullv' }, 'PLACEHOLDER'))));
  });
  RATE_MEMO[memoKey] = next;
  const ticks = [];
  for (let t = 0; t <= max + 1e-9; t += max / 4) ticks.push(h('span', null, (t * 100).toFixed(0) + '%'));
  wrap.appendChild(h('div', { class: 'rb-axis', 'aria-hidden': 'true' }, h('span'), h('div', { class: 'ticks' }, ticks), h('span')));
  return wrap;
}
function legend(items) {
  return h('p', { class: 'legend' }, items.map(function (it) { return h('span', null, h('i', { class: 'sw-' + it.sw }), it.label); }));
}
