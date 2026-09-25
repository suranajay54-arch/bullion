# Costs and the one decision that changes them

Rupee figures convert US dollar prices at about Rs 96 per dollar (the ECB cross rate of 24 Sep 2026)
and are rounded. Prices are as listed by each provider on 25 Sep 2026; where a provider did not
show a billing period or a term, the table says so rather than guessing.

## Monthly cost table

Traffic assumption for a small public demo: up to about 2,000 page views a month (award organisers,
jury, a few hundred interested readers). Each view downloads about 0.5 MB, so about 1 GB a month.

| Provider | Free allowance or verified price | Delay | Rights and limits | Expected monthly spend | What fails or changes if we stay free |
|---|---|---|---|---|---|
| GitHub Pages (hosting) | Free for public repositories on GitHub Free; site up to 1 GB; soft limit 100 GB bandwidth a month | Not applicable | The repository must be public on the free plan (the code and data files are visible) | Rs 0 | Nothing at this traffic (about 1% of the bandwidth limit) |
| GitHub Actions (daily job) | Free for public repositories on standard runners | Scheduled runs can start late at busy times; users reported delays of 4 to 14 hours in Jul and Aug 2026, and dropped runs | Scheduled jobs are switched off after 60 days without repository activity | Rs 0 | A late run means an older snapshot; the page shows its build time and marks old inputs STALE by itself |
| ECB euro reference rates (USD/INR cross) | Free | Daily, about 16:00 Frankfurt time on TARGET working days | Free reuse with attribution; the cross rate must be labelled as a modification | Rs 0 | Nothing; this is the only fully automated market input |
| CBIC tariff-value notifications | Free (Gazette matter, Copyright Act s.52(1)(q)(i)) | About twice a month plus ad hoc | CBIC permits linking, not framing | Rs 0 | Needs about 5 minutes of your time per notification |
| ICEGATE customs exchange rates (ERAM) | Free to view | Twice a month (evening of the 1st and 3rd Thursday) | Reuse terms of the viewer could not be read; used as individual official facts with attribution | Rs 0 | Needs about 2 minutes of your time per fortnight; until you enter it, rupee duty legs are withheld |
| MCX daily prices (bhavcopy) | Free to download for your own use | Daily after the evening session | MCX website terms and data-redistribution policy could not be read (the site blocks automated access); no public display until MCX or a licensed vendor confirms in writing | Rs 0 now; licence price unknown | Exchange prices stay visitor-entered only; the site still shows the method, contract calendar and your own entries |
| CME COMEX prices | CME fee list (1 Jan 2026): "Public Website" USD 487 (about Rs 46,700), Delayed and Historical information only; billing period not shown | Delayed at least 10 minutes; historical from 8 hours | Needs a CME Information License Agreement; personal non-commercial use only without it; no automated retrieval from cmegroup.com | Rs 0 now; about Rs 46,700 per period if licensed (period to confirm with CME), plus a data source | The benchmark stays visitor-entered only |
| Databento (licensed CME data feed) | Standard USD 199 a month (about Rs 19,100; internal use); Plus USD 1,750 a month (about Rs 1.68 lakh; allows external redistribution) | Real time or historical | Exchange licence terms are passed through; the CME licence is still needed for public display | Rs 0 unless option (b) | Not needed for option (a) |
| Zerodha Kite Connect (optional, later) | Rs 500 a month per API key (GST treatment not confirmed); the free Personal plan has no market data | Real time | Terms s.2(a): live market data cannot be displayed to the public; the access token expires at 6 AM daily and login must be manual | Rs 0 unless you want a private owner view | Cannot feed the public site under any plan |
| Own web address (optional) | Porkbun .in USD 7.83 a year (about Rs 750); .com USD 11.08 a year (about Rs 1,065) | Not applicable | Renew yearly | About Rs 65 to 90 a month equivalent | Without it the address is yourname.github.io/bullion |
| Cloudflare Workers (not used) | Free: 100,000 requests a day, 5 scheduled triggers | Not applicable | Keeps secrets server-side if a paid feed is ever added | Rs 0 | Not needed in stage 1 |

**Expected monthly spend for the public site as built: Rs 0** (plus the optional domain).

## The choice: (a) free dated public demo now, or (b) an authorised real-time connector later

**(a) Free, dated, public demo (built and tested now).** The public site refreshes once a day. It
publishes what may lawfully be republished: the USD/INR reference derived from ECB data, the CBIC
tariff values, the dated duty rules and executability flags with their notifications, the MCX
contract calendar, the ICEGATE customs exchange rate (added each fortnight), and the two corridor replays. It
does not republish MCX or COMEX prices. Any visitor (you included, on stage) can type or load
today's prices in their own browser and see the full chain, labelled USER-ENTERED; nothing leaves
their device. Cost: Rs 0 a month. Risk: none from data rights.

**(b) Authorised real-time or delayed exchange data, later.** For the public site this needs
exchange licences, not just an API: an MCX data-vending permission (price not published) and a
CME licence (the "Public Website" category covers delayed and historical data only, about Rs 46,700
per period, period to confirm), plus a paid feed such as Databento Plus (about Rs 1.68 lakh a month)
if you want automation. Kite Connect (Rs 500 a month) is real time but its terms forbid public
display, so it can only power a private view for you.

**Recommendation: (a) now.** The educational value is in the duty base, the executability flags
and the replay, which are all public-law data. Ask MCX in writing for permission to show daily
settlement prices for education; if granted, one switch in config/sources.json publishes the
manual MCX snapshots you already upload, at no cost.
