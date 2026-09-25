/* =============================================================================
 * SECTION 13. SHARED PANEL COMPONENTS: headers, share links, source strips,
 * evidence drawers, warnings, line charts
 * ===========================================================================*/

function panelUrl(id) {
  const base = location.href.split('#')[0];
  return base + '#' + (isDemo() ? 'demo/' : '') + id;
}
function shareButton(id, title) {
  return h('button', { class: 'btn sm share', type: 'button', 'aria-label': 'Copy a link to this panel',
    onclick: function () {
      const url = panelUrl(id);
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent || '')) {
        navigator.share({ title: BUILD.app + ': ' + title, url: url }).catch(function () { copyText(url, 'Link copied'); });
      } else copyText(url, 'Link copied: ' + url);
    } }, 'Share link');
}
function panelHead(p, lede) {
  return h('header', { class: 'view-h' },
    h('div', { class: 'view-h-row' }, h('h2', { id: 'h-' + p.id }, p.title), shareButton(p.id, p.title)),
    lede ? h('p', { class: 'lede' }, lede) : null,
    isDemo() ? h('p', { class: 'banner syn', role: 'note' }, LABEL.DEMO + '. Every price on this page is invented. Real duty rules and contract dates are used so the arithmetic can be followed.') : null);
}
/* Time text for a leaf: market observation, or in-force date for registry entries. */
function nodeTimeText(n) {
  const r = n && n.recs && n.recs[0];
  if (!r) return n && n.flags.syn ? 'no market time (synthetic)' : '';
  if (r.observedAt && MARKET_KINDS.indexOf(r.kind) >= 0) return 'observed ' + fmtDateTime(r.observedAt, BUILD.displayTz, r.observedTz && r.observedTz !== BUILD.displayTz ? r.observedTz : null);
  if (r.kind === 'fx.eurusd' || r.kind === 'fx.eurinr') return 'observed ' + fmtDateTime(r.observedAt, BUILD.displayTz, 'Europe/Berlin');
  if (r.effectiveFrom) return 'in force from ' + fmtDate(r.effectiveFrom) + (r.validTo ? ' to ' + fmtDate(addDays(r.validTo, -1)) : '');
  if (r.enteredOn) return 'entered ' + fmtDate(r.enteredOn);
  return '';
}
function cadenceText(sourceId) { const s = REG.sources[sourceId]; return s ? s.cadence : ''; }
/* "Inputs on this panel": one row per input with value, states, time, cadence and source. */
function srcStrip(nodes, title) {
  const rows = [];
  const seen = {};
  nodes.forEach(function (n) {
    if (!n || seen[n.id]) return;
    seen[n.id] = 1;
    rows.push(n);
  });
  return h('div', { class: 'srcstrip' },
    h('h4', { class: 'subh' }, title || 'Inputs on this panel: value, state, time and source'),
    h('ul', { class: 'srclist' }, rows.map(function (n) {
      const src = n.sourceIds[0];
      const recs = n.recs || [];
      const r0 = recs[0];
      const t = nodeTimeText(n) || (n.kind === 'derived' && n.obs.length ? 'observed ' + fmtDateTime(n.obs[0].at) : '');
      return h('li', { class: 'src-item' + (n.value === null ? ' missing' : '') },
        h('div', { class: 'src-top' }, h('span', { class: 'src-label' }, n.label), h('span', { class: 'src-val' }, n.value === null ? '' : valSpan(n))),
        h('div', { class: 'src-badges' }, badgesForNode(n)),
        t ? h('div', { class: 'src-time' }, t) : null,
        n.value === null && n.note ? h('div', { class: 'src-note' }, n.note) : null,
        details('Source, schedule and documents', [h('div', { class: 'src-meta' },
          src && REG.sources[src] ? h('span', null, 'Source: ' + REG.sources[src].name + '. Cadence: ' + REG.sources[src].cadence) : (src ? h('span', null, 'Source: ' + sourceName(src)) : null),
          r0 && r0.url ? h('a', { href: r0.url, target: '_blank', rel: 'noopener noreferrer' }, 'document') : null,
          (n.citations || []).length ? h('span', null, n.citations.map(function (c) { return citeLink(c, true); })) : null),
          n.value !== null && n.note ? h('div', { class: 'src-note' }, n.note) : null]));
    })));
}
/* Evidence drawer for one node: formula, inputs, records, citations. */
function evidenceBody(n, opts) {
  opts = opts || {};
  const f = n.formulaId ? FORMULA_BY_ID[n.formulaId] : null;
  const parts = [];
  if (f) parts.push(h('p', null, h('strong', null, n.formulaId + ' (' + BUILD.formulaVersion + '): '), f.formula, f.note ? h('span', { class: 'muted' }, ' ' + f.note) : null));
  if (n.kind === 'derived' && n.inputs.length) {
    parts.push(h('ul', { class: 'ev-inputs' }, n.inputLabels.map(function (l, i) {
      const v = n.inputValues[i];
      return h('li', null, l + ' = ', v === null ? h('span', { class: 'nullv' }, 'withheld') : fmtNode({ value: v, unit: n.inputUnits[i], display: null }), ' ', badge(n.inputStatuses[i]));
    })));
  }
  if (n.note) parts.push(h('p', { class: 'muted' }, n.note));
  if ((n.warnings || []).length) parts.push(warnList(n.warnings));
  if ((n.recs || []).length) {
    parts.push(h('div', { class: 'tbl-wrap' }, h('table', { class: 't ev' },
      h('thead', null, h('tr', null, ['Record', 'Value', 'Observed / in force', 'Published', 'Retrieved', 'State', 'Document'].map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', null, n.recs.map(function (r) {
        return h('tr', null, h('td', { class: 'mono' }, r.id), h('td', { class: 'num' }, isNum(r.value) ? String(r.value) : ''),
          h('td', null, r.observedAt ? fmtDateTime(r.observedAt) : (r.effectiveFrom ? fmtDate(r.effectiveFrom) : '')),
          h('td', null, r.publishedAt ? fmtDateTime(r.publishedAt) + (r.publishedApprox ? ' (approx.)' : '') : ''),
          h('td', null, r.retrievedAt ? fmtDateTime(r.retrievedAt) : ''),
          h('td', null, badge(r.verification || '')),
          h('td', null, r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, 'link') : (r.document || ''), r.rawSha256 ? h('div', { class: 'mono xs' }, 'sha256 ' + r.rawSha256.slice(0, 16) + '...') : null));
      })))));
  }
  const cl = citeList(n.citations, !!opts.shortCites);
  if (cl) parts.push(cl);
  return parts;
}
function warnList(ws) {
  if (!ws || !ws.length) return null;
  return h('ul', { class: 'warns', role: 'note' }, ws.map(function (w) { return h('li', null, w); }));
}
/* Leg table: label | value | states | time; each row expands to its evidence. */
function legTable(nodes, opts) {
  opts = opts || {};
  return h('div', { class: 'legs' }, nodes.map(function (n) {
    if (!n) return null;
    const isNull = n.value === null;
    const row = h('div', { class: 'leg' + (n.kind === 'derived' && opts.totals && opts.totals.indexOf(n.id) >= 0 ? ' total' : '') + (isNull ? ' null' : '') },
      h('div', { class: 'leg-l' }, n.label), h('div', { class: 'leg-v' }, isNull ? '' : valSpan(n)), h('div', { class: 'leg-b' }, badgesForNode(n)),
      isNull && whyText(n) ? h('div', { class: 'leg-why' }, whyText(n)) : null);
    return details(row, evidenceBody(n, opts));
  }));
}
/* Simple line / step chart. spec: { series:[{label, cls, points:[[dateISO, value]], step}], fmtY, ariaLabel, xFrom, xTo } */
function renderLine(el, spec) {
  const W = Math.floor(el.clientWidth);
  if (W < 20) return;
  CHART_W.set(el, W);
  const fs = chartFont();
  const pts = [];
  spec.series.forEach(function (s) { s.points.forEach(function (p) { if (isNum(p[1])) pts.push(p); }); });
  if (!pts.length) { setKids(el, h('p', { class: 'note' }, spec.emptyText || 'No data')); return; }
  const t = function (d) { return parseISODate(d); };
  const xs = pts.map(function (p) { return t(p[0]); }).concat(spec.xTo ? [t(spec.xTo)] : []);
  let x0v = Math.min.apply(null, xs), x1v = Math.max.apply(null, xs);
  if (x1v === x0v) x1v = x0v + 86400000;
  const ys = pts.map(function (p) { return p[1]; });
  let lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
  const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.01 || 1; lo -= pad; hi += pad;
  const nt = niceTicks(lo, hi, 4);
  const padL = Math.round(measureText((spec.fmtY || fmtNum)(nt.max), fs * 0.9) + 10), padR = 12, padT = 8, padB = Math.round(fs * 2.6);
  const H = Math.round(Math.max(150, Math.min(240, W * 0.45)));
  const X = function (v) { return padL + (v - x0v) / (x1v - x0v) * (W - padL - padR); };
  const Y = function (v) { return padT + (1 - (v - nt.min) / (nt.max - nt.min)) * (H - padT - padB); };
  const svg = sv('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': spec.ariaLabel || 'Line chart', focusable: 'false' });
  nt.ticks.forEach(function (tk) {
    svg.appendChild(sv('line', { class: 'gl', x1: padL, x2: W - padR, y1: Y(tk), y2: Y(tk) }));
    svg.appendChild(sv('text', { x: padL - 5, y: Y(tk), 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-size': fs * 0.85 }, (spec.fmtY || fmtNum)(tk)));
  });
  const labs = [pts[0][0], pts[pts.length - 1][0]].concat(spec.xTo ? [spec.xTo] : []);
  const sorted = xs.slice().sort(function (a, b) { return a - b; });
  [sorted[0], sorted[sorted.length - 1]].forEach(function (v, k) {
    const d = new Date(v).toISOString().slice(0, 10);
    svg.appendChild(sv('text', { x: X(v), y: H - fs * 0.9, 'text-anchor': k === 0 ? 'start' : 'end', 'font-size': fs * 0.85 }, fmtDate(d)));
  });
  void labs;
  spec.series.forEach(function (s) {
    const p = s.points.filter(function (q) { return isNum(q[1]); }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    if (!p.length) return;
    let dpath = '';
    p.forEach(function (q, i) {
      const x = X(t(q[0])), y = Y(q[1]);
      if (i === 0) dpath += 'M' + x.toFixed(1) + ' ' + y.toFixed(1);
      else if (s.step) dpath += 'H' + x.toFixed(1) + 'V' + y.toFixed(1);
      else dpath += 'L' + x.toFixed(1) + ' ' + y.toFixed(1);
    });
    if (s.step && spec.xTo) dpath += 'H' + X(t(spec.xTo)).toFixed(1);
    svg.appendChild(sv('path', { d: dpath, class: 'ln ' + (s.cls || 's1'), fill: 'none' }));
    p.forEach(function (q) {
      const c = sv('circle', { cx: X(t(q[0])), cy: Y(q[1]), r: s.step ? 3 : 2, class: 'pt ' + (s.cls || 's1') });
      c.appendChild(sv('title', null, s.label + ', ' + fmtDate(q[0]) + ': ' + (spec.fmtY || fmtNum)(q[1])));
      svg.appendChild(c);
    });
  });
  setKids(el, svg);
}
function tableOf(cols, rows, opts) {
  return tableEl({ id: opts && opts.id, caption: opts && opts.caption, columns: cols, rows: rows, rowHeader: !(opts && opts.noRowHeader) });
}
