#!/usr/bin/env python3
"""Browser check for the built or published site.

Usage:
  python tests/e2e_check.py --url http://127.0.0.1:8123/ --out build/e2e          (local build)
  python tests/e2e_check.py --url https://<you>.github.io/<repo>/ --out build/e2e-live   (published site)

Profiles: desktop Chromium, Android phone emulation (Pixel 7 profile: Chrome user agent,
touch, 412 px wide), and the phone with JavaScript switched off. Checks: no blank screen,
no script or network errors, every panel renders, in-page audit tests pass, demo mode is
labelled SYNTHETIC, visitor entries compute and export with lineage, bhavcopy loads locally.
This is an emulator, not a physical Android handset.
"""
import argparse, json, os, sys, time
from playwright.sync_api import sync_playwright

PANELS = ['how', 'parity', 'basis', 'spreads', 'corridor', 'evidence', 'limits']
ap = argparse.ArgumentParser()
ap.add_argument('--url', required=True)
ap.add_argument('--out', default='build/e2e')
ap.add_argument('--interact', action='store_true', help='also type visitor entries and export (local builds)')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
URL = a.url if a.url.endswith('/') or a.url.endswith('.html') else a.url + '/'
report = {'url': URL, 'ranAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'checks': []}
def check(profile, name, ok, detail=''):
    report['checks'].append({'profile': profile, 'check': name, 'pass': bool(ok), 'detail': str(detail)[:500]})
    print(('PASS ' if ok else 'FAIL ') + profile + ' | ' + name + ('' if ok else '  -> ' + str(detail)[:300]))

def attach(page, bag):
    page.on('console', lambda m: bag['console'].append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: bag['pageerror'].append(str(e)))
    page.on('requestfailed', lambda r: bag['failed'].append(r.url + ' ' + (r.failure or '')))
    page.on('response', lambda r: bag['bad'].append(str(r.status) + ' ' + r.url) if r.status >= 400 and not r.url.endswith('favicon.ico') else None)
    page.on('request', lambda r: bag['requests'].append(r.url))

def run_profile(p, name, ctx_args, js=True):
    browser = p.chromium.launch()
    ctx = browser.new_context(accept_downloads=True, java_script_enabled=js, **ctx_args)
    page = ctx.new_page()
    bag = {'console': [], 'pageerror': [], 'failed': [], 'bad': [], 'requests': []}
    attach(page, bag)
    page.goto(URL, wait_until='load')
    page.wait_for_timeout(900)
    text = page.inner_text('main')
    check(name, 'not blank: main has readable text at load', len(text) > 800, len(text))
    page.screenshot(path=os.path.join(a.out, name + '-01-landing.png'))
    if not js:
        for pid in PANELS:
            sec = page.query_selector('#' + pid)
            check(name, 'static panel ' + pid + ' present with content', sec is not None and len(sec.inner_text()) > 150, pid)
        check(name, 'static notice visible', page.is_visible('#boot-note'))
        page.screenshot(path=os.path.join(a.out, name + '-02-static-full.png'), full_page=True)
    else:
        ready = page.evaluate("document.documentElement.classList.contains('app-ready')")
        check(name, 'app booted (html.app-ready)', ready, bag['pageerror'][:3])
        res = page.evaluate("window.IBPCI ? window.IBPCI.runTests() : null")
        if res is None:
            check(name, 'in-page audit tests ran', False, 'window.IBPCI missing')
        else:
            fails = [r for r in res if not r['pass'] and not r.get('skipped')]
            check(name, 'in-page audit tests: %d of %d pass' % (len(res) - len(fails), len(res)), not fails, [f['id'] + ' ' + f['detail'] for f in fails][:5])
        for i, pid in enumerate(PANELS):
            page.evaluate("location.hash = '#%s'" % pid)
            page.wait_for_timeout(450)
            vis = page.is_visible('#' + pid)
            live = page.get_attribute('#' + pid, 'data-live') == '1'
            err = page.query_selector('#' + pid + ' .note.crit[role=alert]')
            t = page.inner_text('#' + pid) if vis else ''
            check(name, 'panel ' + pid + ' renders interactively', vis and live and err is None and len(t) > 200, 'visible=%s live=%s err=%s len=%d' % (vis, live, err is not None, len(t)))
            import re as _re
            junk = _re.findall(r'\b(null|undefined|NaN|Infinity)\b', t)
            check(name, 'panel ' + pid + ' shows no null/undefined/NaN text', not junk, junk[:5])
            others = [q for q in PANELS if q != pid and page.is_visible('#' + q)]
            check(name, 'only ' + pid + ' shown', not others, others)
            page.screenshot(path=os.path.join(a.out, '%s-%02d-%s.png' % (name, i + 2, pid)), full_page=(pid in ('parity', 'corridor')))
        page.evaluate("location.hash = '#demo/parity'")
        page.wait_for_timeout(600)
        demo_ok = page.evaluate("document.body.classList.contains('demo') && document.querySelectorAll('#parity .badge.b-syn').length > 0 && !document.getElementById('demo-bar').hidden")
        check(name, 'demo mode is labelled SYNTHETIC', demo_ok)
        page.screenshot(path=os.path.join(a.out, name + '-10-demo-parity.png'), full_page=True)
        for pid in ['basis', 'spreads', 'corridor']:
            page.evaluate("location.hash = '#demo/%s'" % pid)
            page.wait_for_timeout(500)
            t = page.inner_text('#' + pid)
            check(name, 'demo ' + pid + ' renders with synthetic values', page.get_attribute('#' + pid, 'data-live') == '1' and 'SYNTHETIC' in t.upper(), len(t))
        page.screenshot(path=os.path.join(a.out, name + '-11-demo-corridor.png'), full_page=False)
        page.evaluate("location.hash = '#demo/spreads'")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(a.out, name + '-12-demo-spreads.png'), full_page=True)
        page.evaluate("location.hash = '#parity'")
        page.wait_for_timeout(400)
        check(name, 'leaving demo restores public data', page.evaluate("!document.body.classList.contains('demo') && document.querySelectorAll('#parity .badge.b-syn').length === 0"))
    origin = URL.split('/')[0] + '//' + URL.split('/')[2]
    foreign = [u for u in bag['requests'] if not (u.startswith(origin) or u.startswith('data:') or u.startswith('blob:'))]
    check(name, 'no requests to other hosts', not foreign, foreign[:5])
    check(name, 'no failed or 4xx/5xx requests', not bag['failed'] and not bag['bad'], (bag['failed'] + bag['bad'])[:5])
    check(name, 'no console errors or page errors', not bag['pageerror'] and not [c for c in bag['console'] if c.startswith('error')], (bag['pageerror'] + bag['console'])[:5])
    return browser, ctx, page, bag

