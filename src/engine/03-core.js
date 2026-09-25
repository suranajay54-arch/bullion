/* =============================================================================
 * SECTION 3. CORE: lineage nodes, status and freshness propagation, validation,
 * formatting, exports
 * -----------------------------------------------------------------------------
 * Every number on screen is a node { value, status, flags, fresh, lineage }.
 * Status and freshness are propagated centrally by mkDerived(); renderers never
 * decorate by hand.
 *   - any SYNTHETIC ancestor    -> DERIVED FROM SYNTHETIC INPUTS
 *   - only VERIFIED ancestors   -> DERIVED FROM VERIFIED INPUTS (never VERIFIED itself)
 *   - otherwise                 -> DERIVED plus a badge for each weaker input class
 *   - freshness                 -> the worst freshness among the inputs (STALE beats SNAPSHOT)
 *   - a missing / invalid input -> value withheld (null) with the reason carried along
 * ===========================================================================*/

const FORMULA_BY_ID = (function () {
  const out = {};
  FORMULAS.forEach(function (f) { out[f.id] = f; });
  return Object.freeze(out);
})();
const CORRIDOR_BY_ID = (function () {
  const out = {};
  CORRIDORS.forEach(function (c) { out[c.id] = c; });
  return Object.freeze(out);
})();

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }
function sum(arr) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return s; }

/* ---------- nodes ---------- */
const FLAG_KEYS = Object.freeze(['syn', 'prob', 'ph', 'un', 'inv', 'ver', 'copy', 'sec', 'pend', 'owner', 'user', 'asm', 'stale']);
function blankFlags() { const f = {}; FLAG_KEYS.forEach(function (k) { f[k] = false; }); return f; }
function worstFresh(list) {
  let w = FRESH.NA;
  list.forEach(function (f) { if (f && FRESH_RANK[f] > FRESH_RANK[w]) w = f; });
  return w;
}

/* extra: { sourceId(s), citations, note, error, approx, display, raw, prob, fresh, obsAt, rec } */
function mkLeaf(id, label, value, unit, status, extra) {
  extra = extra || {};
  const v = (value === null || value === undefined) ? null : value;
  const flags = blankFlags();
  flags.syn = status === ST.SYNTHETIC;
  flags.prob = status === ST.PROBABLE || !!extra.prob;
  flags.ph = status === ST.PLACEHOLDER;
  flags.un = status === ST.UNAVAILABLE;
  flags.inv = status === ST.INVALID;
  flags.ver = status === ST.VERIFIED;
  flags.copy = status === ST.COPY;
  flags.sec = status === ST.SECONDARY;
  flags.pend = status === ST.PENDING;
  flags.owner = status === ST.OWNER;
  flags.user = status === ST.USER;
  flags.asm = status === ST.ASSUMPTION;
  let fresh = extra.fresh || (status === ST.UNAVAILABLE ? FRESH.UNAVAILABLE : FRESH.NA);
  if (v === null && (status === ST.UNAVAILABLE)) fresh = FRESH.UNAVAILABLE;
  flags.stale = fresh === FRESH.STALE;
  const obs = extra.obsAt ? [{ id: extra.rec ? extra.rec.id : id, label: label, at: extra.obsAt }] : [];
  return Object.freeze({
    id: id, label: label, unit: unit, value: v, status: status, flags: Object.freeze(flags), kind: 'leaf',
    fresh: fresh, obs: Object.freeze(obs), recs: Object.freeze(extra.rec ? [extra.rec] : []),
    formulaId: null, inputs: Object.freeze([]), inputLabels: Object.freeze([]),
    sourceIds: Object.freeze(extra.sourceIds || (extra.sourceId ? [extra.sourceId] : [])),
    citations: Object.freeze(extra.citations || []),
    note: extra.note || '', error: extra.error || '', approx: !!extra.approx, display: extra.display || null, raw: extra.raw,
    warnings: Object.freeze(extra.warnings || [])
  });
}

