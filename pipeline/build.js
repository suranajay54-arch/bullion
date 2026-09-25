#!/usr/bin/env node
'use strict';
/* =============================================================================
 * SITE BUILD: build/snapshot.json + src/ -> dist/ (ready for GitHub Pages)
 *   dist/index.html        static prerender of every panel + embedded snapshot + CSP
 *   dist/assets/app.js     engine + UI (one strict-mode bundle, no external code)
 *   dist/assets/app.css
 *   dist/data/snapshot.json, dist/data/run-log.json (downloads for transparency)
 * Lints the output: no em or en dashes, no HTML-string injection, no eval, no
 * network calls, CSP present. Exit code 1 on any problem.
 * ===========================================================================*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { loadEngine, ENGINE_FILES } = require('./lib/engine.js');
const prerender = require('./prerender.js');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = function (n) { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const SNAP_PATH = path.resolve(ROOT, opt('--snapshot') || 'build/snapshot.json');
const DIST = path.resolve(ROOT, opt('--out') || 'dist');
const UI_FILES = ['10-uikit.js', '11-state.js', '12-inputs.js', '13-common.js', '14-parity.js', '15-basis.js', '16-spreads.js', '17-corridor.js', '18-evidence.js', '19-text.js', '20-app.js'];
const problems = [];

if (!fs.existsSync(SNAP_PATH)) { console.error('No snapshot at ' + SNAP_PATH + '. Run: node pipeline/run.js'); process.exit(1); }
const snap = JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
const E = loadEngine();

/* 1. browser bundle */
const read = function (dir, f) { return '/* ---- ' + f + ' ---- */\n' + fs.readFileSync(path.join(ROOT, 'src', dir, f), 'utf8'); };
const js = '/* ' + E.BUILD.app + ' ' + E.BUILD.buildVersion + ' (' + E.BUILD.configVersion + '). Source: src/ in the repository. */\n(function () {\n\'use strict\';\n' +
  ENGINE_FILES.map(function (f) { return read('engine', f); }).join('\n') + '\n' + UI_FILES.map(function (f) { return read('ui', f); }).join('\n') + '\n})();\n';
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'data'), { recursive: true });
fs.writeFileSync(path.join(DIST, 'assets', 'app.js'), js);
try { execFileSync(process.execPath, ['--check', path.join(DIST, 'assets', 'app.js')], { stdio: 'pipe' }); }
catch (e) { problems.push('app.js does not parse: ' + String(e.stderr || e.message)); }
const css = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'styles.css'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'src', 'ui', 'site.css'), 'utf8');
fs.writeFileSync(path.join(DIST, 'assets', 'app.css'), css);
const hash = function (s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12); };

