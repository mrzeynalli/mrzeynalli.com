---
author: Elvin Zeynalli
pubDatetime: 2026-09-02T12:00:00+03:00
title: "Four Sources That Must Never Be Added Together: Building a Trade Analytics Product"
postSlug: trade-analytics
featured: true
draft: false
tags:
  - Data Engineering
  - International Trade
  - DuckDB
  - Polars
  - Parquet
  - FastAPI
  - Data Visualization
category: Analytics
description: "Building analytics over UN Comtrade meant handling a source that lags two years, silently truncates responses, and has to be combined with three other datasets without ever summing them. Notes on the design decisions that made it work."
---

**Project description**
- *Stack:* React 19, TypeScript, ECharts 6, Python 3.13, FastAPI, Polars, DuckDB
- *Live:* [analytics.mrzeynalli.xyz/trade](https://analytics.mrzeynalli.xyz/trade)
- *Project page:* [Global Trade Intelligence](/projects/trade-analytics)

---

## What it answers

Pick a reporting country and the application answers: what does it trade, with
whom, how much, how has that changed, what does it depend on, how diversified is
it, and where does it look comparatively strong?

The metrics behind that are standard — HHI for concentration, RCA for
comparative advantage, CAGR for growth — so the interesting engineering is
almost entirely in the data layer.

## The four-source problem

UN Comtrade is the spine. It has everything with partner or product detail. It
also runs **12 to 24 months behind** for a reference year to fill in, which means
a product built on Comtrade alone can't tell you anything about this year.

So three other sources fill specific gaps:

| Source | Covers | Lag |
|---|---|---|
| **UN Comtrade** | Everything with partner or product detail | 12–24 months |
| **IMF ITG** | Headline goods exports/imports, totals only | 2–3 months |
| **Eurostat** | Intra/extra-EU split and BEC mix, EU-27 | ~6 weeks |
| **World Bank** | GDP, population, for ratios | annual |

And here is the rule the whole design hangs on: **the trade sources are never
summed.**

A period is sourced from exactly one of them, whole, and the response payload
says which. Adding a Comtrade reporter to an IMF country would double-count
wherever both published. So `/world/overview` is entirely Comtrade,
`/world/recent` is entirely IMF, `/world/europe` is entirely Eurostat.

Eurostat adds a second reason to keep them apart: it reports in **euro** while
everything else is in US dollars. No Eurostat value is ever added to another
source's value. The interface leans on Eurostat's *shares*, which are
currency-invariant, and clearly labels the euro figures that do appear.

Eurostat is also the only source that can state the intra/extra-EU split at all.
Comtrade sees the Union as 27 separate reporters with bilateral partners, so
reconstructing the split would mean summing 26 partners per country per period —
technically possible, and a great way to accumulate rounding error.

One visible consequence: at the time of writing IMF ITG held 2025 for 173
countries against Comtrade's 98, and monthly figures through June 2026. That's
why the landing page can state a more recent reading than the year its own
charts are drawn from. The alternative — hiding the recent number because the
detailed charts can't match it — seemed worse.

## Comtrade truncates silently

This is the bug waiting to happen. Comtrade caps responses at 100,000 records
and, when it hits that cap, **returns them with no error and no truncation
flag**. If you don't check, you get a plausible-looking answer that is quietly
missing data.

The handling: any result at exactly 100,000 records is *assumed* truncated and
subdivided deterministically — periods first, then flows, then commodity codes,
then reporters — with the pieces recombined and de-duplicated locally.

A few other behaviours worth knowing, all verified against the live API rather
than read from docs: the maximum is 12 periods per request (rejected explicitly
beyond that), omitting `reporterCode` returns every reporter, omitting
`partnerCode` returns every partner *plus* the World aggregate, and rate limiting
comes back as an HTTP 429 with a "try again in N seconds" message.

## Quota is a design constraint, not an afterthought

That "12 periods, every partner, plus World in one call" behaviour is what makes
the product feasible. A whole country costs single-digit API calls:

| Pack | Requests |
|---|---:|
| Annual 2010–2025 (totals + all partners + HS2 composition) | 5 |
| Monthly, last 36 months | 7 |
| HS4 for every chapter, 12 years | 1 |
| Global HS2 matrix for one year, both flows | 2 |

The daily budget is 450 calls, with 50 reserved for anything a user triggers
directly, so background backfill can never lock a visitor out.

The nightly sync is **source-aware rather than TTL-based**. It reads Comtrade's
`getLiveUpdate` for recently republished datasets, intersects that with the
reporters held locally, compares `datasetChecksum` and `lastReleased` against
stored state for anything ambiguous, and queues a refresh for only the affected
reporter/period partitions. Historical years that were never revised are never
refetched, and the cache is never wiped and rebuilt.

## Storage decisions

```
UN Comtrade  →  raw cache (Zstandard JSON)
             →  Polars normalisation + validation
             →  Parquet facts (ZSTD, dictionary encoded)
             →  DuckDB (column + partition pruning)
             →  FastAPI  →  React + ECharts
```

Roles are kept clean: **SQLite** for state and control (durable job queue, quota
ledger, dataset versions), **Parquet** for analytical facts, **DuckDB** as the
query engine, **Polars** for transforms.

Two choices worth explaining:

**Partitions stop at the reporter.** The layout is
`<dataset>/freq=<A|M>/reporter=<NNN>/part.parquet`, with `year` as a sorted
column rather than a directory. Partitioning by year too would make annual totals
two rows per file — the classic "millions of tiny files" failure. A single
reporter file is tens of kilobytes, matches the dominant access pattern (one
selected country), and DuckDB still prunes on `year` using row-group statistics.

**HS codes are strings, not integers.** Dictionary-encoded Parquet strings are as
compact as integers on disk and they remove an entire class of bug: HS chapter
`01` must never become `1`.

## No Docker here

The GDELT project on the same server is containerised. This one isn't, and that's
deliberate rather than inconsistent. This application needs a persistent data
directory, a long-running worker and a systemd timer — all of which the host
already manages natively for the other services on it. A container would have
added a layer without removing one.

It runs as systemd units behind Nginx, with the API key sent as a header rather
than a query parameter so it can't land in an intermediary's access log, and
every string reaching a log line or error payload passing through a redaction
function first.

The backend has 155 tests. None of them touch the live API.
