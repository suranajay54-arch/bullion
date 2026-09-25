/* =============================================================================
 * SECTION 5. TYPED RECORDS, REGISTRIES AND FRESHNESS
 * -----------------------------------------------------------------------------
 * The snapshot (built by pipeline/run.js) carries typed records:
 *   { id, kind, value, unit, metal, contract, expiry, date, observedAt, publishedAt,
 *     retrievedAt, effectiveFrom, validTo, sourceId, url, document, terms,
 *     verification, rawSha256, derivation:{ formulaId, formulaVersion, inputs[] }, note }
 * observedAt (market time) is never replaced by retrievedAt (when we fetched it).
 * Freshness is re-evaluated in the browser at view time, so a page that has not been
 * rebuilt for days shows STALE on its own.
 * ===========================================================================*/

let SNAP = null;
const REG = { loaded: false, sources: {}, citations: {}, tariffMeta: null, tariff: [], rules: [], exec: [], specs: [], contracts: [], contractMeta: null,
  customsFx: [], usdinr: [], ecb: {}, mcx: [], comex: [], costs: [], checks: [] };
const SPEC_BY_ID = {};
const RULE_BY_ID = {};
const VERIFICATION_TO_ST = Object.freeze({
  'VERIFIED': ST.VERIFIED, 'PRIMARY COPY': ST.COPY, 'SECONDARY': ST.SECONDARY, 'CITATION PENDING': ST.PENDING,
  'OWNER-ENTERED': ST.OWNER, 'USER-ENTERED': ST.USER, 'ASSUMPTION': ST.ASSUMPTION, 'SYNTHETIC': ST.SYNTHETIC,
  'DERIVED': ST.DERIVED, 'PROBABLE': ST.PROBABLE, 'UNAVAILABLE': ST.UNAVAILABLE
});
function stFromVerification(v) { return VERIFICATION_TO_ST[v] || ST.PENDING; }

function quoteLabel(q) { return 'INR/' + (q.quotationUnit === 'kg' ? (q.quotationQuantity === 1 ? 'kg' : q.quotationQuantity + 'kg') : q.quotationQuantity + 'g'); }

/* Load registries and records from a snapshot object (browser) or a pipeline build. */
function loadRegistries(snap) {
  SNAP = snap;
  const R = snap.registries || {};
  REG.sources = {};
  (R.sources || []).forEach(function (s) { REG.sources[s.id] = s; });
  REG.citations = R.citations || {};
  REG.tariffMeta = R.tariffMeta || null;
  REG.rules = (R.dutyRules && R.dutyRules.rules) || [];
  REG.exec = (R.dutyRules && R.dutyRules.exec) || [];
  REG.contractMeta = R.contracts || null;
  REG.specs = (R.contracts && R.contracts.specs) || [];
  REG.contracts = (R.contracts && R.contracts.contracts) || [];
  Object.keys(SPEC_BY_ID).forEach(function (k) { delete SPEC_BY_ID[k]; });
  REG.specs.forEach(function (s) {
    const quoteGrams = s.quotationQuantity * UNIT_GRAMS[s.quotationUnit];
    const lotGrams = s.lotSize * UNIT_GRAMS[s.lotUnit];
    SPEC_BY_ID[s.id] = Object.freeze(Object.assign({}, s, {
      quoteGrams: quoteGrams, lotGrams: lotGrams, lotMultiplierFromQuote: lotGrams / quoteGrams,
      displayQuotation: quoteLabel(s), sourceStatus: stFromVerification(s.verification), sourceId: 'MCX-SPEC'
    }));
  });
  Object.keys(RULE_BY_ID).forEach(function (k) { delete RULE_BY_ID[k]; });
  REG.rules.forEach(function (r) { RULE_BY_ID[r.ruleId] = r; });
  const recs = snap.records || [];
  const byKind = function (k) { return recs.filter(function (r) { return r.kind === k; }); };
  const byDate = function (a, b) { return (a.effectiveFrom || a.date) < (b.effectiveFrom || b.date) ? -1 : 1; };
  REG.tariff = byKind('tv').sort(byDate);
  REG.customsFx = byKind('customsfx').sort(byDate);
  REG.usdinr = byKind('fx.usdinr').sort(byDate);
  REG.ecb = {};
  recs.forEach(function (r) { if (r.kind === 'fx.eurusd' || r.kind === 'fx.eurinr' || r.kind === 'fx.usdinr') REG.ecb[r.id] = r; });
  REG.mcx = byKind('mcx.settle').sort(byDate);
  REG.comex = byKind('comex.settle').sort(byDate);
  REG.costs = byKind('cost.assumption');
  REG.checks = snap.checks || [];
  REG.loaded = true;
  return REG;
}