function mergeLineage(inputs) {
  const flags = blankFlags();
  const srcs = [], cites = [], obs = [], recs = [], warns = [];
  const seenObs = {}, seenRec = {};
  inputs.forEach(function (n) {
    FLAG_KEYS.forEach(function (k) { flags[k] = flags[k] || n.flags[k]; });
    n.sourceIds.forEach(function (s) { if (srcs.indexOf(s) < 0) srcs.push(s); });
    (n.citations || []).forEach(function (c) { if (cites.indexOf(c) < 0) cites.push(c); });
    (n.obs || []).forEach(function (o) { if (!seenObs[o.id]) { seenObs[o.id] = 1; obs.push(o); } });
    (n.recs || []).forEach(function (r) { if (!seenRec[r.id]) { seenRec[r.id] = 1; recs.push(r); } });
    (n.warnings || []).forEach(function (w) { if (warns.indexOf(w) < 0) warns.push(w); });
  });
  return { flags: flags, srcs: srcs, cites: cites, obs: obs, recs: recs, warns: warns,
    fresh: worstFresh(inputs.map(function (n) { return n.fresh; })) };
}

function mkDerived(id, label, unit, formulaId, inputs, fn, extra) {
  extra = extra || {};
  const L = mergeLineage(inputs);
  const flags = L.flags;
  if (extra.prob) flags.prob = true;
  const missing = inputs.filter(function (n) { return n.value === null; });
  let value = null;
  let status = ST.DERIVED;
  let note = extra.note || '';
  const causes = [];
  if (missing.length) {
    if (missing.some(function (n) { return n.status === ST.INVALID || n.flags.inv; })) status = ST.INVALID;
    else if (missing.some(function (n) { return n.status === ST.PLACEHOLDER || n.flags.ph; })) status = ST.PLACEHOLDER;
    else status = ST.UNAVAILABLE;
    missing.forEach(function (n) {
      const list = (n.kind === 'leaf' || !n.causes || !n.causes.length) ? [{ label: n.label, why: n.kind === 'leaf' ? (n.error || n.note || '') : '' }] : n.causes;
      list.forEach(function (c) { if (!causes.some(function (x) { return x.label === c.label; })) causes.push(c); });
    });
    note = 'Withheld: requires ' + causes.map(function (c) { return c.label + (c.why ? ' (' + c.why + ')' : ''); }).join('; ');
    if (status === ST.PLACEHOLDER) flags.ph = true;
    if (status === ST.UNAVAILABLE) flags.un = true;
    if (status === ST.INVALID) flags.inv = true;
  } else if (extra.withhold) {
    status = extra.withholdStatus || ST.UNAVAILABLE;
    note = 'Withheld: ' + extra.withhold;
    if (status === ST.UNAVAILABLE) flags.un = true; else flags.inv = true;
  } else {
    const r = fn.apply(null, inputs.map(function (n) { return n.value; }));
    if (isNum(r)) value = r;
    else { status = ST.INVALID; flags.inv = true; note = extra.undefinedNote || 'Undefined for these inputs (for example a zero denominator).'; }
  }
  let fresh = L.fresh;
  if (value === null && status === ST.UNAVAILABLE) fresh = FRESH.UNAVAILABLE;
  flags.stale = flags.stale || fresh === FRESH.STALE;
  const warns = L.warns.slice();
  (extra.warnings || []).forEach(function (w) { if (warns.indexOf(w) < 0) warns.push(w); });
  return Object.freeze({
    id: id, label: label, unit: unit, value: value, status: status, flags: Object.freeze(flags), kind: 'derived',
    fresh: fresh, obs: Object.freeze(L.obs), recs: Object.freeze(L.recs),
    formulaId: formulaId, inputs: Object.freeze(inputs.map(function (n) { return n.id; })),
    inputLabels: Object.freeze(inputs.map(function (n) { return n.label; })),
    inputValues: Object.freeze(inputs.map(function (n) { return n.value; })),
    inputUnits: Object.freeze(inputs.map(function (n) { return n.unit; })),
    inputStatuses: Object.freeze(inputs.map(function (n) { return statusLabel(n); })),
    sourceIds: Object.freeze(L.srcs), citations: Object.freeze(L.cites), note: note, error: '',
    approx: inputs.some(function (n) { return n.approx; }) || !!extra.approx,
    display: null, warnings: Object.freeze(warns), causes: Object.freeze(causes)
  });
}

