'use strict';
/* Static HTML for every panel, rendered at build time from the same engine and view
 * models as the page. This is what a visitor sees if JavaScript is off, blocked or
 * fails: a complete, dated, readable snapshot rather than a blank screen. */

function esc(s) {
  return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const BADGE_CLS = { 'VERIFIED': 'b-ver', 'PRIMARY COPY': 'b-copy', 'SECONDARY': 'b-sec', 'CITATION PENDING': 'b-pend', 'OWNER-ENTERED': 'b-owner', 'USER-ENTERED': 'b-user',
  'ASSUMPTION': 'b-asm', 'SYNTHETIC': 'b-syn', 'PROBABLE': 'b-prob', 'PLACEHOLDER': 'b-ph', 'UNAVAILABLE': 'b-un', 'SNAPSHOT': 'b-snap', 'STALE': 'b-stale', 'DERIVED': 'b-der',
  'DERIVED FROM VERIFIED INPUTS': 'b-dver', 'PRIMARY-COPY INPUT': 'b-copy', 'SECONDARY INPUT': 'b-sec', 'OWNER-ENTERED INPUT': 'b-owner', 'ASSUMPTION INPUT': 'b-asm', 'INVALID INPUT': 'b-inv' };
function badge(t) { return '<span class="badge ' + (BADGE_CLS[t] || 'b-plain') + '">' + esc(t) + '</span>'; }
function badges(list) { return String(list || '').split(' | ').filter(Boolean).map(badge).join(' '); }
function table(cols, rows, caption) {
  return '<div class="tbl-wrap"><table class="t stack">' + (caption ? '<caption>' + esc(caption) + '</caption>' : '') + '<thead><tr>' +
    cols.map(function (c) { return '<th scope="col"' + (c.num ? ' class="num"' : '') + '>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    rows.map(function (r) { return '<tr>' + cols.map(function (c, i) { const v = c.html ? c.html(r) : esc(r[c.key]); return i === 0 ? '<th scope="row">' + v + '</th>' : '<td data-label="' + esc(c.label) + '"' + (c.num ? ' class="num"' : '') + '>' + v + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div>';
}
function card(id, title, body, labels) {
  return '<section class="card span-12" id="' + esc(id) + '" aria-labelledby="' + esc(id) + '-t"><div class="card-h"><h3 id="' + esc(id) + '-t">' + esc(title) + '</h3><div class="card-badges">' +
    (labels || []).map(badge).join(' ') + '</div></div><div class="card-b">' + body + '</div></section>';
}
function head(p, lede) {
  return '<header class="view-h"><div class="view-h-row"><h2 id="h-' + p.id + '">' + esc(p.title) + '</h2></div>' + (lede ? '<p class="lede">' + esc(lede) + '</p>' : '') + '</header>';
}
function link(url, text) { return url && /^https?:\/\//.test(url) ? '<a href="' + esc(url) + '" rel="noopener noreferrer" target="_blank">' + esc(text) + '</a>' : esc(text); }

function render(E, snap) {
  E.loadRegistries(snap);
  const nowMs = Date.parse(snap.generatedAt);
  const ref = E.refFor(E.todayIST(nowMs), nowMs);
  const d = ref.valDate;
  const P = {};
  E.PANELS.forEach(function (p) { P[p.id] = p; });
  const out = {};
  const built = 'Snapshot built ' + E.fmtDateTime(snap.generatedAt) + ' (static view). States below were evaluated at build time; the interactive page re-checks them when it opens.';

  /* how */
  const sb = E.statusBoardRows(ref);
  out.how = head(P.how, null) + '<div class="outputs">' +
    card('s-how-what', 'What this site does', '<p>It works out what it costs to bring gold or silver into India legally, step by step, from the global price to a rupee landed cost, and compares that with prices quoted in India. It also replays two episodes in which the duty gap between the normal route and the India-UAE CEPA route opened and closed.</p><p>It is an explanation, not a price feed. Data are refreshed once a day from sources the site may republish. Nothing here is live, and nothing is a trading signal, forecast or advice.</p>') +
    card('s-how-status', 'Inputs on ' + E.fmtDate(d), table([{ key: 'item', label: 'Input' }, { key: 'value', label: 'Value' }, { key: 'state', label: 'State', html: function (r) { return badges(r.state); } }, { key: 'time', label: 'Time or period', html: function (r) { return esc(r.time) + (r.note ? '<div class="xs muted">' + esc(r.note) + '</div>' : ''); } }], sb) + '<p class="muted">' + esc(built) + '</p>', ['SNAPSHOT']) +
    card('s-how-labels', 'How to read the labels', table([{ key: 'k', label: 'Label', html: function (r) { return badge(r.k.split(' / ')[0]); } }, { key: 'v', label: 'Meaning' }], E.STATE_LEGEND.map(function (x) { return { k: x[0], v: x[1] }; }))) +
    '</div>';

  /* parity */
  let par = '';
  E.METALS.forEach(function (m) {
    const pr = E.publicParity(m, 'NORMAL', d, ref);
    const rows = [pr.input.comex, pr.input.usdinr, pr.input.tvUsd, pr.input.customsFx, pr.rates.total, pr.dutyUsd, pr.av, pr.duty, pr.bench, pr.exCosts].map(function (n) {
      return { l: n.label, v: n.value === null ? E.statusLabel(n) : E.fmtNode(n), s: E.statusLabels(n).join(' | '), note: n.note || '' };
    });
    par += card('s-par-' + m, (m === 'gold' ? 'Gold, ' : 'Silver, ') + E.COMPARISON_UNIT[m].per + ', normal route, ' + E.fmtDate(d),
      table([{ key: 'l', label: 'Leg' }, { key: 'v', label: 'Value', num: true }, { key: 's', label: 'State', html: function (r) { return badges(r.s); } }, { key: 'note', label: 'Why or source', html: function (r) { return '<span class="xs">' + esc(r.note) + '</span>'; } }], rows),
      E.cardLabels(E.aggregate([pr.exCosts, pr.dutyUsd])));
  });
  out.parity = head(P.parity, 'How a global price becomes a rupee landed cost. Duty is charged on the CBIC tariff value converted at the customs exchange rate, not on the market price.') +
    '<div class="outputs">' + par + '<p class="muted">' + esc(built) + ' The interactive page lets you add a benchmark, a customs rate for the current fortnight and cost assumptions in your own browser.</p></div>';

  /* basis */
  const cal = E.calendarRows(d);
  out.basis = head(P.basis, 'Basis compares a domestic quote with the modeled landed cost. MCX futures and physical quotes are computed separately.') + '<div class="outputs">' +
    card('s-basis-why', 'Why no basis is shown here', '<p>A basis needs an exchange price. MCX display rights are not confirmed and COMEX data require a CME licence, so this public page does not republish either. With JavaScript on, you can enter prices you are entitled to use (or load an MCX bhavcopy you downloaded); they stay in your browser.</p>', ['UNAVAILABLE']) +
    card('s-basis-cal', 'MCX bullion contract calendar', table([{ key: 'product', label: 'Product' }, { key: 'month', label: 'Month' }, { key: 'expiry', label: 'Expiry' }, { key: 'tender', label: 'Tender period from' }, { key: 'quote', label: 'Quoted in' }, { key: 'lot', label: 'Lot' }, { key: 'evidence', label: 'Evidence', html: function (r) { return badge(r.evidence.split(' (')[0]); } }], cal.filter(function (r) { return r.product === 'GOLD' || r.product === 'SILVER'; }))) + '</div>';

  /* spreads */
  out.spreads = head(P.spreads, 'The price difference between two MCX contract months on their actual expiry dates. Annualized figures describe the spread; they are not forecasts. Margin appears only as a hypothetical sensitivity.') + '<div class="outputs">' +
    card('s-sp-cal', 'Expiries used for day counts', table([{ key: 'product', label: 'Product' }, { key: 'month', label: 'Month' }, { key: 'expiry', label: 'Expiry' }, { key: 'tender', label: 'Tender period from' }, { key: 'quote', label: 'Quoted in' }, { key: 'lot', label: 'Lot' }, { key: 'evidence', label: 'Evidence', html: function (r) { return badge(r.evidence.split(' (')[0]); } }], cal)) +
    card('s-sp-why', 'Spread values', '<p>Spread values need MCX prices, which are not published here. With JavaScript on, enter the two legs or load a bhavcopy in your browser.</p>', ['UNAVAILABLE']) + '</div>';

  /* corridor */
  const routes = E.routeRows(d);
  let eps = '';
  E.EPISODES.forEach(function (ep) {
    const steps = ep.steps.map(function (s) { return '<li><strong>' + esc(E.fmtDate(s.date)) + '</strong>: ' + esc(s.title) + (s.note ? '<div class="xs muted">' + esc(s.note) + '</div>' : '') + '</li>'; }).join('');
    const facts = ep.facts.slice().sort(function (a, b) { return a.knowableFrom < b.knowableFrom ? -1 : 1; }).map(function (f) {
      const c = snap.registries.citations[f.citation];
      return '<li><div class="fl">' + esc(f.label) + (f.period ? ' <span class="muted">| ' + esc(f.period) + '</span>' : '') + '</div><div class="fv">' + esc(f.text || f.display || 'UNAVAILABLE: ' + (f.note || '')) + '</div><div class="fm">' + badge(f.status) +
        ' published ' + esc(E.fmtDate(f.knowableFrom)) + (c ? ' | ' + link(c.url, (c.publisher || f.citation) + (c.date ? ', ' + c.date : '')) : '') + '</div></li>';
    }).join('');
    eps += card('s-ep-' + ep.id, ep.title, '<p class="muted">' + esc(ep.tagline) + '</p><h4 class="subh">Steps</h4><ol class="plain">' + steps + '</ol><h4 class="subh">Figures in order of publication</h4><ul class="facts">' + facts + '</ul>' +
      ((ep.gaps || []).length ? '<h4 class="subh">Not shown as fact</h4><ul class="plain">' + ep.gaps.map(function (g) { return '<li>' + badge(g.status) + ' ' + esc(g.label) + '<div class="xs muted">' + esc(g.note) + '</div></li>'; }).join('') + '</ul>' : ''));
  });
  out.corridor = head(P.corridor, 'The dated duty wedge between routes (eligibility) and whether the route could be used (executability), plus two replayed episodes.') + '<div class="outputs">' +
    card('s-cor-routes', 'Routes on ' + E.fmtDate(d), table([{ key: 'route', label: 'Route' }, { key: 'rate', label: 'Paper rate' }, { key: 'wedge', label: 'Wedge vs normal' }, { key: 'dutyUsd', label: 'Duty in USD' }, { key: 'exec', label: 'Executability' }], routes)) + eps + '</div>';

  /* evidence */
  const srcs = snap.registries.sources.map(function (s) { return { name: s.name, status: s.status, display: (s.publicDisplay.allowed ? 'Allowed: ' : 'BLOCKED: ') + s.publicDisplay.reason, cadence: s.cadence, url: s.url }; });
  const checks = (snap.checks || []).map(function (c) { return '<li class="lvl-' + esc(c.level) + '">' + badge(c.level.toUpperCase()) + ' <strong>' + esc(c.source) + ':</strong> ' + esc(c.message) + '</li>'; }).join('');
  const cites = Object.keys(snap.registries.citations).map(function (k) { const c = snap.registries.citations[k]; return '<li><span class="mono xs">' + esc(k) + '</span> ' + link(c.url, c.title) + ' ' + badge(c.verification) + '</li>'; }).join('');
  out.evidence = head(P.evidence, 'Build log, source registry, citations and downloads.') + '<div class="outputs">' +
    card('s-ev-snap', 'This snapshot', '<p>Snapshot <span class="mono">' + esc(snap.id) + '</span>, built ' + esc(E.fmtDateTime(snap.generatedAt)) + '. Download <a href="data/snapshot.json">snapshot.json</a> or <a href="data/run-log.json">run-log.json</a>.</p><h4 class="subh">Build log</h4><ul class="checks">' + checks + '</ul>', ['SNAPSHOT']) +
    card('s-ev-src', 'Source registry', table([{ key: 'name', label: 'Source' }, { key: 'status', label: 'Status' }, { key: 'display', label: 'Public display' }, { key: 'cadence', label: 'Cadence' }, { key: 'url', label: 'Where', html: function (r) { return link(r.url, /^https?:/.test(r.url || '') ? 'link' : (r.url || '')); } }], srcs)) +
    card('s-ev-cites', 'Citations', '<ul class="cites">' + cites + '</ul>') + '</div>';

  /* limits */
  out.limits = head(P.limits, 'Read these before relying on any number on this site.') + '<div class="outputs">' +
    card('s-limits', 'Known limitations', '<ol class="plain">' + E.LIMITATIONS.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ol><p class="note prob">' + esc(E.LABEL.PROBABLE_GST) + '</p>') + '</div>';
  return out;
}
module.exports = { render: render, esc: esc };
