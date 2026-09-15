---
author: Elvin Zeynalli
pubDatetime: 2026-01-22T12:00:00+03:00
title: "The Stop Loss Was the Expensive Part: Backtesting Polymarket's 15-Minute BTC Markets"
postSlug: polymarket-backtesting-environment
featured: true
draft: false
tags:
  - Quant Trading
  - Prediction Markets
  - Backtesting
  - Market Microstructure
  - Python
category: Quant Research
description: "Four ways a prediction-market backtest quietly lies to you, the recorder built to avoid them, and one clear finding: adding a stop loss made every variant of the strategy worse without changing which side was right."
---

**Project description**
- *Stack:* Python 3.13, WebSockets, Zstandard, Parquet, DuckDB, SQLite
- *Live:* [polymarket.cibim.app](https://polymarket.cibim.app)
- *Project page:* [Polymarket BTC Backtester](/projects/polymarket-backtester)

---

Polymarket runs BTC Up/Down markets that open and settle every 15 minutes. The
strategy family is obvious enough that everyone tries it: when one side crosses
some threshold — say 0.85 — buy it and hold to settlement.

Testing that idea properly turned out to be much harder than having it.

## Four ways this backtest lies to you

**1. The signal price is not a tradable price.** A midpoint of 0.80 in a
0.78/0.82 book cannot be bought. Every trigger has to be evaluated on the
executable side: the ask for entries, the bid for exits. Using the midpoint gives
you a strategy that trades at prices nobody was offering.

**2. Reaching a trigger is not paying it.** If the ask is already past your
trigger when the entry window opens, you fill at that higher price, not at the
trigger. This matters enormously for binaries, because a contract bought at *p*
must settle in your favour *p* of the time just to break even. A 0.85 trigger
that actually fills at 0.89 needs **four more percentage points of accuracy** to
stand still. So the size-weighted average entry price and the break-even rate it
implies get reported right next to the win rate.

**3. The exit happens exactly when liquidity disappears.** A stop-loss price is
reached during a directional move — which is precisely when quotes get pulled and
every other holder is hitting the same bids. A backtest that assumes the stop
fills at the stop price is measuring a strategy nobody can trade.

**4. Settlement is where the P&L is.** The winner decides every trade's outcome,
so if you don't have an authoritative resolution you need a defensible derived
fallback, and you need to say which one you used.

## What the recorder does

The collector discovers each new 15-minute market through multi-signal Gamma
discovery with confidence scoring, mapping labels to outcome tokens explicitly
and quarantining anything ambiguous. It subscribes to public Level-2 and trade
messages for both outcome tokens with overlapping current/next-market
subscriptions, and records Polymarket's Binance and Chainlink BTC reference
prices on separate streams.

Every payload is preserved exactly — raw text or reversible base64 — in
append-only Zstandard JSONL with crash recovery, atomic close and SHA-256
manifests. The receive path captures UTC and monotonic time before enqueueing and
does no REST work, no database writes and no per-event logging.

Normalization into versioned Parquet is keyed by raw path and hash in SQLite, so
it's safe to rerun, and the original raw files always remain the source of truth.

### The boundary that matters most

There is **no authenticated client, no wallet configuration, no signing code and
no order-submission function anywhere in the repository.** The collector uses
public endpoints only. Orders and fills exist solely inside the offline
simulator. No credential environment variables exist at all.

A recorder that could also trade is a different and much riskier piece of
software. Keeping the two apart isn't a limitation — it's the point.

## The finding

Over **167 eligible episodes** (entry window minutes 10–14, favoured side, $100
per market, base realism), with a 0.85 trigger:

| variant | trades | net | win rate | side correct | avg entry | break-even |
|---|---:|---:|---:|---:|---:|---:|
| ceiling 0.95, **no stop** | 128 | **+47.23** | 90.6% | 90.6% | 0.8908 | 89.1% |
| ceiling 0.95, 0.75 stop | 128 | −64.60 | 65.6% | 90.6% | 0.8908 | 89.1% |
| ceiling 0.95, stop armed from 13 | 128 | −74.56 | 71.1% | 90.6% | 0.8908 | 89.1% |
| ceiling 0.95, stop armed from 14 | 128 | −61.86 | 76.6% | 90.6% | 0.8908 | 89.1% |
| ceiling 0.86, no stop | 87 | −7.99 | 86.2% | 86.2% | 0.8517 | 85.2% |
| ceiling 0.86, 0.75 stop | 87 | −25.37 | 52.9% | 86.2% | 0.8517 | 85.2% |

**The stop is the expensive part.** Every row with a stop is worse than the same
row without one, by $17 to $112 on identical entries.

Look at the `side correct` column: it never moves. The stop changes nothing about
which side was right. But the win rate collapses from 90.6% to 65.6%, and that
gap *is* the stop — a quarter of the entries that were on the eventual winner got
sold at a loss before settlement.

**Arming it later doesn't rescue it.** Delaying to minute 13 or 14 raises the win
rate (65.6% → 76.6%) simply because fewer positions get stopped at all. The ones
that do fire have no time left to recover and hit the book at its thinnest. Both
are still worse than not stopping.

**The ceiling sets the price, and the price sets the bar.** The trigger was 0.85
in every row, but a five-cent ceiling let the size-weighted fill drift to 0.8908,
where 89.1% accuracy merely breaks even. A one-cent ceiling held it at 0.8517 for
an 85.2% bar. The loose ceiling wins on net here — but it wins by 1.5 points over
its own break-even, which at this sample size is not a margin at all.

Compounding amplifies whichever is true rather than changing it: the 0.86-ceiling
hold took $100 to $95.79 (−4.2%, 60% peak drawdown), while the 0.95-ceiling stop
variant took it to $37.36 (−62.6%, 80% drawdown). Read the drawdown column first.

## How much to trust this

Not very much yet, and it's worth saying why.

The sample is a day or two of markets. More importantly, **these figures moved
substantially when the execution model was corrected — one variant reversed
sign.** That is the honest measure of how much a conclusion here depends on
assumptions that public data cannot settle.

Other limits I'd want closed before believing any of it:

- **Taker only.** Resting a limit order at the trigger instead of crossing the
  spread is a materially different strategy. Public Level-2 data cannot prove
  queue position, so the maker path stays explicitly experimental and the default
  engine rejects it.
- **No competing-order model.** Matching-engine races, hidden liquidity and
  exchange rejects are represented only by haircuts.
- **Derived resolution.** Winners currently come from the terminal book and
  reference price rather than an authoritative settlement feed. Recording
  resolutions in the collector would remove that dependency.

The direction of the stop-loss result is strong enough that I believe it. The
magnitudes are hypotheses.

## The dashboard

There's a read-only web dashboard on the archive. Pick a market and you get the
UP/DOWN bid, ask, midpoint and spread paths; click any point on the chart and it
reconstructs both full order books at that instant alongside the public trades
and BTC reference prices.

The backtest tab runs the parameter sweep across every recorded market — entry
price, entry window, optional stop with an arming minute, side, fixed or
compounding stake, execution-realism preset and entry policy. Orders walk the
reconstructed ladder, so **size the book could not absorb is reported as unfilled
rather than silently filled**. Runs are queued one at a time, because each one
replays every recorded book state of every selected market.
