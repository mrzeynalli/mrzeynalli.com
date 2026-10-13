---
author: Elvin Zeynalli
pubDatetime: 2026-04-15T12:00:00+03:00
title: "Building Portafel: A Research Terminal for 10,800 Instruments"
postSlug: portafel
featured: true
draft: false
tags:
  - Software Engineering
  - Financial Data
  - NLP
  - FinBERT
  - PostgreSQL
  - Next.js
  - Python
category: Automation
description: "Portafel covers ~10,800 stocks, ETFs, indices, commodities, FX pairs and crypto, turning company news into a personal briefing with filings, financials and price history alongside it. Here is how it is built and what was harder than expected."
---

**Project description**
- *Stack:* Next.js 16, React 19, TypeScript, PostgreSQL 16, Python, FastAPI
- *Live:* [portafel.com](https://portafel.com)
- *Project page:* [Portafel](/projects/portafel)

---

## The problem

If you follow ten or fifteen tickers, keeping up with them is annoying in a very
specific way. The news is on one site, the filings are on another, the financials
are behind a login somewhere else, and the price chart is on a fourth. None of
them agree on what a ticker symbol means.

Portafel is my attempt at putting all of that on one page, with a link back to the
original source for anything it claims.

## What it covers

Roughly **10,800 instruments**: every eligible common-equity listing in the
Nasdaq stock screener (~5,400), every fund in the Nasdaq ETF screener (~5,200),
plus a curated set of world indices, commodity futures, FX pairs and crypto.
Both screeners are downloaded live and archived, and membership refreshes on each
deploy.

For each one you get news, SEC filings, financial statements, valuation ratios,
analyst consensus, earnings history and calendar, insider purchases, and price
history going back as far as the instrument goes — the S&P 500 to 1927, Apple to
1980.

## Three things that were harder than I expected

### 1. Ticker symbols are not a namespace

`DASH` is DoorDash. `DASH` is also a cryptocurrency. Nothing in the data tells
you which one someone means.

The rule I settled on: display symbols form **one namespace across all markets**,
and listed companies win a contested ticker. So the Dash token becomes
`DASH-USD` while `DASH` stays DoorDash. Curated instruments take a `-USD`,
`-IDX`, `-CMD` or `-FX` suffix only on collision. Seeding order enforces it —
stocks are loaded first, so a colliding curated instrument falls back to the
suffixed form automatically rather than overwriting a real company.

This sounds like a detail. It is not. Get it wrong once and a user sees crypto
news on an equity page, which destroys trust in everything else on the screen.

### 2. Sentiment has to be cheap and local

Every instrument gets about ten recent stories, and they rotate constantly across
the universe. Sending that to a hosted LLM API would be both expensive and slow,
and it would mean shipping article text to a third party.

Instead there's a small FastAPI service wrapping **ProsusAI/finbert**, kept warm
in memory, running on CPU on loopback. Every 30 minutes a job:

1. marks near-duplicate headlines using PostgreSQL `pg_trgm` title similarity —
   the same story gets syndicated to six outlets and shouldn't count six times;
2. extracts article text with trafilatura, falling back to title and summary;
3. chunks to 512 tokens, scores each chunk, and averages into a per-article
   label and signed score;
4. aggregates a per-asset daily series that drives the sentiment badges and the
   chart pane.

**Only the scores are stored.** Article bodies are never persisted. That was a
deliberate call — it keeps the database small and sidesteps a whole category of
content-licensing questions.

The service is CPU-quota bounded so a nightly batch can't starve everything else
running on the same box.

### 3. Alerts should be boring

The alerts are deterministic rules, not a model deciding what's interesting:

- a material shift in FinBERT sentiment for an instrument you follow;
- a parsed SEC Form 4 transaction — and **only** transaction code `P` is labeled
  a purchase, because the other codes mean different things and getting this
  wrong would be actively misleading;
- an earnings date approaching;
- a cash-flow-aware drawdown in your portfolio.

Every external event links back to its own evidence. Peer comparisons work the
same way — they use exact SEC SIC codes and stored Companyfacts metrics, so no
model chooses or ranks the peers.

If someone acts on an alert, they should be able to see exactly why it fired.

## Architecture

The web app is Next.js 16 on PostgreSQL 16. Scheduled Python jobs do all the
ingestion and write to Postgres. Two small services sit alongside: FinBERT for
sentiment, and a capped WebSocket fan-out that gives browsers live quotes —
Binance public streams for supported crypto, Yahoo for everything else. Browsers
only ever connect to Portafel's own same-origin fan-out, and no trading key is
involved anywhere.

PostgreSQL is the single canonical store for market history. The history endpoint
reads SQL directly and never calls an external provider at request time. Daily
candles cover full listed history; one-minute bars are fetched in eight-day
slices across Yahoo's ~30-day retention and rolled up into five-minute views.

There's also an iOS app built with Expo.

## Where it stops

It's live, and it runs on real vendor data. It is **not** a paid product, and
that's deliberate.

Charging users would first require a billing provider, proper display and
redistribution licensing for the Yahoo and Nasdaq feeds, a production privacy and
security review, and a product/legal classification. The current ingestion is fine
for a research prototype and is not evidence of commercial redistribution rights.
SEC filings have clearer provenance, but their terms still need review.

I'd rather say that plainly than ship a paywall and find out later.

Portafel is informational software — not an investment adviser, not a brokerage.
Market data, news, estimates and generated text can all be incomplete or wrong.
