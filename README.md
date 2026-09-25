# India Bullion Parity & Corridor Intelligence (public site, Build 3.0.0)

**Live: https://suranajay54-arch.github.io/bullion/** (published 25 Sep 2026 from this repository; rebuilt twice a day and on every data edit).

## Five steps to put it online (done on 25 Sep 2026; kept for reference)

1. **Get a GitHub account.** Go to github.com/signup and create a free account. Your username becomes part of the web address.
2. **Create an empty public repository.** Go to github.com/new, type the name `bullion`, choose **Public**, leave everything else unticked, click **Create repository**.
3. **Upload this folder.** On the new repository page click **uploading an existing file**. Open the unzipped folder on your computer, select everything inside it (including the `.github` folder), drag it onto the page and click **Commit changes**. (If `.github` does not upload, see "Troubleshooting uploads" below.)
4. **Switch on the website.** In the repository click **Settings > Pages**. Under "Build and deployment", set **Source** to **GitHub Actions**.
5. **Publish.** Click the **Actions** tab, choose **Build and publish**, click **Run workflow**. After about two minutes a green tick appears. The address is shown under Settings > Pages, normally `https://<your-username>.github.io/bullion/`. Open it on your phone and your computer.

A red cross on the Actions tab before step 4 is expected: GitHub tries to publish as soon as the files arrive. Run step 5 again after step 4.

After that, two small jobs keep it honest: add the customs exchange rate every second Thursday and each new CBIC tariff-value notification (docs/OPERATIONS.md, about 5 minutes each).

## What this is

An educational, public explanation of what it costs to import gold and silver into India, built on
the Build 2.0.0 parity and corridor model. Seven panels, each with a direct link:

| Panel | Link | What it shows |
|---|---|---|
| How to read | `#how` | Today's inputs and their states, the label legend |
| Parity | `#parity` | Evidence waterfall from the global price to the landed cost; duty on the CBIC tariff value at the customs rate |
| Basis | `#basis` | MCX futures basis and physical basis, kept separate; carry to expiry; what moved the basis between two dates |
| Spreads | `#spreads` | Calendar spreads on MCX's actual expiry dates; fair carry; margin only as a hypothetical sensitivity |
| Corridors | `#corridor` | Dated duty wedges versus executability, the counterfactual duty, and the replay that shows only what was published on each date |
| Evidence | `#evidence` | Build log, every source with terms and schedule, every record, citations, formulas, and the audit tests you can run |
| Limitations | `#limits` | What the numbers leave out |

Add `demo/` for the synthetic demo, for example `#demo/parity`: every price is invented and
labelled SYNTHETIC; rates and contract dates are real.

## What is public, what is not, and why

| Input | On the public site? | Why |
|---|---|---|
| USD/INR (ECB cross) | Yes, automated daily | ECB permits reuse with attribution; labelled as derived |
| CBIC tariff values, duty rules, DGFT conditions | Yes, from dated registries you maintain | Gazette matter; each entry cites its notification |
| Customs exchange rate (ICEGATE) | Yes, added each fortnight from ICEGATE's notification list | Official rate used as a fact; ICEGATE documents no data feed |
| MCX prices | No (visitors can enter or load their own) | MCX display rights not confirmed |
| COMEX prices | No (visitors can enter their own) | CME requires a licence for public display |
| Your cost assumptions | Only if you publish defaults | Optional (`data/manual/local-costs.json`) |

Nothing on the site is live. It is a daily snapshot, and it says so on every page. It is not a
trading signal, forecast or advice.

## Costs

Rs 0 a month on free tiers (optional domain about Rs 750 to 1,065 a year). The full table and the
choice between (a) this free dated demo and (b) a licensed real-time connector later are in
docs/COSTS.md.

## Detailed instructions

### A. See it on your own computer first (optional)