/* A withheld output that still records its inputs (used by async / pairing rules). */
function mkWithheld(id, label, unit, formulaId, inputs, reason, status) {
  return mkDerived(id, label, unit, formulaId, inputs, function () { return NaN; }, { withhold: reason, withholdStatus: status || ST.UNAVAILABLE });
}

function allVerified(flags) {
  return flags.ver && !flags.syn && !flags.copy && !flags.sec && !flags.pend && !flags.owner && !flags.user && !flags.asm;
}
function statusLabel(n) {
  if (!n) return 'PLACEHOLDER';
  switch (n.status) {
    case ST.DERIVED: return n.flags.syn ? LABEL.DERIVED_SYN : (allVerified(n.flags) ? LABEL.DERIVED_VER : LABEL.DERIVED);
    case ST.INVALID: return 'INVALID INPUT';
    default: return n.status;
  }
}
/* Badge list: status, then weaker input classes (derived only), PROBABLE, freshness. */
function statusLabels(n) {
  const out = [statusLabel(n)];
  if (!n) return out;
  if (n.kind === 'derived' && !n.flags.syn) {
    if (n.flags.user) out.push('USER-ENTERED INPUT');
    if (n.flags.owner) out.push('OWNER-ENTERED INPUT');
    if (n.flags.asm) out.push('ASSUMPTION INPUT');
    if (n.flags.copy) out.push('PRIMARY-COPY INPUT');
    if (n.flags.sec) out.push('SECONDARY INPUT');
    if (n.flags.pend) out.push('CITATION PENDING');
  }
  if (n.flags.prob && n.status !== ST.PROBABLE) out.push('PROBABLE');
  if (n.fresh === FRESH.STALE) out.push('STALE');
  else if (n.value !== null && (n.fresh === FRESH.SNAPSHOT || n.fresh === FRESH.DELAYED || n.fresh === FRESH.LIVE) && n.kind === 'leaf') out.push(n.fresh);
  return out;
}

/* Aggregate a set of nodes into card-level flags (central propagation). */
function aggregate(nodes) {
  const a = { count: 0, derived: false, synLeaf: false, verLeaf: false, allNull: true, fresh: FRESH.NA };
  FLAG_KEYS.forEach(function (k) { a[k] = false; });
  (nodes || []).forEach(function (n) {
    if (!n) return;
    a.count++;
    FLAG_KEYS.forEach(function (k) { a[k] = a[k] || n.flags[k]; });
    a.ph = a.ph || n.status === ST.PLACEHOLDER;
    a.un = a.un || n.status === ST.UNAVAILABLE;
    a.inv = a.inv || n.status === ST.INVALID;
    if (n.status === ST.DERIVED) a.derived = true;
    if (n.status === ST.SYNTHETIC) a.synLeaf = true;
    if (n.status === ST.VERIFIED) a.verLeaf = true;
    if (n.value !== null && n.value !== undefined) a.allNull = false;
    a.fresh = worstFresh([a.fresh, n.value === null ? FRESH.NA : n.fresh]);
  });
  return a;
}
function cardLabels(a) {
  const L = [];
  if (a.synLeaf || a.syn) L.push('SYNTHETIC');
  if (!a.syn) {
    if (a.user) L.push('USER-ENTERED');
    if (a.owner) L.push('OWNER-ENTERED');
    if (a.asm) L.push('ASSUMPTION');
    if (a.sec) L.push('SECONDARY');
    if (a.pend) L.push('CITATION PENDING');
  }
  if (a.prob) L.push('PROBABLE');
  if (a.stale) L.push('STALE');
  else if (!a.syn && a.fresh === FRESH.SNAPSHOT) L.push('SNAPSHOT');
  if (a.ph) L.push('PLACEHOLDER');
  if (a.un) L.push('UNAVAILABLE');
  if (a.inv) L.push('INVALID INPUT');
  return L;
}
/* Filename status token for exports. */
function exportStatusToken(a) {
  if (a.syn) return 'SYNTHETIC';
  if (a.count > 0 && a.allNull) return a.ph && !a.un ? 'PLACEHOLDER' : 'UNAVAILABLE';
  if (a.user) return 'USER-ENTERED';
  if (a.stale) return 'STALE';
  return 'SNAPSHOT';
}

