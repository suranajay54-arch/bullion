#!/usr/bin/env node
'use strict';
/* =============================================================================
 * DAILY SNAPSHOT PIPELINE
 * Reads config/ and data/, fetches permitted automated sources, validates every
 * registry and manual file, and writes build/snapshot.json + build/run-log.json.
 *
 *   node pipeline/run.js                      offline: registries + manual files + previous/fixture data
 *   node pipeline/run.js --fetch              also fetch ECB rates (the only automated source)
 *   node pipeline/run.js --fetch-docs         also download registry documents and record SHA-256
 *   node pipeline/run.js --previous <url|file> carry forward last valid observations if a fetch fails
 *   node pipeline/run.js --ecb-file <path>    use a saved ECB XML file (tests, manual fallback)
 *   node pipeline/run.js --now <ISO>          fix the clock (tests)
 *
 * Exit code 1 only when a registry or manual file is invalid, so a bad edit never
 * replaces the live site (the last good deployment stays up). Source outages are
 * logged as checks and never fail the run.
 * No secrets are used or printed by this pipeline.
 * ===========================================================================*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadEngine } = require('./lib/engine.js');

const args = process.argv.slice(2);
const flag = function (n) { return args.indexOf(n) >= 0; };
const opt = function (n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ROOT = opt('--root') ? path.resolve(opt('--root')) : path.join(__dirname, '..');
const E = loadEngine();
const NOW = opt('--now') ? Date.parse(opt('--now')) : Date.now();
const OUT = path.resolve(ROOT, opt('--out') || 'build');
const checks = [];
const fetchLog = [];
let fatal = 0;
function check(level, source, message) {
  checks.push({ level: level, source: source, message: message, at: new Date(NOW).toISOString() });
  if (level === 'fatal') fatal++;
  const tag = { info: 'INFO ', warn: 'WARN ', error: 'ERROR', fatal: 'FATAL' }[level] || level;
  console.log('[' + tag + '] ' + source + ': ' + message);
}
function readText(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function readJson(rel) {
  try { return JSON.parse(readText(rel)); } catch (e) { check('fatal', rel, 'Not valid JSON: ' + e.message); return null; }
}
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* Bounded fetch with timeout and backoff (2 s, 6 s, 18 s). */
async function fetchWithRetry(url, sourceId, opts) {
  opts = opts || {};
  const tries = opts.tries || 3, timeout = opts.timeoutMs || 20000;
  let last = null;
  for (let i = 0; i < tries; i++) {
    const t0 = Date.now();
    const ac = new AbortController();
    const timer = setTimeout(function () { ac.abort(); }, timeout);
    try {
      const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'ibpci-snapshot/3 (+educational; daily)' }, redirect: 'follow' });
      const buf = Buffer.from(await res.arrayBuffer());
      clearTimeout(timer);
      const entry = { source: sourceId, url: url, ok: res.ok, status: res.status, bytes: buf.length, sha256: sha256(buf), ms: Date.now() - t0, attempt: i + 1,
        lastModified: res.headers.get('last-modified'), date: res.headers.get('date'), retrievedAt: new Date().toISOString() };
      fetchLog.push(entry);
      if (res.ok) return { buf: buf, entry: entry };
      last = new Error('HTTP ' + res.status);
    } catch (e) {
      clearTimeout(timer);
      last = e;
      fetchLog.push({ source: sourceId, url: url, ok: false, error: String(e && e.message || e), ms: Date.now() - t0, attempt: i + 1 });
    }
    if (i < tries - 1) await sleep([2000, 6000, 18000][i]);
  }
  throw last || new Error('fetch failed');
}

