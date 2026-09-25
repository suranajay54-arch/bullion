Drop MCX bhavcopy CSV files here (for example BhavCopyDateWise_20260924.csv), downloaded by you from
https://www.mcxindia.com/market-data/bhavcopy in a normal browser.

The daily job reads them, keeps only the bullion futures rows (GOLD, GOLDM, GOLDGUINEA, GOLDPETAL,
SILVER, SILVERM, SILVERMIC) and checks the columns. Because MCX display rights are not confirmed,
these prices are NOT published on the public site until you switch MCX-SETTLE.publicDisplay.allowed
to true in config/sources.json. Do not do that without written permission from MCX or a licensed vendor.