/* ---------- registry lookups (no look-ahead: only entries in force on the date) ---------- */
function lastOnOrBefore(list, dateISO, key) {
  let out = null;
  list.forEach(function (r) { if ((r[key || 'effectiveFrom']) <= dateISO) out = r; });
  return out;
}
function tariffRecordFor(metal, dateISO) {
  if (REG.tariffMeta && REG.tariffMeta.coverageFrom && dateISO < REG.tariffMeta.coverageFrom) return null;
  return lastOnOrBefore(REG.tariff.filter(function (r) { return r.metal === metal; }), dateISO);
}
function customsFxRecordFor(dateISO) { return lastOnOrBefore(REG.customsFx, dateISO); }
function usdinrRecordAsOf(dateISO) { return lastOnOrBefore(REG.usdinr, dateISO, 'date'); }
function inRange(from, to, d) { return (!from || from <= d) && (!to || d < to); }
function ruleFor(corridorId, metal, dateISO) {
  const c = REG.rules.filter(function (r) { return r.corridorId === corridorId && r.metals.indexOf(metal) >= 0 && inRange(r.effectiveFrom, r.effectiveTo, dateISO); });
  return c.length ? c[c.length - 1] : null;
}
/* asOfISO: only entries whose evidence was published by then (replay no-look-ahead). */
function execFor(corridorId, metal, dateISO, asOfISO) {
  const asOf = asOfISO || '9999-12-31';
  const c = REG.exec.filter(function (e) { return e.corridorId === corridorId && e.metal === metal && inRange(e.from, e.to, dateISO) && (e.knowableFrom || e.from) <= asOf; });
  return c.length ? c[c.length - 1] : null;
}
function execInfo(e) {
  if (!e) return { code: 'NOT_STATED', label: EXEC_CODES.NOT_STATED.label, cls: EXEC_CODES.NOT_STATED.cls, note: 'Not documented for this date.', verification: 'PLACEHOLDER', citations: [] };
  const c = EXEC_CODES[e.code] || EXEC_CODES.NOT_STATED;
  return { code: e.code, label: c.label, cls: c.cls, note: e.note, verification: e.verification, citations: e.citations || [] };
}
/* Listed contracts for a product, plus rule-computed months (marked PROBABLE). */
function contractsFor(product, fromISO, monthsAhead) {
  const spec = SPEC_BY_ID[product];
  const listed = REG.contracts.filter(function (c) { return c.product === product; }).map(function (c) {
    return Object.assign({}, c, { computed: false, id: product + ':' + c.month });
  });
  if (!spec || !monthsAhead) return listed.sort(function (a, b) { return a.month < b.month ? -1 : 1; });
  let y = Number(fromISO.slice(0, 4)), m = Number(fromISO.slice(5, 7));
  for (let i = 0; i < monthsAhead; i++) {
    const ym = y + '-' + pad2(m);
    const inCycle = !spec.listingCycle || spec.listingCycle.indexOf(m) >= 0;
    if (inCycle && !listed.some(function (c) { return c.month === ym; })) {
      const exp = expiryByRule(spec.expiryRule, ym);
      if (exp && exp >= fromISO) listed.push({ product: product, month: ym, expiry: exp, verification: 'PROBABLE', citations: spec.citations, computed: true, id: product + ':' + ym,
        note: 'Month from the listing cycle and expiry from the rule (PROBABLE): neither is from a located circular, and MCX holidays are not loaded.' });
    }
    m++; if (m > 12) { m = 1; y++; }
  }
  return listed.sort(function (a, b) { return a.month < b.month ? -1 : 1; });
}
function contractById(id) {
  const p = String(id || '').split(':');
  if (p.length !== 2) return null;
  return contractsFor(p[0], '1900-01-01', 0).filter(function (c) { return c.month === p[1]; })[0] ||
    (SPEC_BY_ID[p[0]] ? { product: p[0], month: p[1], expiry: expiryByRule(SPEC_BY_ID[p[0]].expiryRule, p[1]), verification: 'PROBABLE', computed: true, id: id, citations: SPEC_BY_ID[p[0]].citations } : null);
}
/* COMEX contract code (GCZ26) -> { product:'GC', metal, month:'2026-12' } or null */
function parseComexCode(code) {
  const m = /^(GC|SI)([FGHJKMNQUVXZ])(\d{2})$/.exec(String(code || '').trim().toUpperCase());
  if (!m) return null;
  return { code: m[0], product: m[1], metal: m[1] === 'GC' ? 'gold' : 'silver', month: '20' + m[3] + '-' + pad2(MONTH_CODES[m[2]]) };
}

