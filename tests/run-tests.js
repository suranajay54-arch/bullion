#!/usr/bin/env node
'use strict';
/* Runs the full audit suite in Node against a deterministic snapshot built from the
 * ECB fixture (so results do not depend on today's data), plus pipeline-only checks.
 *   node tests/run-tests.js            (after `node pipeline/build.js` to include N16/T22 on the built page)
 * Exit code 1 if any test fails. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadEngine } = require('../pipeline/lib/engine.js');

const ROOT = path.join(__dirname, '..');
const FIXTURE = 'data/fixtures/ecb-hist-90d-fixture-20260924.xml';
const NOW = '2026-09-25T09:00:00Z';
const results = [];
function runPipeline(root, out, extra) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'pipeline', 'run.js'), '--root', root, '--out', out, '--ecb-file', path.join(ROOT, FIXTURE), '--now', NOW].concat(extra || []), { stdio: 'pipe' });
    return 0;
  } catch (e) { return e.status || 1; }
}
function copyRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ibpci-'));
  ['config', 'data'].forEach(function (d) { fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true }); });
  return tmp;
}

/* 1. deterministic snapshot */
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ibpci-out-'));
const code = runPipeline(ROOT, outDir);
if (code !== 0) { console.error('Pipeline failed on the repository data; see: node pipeline/run.js'); process.exit(1); }
const snap = JSON.parse(fs.readFileSync(path.join(outDir, 'snapshot.json'), 'utf8'));
const E = loadEngine();
E.loadRegistries(snap);

/* 2. built page (optional) */
const ctx = {};
const privRef = path.join(ROOT, 'tests', 'private', 'reference-exchange-prices-20260924.json');
if (fs.existsSync(privRef)) ctx.referencePrices = JSON.parse(fs.readFileSync(privRef, 'utf8'));
const built = path.join(ROOT, 'dist', 'index.html');
if (fs.existsSync(built)) {
  ctx.html = fs.readFileSync(built, 'utf8');
  const m = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(ctx.html);
  ctx.csp = m ? m[1] : '';
}
E.runTests(ctx).forEach(function (r) { results.push(r); });

/* 3. pipeline-only checks */
function p(id, name, fn) {
  try { const o = fn(); results.push({ id: id, name: name, pass: !!o.pass, detail: o.detail }); }
  catch (e) { results.push({ id: id, name: name, pass: false, detail: 'Exception: ' + e.message }); }
}
p('P01', 'Pipeline reads the ECB fixture and derives USD/INR = EUR/INR / EUR/USD per date', function () {
  const r = snap.records.filter(function (x) { return x.id === 'ecb-usdinr-2026-09-24'; })[0];
  const ok = r && Math.abs(r.value - 109.0775 / 1.1367) < 1e-12 && r.observedAt === '2026-09-24T14:15:00+02:00' && r.derivation.inputs.length === 2 && r.retrievedAt && r.rawSha256 && r.retrievedAt !== r.observedAt;
  return { pass: ok, detail: r ? 'ecb-usdinr-2026-09-24 = ' + r.value.toFixed(6) + ', observed ' + r.observedAt + ', retrieved ' + r.retrievedAt + ' (never equated)' : 'record missing' };
});
p('P02', 'A bad manual edit stops the pipeline (live site unchanged)', function () {
  const tmp = copyRepo();
  const f = path.join(tmp, 'data', 'registry', 'cbic-tariff-values.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); j.entries[j.entries.length - 1].gold = 13.73; fs.writeFileSync(f, JSON.stringify(j));
  const c1 = runPipeline(tmp, path.join(tmp, 'out'));
  const tmp2 = copyRepo();
  fs.appendFileSync(path.join(tmp2, 'data', 'manual', 'customs-fx.csv'), '2026-09-18,USD,abc,,,OWNER-ENTERED,ICEGATE,owner,2026-09-25,\n');
  const c2 = runPipeline(tmp2, path.join(tmp2, 'out'));
  return { pass: c1 === 1 && c2 === 1 && !fs.existsSync(path.join(tmp, 'out', 'snapshot.json')), detail: 'tariff 13.73 and customs FX "abc" both rejected with exit code 1; no snapshot written' };
});
p('P03', 'Manual MCX and COMEX rows are validated but withheld while display rights are off', function () {
  const tmp = copyRepo();
  fs.appendFileSync(path.join(tmp, 'data', 'manual', 'mcx-settlements.csv'), '2026-09-24,GOLD,2026-10,2026-10-05,123456,CLOSE,synthetic-test.csv,owner,SYNTHETIC test row\n');
  fs.appendFileSync(path.join(tmp, 'data', 'manual', 'comex-settlements.csv'), '2026-09-24,GCZ26,1234.5,SETTLEMENT,synthetic test,owner,SYNTHETIC test row\n');
  const c = runPipeline(tmp, path.join(tmp, 'out'));
  const s = JSON.parse(fs.readFileSync(path.join(tmp, 'out', 'snapshot.json'), 'utf8'));
  const leaked = s.records.filter(function (r) { return r.kind === 'mcx.settle' || r.kind === 'comex.settle'; }).length;
  const logged = s.checks.filter(function (x) { return /WITHHELD/.test(x.message); }).length;
  const txt = JSON.stringify(s);
  return { pass: c === 0 && leaked === 0 && logged === 2 && txt.indexOf('123456') < 0 && txt.indexOf('1234.5') < 0, detail: 'rows accepted, 0 exchange prices in the public snapshot, 2 withheld notices logged' };
});
p('P04', 'ECB outage keeps the last valid observations and never invents new ones', function () {
  const tmp = copyRepo();
  const out = path.join(tmp, 'out');
  let c = 0;
  try { execFileSync(process.execPath, [path.join(ROOT, 'pipeline', 'run.js'), '--root', tmp, '--out', out, '--ecb-file', path.join(ROOT, 'data', 'fixtures', 'README.md'), '--now', NOW, '--previous', path.join(outDir, 'snapshot.json')], { stdio: 'pipe' }); } catch (e) { c = e.status || 1; }
  const s = JSON.parse(fs.readFileSync(path.join(out, 'snapshot.json'), 'utf8'));
  const fx = s.records.filter(function (r) { return r.kind === 'fx.usdinr'; });
  const err = s.checks.filter(function (x) { return x.source === 'ECB-EXR' && x.level === 'error'; }).length;
  const newest = fx.map(function (r) { return r.date; }).sort().pop();
  return { pass: c === 0 && err === 1 && fx.length === 11 && newest === '2026-09-24', detail: 'parse error logged; ' + fx.length + ' carried-forward records, newest still ' + newest + ' (freshness is re-evaluated on the page)' };
});

/* 4. report */
let fails = 0;
results.forEach(function (r) {
  const tag = r.skipped ? 'SKIP' : (r.pass ? 'PASS' : 'FAIL');
  if (!r.pass && !r.skipped) fails++;
  console.log(tag + '  ' + r.id + '  ' + r.name + '\n        ' + r.detail);
});
console.log('\n' + (results.length - fails) + ' of ' + results.length + ' passed' + (fails ? '; ' + fails + ' FAILED' : ''));
fs.mkdirSync(path.join(ROOT, 'build'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'test-results.json'), JSON.stringify({ ranAt: new Date().toISOString(), results: results }, null, 1));
process.exit(fails ? 1 : 0);