/* ---------- validation ---------- */
const INPUT_RULES = Object.freeze({
  price: { min: 0, exclusiveMin: true, msg: 'must be a positive number' },
  cost:  { min: 0, msg: 'must be zero or a positive number' },
  pct:   { min: 0, max: 100, msg: 'must be a percentage between 0 and 100' },
  days:  { min: 0, max: 3650, integer: true, msg: 'must be a whole number of days between 0 and 3650' },
  lots:  { min: 1, max: 100000, integer: true, msg: 'must be a whole number of lots, at least 1' }
});
const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/* Returns { state: 'OK'|'EMPTY'|'INVALID', value, error }. Never defaults silently. */
function parseInput(raw, ruleName) {
  const rule = INPUT_RULES[ruleName];
  const s = String(raw === null || raw === undefined ? '' : raw).trim().replace(/,/g, '').replace(/^₹\s*/, '').replace(/%$/, '').trim();
  if (s === '') return { state: 'EMPTY', value: null, error: 'Missing: PLACEHOLDER (excluded, never zero)' };
  if (!NUM_RE.test(s)) return { state: 'INVALID', value: null, error: 'Not a number' };
  const v = Number(s);
  if (!Number.isFinite(v)) return { state: 'INVALID', value: null, error: 'Not a finite number' };
  if (rule) {
    if (rule.integer && !Number.isInteger(v)) return { state: 'INVALID', value: null, error: 'Value ' + rule.msg };
    if (rule.exclusiveMin ? !(v > rule.min) : v < rule.min) return { state: 'INVALID', value: null, error: 'Value ' + rule.msg };
    if (rule.max !== undefined && v > rule.max) return { state: 'INVALID', value: null, error: 'Value ' + rule.msg };
  }
  return { state: 'OK', value: v, error: '' };
}

/* Strict ISO date (YYYY-MM-DD) to UTC milliseconds, or null. */
function parseISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const p = s.split('-').map(Number);
  const t = Date.UTC(p[0], p[1] - 1, p[2]);
  const d = new Date(t);
  if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) return null;
  return t;
}
function dayDiff(aISO, bISO) {
  const a = parseISODate(aISO), b = parseISODate(bISO);
  if (a === null || b === null) return null;
  return Math.round((b - a) / 86400000);
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- formatting (display only; raw values are never rounded) ---------- */
const NF = {
  inr2: new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  inr0: new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }),
  n2: new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  n4: new Intl.NumberFormat('en-IN', { minimumFractionDigits: 4, maximumFractionDigits: 4 }),
  usd2: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
};
function fmtINR(v, dp) {
  if (!isNum(v)) return '';
  const f = dp === 0 ? NF.inr0 : NF.inr2;
  return (v < 0 ? '-' : '') + '₹' + f.format(Math.abs(v));
}
function fmtSignedINR(v, dp) {
  if (!isNum(v)) return '';
  return (v > 0 ? '+' : '') + fmtINR(v, dp);
}
function fmtINRShort(v) {
  if (!isNum(v)) return '';
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  if (a >= 1e7) return sg + '₹' + NF.n2.format(a / 1e7) + ' cr';
  if (a >= 1e5) return sg + '₹' + NF.n2.format(a / 1e5) + ' lakh';
  return fmtINR(v, 0);
}
function fmtPct(v, dp) {
  if (!isNum(v)) return '';
  const d = dp === undefined ? 2 : dp;
  return (v * 100).toFixed(d) + '%';
}
function fmtSignedPct(v, dp) {
  if (!isNum(v)) return '';
  return (v > 0 ? '+' : '') + fmtPct(v, dp);
}
function fmtPts(v) {
  if (!isNum(v)) return '';
  const p = Math.round(v * 100 * 100) / 100;
  const s = Number.isInteger(p) ? String(p) : p.toFixed(2);
  return (p > 0 ? '+' : '') + s + ' pts';
}
function fmtUSD(v) { return isNum(v) ? '$' + NF.usd2.format(v) : ''; }
function fmtUSDShort(v) {
  if (!isNum(v)) return '';
  const a = Math.abs(v), sg = v < 0 ? '-' : '';
  const sig = function (x) { return Number(x.toPrecision(4)).toString(); };
  if (a >= 1e9) return sg + '$' + sig(a / 1e9) + 'bn';
  if (a >= 1e6) return sg + '$' + sig(a / 1e6) + 'M';
  if (a >= 1e3) return sg + '$' + sig(a / 1e3) + 'k';
  return sg + '$' + sig(a);
}
function fmtNum(v, dp) { return isNum(v) ? (dp === 4 ? NF.n4 : NF.n2).format(v) : ''; }
function fmtX(v, dp) { return isNum(v) ? v.toFixed(dp === undefined ? 2 : dp) + 'x' : ''; }
function fmtDays(v) { return isNum(v) ? String(v) + (v === 1 ? ' day' : ' days') : ''; }

