/* =============================================================================
 * SECTION 4. TIME: time zones, business-day calendars, publication schedules
 * -----------------------------------------------------------------------------
 * All instants are handled as UTC milliseconds and shown in IST (Asia/Kolkata)
 * with the source's own zone alongside. Offsets come from the platform's time
 * zone database (Intl), so daylight-saving changes in Frankfurt and New York are
 * handled without hand-coded rules.
 * ===========================================================================*/

const TZ_SHORT = Object.freeze({ 'Asia/Kolkata': 'IST', 'Europe/Berlin': null, 'America/New_York': null, 'UTC': 'UTC' });
const DTF_CACHE = {};
function dtf(tz) {
  if (!DTF_CACHE[tz]) {
    DTF_CACHE[tz] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return DTF_CACHE[tz];
}
function zonedParts(ms, tz) {
  const o = {};
  dtf(tz).formatToParts(new Date(ms)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = Number(p.value); });
  if (o.hour === 24) o.hour = 0;
  return o;
}
/* Offset of tz from UTC at instant ms, in minutes (IST = +330). */
function tzOffsetMinutes(tz, ms) {
  const p = zonedParts(ms, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
}
/* Local wall time (dateISO + 'HH:MM') in tz to UTC ms. */
function zonedToUTC(dateISO, hhmm, tz) {
  const d = dateISO.split('-').map(Number);
  const t = (hhmm || '00:00').split(':').map(Number);
  const guess = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1] || 0, 0);
  const o1 = tzOffsetMinutes(tz, guess);
  let ms = guess - o1 * 60000;
  const o2 = tzOffsetMinutes(tz, ms);
  if (o2 !== o1) ms = guess - o2 * 60000;
  return ms;
}
function pad2(x) { return String(x).padStart(2, '0'); }
/* ISO 8601 with the zone's offset, e.g. 2026-09-24T14:15:00+02:00 */
function isoInZone(ms, tz) {
  const p = zonedParts(ms, tz);
  const off = tzOffsetMinutes(tz, ms);
  const sg = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return p.year + '-' + pad2(p.month) + '-' + pad2(p.day) + 'T' + pad2(p.hour) + ':' + pad2(p.minute) + ':' + pad2(p.second) + sg + pad2(Math.floor(a / 60)) + ':' + pad2(a % 60);
}
function dateInZone(ms, tz) {
  const p = zonedParts(ms, tz);
  return p.year + '-' + pad2(p.month) + '-' + pad2(p.day);
}
function todayIST(nowMs) { return dateInZone(nowMs === undefined ? Date.now() : nowMs, 'Asia/Kolkata'); }
function tzLabel(tz, ms) {
  if (TZ_SHORT[tz]) return TZ_SHORT[tz];
  const off = tzOffsetMinutes(tz, ms);
  if (tz === 'Europe/Berlin') return off === 120 ? 'CEST' : 'CET';
  if (tz === 'America/New_York') return off === -240 ? 'EDT' : 'EST';
  const sg = off >= 0 ? '+' : '-';
  return 'UTC' + sg + pad2(Math.floor(Math.abs(off) / 60)) + ':' + pad2(Math.abs(off) % 60);
}
const MONTHS_SHORT = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
function fmtDate(dateISO) {
  if (!dateISO || parseISODate(dateISO) === null) return '';
  const p = dateISO.split('-').map(Number);
  return p[2] + ' ' + MONTHS_SHORT[p[1] - 1] + ' ' + p[0];
}
function fmtMonth(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym || '')) return '';
  const p = ym.split('-').map(Number);
  return MONTHS_SHORT[p[1] - 1] + ' ' + p[0];
}
/* "24 Sep 2026, 17:45 IST" (optionally with the source zone: "(14:15 CEST)") */
function toMs(x) { return typeof x === 'number' ? x : Date.parse(x); }
function fmtDateTime(x, tz, withZone) {
  const ms = toMs(x);
  if (!isNum(ms)) return '';
  const z = tz || BUILD.displayTz;
  const p = zonedParts(ms, z);
  let s = p.day + ' ' + MONTHS_SHORT[p.month - 1] + ' ' + p.year + ', ' + pad2(p.hour) + ':' + pad2(p.minute) + ' ' + tzLabel(z, ms);
  if (withZone && withZone !== z) {
    const q = zonedParts(ms, withZone);
    s += ' (' + pad2(q.hour) + ':' + pad2(q.minute) + ' ' + tzLabel(withZone, ms) + (dateInZone(ms, withZone) !== dateInZone(ms, z) ? ', ' + q.day + ' ' + MONTHS_SHORT[q.month - 1] : '') + ')';
  }
  return s;
}
function hoursBetween(aMs, bMs) { return Math.abs(bMs - aMs) / 3600000; }

