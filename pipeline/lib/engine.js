'use strict';
/* Loads the browser engine (src/engine/*.js) into Node so the pipeline, the static
 * prerender and the tests use exactly the same arithmetic as the page. */
const fs = require('fs');
const path = require('path');
const ENGINE_FILES = ['01-config.js', '02-demo.js', '03-core.js', '04-time.js', '05-records.js', '06-engines.js', '07-parsers.js', '08-tests.js', '09-viewmodels.js'];
const ENGINE_DIR = path.join(__dirname, '..', '..', 'src', 'engine');

function engineSource() {
  return ENGINE_FILES.filter(function (f) { return fs.existsSync(path.join(ENGINE_DIR, f)); })
    .map(function (f) { return '/* ' + f + ' */\n' + fs.readFileSync(path.join(ENGINE_DIR, f), 'utf8'); }).join('\n');
}
function topLevelNames(code) {
  const names = new Set();
  const re = /^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=)/gm;
  let m;
  while ((m = re.exec(code)) !== null) names.add(m[1] || m[2]);
  return Array.from(names);
}
function loadEngine() {
  const code = engineSource();
  const names = topLevelNames(code);
  const body = '"use strict";\n' + code + '\nreturn {' + names.map(function (n) { return JSON.stringify(n) + ': ' + n; }).join(',\n') + '};';
  /* eslint-disable-next-line no-new-func */
  return (new Function(body))();
}
module.exports = { loadEngine: loadEngine, engineSource: engineSource, ENGINE_FILES: ENGINE_FILES };