/* Format a node for display according to its unit. */
function fmtNode(n) {
  if (!n || n.value === null) return '';
  if (n.display) return n.display;
  const v = n.value;
  switch (n.unit) {
    case 'rate': return fmtPct(v, 2);
    case 'rate-p.a.': return fmtPct(v, 2) + ' p.a.';
    case 'pts': return fmtPts(v);
    case 'days': return fmtDays(v);
    case 'x': return fmtX(v, 2);
    case 'USD/troy oz': return fmtUSD(v) + '/oz';
    case 'USD/10g': return fmtUSD(v) + ' per 10 g';
    case 'USD/kg': return fmtUSD(v) + ' per kg';
    case 'INR per USD': return NF.n4.format(v);
    case 'USD': return fmtUSDShort(v);
    case 'USD/kg-v': return fmtUSD(v) + '/kg';
    case 'USD/oz-v': return fmtUSD(v) + '/oz';
    case 'x1': return v.toFixed(1) + 'x';
    case 'months': return String(v) + (v === 1 ? ' month' : ' months');
    case 'tonnes': return NF.inr0.format(v) + ' tonnes';
    case 'growth': return fmtSignedPct(v, 1);
    case 'INR': case 'INR per lot': return fmtINR(v, 0);
    case 'lots': return String(v);
    default: return fmtINR(v, 2);
  }
}

/* Plain-text trace of a derived node: formula plus the actual input values. */
function traceText(n) {
  if (!n) return '';
  if (n.kind !== 'derived') {
    return n.label + ': ' + (n.value === null ? statusLabel(n) : fmtNode(n)) + ' [' + statusLabel(n) + (n.sourceIds.length ? '; ' + n.sourceIds.join(', ') : '') + ']';
  }
  const f = FORMULA_BY_ID[n.formulaId];
  const ins = n.inputLabels.map(function (l, i) {
    const v = n.inputValues ? n.inputValues[i] : null;
    const u = n.inputUnits ? n.inputUnits[i] : '';
    return l + ' = ' + (v === null ? 'withheld' : fmtNode({ value: v, unit: u, display: null }));
  }).join('; ');
  return (n.formulaId ? n.formulaId + ': ' : '') + (f ? f.formula : n.label) + ' | inputs: ' + ins + ' | result: ' + (n.value === null ? statusLabel(n) : fmtNode(n)) + ' [' + statusLabels(n).join(' + ') + ']';
}