/* 2. static prerender */
const html0 = prerender.render(E, snap);
const esc = prerender.esc;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'none'; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'";
const built = E.fmtDateTime(snap.generatedAt);
const nav = E.PANELS.map(function (p) { return '<a href="#' + p.id + '" data-panel="' + p.id + '">' + esc(p.label) + '</a>'; }).join('');
const sections = E.PANELS.map(function (p) { return '<section class="view" id="' + p.id + '" aria-labelledby="h-' + p.id + '" data-static="1">' + html0[p.id] + '</section>'; }).join('\n');
const snapJson = JSON.stringify(snap).replace(/</g, '\\u003c').replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028').replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
const description = 'Educational analysis of India gold and silver import parity: CBIC tariff values, customs exchange rates, duty rules, MCX contract normalization, calendar spreads and the India-UAE CEPA corridor. Daily snapshot, not live data, not advice.';
const page = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  '<meta http-equiv="Content-Security-Policy" content="' + CSP + '">\n<meta name="referrer" content="no-referrer">\n' +
  '<meta name="description" content="' + esc(description) + '">\n<meta name="color-scheme" content="light dark">\n' +
  '<meta property="og:title" content="' + esc(E.BUILD.app) + '">\n<meta property="og:description" content="' + esc(description) + '">\n<meta property="og:type" content="website">\n' +
  '<title>' + esc(E.BUILD.app) + '</title>\n<link rel="stylesheet" href="assets/app.css?v=' + hash(css) + '">\n' +
  '<script src="assets/app.js?v=' + hash(js) + '" defer></script>\n</head>\n<body>\n<a class="skip" href="#main">Skip to content</a>\n' +
  '<header class="topbar" id="topbar">\n<div class="brand"><div class="brand-title">' + esc(E.BUILD.app) + '</div><div class="brand-sub">Gold INR/10g | Silver INR/kg | Public educational build ' + esc(E.BUILD.buildVersion) + '</div></div>\n' +
  '<div class="asof" id="asof"><span class="asof-main">Daily snapshot built ' + esc(built) + '</span><span class="asof-sub">Not live. Times in IST.</span></div>\n' +
  '<nav class="modnav" id="modnav" aria-label="Panels">' + nav + '</nav>\n<div class="tools" id="tools"></div>\n</header>\n' +
  '<div class="demo-bar" id="demo-bar" hidden></div>\n<main id="main" tabindex="-1">\n' +
  '<p class="note" id="boot-note" role="status">You are reading the static snapshot of ' + esc(built) + '. Interactive features start automatically when scripts run.</p>\n' +
  '<noscript><p class="note">JavaScript is off: this is the complete static snapshot. Interactive inputs, the replay time machine and exports need JavaScript.</p></noscript>\n' +
  sections + '\n</main>\n' +
  '<footer class="foot"><p>' + esc(E.BUILD.app) + ' ' + esc(E.BUILD.buildVersion) + '. Explanatory research, not trade, tax, customs, investment or legal advice. USD/INR derived from ECB reference rates (modified by this site). Tariff values and duty rules from Government of India notifications. Snapshot ' + esc(snap.id) + '.</p></footer>\n' +
  '<div class="toast" id="toast" role="status" aria-live="polite"></div>\n' +
  '<script type="application/json" id="snapshot-data">' + snapJson + '</script>\n</body>\n</html>\n';
fs.writeFileSync(path.join(DIST, 'index.html'), page);
fs.writeFileSync(path.join(DIST, '404.html'), page.replace('<title>', '<title>Not found | '));
fs.copyFileSync(SNAP_PATH, path.join(DIST, 'data', 'snapshot.json'));
const logPath = path.join(path.dirname(SNAP_PATH), 'run-log.json');
if (fs.existsSync(logPath)) fs.copyFileSync(logPath, path.join(DIST, 'data', 'run-log.json'));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n');

/* 3. lint */
const checkText = function (name, text) {
  [[String.fromCharCode(0x2014), 'em dash'], [String.fromCharCode(0x2013), 'en dash']].forEach(function (x) { const i = text.indexOf(x[0]); if (i >= 0) problems.push(name + ': ' + x[1] + ' near "' + text.slice(Math.max(0, i - 40), i + 20).replace(/\s+/g, ' ') + '"'); });
};
checkText('index.html', page); checkText('app.js', js); checkText('app.css', css);
[[/\.innerHTML\s*=/, 'innerHTML assignment'], [/\.outerHTML\s*=/, 'outerHTML assignment'], [/insertAdjacentHTML/, 'insertAdjacentHTML'], [/document\.write/, 'document.write'],
  [/\beval\s*\(/, 'eval'], [/new Function/, 'new Function'], [/\bfetch\s*\(/, 'fetch'], [/XMLHttpRequest/, 'XMLHttpRequest'], [/WebSocket/, 'WebSocket'], [/sendBeacon/, 'sendBeacon']].forEach(function (x) {
  if (x[0].test(js)) problems.push('app.js: forbidden ' + x[1]);
});
if (!/connect-src 'none'/.test(page)) problems.push('CSP missing connect-src none');
if (/<script(?![^>]*(src="assets\/app\.js|type="application\/json"))[^>]*>/.test(page)) problems.push('index.html: unexpected script tag');
if (Buffer.byteLength(page) > 3e6) problems.push('index.html larger than 3 MB');
if (problems.length) { console.error('BUILD PROBLEMS:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('Built ' + path.relative(ROOT, DIST) + '/: index.html ' + Math.round(Buffer.byteLength(page) / 1024) + ' KB, app.js ' + Math.round(Buffer.byteLength(js) / 1024) + ' KB, app.css ' + Math.round(Buffer.byteLength(css) / 1024) + ' KB; snapshot ' + snap.id);
