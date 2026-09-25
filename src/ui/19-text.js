/* =============================================================================
 * SECTION 19. HOW-TO-READ AND LIMITATIONS PANELS
 * ===========================================================================*/

function buildHow(root) {
  const p = PANELS.filter(function (x) { return x.id === 'how'; })[0];
  const ref = refFor(null);
  const rows = statusBoardRows(ref);
  const go = function (id, label) { return h('a', { href: '#' + (isDemo() ? 'demo/' : '') + id }, label); };
  setKids(root, 
    panelHead(p, null),
    h('div', { class: 'outputs' },
      card({ id: 'card-how-what', title: 'What this site does', body: [
        h('p', null, 'It works out what it costs to bring gold or silver into India legally, step by step, from the global price to a rupee landed cost, and compares that with prices quoted in India. It also replays two episodes in which the duty gap between the normal route and the India-UAE trade agreement (CEPA) opened and closed.'),
        h('p', null, 'It is an explanation, not a price feed. The data are refreshed once a day from sources the site is allowed to republish. Nothing here is live, and nothing is a trading signal, forecast or advice.')] }),
      card({ id: 'card-how-status', title: 'Inputs today (' + fmtDate(ref.valDate) + ')', labels: [LABEL.NOT_LIVE], body: [
        tableOf([{ key: 'item', label: 'Input' }, { key: 'value', label: 'Value' },
          { key: 'state', label: 'State', render: function (r) { return h('span', null, String(r.state).split(' | ').map(function (s0) { return badge(s0); })); } },
          { key: 'time', label: 'Time or period', render: function (r) { return h('span', null, r.time, r.note ? h('div', { class: 'xs muted' }, r.note) : null); } }], rows, { id: 'tbl-status' }),
        h('p', { class: 'muted' }, 'Snapshot built ' + (SNAP && SNAP.generatedAt ? fmtDateTime(SNAP.generatedAt) : 'at an unknown time') + '. States are re-checked in your browser every time you open the page, so an old page shows STALE by itself.')] }),
      card({ id: 'card-how-panels', title: 'The panels', body: [h('ul', { class: 'plain' },
        h('li', null, go('parity', 'Parity'), ': the chain from global price to landed cost, with a source and a time on every step. Customs duty is charged on the CBIC tariff value converted at the customs exchange rate, not on the market price.'),
        h('li', null, go('basis', 'Basis'), ': how far an MCX futures price or a physical quote sits from the modeled landed cost, and what moved it between two dates.'),
        h('li', null, go('spreads', 'Spreads'), ': the price difference between two MCX contract months on their real expiry dates, and what it implies per year.'),
        h('li', null, go('corridor', 'Corridors'), ': duty on each route by date, whether the route could actually be used, and a replay that shows only what had been published on each date.'),
        h('li', null, go('evidence', 'Evidence'), ': the build log, every source with its terms and schedule, every record, the citations, the formulas and the audit tests you can run yourself.'),
        h('li', null, go('limits', 'Limitations'), ': what the numbers leave out.'))] }),
      card({ id: 'card-how-labels', title: 'How to read the labels', body: [
        tableOf([{ key: 'k', label: 'Label', render: function (r) { return badge(r.k.split(' / ')[0]); } }, { key: 'v', label: 'Meaning' }], STATE_LEGEND.map(function (x) { return { k: x[0], v: x[1] }; }), { id: 'tbl-legend' })] }),
      card({ id: 'card-how-use', title: 'Using your own numbers', body: [
        h('p', null, 'Exchange prices are not republished here: MCX display rights are not confirmed and COMEX data need a CME licence. You can type prices you are entitled to use, or load an MCX bhavcopy you downloaded. Your entries are labelled USER-ENTERED, kept only in this browser, and the page is technically unable to send them anywhere.'),
        h('p', null, 'Each panel has a Share link button that copies a direct link to it. ', isDemo() ? go('how', 'Leave the demo') : h('a', { href: '#demo/parity' }, 'Open the synthetic demo'), isDemo() ? '' : ' to see every panel filled with invented numbers, clearly marked SYNTHETIC.')] })));
  return { update: function () { } };
}
function buildLimits(root) {
  const p = PANELS.filter(function (x) { return x.id === 'limits'; })[0];
  setKids(root, panelHead(p, 'Read these before relying on any number on this site.'),
    h('div', { class: 'outputs' }, card({ id: 'card-limits', title: 'Known limitations', body: [
      h('ol', { class: 'plain' }, LIMITATIONS.map(function (l) { return h('li', null, l); })),
      h('p', { class: 'note prob' }, LABEL.PROBABLE_GST),
      h('p', { class: 'muted' }, 'Explanatory research. Not trade, tax, customs, investment or legal advice.')] })));
  return { update: function () { } };
}