/* ---------- CSV / export primitives ---------- */
function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           /* spreadsheet formula-injection guard */
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvLine(arr) { return arr.map(csvCell).join(','); }
function stampParts(d) {
  const p = function (x) { return String(x).padStart(2, '0'); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function localISO(d) {
  const off = -d.getTimezoneOffset();
  const sg = off >= 0 ? '+' : '-';
  const p = function (x) { return String(Math.floor(Math.abs(x))).padStart(2, '0'); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + sg + p(off / 60) + ':' + p(off % 60);
}
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }

/* Flatten nested metadata to [key, value] pairs for the CSV header block. */
function flattenMeta(obj, prefix, out) {
  out = out || [];
  Object.keys(obj).forEach(function (k) {
    const v = obj[k];
    const key = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenMeta(v, key, out);
    else out.push([key, Array.isArray(v) ? v.join(' | ') : v]);
  });
  return out;
}

/* Records behind a set of nodes, for the provenance block of every export. */
function provenanceRows(nodes) {
  const seen = {}, out = [];
  (nodes || []).forEach(function (n) {
    if (!n) return;
    (n.recs || []).forEach(function (r) {
      if (seen[r.id]) return;
      seen[r.id] = 1;
      out.push({
        record_id: r.id, kind: r.kind, value_raw: r.value === undefined ? null : r.value, unit: r.unit || null,
        metal: r.metal || null, contract: r.contract || null, expiry: r.expiry || null,
        observed_at: r.observedAt || null, published_at: r.publishedAt || null, retrieved_at: r.retrievedAt || null,
        effective_from: r.effectiveFrom || null, valid_to: r.validTo || null,
        source_id: r.sourceId || null, source_url: r.url || null, document: r.document || null,
        verification: r.verification || null, freshness_at_build: r.freshness || null,
        raw_sha256: r.rawSha256 || null, terms: r.terms || null, note: r.note || null
      });
    });
  });
  return out;
}
const PROVENANCE_COLUMNS = Object.freeze(['record_id', 'kind', 'value_raw', 'unit', 'metal', 'contract', 'expiry', 'observed_at', 'published_at',
  'retrieved_at', 'effective_from', 'valid_to', 'source_id', 'source_url', 'document', 'verification', 'freshness_at_build', 'raw_sha256', 'terms', 'note']
  .map(function (k) { return { key: k, label: k }; }));

/* Build one export payload (pure; used by UI buttons and by the test suite).
 * spec: { module, subject, columns:[{key,label}], rows:[{...}], nodes:[...], meta:{...}, forceSynthetic } */
function buildExport(spec, now) {
  now = now || new Date();
  const agg = aggregate(spec.nodes || []);
  if (spec.forceSynthetic) agg.syn = true;
  if (spec.forcePlaceholder && !agg.syn) { agg.ph = true; agg.allNull = true; agg.count = Math.max(1, agg.count); }
  const token = spec.statusToken || exportStatusToken(agg);
  const base = [slug(spec.module), slug(spec.subject), stampParts(now), token].join('-');
  const snap = (typeof SNAP !== 'undefined' && SNAP) ? SNAP : null;
  const meta = Object.assign({
    app: BUILD.app, buildVersion: BUILD.buildVersion, configVersion: BUILD.configVersion,
    sampleDataVersion: BUILD.sampleDataVersion, formulaVersion: BUILD.formulaVersion,
    snapshotId: snap ? snap.id : null, snapshotGeneratedAt: snap ? snap.generatedAt : null,
    dataMode: (typeof APP !== 'undefined' && APP && APP.mode) ? APP.mode : 'engine',
    exportedAtLocal: localISO(now), exportedAtISO: now.toISOString(),
    viewerTimezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'), displayTimezone: BUILD.displayTz,
    notLive: true, statusToken: token, disclaimer: 'Explanatory research. Not trade, tax, customs, investment or legal advice.'
  }, spec.meta || {});
  const flags = { containsSynthetic: !!agg.syn, containsUserEntered: !!agg.user, containsStale: !!agg.stale, containsPlaceholder: !!agg.ph,
    containsUnavailable: !!agg.un, containsProbable: !!agg.prob, containsInvalid: !!agg.inv };
  const watermark = agg.syn ? LABEL.SYN_WM : LABEL.NOT_LIVE;
  const prov = spec.noProvenance ? [] : provenanceRows(spec.nodes);
  const json = {
    notLive: true, watermark: watermark,
    containsSynthetic: flags.containsSynthetic, containsUserEntered: flags.containsUserEntered, containsStale: flags.containsStale,
    containsPlaceholder: flags.containsPlaceholder, containsUnavailable: flags.containsUnavailable,
    containsProbable: flags.containsProbable, containsInvalid: flags.containsInvalid,
    meta: meta, columns: spec.columns.map(function (c) { return { key: c.key, label: c.label }; }),
    rows: spec.rows.map(function (r) {
      const o = {};
      spec.columns.forEach(function (c) { o[c.key] = (r[c.key] === undefined ? null : r[c.key]); });
      return o;
    }),
    provenance: prov
  };
  if (spec.extraJson) json.sections = spec.extraJson;
  const lines = [];
  lines.push(csvLine(['# watermark', watermark]));
  lines.push(csvLine(['# notLive', 'true']));
  Object.keys(flags).forEach(function (k) { lines.push(csvLine(['# ' + k, flags[k]])); });
  flattenMeta(meta).forEach(function (kv) { lines.push(csvLine(['# ' + kv[0], kv[1]])); });
  lines.push('');
  lines.push(csvLine(spec.columns.map(function (c) { return c.key; })));
  spec.rows.forEach(function (r) { lines.push(csvLine(spec.columns.map(function (c) { return r[c.key]; }))); });
  const sections = (spec.extraCsvSections || []).slice();
  if (prov.length) sections.push({ title: 'provenance (records behind these values)', columns: PROVENANCE_COLUMNS, rows: prov });
  sections.forEach(function (sec) {
    lines.push('');
    lines.push(csvLine(['# section', sec.title]));
    lines.push(csvLine(sec.columns.map(function (c) { return c.key; })));
    sec.rows.forEach(function (r) { lines.push(csvLine(sec.columns.map(function (c) { return r[c.key]; }))); });
  });
  return {
    filenameBase: base, token: token, agg: agg, json: json,
    jsonText: JSON.stringify(json, null, 2),
    csvText: String.fromCharCode(0xFEFF) + lines.join('\r\n') + '\r\n'
  };
}

/* Standard export row for a node: raw number separate from formatted string. */
function nodeRow(n, extra) {
  const f = n.formulaId ? FORMULA_BY_ID[n.formulaId] : null;
  const times = (n.obs || []).map(function (o) { return o.at; }).sort();
  return Object.assign({
    id: n.id, label: n.label,
    value_raw: n.value === null ? null : n.value,
    value_formatted: n.value === null ? null : fmtNode(n),
    unit: n.unit, status: statusLabel(n), badges: statusLabels(n).join(' | '), freshness: n.fresh,
    observed_from: times.length ? times[0] : null, observed_to: times.length ? times[times.length - 1] : null,
    probable: !!n.flags.prob, contains_synthetic: !!n.flags.syn, contains_user_entered: !!n.flags.user,
    contains_placeholder: !!n.flags.ph, contains_unavailable: !!n.flags.un,
    formula_id: n.formulaId || null, formula_version: n.formulaId ? BUILD.formulaVersion : null, formula: f ? f.formula : null,
    inputs: n.inputs.length ? n.inputs.join(' | ') : null,
    input_statuses: n.inputStatuses ? n.inputStatuses.join(' | ') : null,
    records: (n.recs || []).length ? n.recs.map(function (r) { return r.id; }).join(' | ') : null,
    sources: n.sourceIds.length ? n.sourceIds.join(' | ') : null,
    citations: (n.citations || []).length ? n.citations.join(' | ') : null,
    note: n.note || n.error || null,
    warnings: (n.warnings || []).length ? n.warnings.join(' | ') : null
  }, extra || {});
}
const NODE_COLUMNS = Object.freeze([
  { key: 'id', label: 'Node id' }, { key: 'label', label: 'Label' }, { key: 'value_raw', label: 'Value (raw)' },
  { key: 'value_formatted', label: 'Value (formatted)' }, { key: 'unit', label: 'Unit' }, { key: 'status', label: 'Status' },
  { key: 'badges', label: 'Badges' }, { key: 'freshness', label: 'Freshness' },
  { key: 'observed_from', label: 'Earliest input observation' }, { key: 'observed_to', label: 'Latest input observation' },
  { key: 'probable', label: 'Probable flag' }, { key: 'contains_synthetic', label: 'Synthetic ancestor' },
  { key: 'contains_user_entered', label: 'User-entered ancestor' },
  { key: 'contains_placeholder', label: 'Placeholder' }, { key: 'contains_unavailable', label: 'Unavailable' },
  { key: 'formula_id', label: 'Formula id' }, { key: 'formula_version', label: 'Formula version' }, { key: 'formula', label: 'Formula' },
  { key: 'inputs', label: 'Inputs' }, { key: 'input_statuses', label: 'Input statuses' }, { key: 'records', label: 'Records' },
  { key: 'sources', label: 'Sources' }, { key: 'citations', label: 'Citations' }, { key: 'note', label: 'Note' }, { key: 'warnings', label: 'Warnings' }
]);