/* ---------- calendars ---------- */
function addDays(dateISO, n) {
  const t = parseISODate(dateISO);
  if (t === null) return null;
  const d = new Date(t + n * 86400000);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function weekdayOf(dateISO) { const t = parseISODate(dateISO); return t === null ? null : new Date(t).getUTCDay(); }
function isWeekend(dateISO) { const w = weekdayOf(dateISO); return w === 0 || w === 6; }
/* Gregorian Easter Sunday (anonymous algorithm). */
function easterSunday(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
  const month = Math.floor((hh + l - 7 * m + 114) / 31), day = ((hh + l - 7 * m + 114) % 31) + 1;
  return y + '-' + pad2(month) + '-' + pad2(day);
}
const HOLIDAY_CACHE = {};
function targetHolidays(y) {
  if (!HOLIDAY_CACHE[y]) {
    const e = easterSunday(y);
    HOLIDAY_CACHE[y] = [y + '-01-01', addDays(e, -2), addDays(e, 1), y + '-05-01', y + '-12-25', y + '-12-26'];
  }
  return HOLIDAY_CACHE[y];
}
/* cal: 'TARGET' (ECB) or 'WEEKDAYS' (exchange holidays not loaded). */
function isBusinessDay(dateISO, cal) {
  if (isWeekend(dateISO)) return false;
  if (cal === 'TARGET') return targetHolidays(Number(dateISO.slice(0, 4))).indexOf(dateISO) < 0;
  return true;
}
function nextBusinessDay(dateISO, cal) {
  let d = addDays(dateISO, 1);
  for (let i = 0; i < 15 && !isBusinessDay(d, cal); i++) d = addDays(d, 1);
  return d;
}
function prevBusinessDay(dateISO, cal) {
  let d = addDays(dateISO, -1);
  for (let i = 0; i < 15 && !isBusinessDay(d, cal); i++) d = addDays(d, -1);
  return d;
}
/* Business days in (a, b]; negative when b < a. */
function businessDaysBetween(aISO, bISO, cal) {
  if (aISO === bISO) return 0;
  const sign = aISO < bISO ? 1 : -1;
  let lo = sign > 0 ? aISO : bISO; const hi = sign > 0 ? bISO : aISO;
  let n = 0;
  for (let i = 0; i < 4000 && lo < hi; i++) { lo = addDays(lo, 1); if (isBusinessDay(lo, cal)) n++; }
  return sign * n;
}

/* ---------- ICEGATE ERAM schedule ----------
 * Rates published on the evening of the 1st and 3rd Thursday; in force from 00:00 IST the next day. */
function nthWeekdayOfMonth(y, m, weekday, n) {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  return y + '-' + pad2(m) + '-' + pad2(day);
}
function eramEffectiveDatesForMonth(y, m) {
  return [addDays(nthWeekdayOfMonth(y, m, 4, 1), 1), addDays(nthWeekdayOfMonth(y, m, 4, 3), 1)];
}
function nextEramEffectiveAfter(dateISO) {
  let y = Number(dateISO.slice(0, 4)), m = Number(dateISO.slice(5, 7));
  for (let i = 0; i < 3; i++) {
    const c = eramEffectiveDatesForMonth(y, m).filter(function (d) { return d > dateISO; });
    if (c.length) return c[0];
    m++; if (m > 12) { m = 1; y++; }
  }
  return null;
}
function eramPublicationFor(effectiveISO) { return addDays(effectiveISO, -1); }

/* ---------- CBIC tariff-value schedule ----------
 * Regular notifications are in force from the 1st and the 16th of each month. */
function nextTariffScheduledInForce(afterISO) {
  let y = Number(afterISO.slice(0, 4)), m = Number(afterISO.slice(5, 7));
  for (let i = 0; i < 3; i++) {
    const c = [y + '-' + pad2(m) + '-01', y + '-' + pad2(m) + '-16'].filter(function (d) { return d > afterISO; });
    if (c.length) return c[0];
    m++; if (m > 12) { m = 1; y++; }
  }
  return null;
}

/* ---------- MCX expiry rules (holidays not loaded: weekend roll only) ---------- */
function lastDayOfMonth(ym) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return ym + '-' + pad2(new Date(Date.UTC(y, m, 0)).getUTCDate());
}
function expiryByRule(rule, ym) {
  let d = rule === 'DAY5_PRECEDING' ? ym + '-05' : rule === 'LASTDAY_PRECEDING' ? lastDayOfMonth(ym) : null;
  if (!d) return null;
  while (!isBusinessDay(d, 'WEEKDAYS')) d = addDays(d, -1);
  return d;
}
/* First day of the staggered-delivery tender period: 3 trading days including expiry. */
function tenderStart(expiryISO) {
  let d = expiryISO;
  for (let i = 0; i < 2; i++) d = prevBusinessDay(d, 'WEEKDAYS');
  return d;
}