async function loadPrevious(ref) {
  if (!ref) return null;
  try {
    if (/^https?:/.test(ref)) {
      const r = await fetchWithRetry(ref, 'PREVIOUS-SNAPSHOT', { tries: 2, timeoutMs: 15000 });
      return JSON.parse(r.buf.toString('utf8'));
    }
    return JSON.parse(fs.readFileSync(ref, 'utf8'));
  } catch (e) {
    check('info', 'PREVIOUS-SNAPSHOT', 'Previous snapshot not available (' + (e.message || e) + '); continuing without carry-forward.');
    return null;
  }
}

/* ---------- ECB adapter ---------- */
function ecbRecords(days, rawSha, retrievedAt, url) {
  const out = [];
  const series = [];
  days.forEach(function (d) {
    const usd = d.rates.USD, inr = d.rates.INR;
    const obsMs = E.zonedToUTC(d.date, '14:15', 'Europe/Berlin');
    const pubMs = E.zonedToUTC(d.date, '16:00', 'Europe/Berlin');
    const common = { date: d.date, observedAt: E.isoInZone(obsMs, 'Europe/Berlin'), observedTz: 'Europe/Berlin', publishedAt: E.isoInZone(pubMs, 'Europe/Berlin'),
      publishedApprox: true, retrievedAt: retrievedAt, sourceId: 'ECB-EXR', url: url, rawSha256: rawSha, verification: 'VERIFIED', citations: ['C-ECB-EXR'],
      terms: 'ECB: free use with attribution; modifications stated' };
    if (!(E.isNum(usd) && usd > 0) || !(E.isNum(inr) && inr > 0)) {
      check('warn', 'ECB-EXR', 'No USD or INR rate for ' + d.date + ': no cross computed for that date (never interpolated).');
      return;
    }
    const idU = 'ecb-eurusd-' + d.date, idI = 'ecb-eurinr-' + d.date;
    out.push(Object.assign({ id: idU, kind: 'fx.eurusd', value: usd, unit: 'USD per EUR' }, common));
    out.push(Object.assign({ id: idI, kind: 'fx.eurinr', value: inr, unit: 'INR per EUR' }, common));
    const cross = inr / usd;
    out.push(Object.assign({ id: 'ecb-usdinr-' + d.date, kind: 'fx.usdinr', value: cross, unit: 'INR per USD' }, common, {
      sourceId: 'USDINR-ECB-CROSS', verification: 'DERIVED', terms: 'Derived by this site from ECB rates (EUR/INR / EUR/USD); a modification of ECB data',
      derivation: { formulaId: 'F-FX-01', formulaVersion: E.BUILD.formulaVersion, inputs: [idI, idU] } }));
    series.push([d.date, cross]);
  });
  return { records: out, series: series };
}
async function ecbAdapter(src, previous) {
  const keepDays = 31;
  let text = null, rawSha = null, retrievedAt = null, how = null;
  if (opt('--ecb-file')) {
    text = fs.readFileSync(opt('--ecb-file'), 'utf8'); rawSha = sha256(Buffer.from(text, 'utf8')); retrievedAt = new Date(NOW).toISOString(); how = 'file ' + opt('--ecb-file');
  } else if (flag('--fetch')) {
    try {
      const r = await fetchWithRetry(src.url, 'ECB-EXR');
      text = r.buf.toString('utf8'); rawSha = r.entry.sha256; retrievedAt = r.entry.retrievedAt; how = 'fetched';
    } catch (e) { check('error', 'ECB-EXR', 'Fetch failed after retries: ' + (e.message || e) + '. Keeping the last valid observations from the previous snapshot.'); }
  }
  if (text !== null) {
    try {
      const days = E.parseEcbXml(text);
      const res = ecbRecords(days, rawSha, retrievedAt, src.url);
      const recs = res.records.filter(function (r) { return r.date >= days[Math.max(0, days.length - keepDays)].date; });
      check('info', 'ECB-EXR', 'Parsed ' + days.length + ' ECB dates (' + how + '); newest ' + days[days.length - 1].date + '; kept ' + keepDays + ' days of records.');
      return { records: recs, series: res.series, ok: true, how: how === 'fetched' ? 'fetched' : 'file' };
    } catch (e) {
      check('error', 'ECB-EXR', 'Parse failed: ' + e.message + '. Keeping the last valid observations from the previous snapshot.');
    }
  }
  if (previous && previous.records) {
    const recs = previous.records.filter(function (r) { return r.sourceId === 'ECB-EXR' || r.sourceId === 'USDINR-ECB-CROSS'; });
    const series = (previous.series && previous.series.usdinr) || [];
    if (recs.length) check('warn', 'ECB-EXR', 'Using ' + recs.length + ' carried-forward ECB records (newest ' + recs.map(function (r) { return r.date; }).sort().pop() + '). Freshness is re-evaluated on the page.');
    return { records: recs, series: series, ok: false, how: recs.length ? 'carried-forward' : 'none' };
  }
  check('warn', 'ECB-EXR', 'No ECB data this run and no previous snapshot: USD/INR is UNAVAILABLE.');
  return { records: [], series: [], ok: false, how: 'none' };
}

