---
author: Elvin Zeynalli
pubDatetime: 2026-06-18T12:00:00+03:00
title: "Reading the World's News as a Risk Signal: A GDELT Observatory"
postSlug: gdelt-observatory
featured: false
draft: false
tags:
  - Data Engineering
  - GDELT
  - Geopolitical Risk
  - BigQuery
  - DuckDB
  - Data Visualization
category: Analytics
description: "GDELT machine-codes the world's news into structured events. Turning that into a country risk dashboard means resisting the urge to collapse everything into one number, and keeping a BigQuery bill from running away."
---

**Project description**
- *Stack:* React, TypeScript, ECharts, Express, DuckDB, BigQuery
- *Live:* [analytics.mrzeynalli.xyz/gdelt](https://analytics.mrzeynalli.xyz/gdelt)
- *Project page:* [Geopolitical Risk Observatory](/projects/gdelt-observatory)

---

## What GDELT gives you

GDELT monitors news worldwide and machine-codes it into structured records: who
did what to whom, where it happened, how cooperative or conflictive the action
was, and what the surrounding media tone looked like. It's free, global, and
goes back years.

That's a rare enough combination to be worth building on. This project tracks
**32 countries** and publishes a daily risk reading for each.

## The mistake I wanted to avoid

The obvious version of this dashboard shows one number per country: *risk*. It's
also wrong, in two ways.

**Raw event volume is not risk.** Countries differ enormously in media volume,
population, connectivity and reporting density. A country with dense English-
language coverage will always produce more coded events than one without. If you
rank by event count you are mostly ranking media attention.

**One number hides the question people actually ask.** "Is it bad?" and "is it
getting worse?" are different questions with different answers, and a composite
that averages them answers neither.

So the product separates three signals and shows all of them:

1. **Risk level** — current normalized severity.
2. **Risk momentum** — how quickly that level is changing.
3. **Risk anomaly** — how unusual today is *for this specific country*.

The anomaly is the one that does the real work. It's a z-score of log event
counts against up to eight prior observations of **the same weekday**. Comparing
Tuesdays to Tuesdays removes most of the weekly publishing cycle, and comparing a
country only to its own history removes the media-density problem entirely. A
quiet country having a genuinely strange day shows up; a loud country having a
normal day doesn't.

## The score

The composite blends five features:

```text
raw_risk = 0.30 × conflict intensity      (QuadClass 3–4 share)
         + 0.25 × negative Goldstein
         + 0.15 × 7-day event growth
         + 0.15 × negative media tone
         + 0.15 × positive activity anomaly
```

Growth and anomaly are clipped at three standard deviations. Conflict share,
Goldstein severity and tone are computed over a trailing seven-day aggregate,
while the event count stays daily — that keeps the score from swinging on a
handful of events in a sparse day without hiding current coverage.

The result maps to 0–100 using the 5th and 95th percentiles of the tracked panel's
last 90 days as robust anchors. **Those anchors are frozen after a calibration**,
so a later refresh doesn't silently rewrite what the previous 120 days meant. A
score you can't compare to last week's score isn't a monitoring signal.

Two things this is not: it is not a forecast, and it is not an estimate of
real-world incident probability. It's a relative signal for noticing where to
look.

## Confidence, stated separately

Every observation carries a coverage-confidence figure combining current-day
sample size with how much same-weekday history exists. It describes *measurement
coverage*, not correctness. Low-confidence readings stay visible, but they're
excluded from the biggest-movers ranking — otherwise the movers board fills up
with countries that had three events yesterday and five today.

## Keeping BigQuery from becoming a bill

GDELT lives in BigQuery, which bills by bytes scanned. A careless query over a
decade of global events is genuinely expensive, so the importer **fails closed**:

1. every run is a no-charge dry run unless `--execute` is passed explicitly;
2. queries are partition-bounded and split into chunks of at most seven days;
3. `maximum_bytes_billed` is capped at 5 GiB for every job;
4. all chunks are estimated *before* any chunk executes;
5. a local ledger refuses work above 10 GiB in a calendar month;
6. job IDs and BigQuery-reported billed bytes are recorded after every job,
   including during a partially failed refresh;
7. the scheduled refresh scans the latest eight days, not all 120.

The initial 120-day import estimated 1.10 GiB and BigQuery reported 1.11 GiB —
about one percent of Google's 1 TiB monthly on-demand allowance.

Worth noting the limit of application-level guards: that allowance belongs to the
billing account, and this app cannot know what other projects have already spent.
For a real hard boundary you want a dedicated sandbox project or a custom query
quota in Google Cloud. Billing budgets are alerts, not caps.

## Running it

React and ECharts on the front end, an Express API in a read-only Docker
container bound to loopback, Nginx with TLS in front. A systemd timer refreshes
daily with a short window for late-arriving corrections.

Only country/day/event-group aggregates are retained — never the raw GDELT event
archive — which keeps the 120-day DuckDB cache down to a few megabytes.

## One caveat on geography

Country attribution uses GDELT's `ActionGeo_CountryCode`: the geocoded location
of the *action*, which is not necessarily the nationality of either actor. A
summit about Country A held in Country B is coded to B. The map colours are
country-level signals only, since the current cache doesn't retain sub-national
metrics.

It's the kind of limitation that's easy to forget once the map looks convincing,
which is exactly why it's written down.