/* ---------- freshness ----------
 * ref = { valDate: 'YYYY-MM-DD' (IST), refMs: instant the view represents }            */
function refFor(valDate, nowMs) {
  const now = nowMs === undefined ? Date.now() : nowMs;
  const today = todayIST(now);
  return { valDate: valDate || today, refMs: (!valDate || valDate >= today) ? now : zonedToUTC(valDate, '23:59', 'Asia/Kolkata'), nowMs: now, today: today };
}
function sourceRule(sourceId) { const s = REG.sources[sourceId]; return s && s.staleRule ? s.staleRule : { type: 'none' }; }

/* Returns { fresh, reason, until } for a record as seen from ref. */
function freshnessOf(rec, ref) {
  if (!rec) return { fresh: FRESH.UNAVAILABLE, reason: 'No record' };
  const rule = sourceRule(rec.sourceId);
  const unavailAfter = (rule.staleDaysBeforeUnavailable || THRESHOLDS.staleToUnavailableDays);
  switch (rule.type) {
    case 'businessDaily': {
      const d = rec.date;
      const next = nextBusinessDay(d, rule.calendar);
      const due = zonedToUTC(next, rule.publishLocal, rule.tz) + rule.graceHours * 3600000;
      if (ref.refMs <= due) return { fresh: FRESH.SNAPSHOT, reason: 'Newest observation expected for this cadence', until: due };
      const lag = businessDaysBetween(d, ref.valDate, rule.calendar);
      return { fresh: FRESH.STALE, reason: 'Observed ' + fmtDate(d) + '; a newer observation was due by ' + fmtDateTime(due) + (lag > 0 ? ' (' + lag + ' business day' + (lag === 1 ? '' : 's') + ' behind the valuation date)' : ''), until: due };
    }
    case 'cbicTariffSchedule': {
      if (rec.validTo && ref.valDate < rec.validTo) return { fresh: FRESH.SNAPSHOT, reason: 'In force on the valuation date' };
      const reviewed = (REG.tariffMeta && REG.tariffMeta.lastReviewed) || rec.effectiveFrom;
      const anchor = reviewed > rec.effectiveFrom ? reviewed : rec.effectiveFrom;
      const nextDue = nextTariffScheduledInForce(anchor);
      const dueMs = zonedToUTC(nextDue, '00:00', 'Asia/Kolkata');
      if (ref.refMs < dueMs && ref.valDate < nextDue) return { fresh: FRESH.SNAPSHOT, reason: 'Latest notification; registry reviewed ' + fmtDate(reviewed) + '; next scheduled revision in force ' + fmtDate(nextDue), until: dueMs };
      if (dayDiff(nextDue, ref.valDate) > unavailAfter) return { fresh: FRESH.UNAVAILABLE, reason: 'Registry not reviewed since ' + fmtDate(reviewed) + '; more than ' + unavailAfter + ' days past the scheduled revision of ' + fmtDate(nextDue) };
      return { fresh: FRESH.STALE, reason: 'May be superseded: a revision was scheduled to be in force from ' + fmtDate(nextDue) + ' and the registry was last reviewed ' + fmtDate(reviewed), until: dueMs };
    }
    case 'eramSchedule': {
      const windowEnd = rec.validTo || nextEramEffectiveAfter(rec.effectiveFrom);
      if (ref.valDate < windowEnd) return { fresh: FRESH.SNAPSHOT, reason: 'In force for the fortnight ' + fmtDate(rec.effectiveFrom) + ' to ' + fmtDate(addDays(windowEnd, -1)) };
      const past = dayDiff(windowEnd, ref.valDate);
      if (past > unavailAfter) return { fresh: FRESH.UNAVAILABLE, reason: 'No rate recorded for the ERAM fortnight starting ' + fmtDate(windowEnd) + ' (last recorded rate was in force ' + fmtDate(rec.effectiveFrom) + ' to ' + fmtDate(addDays(windowEnd, -1)) + ')' };
      return { fresh: FRESH.STALE, reason: 'The rate for the fortnight starting ' + fmtDate(windowEnd) + ' is not recorded; showing the previous fortnight\'s rate' };
    }
    case 'maxAgeDays': {
      const d = rec.enteredOn || rec.date || rec.effectiveFrom;
      if (!d) return { fresh: FRESH.SNAPSHOT, reason: 'Undated' };
      return dayDiff(d, ref.valDate) > rule.days ? { fresh: FRESH.STALE, reason: 'Older than ' + rule.days + ' days' } : { fresh: FRESH.SNAPSHOT, reason: 'Reviewed ' + fmtDate(d) };
    }
    default:
      return { fresh: FRESH.SNAPSHOT, reason: 'Registry entry in force' };
  }
}

