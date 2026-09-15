---
title: "Geopolitical Risk Observatory"
tagline: "A daily risk dashboard over the GDELT global news event database, separating how bad things are from how fast they're changing."
description: "A dashboard built on GDELT 2.0 event data that tracks geopolitical risk across 32 countries, deliberately separating risk level, risk momentum and risk anomaly rather than collapsing them into one number."
status: live
startDate: 2026-06-01
stack:
  - React
  - TypeScript
  - ECharts
  - Express
  - DuckDB
  - BigQuery
  - Docker
  - Nginx
liveUrl: https://analytics.mrzeynalli.xyz/gdelt
featured: true
order: 20
relatedPosts:
  - gdelt-observatory
---

GDELT machine-codes the world's news — who did what to whom, where, and in what
tone — and republishes it continuously. This dashboard turns that into a daily
risk reading for **32 tracked countries**.

## Three signals, not one

The thing I care most about here is that the product refuses to collapse
everything into a single number:

1. **Risk level** — current normalized severity.
2. **Risk momentum** — how fast that level is changing.
3. **Risk anomaly** — how unusual today is *for this specific country*.

That third one matters because raw event volume is not risk. Countries differ
enormously in media volume, population, connectivity and reporting density. A
busy news day in Germany and a busy news day in Azerbaijan are not the same
measurement. The anomaly signal is a z-score of log event counts against up to
eight prior observations of *the same weekday*, which also strips out the
weekday/weekend publishing cycle.

The composite score blends conflict share, negative Goldstein intensity, 7-day
event growth, negative media tone and the activity anomaly, then maps to 0–100
using the 5th and 95th percentiles of the tracked panel as robust anchors. Those
anchors are frozen after a calibration, so a later refresh doesn't quietly
rewrite the meaning of history.

It's a **relative monitoring signal** — not a forecast, and not an estimate of
real-world incident probability.

## Keeping BigQuery cheap

GDELT lives in BigQuery, which bills by bytes scanned, so the importer fails
closed by design:

- it's a no-charge dry run unless `--execute` is passed explicitly;
- every query is partition-bounded and split into chunks of at most seven days;
- `maximum_bytes_billed` is capped at 5 GiB per job;
- all chunks are estimated before any chunk runs;
- a local ledger refuses work above 10 GiB in a calendar month;
- the scheduled refresh scans the latest eight days, not the full 120.

The initial 120-day import came to 1.11 GiB — roughly one percent of Google's
1 TiB monthly free allowance.

## Running it

React and ECharts on the front, an Express API in a read-only Docker container
bound to loopback, Nginx with TLS in front. Only country/day aggregates are
retained — no raw GDELT event rows — so the 120-day DuckDB cache is a few
megabytes. A systemd timer refreshes daily with a short window for
late-arriving corrections.
