/* =============================================================================
 * SECTION 7. PARSERS (shared by the pipeline and the browser)
 * -----------------------------------------------------------------------------
 * Each parser returns { rows, errors } or throws with a plain-language message.
 * A parse failure never produces a zero or a guessed value: the caller keeps the
 * last valid dated observation (marked STALE when overdue) or shows UNAVAILABLE.
 * ===========================================================================*/

/* ECB eurofxref XML (daily or 90-day history). */
function parseEcbXml(text) {
  const s = String(text || '');
  if (s.indexOf('European Central Bank') < 0 || s.indexOf('<Cube') < 0) throw new Error('ECB file not recognised: sender or Cube elements missing');
  const out = [];
  const dayRe = /<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>([\s\S]*?)<\/Cube>/g;
  let m;
  while ((m = dayRe.exec(s)) !== null) {
    const rates = {};
    const rateRe = /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]\s*\/>/g;
    let r;
    while ((r = rateRe.exec(m[2])) !== null) rates[r[1]] = Number(r[2]);
    if (parseISODate(m[1]) === null) throw new Error('ECB file has an invalid date: ' + m[1]);
    out.push({ date: m[1], rates: rates });
  }
  if (!out.length) throw new Error('ECB file contains no dated rate blocks');
  out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  return out;
}