const MARKET_KINDS = Object.freeze(['fx.usdinr', 'fx.eurusd', 'fx.eurinr', 'mcx.settle', 'comex.settle', 'physical.quote', 'benchmark.user', 'mcx.user']);
/* A leaf from a typed record, with freshness evaluated at ref. UNAVAILABLE freshness withholds the value. */
function leafFromRecord(rec, id, label, unit, ref, extra) {
  extra = extra || {};
  if (!rec) return mkLeaf(id, label, null, unit, ST.UNAVAILABLE, { note: extra.missingNote || 'No record', sourceId: extra.sourceId });
  const f = freshnessOf(rec, ref);
  const status = stFromVerification(rec.verification);
  const cites = rec.citations || [];
  const isMarket = MARKET_KINDS.indexOf(rec.kind) >= 0;
  if (f.fresh === FRESH.UNAVAILABLE) {
    return mkLeaf(id, label, null, unit, ST.UNAVAILABLE, { sourceId: rec.sourceId, citations: cites, note: f.reason, rec: rec });
  }
  const notes = [f.fresh === FRESH.STALE ? 'STALE: ' + f.reason : f.reason];
  if (rec.note) notes.push(rec.note);
  return mkLeaf(id, label, rec.value, unit, status, {
    sourceId: rec.sourceId, citations: cites, fresh: f.fresh, obsAt: isMarket ? rec.observedAt : null, rec: rec,
    note: notes.join(' '), prob: !!rec.inferred || extra.prob, display: extra.display
  });
}

/* Visitor entry -> record-shaped object -> leaf (USER-ENTERED, local only). */
function visitorRecord(kind, id, value, unit, dateISO, timeLocal, tz, extra) {
  const obsMs = zonedToUTC(dateISO, timeLocal, tz);
  return Object.assign({ id: id, kind: kind, value: value, unit: unit, date: dateISO, observedAt: isoInZone(obsMs, tz), observedTz: tz,
    publishedAt: null, retrievedAt: null, sourceId: 'VISITOR', verification: 'USER-ENTERED', url: null,
    note: 'Entered in this browser; time assumed ' + timeLocal + ' ' + tzLabel(tz, obsMs) + ' on the stated date.' }, extra || {});
}
