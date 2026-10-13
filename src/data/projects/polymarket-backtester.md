---
title: "Polymarket BTC Backtester"
tagline: "A recorder and replay engine for Polymarket's 15-minute BTC markets, built so a backtest can't quietly lie to you."
description: "A collector and backtesting environment for Polymarket's 15-minute BTC Up/Down markets: continuous public order book recording, deterministic replay, and execution-realistic simulation with a read-only web dashboard."
status: live
startDate: 2026-01-15
stack:
  - Python 3.13
  - WebSockets
  - Zstandard
  - Parquet
  - DuckDB
  - SQLite
  - systemd
  - Docker
liveUrl: https://polymarket.portafel.com
featured: true
order: 10
relatedPosts:
  - polymarket-backtesting-environment
---

Polymarket runs BTC Up/Down markets that open and settle every 15 minutes. This
project continuously records them, then lets you replay the recording and test
strategies against what the book actually looked like.

Two halves:

**The collector** discovers each new 15-minute market, subscribes to public
Level-2 and trade messages for both outcome tokens, and records Polymarket's
Binance and Chainlink BTC reference prices alongside them. Every payload is
preserved exactly in an append-only Zstandard archive, then normalized into
versioned Parquet for deterministic replay.

**The simulator** replays those archives with depth-sweeping fills, configurable
latency, versioned fees and settlement at resolution. Orders walk the
reconstructed ladder, so size the book could not absorb is reported as
*unfilled* rather than silently filled.

There's a read-only dashboard where you can pick a market, watch the UP/DOWN
bid/ask/spread paths, click any point to reconstruct both full order books, and
run a parameterised backtest across every recorded market.

## A safety boundary I'd call the most important design decision

There is **no authenticated client, no wallet configuration, no signing code and
no order-submission function anywhere in the repository**. The collector uses
public endpoints only. Orders and fills exist solely inside the offline
simulator. No credential environment variables exist at all.

## What it found

Testing a threshold-and-hold strategy — buy the favoured side when it crosses
0.85, hold to settlement — over 167 eligible episodes produced one clear result:

**the stop loss is the expensive part.** Every variant with a stop was worse than
the identical entries without one. The side-correct rate never moved (90.6% in
both cases) — the stop changes nothing about which side was right — but the win
rate collapsed from 90.6% to 65.6%. That gap is entirely positions that were on
the eventual winner and got sold at a loss before settlement. Arming the stop
later didn't rescue it.

Worth being honest about the sample: this is a day or two of markets, and the
numbers moved substantially — one variant reversed sign — when the execution
model was corrected. They're hypotheses, not measurements.