/* Minimal RFC 4180 CSV reader. Skips blank lines and lines starting with '#'. Strips a BOM. */
function parseCsv(text) {
  const s = String(text || '').replace(new RegExp('^' + String.fromCharCode(0xFEFF)), '');
  const rows = [];
  let row = [], cell = '', q = false, i = 0, lineStart = true;
  while (i < s.length) {
    const c = s[i];
    if (lineStart && !q && c === '#') { while (i < s.length && s[i] !== '\n') i++; i++; continue; }
    lineStart = false;
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"') { q = true; i++; continue; }
    if (c === ',') { row.push(cell); cell = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(cell); if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row); row = []; cell = ''; i++; lineStart = true; continue; }
    cell += c; i++;
  }
  row.push(cell);
  if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
  return rows;
}
function normHeader(h0) { return String(h0 || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function csvObjects(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { header: [], objects: [] };
  const header = rows[0].map(function (x) { return x.trim(); });
  const keys = header.map(normHeader);
  const objects = rows.slice(1).map(function (r, idx) {
    const o = { _line: idx + 2 };
    keys.forEach(function (k, j) { o[k] = r[j] === undefined ? '' : String(r[j]).trim(); });
    return o;
  });
  return { header: header, keys: keys, objects: objects };
}

const MON3 = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
/* Accepts YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY (Indian order), DD MMM YYYY, DD-MMM-YYYY, DDMMMYYYY. */
function parseLooseDate(s) {
  const t = String(s || '').trim().toUpperCase();
  let m;
  const mk = function (y, mo, d) { const iso = y + '-' + pad2(mo) + '-' + pad2(d); return parseISODate(iso) === null ? null : iso; };
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t))) return mk(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(t))) return mk(+m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[\s\-]?([A-Z]{3})[A-Z]*[\s\-,]*(\d{4})$/.exec(t)) && MON3[m[2]]) return mk(+m[3], MON3[m[2]], +m[1]);
  return null;
}
function parseNum(s) {
  const t = String(s === undefined || s === null ? '' : s).replace(/,/g, '').trim();
  if (t === '' || !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/* data/manual/customs-fx.csv */
const CUSTOMS_FX_VERIFICATION = Object.freeze(['OWNER-ENTERED', 'VERIFIED', 'PRIMARY COPY', 'SECONDARY']);
function parseCustomsFxCsv(text) {
  const t = csvObjects(text);
  const need = ['effectivefrom', 'currency', 'importrate'];
  const missing = need.filter(function (k) { return t.keys.indexOf(k) < 0; });
  if (missing.length) throw new Error('customs-fx.csv is missing columns: ' + missing.join(', '));
  const rows = [], errors = [];
  t.objects.forEach(function (o) {
    const eff = parseLooseDate(o.effectivefrom), rate = parseNum(o.importrate), exp = parseNum(o.exportrate);
    const ver = (o.verification || 'OWNER-ENTERED').toUpperCase();
    if (o.currency.toUpperCase() !== 'USD') { errors.push('Line ' + o._line + ': only USD rows are used (found ' + o.currency + ')'); return; }
    if (!eff) { errors.push('Line ' + o._line + ': effective_from is not a valid date'); return; }
    if (rate === null || rate < 50 || rate > 200) { errors.push('Line ' + o._line + ': import_rate must be a number between 50 and 200'); return; }
    if (CUSTOMS_FX_VERIFICATION.indexOf(ver) < 0) { errors.push('Line ' + o._line + ': verification must be one of ' + CUSTOMS_FX_VERIFICATION.join(', ')); return; }
    if (rows.some(function (r) { return r.effectiveFrom === eff; })) { errors.push('Line ' + o._line + ': duplicate effective_from ' + eff); return; }
    const sched = eramEffectiveDatesForMonth(Number(eff.slice(0, 4)), Number(eff.slice(5, 7)));
    rows.push({ effectiveFrom: eff, importRate: rate, exportRate: exp, publishedOn: parseLooseDate(o.publishedon), verification: ver,
      sourceReference: o.sourcereference || null, enteredBy: o.enteredby || null, enteredOn: parseLooseDate(o.enteredon), note: o.note || null,
      offSchedule: sched.indexOf(eff) < 0 });
  });
  rows.sort(function (a, b) { return a.effectiveFrom < b.effectiveFrom ? -1 : 1; });
  return { rows: rows, errors: errors };
}

/* MCX bhavcopy CSV (columns per C-BHAAVBRIEF; names matched loosely). Bullion futures only. */
const BULLION_PRODUCTS = Object.freeze(['GOLD', 'GOLDM', 'GOLDGUINEA', 'GOLDPETAL', 'SILVER', 'SILVERM', 'SILVERMIC']);
const BHAV_REQUIRED = Object.freeze({ date: ['date', 'tradedate', 'timestamp'], symbol: ['symbol'], expiry: ['expirydate', 'expiry'], close: ['close', 'closeprice', 'settlementprice'] });
const BHAV_OPTIONAL = Object.freeze({ instrument: ['instrumentname', 'instrument'], prevClose: ['previousclose', 'prevclose'], optionType: ['optiontype'],
  open: ['open'], high: ['high'], low: ['low'], volumeLots: ['volumelots'], oiLots: ['openinterestlots'] });
function pickCol(keys, names) { for (let i = 0; i < names.length; i++) { const j = keys.indexOf(names[i]); if (j >= 0) return names[i]; } return null; }
function parseBhavcopy(text, fileName) {
  const t = csvObjects(text);
  const col = {}, missing = [];
  Object.keys(BHAV_REQUIRED).forEach(function (k) { col[k] = pickCol(t.keys, BHAV_REQUIRED[k]); if (!col[k]) missing.push(k); });
  if (missing.length) {
    const e = new Error('Bhavcopy format not recognised: missing ' + missing.join(', ') + ' column(s). Found: ' + t.header.join(', '));
    e.missingColumns = missing; throw e;
  }
  Object.keys(BHAV_OPTIONAL).forEach(function (k) { col[k] = pickCol(t.keys, BHAV_OPTIONAL[k]); });
  const rows = [], errors = [];
  t.objects.forEach(function (o) {
    const sym = String(o[col.symbol] || '').toUpperCase();
    if (BULLION_PRODUCTS.indexOf(sym) < 0) return;
    const inst = col.instrument ? String(o[col.instrument] || '').toUpperCase() : '';
    const opt = col.optionType ? String(o[col.optionType] || '').toUpperCase().trim() : '';
    if ((inst && inst.indexOf('OPT') === 0) || (opt && opt !== '-' && opt !== 'XX' && opt !== 'FUT')) return;   /* futures only */
    const d = parseLooseDate(o[col.date]), ex = parseLooseDate(o[col.expiry]), close = parseNum(o[col.close]);
    if (!d || !ex) { errors.push('Line ' + o._line + ': unreadable date or expiry for ' + sym); return; }
    if (close === null || close <= 0) { errors.push('Line ' + o._line + ': no usable close for ' + sym + ' ' + ex); return; }
    rows.push({ product: sym, date: d, expiry: ex, month: ex.slice(0, 7), price: close, prevClose: col.prevClose ? parseNum(o[col.prevClose]) : null,
      priceType: col.close === 'settlementprice' ? 'SETTLEMENT' : 'CLOSE', instrument: inst || null, sourceFile: fileName || null, line: o._line });
  });
  if (!rows.length) errors.push('No bullion futures rows found (GOLD, GOLDM, GOLDGUINEA, GOLDPETAL, SILVER, SILVERM, SILVERMIC).');
  return { rows: rows, errors: errors, columns: col, header: t.header };
}

/* data/manual/mcx-settlements.csv */
function parseManualMcxCsv(text) {
  const t = csvObjects(text);
  const rows = [], errors = [];
  t.objects.forEach(function (o) {
    const d = parseLooseDate(o.date), ex = parseLooseDate(o.expiry), p = parseNum(o.price), sym = String(o.product || '').toUpperCase();
    const ym = /^\d{4}-\d{2}$/.test(o.contractmonth || '') ? o.contractmonth : (ex ? ex.slice(0, 7) : null);
    if (BULLION_PRODUCTS.indexOf(sym) < 0) { errors.push('Line ' + o._line + ': unknown product ' + sym); return; }
    if (!d || !ym || p === null || p <= 0) { errors.push('Line ' + o._line + ': date, contract_month/expiry and a positive price are required'); return; }
    rows.push({ product: sym, date: d, month: ym, expiry: ex, price: p, priceType: (o.pricetype || 'CLOSE').toUpperCase(), sourceFile: o.sourcefile || null, enteredBy: o.enteredby || null, note: o.note || null });
  });
  return { rows: rows, errors: errors };
}
/* data/manual/comex-settlements.csv */
function parseManualComexCsv(text) {
  const t = csvObjects(text);
  const rows = [], errors = [];
  t.objects.forEach(function (o) {
    const d = parseLooseDate(o.date), p = parseNum(o.price), c = parseComexCode(o.contract);
    if (!c) { errors.push('Line ' + o._line + ': contract must look like GCZ26 or SIZ26'); return; }
    if (!d || p === null || p <= 0) { errors.push('Line ' + o._line + ': date and a positive price are required'); return; }
    rows.push({ contract: c.code, metal: c.metal, month: c.month, date: d, price: p, priceType: (o.pricetype || 'SETTLEMENT').toUpperCase(), source: o.source || null, enteredBy: o.enteredby || null, note: o.note || null });
  });
  return { rows: rows, errors: errors };
}
/* data/manual/local-costs.json */
const COST_FIELDS = Object.freeze(['freight', 'assay', 'handling', 'financingRatePct', 'financingDays']);
function parseLocalCosts(obj) {
  const out = { gold: {}, silver: {}, errors: [] };
  METALS.forEach(function (m) {
    const src = (obj && obj[m]) || {};
    COST_FIELDS.forEach(function (k) {
      const v = src[k];
      if (v === null || v === undefined || v === '') { out[m][k] = null; return; }
      const rule = k === 'financingRatePct' ? 'pct' : k === 'financingDays' ? 'days' : 'cost';
      const p = parseInput(v, rule);
      if (p.state !== 'OK') { out.errors.push(m + '.' + k + ': ' + p.error); out[m][k] = null; return; }
      out[m][k] = p.value;
    });
  });
  return out;
}
