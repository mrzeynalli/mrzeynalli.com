---
title: "CIBIM"
tagline: "A research terminal for US-listed stocks and ETFs — news scored by FinBERT, SEC filings, financials and price history, all in one place."
description: "CIBIM is a market research application covering ~10,800 instruments. It turns company news into a personal briefing around the tickers you follow, and keeps official filings, financials, earnings and price history one click away."
status: live
startDate: 2026-04-01
stack:
  - Next.js 16
  - React 19
  - TypeScript
  - Tailwind CSS 4
  - PostgreSQL 16
  - Python
  - FastAPI
  - FinBERT
  - ECharts
  - Expo (iOS)
liveUrl: https://cibim.app
featured: true
order: 40
relatedPosts:
  - cibim
---

CIBIM is the biggest thing I run. It covers roughly **10,800 instruments** —
every eligible common-equity listing and every fund in the Nasdaq screeners
(~5,400 stocks and ~5,200 ETFs), plus a curated set of world indices,
commodities, FX pairs and crypto.

The idea is simple: if you follow a handful of tickers, you should be able to
open one page and see what actually happened to them, with a link to the source
for every claim.

## What's in it

- **News with sentiment.** About ten recent stories per instrument from Yahoo
  Finance, each scored by a self-hosted FinBERT model. Only the scores get
  stored — never the article text.
- **Official filings.** SEC EDGAR 10-Q, 10-K, 8-K, 20-F, 40-F and 6-K, plus ten
  years of Companyfacts history for revenue, earnings, cash flow, EPS and
  dividends.
- **Financials and ratios.** Income statement, balance sheet and cash flow
  (annual and quarterly), mapped onto SEC XBRL tags.
- **Analyst context.** Nasdaq consensus, recommendation spread and 12-month
  price targets, plus the earnings calendar with consensus EPS.
- **Smart alerts.** Deterministic rules, not a model guessing: a material shift
  in news sentiment, a parsed SEC Form 4 insider *purchase*, an earnings date
  coming up, or a cash-flow-aware drawdown in your portfolio.
- **Price history.** Daily candles going back as far as the instrument goes —
  the S&P 500 to 1927, Apple to 1980 — with intraday down to one minute for the
  last 30 days.
- **Accounts.** Favorites, watchlists, saved research, portfolios and
  notifications, with export and deletion.

There's also an iOS app built with Expo.

## How it's put together

The web app is Next.js 16 on PostgreSQL. A set of scheduled Python jobs handles
all the ingestion — screeners, candles, news, filings, analyst data, FX rates —
and writes to Postgres. Two small services sit alongside: a FastAPI wrapper
around FinBERT for sentiment, and a capped WebSocket fan-out that gives browsers
live quotes without exposing any upstream connection.

PostgreSQL is the only canonical store for market history. The site's history
endpoint reads SQL directly and never calls an external provider at request
time.

## Where it stands

The application is live and running on real vendor data. It is **not** a paid
product yet, and deliberately so: charging users would first require a billing
provider, proper data-redistribution licensing for the Yahoo and Nasdaq feeds,
and a production privacy and security review. The current ingestion is
appropriate for a research prototype and I'm not pretending otherwise.

CIBIM is informational software — not an investment adviser and not a brokerage.
