# Test fixtures

`ecb-hist-90d-fixture-20260924.xml` is a reconstruction of the USD and INR values from the ECB
90-day reference-rate file for 10 to 24 Sep 2026, read on 25 Sep 2026. It is used so that the test
suite gives the same answer every day. It is not the raw ECB file and its SHA-256 is its own.

This README doubles as a deliberately invalid ECB input for test P04 (parse failure handling).
