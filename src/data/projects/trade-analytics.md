---
title: "Global Trade Intelligence"
tagline: "Interactive analytics over UN Comtrade data — what a country trades, with whom, how concentrated it is, and where it's comparatively strong."
description: "An analytics product built on UN Comtrade merchandise trade statistics, answering for any country what it trades, with which partners, how that has changed, and how dependent or diversified it is."
status: live
startDate: 2026-09-01
stack:
  - React 19
  - TypeScript
  - ECharts 6
  - Python 3.13
  - FastAPI
  - Polars
  - DuckDB
  - Parquet
  - SQLite
liveUrl: https://analytics.mrzeynalli.xyz/trade
featured: true
order: 30
relatedPosts:
  - trade-analytics
---

Pick a country and this answers: what does it trade, with whom, how much, how
has that changed, what does it depend on, how diversified is it, and where does
it look comparatively strong?

It's built on public statistics — mainly **UN Comtrade** merchandise trade data,
with IMF, Eurostat and World Bank filling specific gaps.

## The interesting parts

**Four sources, never added together.** Comtrade is the spine, but it runs
12–24 months behind. IMF ITG has headline totals with a 2–3 month lag. Eurostat
is the only source that can state the intra/extra-EU split. World Bank supplies
GDP and population for ratios. Each period is sourced from exactly one of them,
whole, and the response says which — because adding a Comtrade reporter to an
IMF country would double-count wherever both published. Eurostat also reports in
euro rather than dollars, so the interface leans on its *shares*, which are
currency-invariant.

**Comtrade truncates silently.** A response capped at exactly 100,000 records
comes back with no error flag. Any result hitting that number is treated as
truncated and subdivided deterministically — periods, then flows, then commodity
codes, then reporters — and recombined locally.

**A whole country costs about five API calls.** One request returns twelve
periods, every partner and the World aggregate together. Annual history from
2010 for a country is 5 requests; 36 months of monthly data is 7. The daily
budget is 450 calls with 50 held back for anything a user triggers directly.

**Nightly sync is source-aware, not TTL-based.** It asks Comtrade what was
recently republished, intersects that with the reporters held locally, compares
dataset checksums, and refreshes only the affected partitions. Historical years
that were never revised are never refetched.

## Architecture

```
UN Comtrade  →  raw cache (Zstandard JSON)
             →  Polars normalisation
             →  Parquet facts
             →  DuckDB queries
             →  FastAPI  →  React + ECharts
```

SQLite holds state and control (job queue, quota ledger, dataset versions),
Parquet holds the analytical facts, DuckDB is the query engine and Polars does
the transforms. No Docker here — it runs on systemd behind Nginx, matching how
the rest of this server is managed.

The backend has 155 tests, none of which touch the live API.