/* ---------- registries ---------- */
function tariffRecords(reg) {
  const recs = [];
  if (!reg || !Array.isArray(reg.entries)) { check('fatal', 'CBIC-TV', 'cbic-tariff-values.json has no entries array'); return recs; }
  const entries = reg.entries.slice();
  const seen = {};
  entries.forEach(function (e, i) {
    const where = 'entry ' + (i + 1) + ' (' + (e.notification || '?') + ')';
    if (!e.notification || seen[e.notification]) check('fatal', 'CBIC-TV', where + ': missing or duplicate notification number');
    seen[e.notification] = 1;
    if (E.parseISODate(e.effectiveFrom) === null) check('fatal', 'CBIC-TV', where + ': effectiveFrom is not YYYY-MM-DD');
    if (!(E.isNum(e.gold) && e.gold > 500 && e.gold < 5000)) check('fatal', 'CBIC-TV', where + ': gold must be USD per 10 g between 500 and 5,000');
    if (!(E.isNum(e.silver) && e.silver > 300 && e.silver < 10000)) check('fatal', 'CBIC-TV', where + ': silver must be USD per kg between 300 and 10,000');
    if (['VERIFIED', 'PRIMARY COPY', 'SECONDARY', 'OWNER-ENTERED'].indexOf(e.verification) < 0) check('fatal', 'CBIC-TV', where + ': verification must be VERIFIED, PRIMARY COPY, SECONDARY or OWNER-ENTERED');
    if (i > 0) {
      const p = entries[i - 1];
      if (!(e.effectiveFrom > p.effectiveFrom)) check('fatal', 'CBIC-TV', where + ': entries must be in increasing effectiveFrom order');
      ['gold', 'silver'].forEach(function (m) {
        const ch = e[m] / p[m] - 1;
        if (Math.abs(ch) > 0.2) check('warn', 'CBIC-TV', where + ': ' + m + ' moved ' + (ch * 100).toFixed(1) + '% from the previous notification. Check the figure.');
      });
    }
  });
  entries.forEach(function (e, i) {
    const next = entries[i + 1];
    ['gold', 'silver'].forEach(function (m) {
      recs.push({ id: 'tv-' + e.notification.split('-')[0].replace('/', '-') + '-' + m, kind: 'tv', metal: m, value: e[m], unit: m === 'gold' ? 'USD/10g' : 'USD/kg',
        effectiveFrom: e.effectiveFrom, validTo: next ? next.effectiveFrom : null, notification: e.notification, dated: e.dated,
        observedAt: E.isoInZone(E.zonedToUTC(e.effectiveFrom, '00:00', 'Asia/Kolkata'), 'Asia/Kolkata'), publishedAt: e.dated ? e.dated + 'T00:00:00+05:30' : null,
        retrievedAt: null, sourceId: 'CBIC-TV', url: e.documentUrl || null, document: e.documentHost || null, verification: e.verification,
        rawSha256: e.sha256 || null, fileNo: e.fileNo || null, citations: e.notification === '75/2026-Customs (N.T.)' ? ['C-NT75-2026'] : [],
        note: e.note || null, terms: 'Gazette matter (Copyright Act s.52(1)(q)(i))' });
    });
  });
  const latest = entries[entries.length - 1];
  const nextDue = E.nextTariffScheduledInForce(reg.lastReviewed > latest.effectiveFrom ? reg.lastReviewed : latest.effectiveFrom);
  check('info', 'CBIC-TV', entries.length + ' notifications; latest ' + latest.notification + ' in force ' + latest.effectiveFrom + '; registry reviewed ' + reg.lastReviewed + '; next scheduled revision in force ' + nextDue + '.');
  if (E.todayIST(NOW) >= nextDue) check('warn', 'CBIC-TV', 'A scheduled tariff-value revision was due in force on ' + nextDue + '. Add the new notification (or update lastReviewed if none was issued).');
  return recs;
}
function customsFxRecords(text) {
  const recs = [];
  let parsed;
  try { parsed = E.parseCustomsFxCsv(text); } catch (e) { check('fatal', 'ICEGATE-ERAM', e.message); return recs; }
  parsed.errors.forEach(function (m) { check('fatal', 'ICEGATE-ERAM', 'customs-fx.csv ' + m); });
  parsed.rows.forEach(function (r, i) {
    const next = parsed.rows[i + 1];
    const sched = E.nextEramEffectiveAfter(r.effectiveFrom);
    const validTo = next && next.effectiveFrom < sched ? next.effectiveFrom : sched;
    if (r.offSchedule) check('warn', 'ICEGATE-ERAM', 'Row effective ' + r.effectiveFrom + ' is not the Friday after a 1st or 3rd Thursday. Ad hoc revisions exist, but check the date.');
    const pubMs = E.zonedToUTC(r.publishedOn || E.eramPublicationFor(r.effectiveFrom), '18:00', 'Asia/Kolkata');
    recs.push({ id: 'cfx-' + r.effectiveFrom, kind: 'customsfx', value: r.importRate, unit: 'INR per USD', currency: 'USD', exportRate: r.exportRate,
      effectiveFrom: r.effectiveFrom, validTo: validTo, observedAt: E.isoInZone(E.zonedToUTC(r.effectiveFrom, '00:00', 'Asia/Kolkata'), 'Asia/Kolkata'),
      publishedAt: E.isoInZone(pubMs, 'Asia/Kolkata'), publishedApprox: !r.publishedOn, retrievedAt: r.enteredOn ? r.enteredOn + 'T00:00:00+05:30' : null,
      sourceId: 'ICEGATE-ERAM', url: r.sourceReference, document: r.sourceReference, verification: r.verification, enteredBy: r.enteredBy, enteredOn: r.enteredOn,
      citations: ['C-PIB-ERAM', 'C-ICEGATE-ERAM'], note: r.note, terms: 'Official rate used as a fact with attribution' });
  });
  const last = parsed.rows[parsed.rows.length - 1];
  const today = E.todayIST(NOW);
  if (!last) check('warn', 'ICEGATE-ERAM', 'No customs exchange rate rows: rupee duty legs are withheld.');
  else {
    const end = recs[recs.length - 1].validTo;
    if (today >= end) check('warn', 'ICEGATE-ERAM', 'No customs exchange rate for the ERAM fortnight in force today (the last row covers ' + last.effectiveFrom + ' to ' + E.addDays(end, -1) + '). Add the ICEGATE rate: rupee duty legs are withheld or STALE until then.');
  }
  return recs;
}
function validateDutyRules(reg, citations) {
  if (!reg || !Array.isArray(reg.rules) || !Array.isArray(reg.exec)) { check('fatal', 'DUTY-RULES', 'duty-rules.json needs rules[] and exec[]'); return; }
  reg.rules.forEach(function (r) {
    const w = 'rule ' + r.ruleId;
    if (E.parseISODate(r.effectiveFrom) === null) check('fatal', 'DUTY-RULES', w + ': effectiveFrom invalid');
    if (r.effectiveTo !== null && E.parseISODate(r.effectiveTo) === null) check('fatal', 'DUTY-RULES', w + ': effectiveTo invalid');
    if (r.total !== null && !(r.total >= 0 && r.total < 1)) check('fatal', 'DUTY-RULES', w + ': total must be a decimal (0.15 = 15%)');
    if (r.bcd !== null && r.aidc !== null && Math.abs(r.bcd + r.aidc - r.total) > 1e-9) check('fatal', 'DUTY-RULES', w + ': bcd + aidc does not equal total');
    (r.citations || []).forEach(function (c) { if (!citations[c]) check('fatal', 'DUTY-RULES', w + ': unknown citation ' + c); });
  });
  ['gold', 'silver'].forEach(function (m) {
    E.CORRIDORS.forEach(function (c) {
      const rs = reg.rules.filter(function (r) { return r.corridorId === c.id && r.metals.indexOf(m) >= 0; }).sort(function (a, b) { return a.effectiveFrom < b.effectiveFrom ? -1 : 1; });
      for (let i = 1; i < rs.length; i++) {
        if (rs[i - 1].effectiveTo === null || rs[i - 1].effectiveTo > rs[i].effectiveFrom) check('fatal', 'DUTY-RULES', 'Overlapping rules for ' + c.id + ' ' + m + ': ' + rs[i - 1].ruleId + ' and ' + rs[i].ruleId);
      }
    });
  });
  reg.exec.forEach(function (x, i) {
    if (!E.EXEC_CODES[x.code]) check('fatal', 'DUTY-RULES', 'exec entry ' + (i + 1) + ': unknown code ' + x.code);
    if (x.knowableFrom && E.parseISODate(x.knowableFrom) === null) check('fatal', 'DUTY-RULES', 'exec entry ' + (i + 1) + ': knowableFrom invalid');
    (x.citations || []).forEach(function (c) { if (!citations[c]) check('fatal', 'DUTY-RULES', 'exec entry ' + (i + 1) + ': unknown citation ' + c); });
  });
  check('info', 'DUTY-RULES', reg.rules.length + ' duty rules and ' + reg.exec.length + ' executability entries validated.');
}
function validateContracts(reg, citations) {
  if (!reg || !Array.isArray(reg.specs) || !Array.isArray(reg.contracts)) { check('fatal', 'MCX-SPEC', 'mcx-contracts.json needs specs[] and contracts[]'); return; }
  const ids = reg.specs.map(function (s) { return s.id; });
  E.BULLION_PRODUCTS.forEach(function (p) { if (ids.indexOf(p) < 0) check('fatal', 'MCX-SPEC', 'Missing specification for ' + p); });
  reg.specs.forEach(function (s) {
    if (!(s.lotSize > 0) || !(s.quotationQuantity > 0) || !E.UNIT_GRAMS[s.lotUnit] || !E.UNIT_GRAMS[s.quotationUnit]) check('fatal', 'MCX-SPEC', s.id + ': lot or quotation unit invalid');
    (s.citations || []).forEach(function (c) { if (!citations[c]) check('fatal', 'MCX-SPEC', s.id + ': unknown citation ' + c); });
  });
  reg.contracts.forEach(function (c) {
    const s = reg.specs.filter(function (x) { return x.id === c.product; })[0];
    if (!s) { check('fatal', 'MCX-SPEC', 'Contract for unknown product ' + c.product); return; }
    if (E.parseISODate(c.expiry) === null || c.expiry.slice(0, 7) !== c.month) check('fatal', 'MCX-SPEC', c.product + ' ' + c.month + ': expiry must be a date in the contract month');
    const rule = E.expiryByRule(s.expiryRule, c.month);
    if (rule !== c.expiry) check('warn', 'MCX-SPEC', c.product + ' ' + c.month + ': listed expiry ' + c.expiry + ' differs from the rule-computed ' + rule + ' (an exchange holiday?).');
  });
  check('info', 'MCX-SPEC', reg.specs.length + ' specifications and ' + reg.contracts.length + ' listed contract months validated.');
}
function validateCitations(cit) {
  const items = (cit && cit.items) || {};
  Object.keys(items).forEach(function (k) {
    const c = items[k];
    if (!c.title || !c.url || !/^https?:\/\//.test(c.url)) check('fatal', 'CITATIONS', k + ': title and an http(s) url are required');
    if (['VERIFIED', 'PRIMARY COPY', 'SECONDARY', 'CITATION PENDING'].indexOf(c.verification) < 0) check('fatal', 'CITATIONS', k + ': unknown verification ' + c.verification);
  });
  E.EPISODES.forEach(function (ep) { ep.facts.forEach(function (f) { if (f.citation && !items[f.citation]) check('fatal', 'CITATIONS', 'Episode fact ' + f.id + ' cites unknown ' + f.citation); }); });
  return items;
}

/* ---------- manual exchange snapshots (gated by publicDisplay) ---------- */
function manualExchange(sources) {
  const mcxSrc = sources['MCX-SETTLE'], cmxSrc = sources['COMEX-SETTLE'];
  const recs = [];
  const mcxRows = [];
  try {
    const p = E.parseManualMcxCsv(readText('data/manual/mcx-settlements.csv'));
    p.errors.forEach(function (m) { check('fatal', 'MCX-SETTLE', 'mcx-settlements.csv ' + m); });
    p.rows.forEach(function (r) { mcxRows.push(Object.assign({ origin: 'manual' }, r)); });
  } catch (e) { check('fatal', 'MCX-SETTLE', 'mcx-settlements.csv: ' + e.message); }
  const inbox = path.join(ROOT, 'data', 'inbox', 'mcx');
  if (fs.existsSync(inbox)) {
    fs.readdirSync(inbox).filter(function (f) { return /\.csv$/i.test(f); }).forEach(function (f) {
      const text = fs.readFileSync(path.join(inbox, f), 'utf8');
      try {
        const p = E.parseBhavcopy(text, f);
        p.errors.forEach(function (m) { check('warn', 'MCX-SETTLE', f + ': ' + m); });
        const h = sha256(Buffer.from(text, 'utf8'));
        p.rows.forEach(function (r) { mcxRows.push(Object.assign({ origin: 'bhavcopy', fileSha256: h }, r)); });
        check('info', 'MCX-SETTLE', f + ': ' + p.rows.length + ' bullion futures rows parsed (sha256 ' + h.slice(0, 12) + '...).');
      } catch (e) { check('error', 'MCX-SETTLE', f + ': ' + e.message + ' The file was skipped; nothing was guessed.'); }
    });
  }
  const cmxRows = [];
  try {
    const p = E.parseManualComexCsv(readText('data/manual/comex-settlements.csv'));
    p.errors.forEach(function (m) { check('fatal', 'COMEX-SETTLE', 'comex-settlements.csv ' + m); });
    p.rows.forEach(function (r) { cmxRows.push(r); });
  } catch (e) { check('fatal', 'COMEX-SETTLE', 'comex-settlements.csv: ' + e.message); }
  const mcxPublic = !!(mcxSrc && mcxSrc.publicDisplay && mcxSrc.publicDisplay.allowed);
  const cmxPublic = !!(cmxSrc && cmxSrc.publicDisplay && cmxSrc.publicDisplay.allowed);
  if (mcxRows.length && !mcxPublic) check('info', 'MCX-SETTLE', mcxRows.length + ' MCX price rows validated and WITHHELD from the public snapshot (display rights not confirmed).');
  if (cmxRows.length && !cmxPublic) check('info', 'COMEX-SETTLE', cmxRows.length + ' COMEX rows validated and WITHHELD from the public snapshot (no CME licence).');
  if (mcxPublic) mcxRows.forEach(function (r) {
    const obs = E.zonedToUTC(r.date, '23:55', 'Asia/Kolkata');
    recs.push({ id: 'mcx-' + r.product + '-' + r.month + '-' + r.date, kind: 'mcx.settle', product: r.product, contract: r.product + ' ' + r.month, month: r.month, expiry: r.expiry,
      value: r.price, unit: 'native', priceType: r.priceType, date: r.date, observedAt: E.isoInZone(obs, 'Asia/Kolkata'), sourceId: 'MCX-SETTLE',
      verification: 'OWNER-ENTERED', url: null, document: r.sourceFile, rawSha256: r.fileSha256 || null, note: 'Close of trading day (time assumed 23:55 IST)' });
  });
  if (cmxPublic) cmxRows.forEach(function (r) {
    const obs = E.zonedToUTC(r.date, '13:30', 'America/New_York');
    recs.push({ id: 'comex-' + r.contract + '-' + r.date, kind: 'comex.settle', contract: r.contract, metal: r.metal, month: r.month, value: r.price, unit: 'USD/troy oz',
      priceType: r.priceType, date: r.date, observedAt: E.isoInZone(obs, 'America/New_York'), sourceId: 'COMEX-SETTLE', verification: 'OWNER-ENTERED', url: null, document: r.source });
  });
  return recs;
}
function costRecords() {
  const raw = readJson('data/manual/local-costs.json');
  if (!raw) return [];
  const p = E.parseLocalCosts(raw);
  p.errors.forEach(function (m) { check('fatal', 'LOCAL-COSTS', 'local-costs.json ' + m); });
  const recs = [];
  E.METALS.forEach(function (m) {
    E.COST_FIELDS.forEach(function (k) {
      if (p[m][k] === null) return;
      recs.push({ id: 'cost-' + m + '-' + k, kind: 'cost.assumption', metal: m, field: k, value: p[m][k], unit: k === 'financingRatePct' ? 'percent p.a.' : k === 'financingDays' ? 'days' : E.COMPARISON_UNIT[m].label,
        sourceId: 'LOCAL-COSTS', verification: 'ASSUMPTION', enteredBy: raw.enteredBy, enteredOn: raw.enteredOn, note: raw.basis || null });
    });
  });
  check('info', 'LOCAL-COSTS', recs.length ? recs.length + ' owner assumptions published.' : 'No owner cost assumptions: landed values are shown before local costs.');
  return recs;
}

async function docHashes(tvReg) {
  if (!flag('--fetch-docs')) return;
  for (const e of tvReg.entries) {
    if (!e.documentUrl) continue;
    try {
      const r = await fetchWithRetry(e.documentUrl, 'CBIC-TV-DOC', { tries: 2, timeoutMs: 20000 });
      if (e.sha256 && e.sha256 !== r.entry.sha256) check('error', 'CBIC-TV', e.notification + ': document hash changed (registry ' + e.sha256.slice(0, 12) + '..., now ' + r.entry.sha256.slice(0, 12) + '...). Re-check the values.');
      else check('info', 'CBIC-TV', e.notification + ': document retrieved, sha256 ' + r.entry.sha256 + (e.sha256 ? ' (matches registry)' : ' (not yet pinned in the registry)'));
    } catch (err) { check('warn', 'CBIC-TV', e.notification + ': document not retrievable this run (' + (err.message || err) + '). Values unaffected.'); }
  }
}

async function main() {
  const sourcesCfg = readJson('config/sources.json');
  const citations = readJson('data/registry/citations.json');
  const tvReg = readJson('data/registry/cbic-tariff-values.json');
  const duty = readJson('data/registry/duty-rules.json');
  const contracts = readJson('data/registry/mcx-contracts.json');
  if (fatal) return finish(null);
  const sources = {};
  sourcesCfg.sources.forEach(function (s) { sources[s.id] = s; });
  const citeItems = validateCitations(citations);
  validateDutyRules(duty, citeItems);
  validateContracts(contracts, citeItems);
  const previous = await loadPrevious(opt('--previous'));
  const ecb = await ecbAdapter(sources['ECB-EXR'], previous);
  const records = [].concat(ecb.records, tariffRecords(tvReg), customsFxRecords(readText('data/manual/customs-fx.csv')), manualExchange(sources), costRecords());
  await docHashes(tvReg);
  const stamp = new Date(NOW);
  const id = 'snap-' + stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const snapshot = {
    schema: E.BUILD.snapshotSchema, id: id, generatedAt: stamp.toISOString(), generatedAtIST: E.isoInZone(NOW, 'Asia/Kolkata'),
    build: { buildVersion: E.BUILD.buildVersion, configVersion: E.BUILD.configVersion, formulaVersion: E.BUILD.formulaVersion },
    pipeline: { runId: process.env.GITHUB_RUN_ID || null, commit: process.env.GITHUB_SHA || null, trigger: process.env.GITHUB_EVENT_NAME || 'local', node: process.version,
      ecbSource: ecb.how, previousSnapshotId: previous ? previous.id : null },
    registries: {
      sources: sourcesCfg.sources, citations: citeItems,
      tariffMeta: { coverageFrom: tvReg.coverageFrom, lastReviewed: tvReg.lastReviewed, lastReviewedNote: tvReg.lastReviewedNote, cadence: tvReg.cadence, units: tvReg.units },
      dutyRules: { rules: duty.rules, exec: duty.exec, lastReviewed: duty.lastReviewed, coverageNote: duty.coverageNote },
      contracts: { specs: contracts.specs, contracts: contracts.contracts, tenderPeriod: contracts.tenderPeriod, holidayCalendar: contracts.holidayCalendar, lastReviewed: contracts.lastReviewed }
    },
    records: records,
    series: { usdinr: ecb.series },
    checks: checks,
    fetchLog: fetchLog
  };
  /* Freshness at build time (the page re-evaluates at view time). */
  E.loadRegistries(snapshot);
  const refBuild = E.refFor(E.todayIST(NOW), NOW);
  records.forEach(function (r) { r.freshness = E.freshnessOf(r, refBuild).fresh; });
  /* The public snapshot must never contain synthetic values. */
  if (records.some(function (r) { return r.verification === 'SYNTHETIC' || r.sourceId === 'SYN-DEMO'; })) check('fatal', 'SNAPSHOT', 'Synthetic record found in the public snapshot');
  return finish(snapshot);
}
function finish(snapshot) {
  fs.mkdirSync(OUT, { recursive: true });
  const log = { generatedAt: new Date(NOW).toISOString(), fatal: fatal, checks: checks, fetchLog: fetchLog };
  fs.writeFileSync(path.join(OUT, 'run-log.json'), JSON.stringify(log, null, 1));
  if (fatal || !snapshot) {
    console.log('\nPIPELINE STOPPED: ' + fatal + ' invalid registry or manual-file problem(s). Fix the file(s) named above. The live site is unchanged.');
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(path.join(OUT, 'snapshot.json'), JSON.stringify(snapshot));
  const counts = {};
  checks.forEach(function (c) { counts[c.level] = (counts[c.level] || 0) + 1; });
  console.log('\nSnapshot ' + snapshot.id + ': ' + snapshot.records.length + ' records; checks ' + JSON.stringify(counts) + '; written to ' + path.relative(ROOT, OUT) + '/');
}
main().catch(function (e) { check('fatal', 'PIPELINE', e.stack || String(e)); finish(null); });