1. Install Node.js 22 (nodejs.org, "LTS" installer) and Python 3 (python.org).
2. Open a terminal in this folder.
3. Run `node pipeline/run.js --ecb-file data/fixtures/ecb-hist-90d-fixture-20260924.xml` (works offline) or `node pipeline/run.js --fetch` (downloads today's ECB rates).
4. Run `node pipeline/build.js`, then `python3 -m http.server --directory dist 8080`.
5. Open http://127.0.0.1:8080/ in your browser.

### B. Update the data (the only routine work)

Follow docs/OPERATIONS.md. Every edit can be made on github.com with the pencil icon; the site
republishes by itself within a few minutes. A mistake stops the publish and leaves the previous
site online, so an error can never reach the public page.

### C. Add a source, or switch on exchange prices (only with permission)

1. Record the source in `config/sources.json` (name, URL, terms, cadence, staleness rule, failure modes).
2. For a manual source, put rows in the matching file in `data/manual/`; for a bhavcopy, drop the CSV into `data/inbox/mcx/`. The pipeline validates them either way.
3. MCX or COMEX prices stay out of the public snapshot until you set `"publicDisplay": { "allowed": true, ... }` for that source. Do this only with written permission or a licence.
4. Run the tests (step E) and commit.

### D. Supply a password or key securely (only if you add a paid feed later)

Never put a key in chat, email or any file. On github.com: repository **Settings > Secrets and
variables > Actions > New repository secret**. Stage 1 uses no secrets.

### E. Run the tests

`node tests/run-tests.js` runs 42 checks (the 22 Build 2.0.0 tests, 16 new ones and 4 pipeline
checks). `python3 tests/e2e_check.py --url http://127.0.0.1:8080/ --out build/e2e --interact` checks
the built page in desktop Chrome, Android phone emulation and with scripts off (needs
`pip install playwright` and `python -m playwright install chromium`). Both also run on GitHub after
every publish.

### F. Publish and check

Steps 4 and 5 above. After each publish, Actions > **Check the live site** saves screenshots and a
report of the published address.

### G. Use your own web address (optional)

1. Buy a domain (for example at porkbun.com; .in about USD 7.83 a year).
2. In the repository: Settings > Pages > Custom domain, type it and save.
3. At the domain seller, add the DNS records listed in GitHub's help page "Managing a custom domain for your GitHub Pages site": four A records for a bare domain, or one CNAME record for a subdomain such as `bullion.yourname.in` pointing to `<your-username>.github.io`.
4. Tick **Enforce HTTPS** once it becomes available (can take up to a day).

### H. Keep the daily job running

GitHub pauses scheduled jobs in public repositories after 60 days without any commit. The
fortnightly customs-rate update prevents that. If it happens, Actions > Build and publish >
**Enable workflow**.

## Troubleshooting uploads

- **The `.github` folder did not upload.** On github.com click **Add file > Create new file**, type
  `.github/workflows/publish.yml` as the name, paste the contents of that file from this folder, and
  commit. Repeat for `.github/workflows/check-live.yml`.
- **Alternative:** install GitHub Desktop (desktop.github.com), sign in, **File > Add local
  repository**, choose this folder, accept "create a repository", then **Publish repository** with
  "Keep this code private" unticked.

Other problems (expired token, changed bhavcopy format, market closed, stale values, missing
citations, failed mobile load): docs/OPERATIONS.md, "Troubleshooting".

## Folder map

| Path | Contents |
|---|---|
| `src/engine/` | Arithmetic, lineage, time and calendar rules, parsers, tests (shared by the page, the build and the tests) |
| `src/ui/` | The page: panels, charts, styles |
| `pipeline/` | Daily snapshot (`run.js`), site build (`build.js`), static fallback (`prerender.js`), docs generator |
| `config/sources.json` | Source registry |
| `data/registry/` | Tariff values, duty rules and executability, MCX contracts, citations |
| `data/manual/` | Customs exchange rates, cost assumptions, manual exchange snapshots |
| `tests/` | Node test runner, browser check, synthetic fixtures |
| `docs/` | Methodology, sources, reconciliation, costs, operations, checklist, blockers, verification |
| `.github/workflows/` | Daily build and publish; live-site check |

## Credits and terms

USD/INR is derived by this site from European Central Bank euro reference rates (a modification of
ECB data). Tariff values, duty rates and trade-policy conditions come from Government of India
notifications cited on the page. Trade figures are attributed to their publishers. Explanatory
research only: not trade, tax, customs, investment or legal advice.