def interact(page, name):
    page.evaluate("location.hash = '#parity'")
    page.wait_for_timeout(400)
    page.evaluate("document.querySelectorAll('#parity details.drawer').forEach(function(d){ if (/benchmark|Customs exchange/i.test(d.querySelector('summary').textContent)) d.open = true; })")
    page.fill('#bench-c-gold', 'GCZ26'); page.fill('#bench-p-gold', '4000'); page.fill('#bench-d-gold', '2026-09-24')
    page.dispatch_event('#bench-d-gold', 'change')
    page.wait_for_timeout(500)
    t = page.inner_text('#card-par-wf')
    check(name, 'visitor benchmark (synthetic 4,000) computes the benchmark leg', 'USER-ENTERED' in t and '1,23,4' in t, t[:300])
    tiles0 = page.inner_text('#parity .tiles')
    check(name, 'published ICEGATE rate 96.80 (No. 27/2026) gives duty 19,935.96 per 10 g', '19,935.96' in tiles0, tiles0[:400])
    page.fill('#cfx-v', '97.00'); page.fill('#cfx-d', '2026-09-18'); page.dispatch_event('#cfx-d', 'change')
    page.wait_for_timeout(600)
    tiles = page.inner_text('#parity .tiles')
    check(name, 'a visitor customs rate (97.00) overrides it: duty 19,977.15 per 10 g', '19,977.15' in tiles, tiles[:400])
    with page.expect_download() as dl:
        page.click('#card-par-wf [data-export="par-wf:csv"]')
    d = dl.value
    path = os.path.join(a.out, d.suggested_filename)
    d.save_as(path)
    body = open(path, encoding='utf-8-sig').read()
    check(name, 'CSV export has watermark, user-entered flag and provenance', 'DAILY SNAPSHOT - NOT LIVE' in body and 'USER-ENTERED' in d.suggested_filename and 'provenance' in body and 'ecb-eurinr' in body, d.suggested_filename)
    page.evaluate("location.hash = '#basis'")
    page.wait_for_timeout(500)
    page.set_input_files('#bhav-file', os.path.join(os.path.dirname(__file__), 'fixtures', 'bhavcopy-SYNTHETIC-test.csv'))
    page.wait_for_timeout(900)
    txt = page.inner_text('#basis')
    check(name, 'bhavcopy file parsed in the browser (4 bullion futures rows)', 'Loaded bhavcopy-SYNTHETIC-test.csv: 4' in txt, txt[:300])
    page.screenshot(path=os.path.join(a.out, name + '-20-basis-with-entries.png'), full_page=True)
    page.evaluate("location.hash = '#parity'")
    page.wait_for_timeout(300)
    page.click('text=Clear all my entries')
    page.wait_for_timeout(500)
    check(name, 'clearing entries restores the public state', page.evaluate("JSON.stringify(window.IBPCI.state().user.bench.gold.price) === '\"\"'"))

with sync_playwright() as p:
    b1, c1, pg1, _ = run_profile(p, 'desktop', {'viewport': {'width': 1366, 'height': 900}})
    if a.interact:
        interact(pg1, 'desktop')
    b1.close()
    phone = dict(p.devices['Pixel 7'])
    b2, c2, pg2, _ = run_profile(p, 'android', phone)
    if a.interact:
        interact(pg2, 'android')
    b2.close()
    b3, c3, pg3, _ = run_profile(p, 'android-nojs', phone, js=False)
    b3.close()
fails = [c for c in report['checks'] if not c['pass']]
report['summary'] = '%d of %d checks passed' % (len(report['checks']) - len(fails), len(report['checks']))
json.dump(report, open(os.path.join(a.out, 'e2e-report.json'), 'w'), indent=1)
print('\n' + report['summary'])
sys.exit(1 if fails else 0)
