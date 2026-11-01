---
author: Elvin Zeynalli
pubDatetime: 2026-11-01T12:00:00+04:00
title: "Learning to Trade Bitcoin Perpetual Futures with Recurrent PPO"
postSlug: rl-btc-perpetual-futures
featured: true
draft: false
tags:
  - Reinforcement Learning
  - Quant Trading
  - PPO
  - LSTM
  - Bitcoin
  - Perpetual Futures
  - Python
category: Quant Research
description: "A recurrent PPO agent chooses a short, flat, or long Bitcoin perpetual position every hour. Retrained annually and evaluated over five and a half years, it stays profitable in every calendar year and outperforms buy and hold and established technical rules on a risk adjusted basis."
---

**Project description**
- *Authors:* Elvin Zeynalli and Altug Tanaltay, Sabanci Business School
- *Language:* Python
- *Libraries:* PyTorch, numpy, pandas
- *Project type:* Deep reinforcement learning, optimal trading
- *Data source:* BitMEX XBTUSD hourly prices, volume, and funding, 2017 to 2026

---

Financial markets are nonstationary, and patterns that forecast returns in one period rarely persist into the next. Markets nevertheless pass through recognizable conditions that last for some time. This suggests that a trading agent can succeed by recognizing and adapting to the prevailing condition rather than by predicting prices.

This post presents a study that puts the idea to a test on Bitcoin perpetual futures. A recurrent agent, trained with proximal policy optimization (PPO), chooses a short, flat, or long position every hour and is rewarded for improving its risk adjusted performance. It is retrained every year on the data available at the time and evaluated on the following year, over five and a half years that include strong advances, a deep decline, and a record high followed by a sharp fall.

The question is whether a reinforcement learning (RL) agent can generalize across changing market conditions on data it has not seen. Averaged over ten random initializations, the agent reached an annualized Sharpe ratio of 1.39, compared with 0.53 for buy and hold and 0.78 for time series momentum, the strongest benchmark, and it remained profitable in every calendar year.

## Table of contents

## Why Learn the Decision Directly

Quantitative trading has traditionally relied on statistical models of prices. A process is specified for the evolution of prices, its parameters are estimated from history, and a trading policy is derived from the fitted model. A closely related approach first forecasts returns and then translates the forecast into a position through an additional rule. Both approaches separate the description of the market from the trading decision. A trade, however, is a sequence of decisions whose consequences unfold over time, and a forecast that is accurate over one horizon does not by itself determine whether a position should be opened, held, or closed.

RL removes this separation. An agent learns a decision policy by interacting with an environment, so the trading objective itself becomes the target of learning. This line of work goes back to Moody and Saffell, who trained recurrent trading systems directly against risk adjusted objectives. Later studies by Deng et al., Zhang, Zohren and Roberts, and Jiang et al. extended it with deep networks to futures and cryptocurrency portfolios.

The main obstacle lies in the nature of markets. When prices reflect available information, as Fama argued, predictable patterns are small and tend to disappear once exploited. Yet markets are not uniform over time. They pass through periods of steady advance, turbulent decline, and movement without a clear direction, and each condition tends to persist for a while, as the regime switching literature documents. An agent should therefore not aim primarily to predict the next price. It should learn to recognize the prevailing condition, hold an exposure that suits it, and adjust when the condition changes. The paper refers to this ability as trading instinct.

Bitcoin perpetual futures make this problem particularly demanding. These contracts trade continuously, allow long and short positions without an expiry date, and rely on periodic funding payments to keep their price close to the underlying asset. Studies of RL on perpetual futures remain few. Borrageiro et al. let the policy keep learning during evaluation, whereas Chun et al. use a single test period. Neither design shows whether annual retraining, followed by evaluation with fixed parameters, produces consistent results across several years in this market. That is the gap this study addresses.

## Problem Definition

The problem is single asset optimal trading of Bitcoin perpetual futures. Opening a long or short position corresponds to speculating that the price will rise or fall, with no date by which the position must be closed. The account equity is measured in US dollars and changes in direct proportion to the price return and the chosen exposure, while a flat position holds no exposure.

The market is assumed to be frictionless, so positions are opened and closed at the hourly closing price. This isolates the central question of the study, namely whether the agent can learn a profitable sequence of trading decisions across changing market conditions. All benchmarks are evaluated under the same assumption.

## Data

One minute bars were constructed from the official BitMEX public trade archive for XBTUSD from 13 May 2016 to 1 August 2026, together with all 11,153 realized funding settlements. The bars were aggregated into hourly bars labelled by the end of the hour, so every variable computed at time $t$ uses only information available at that time. Once the longest look back windows are filled, the usable sample contains 78,637 hourly observations from 12 August 2017 to 1 August 2026. The test period begins on 1 January 2021 and contains 48,936 hourly returns.

![Figure 1: Hourly XBTUSD closing price over the test period](../../assets/images/rl_btc_perpetuals/price.png)
*Figure 1: Hourly XBTUSD closing price over the test period.*

The market changed direction repeatedly and by large amounts. The price rose by 59.6 percent in 2021, fell by 64.2 percent in 2022, and more than doubled in both 2023 and 2024. It reached an all time high of 126,036 USD in October 2025 and then fell by 28.3 percent in the first seven months of 2026. Below, 2026* denotes this partial year.

| Year | Low (USD) | High (USD) | Return (%) | Volatility (%) | Max. drawdown (%) |
|---|--:|--:|--:|--:|--:|
| 2021 | 28,951 | 68,656 | 59.6 | 87.3 | 54.8 |
| 2022 | 15,616 | 47,962 | −64.2 | 64.2 | 67.4 |
| 2023 | 16,496 | 44,526 | 156.1 | 43.2 | 21.8 |
| 2024 | 38,721 | 108,359 | 120.7 | 53.1 | 32.4 |
| 2025 | 74,700 | 126,036 | −6.3 | 44.6 | 34.9 |
| 2026* | 58,145 | 97,598 | −28.3 | 45.0 | 40.4 |

## The Markov Decision Process

The trading problem is formulated as a Markov decision process (MDP). A state describes the environment at a decision time, an action changes the position, a transition advances the environment, and a reward evaluates the outcome. Because a finite set of market variables describes the market only partially, the agent acts on the history of observations $\mathcal{H}_t = (o_1, \dots, o_t)$, which it summarizes with recurrent memory.

### State

Bitcoin prices, volatility, and volume changed by large factors between 2017 and 2026, so every market variable is expressed relative to its own history, as a ratio, as a movement in units of recent volatility, or as a percentile rank within a trailing window. With $r_t=\ln(P_t/P_{t-1})$ the hourly log return,

$$
\mathrm{RV}_{k,t}=\frac{1}{k}\sum_{i=0}^{k-1}r_{t-i}^{2},\qquad
\sigma_{d,t}=\sqrt{24\,\mathrm{RV}_{672,t}},\qquad
m_{k,t}=\frac{\ln(P_t/P_{t-k})}{\sigma_{d,t}\sqrt{k/24}}.
$$

The realized variance $\mathrm{RV}_{k,t}$ is the mean squared hourly return over the last $k$ hours, $\sigma_{d,t}$ converts the variance of the last four weeks into a daily volatility, and the momentum $m_{k,t}$ measures the price change over $k$ hours in units of the typical movement over that horizon. A value of one corresponds to a movement of one standard deviation.

The state contains 120 market variables that describe the market at scales from one hour to one year.

| Group | Count | Horizons |
|---|--:|---|
| Recent returns | 45 | 0 to 44 hours back |
| Momentum | 12 | 3 hours to 26 weeks |
| Momentum ranks | 4 | 1 day to 13 weeks |
| Volatility ratios | 6 | 6 hours to 2 weeks |
| Volatility ranks | 8 | 1 day to 4 weeks |
| Volume ratios | 4 | 1 hour to 1 week |
| Volume ranks | 9 | 1 hour to 1 week |
| Position in range | 5 | 1 day to 1 year |
| Distance from high | 3 | 4 weeks to 1 year |
| Trend efficiency | 6 | 1 day to 13 weeks |
| Trend persistence | 12 | 1 week to 200 days |
| Funding | 6 | 1 week to 1 year |

Each variable is standardized with the mean and standard deviation of the training period and clipped to $[-5,5]$. The observation is

$$
o_t=\big(x_t,e(a_{t-1})\big)\in\mathbb{R}^{123},
$$

where $x_t$ contains the market variables and $e(a_{t-1})$ represents the current position with three indicators, of which only the active one equals one.

### Actions and Transitions

At every hour the agent chooses a target position $a_t \in \{-1, 0, 1\}$, corresponding to a short, flat, or long exposure equal to the equity of the account, and holds it for one hour. The return of the account and the evolution of its equity are

$$
R_{t+1}=a_t\left(\frac{P_{t+1}}{P_t}-1\right),
\qquad E_{t+1}=E_t(1+R_{t+1}), \qquad E_0=10{,}000\ \mathrm{USD},
$$

so a long position earns the percentage change of the price, a short position earns its negative, and a flat position earns nothing. The market evolves independently of the agent, whereas the position component of the state follows the chosen action deterministically.

### Reward

The reward favours returns that are high relative to their variability rather than profit alone. It is the differential Sharpe ratio (DSR) of Moody et al., which measures the contribution of the latest return to an exponentially weighted Sharpe ratio of the account. The first and second moments of the account returns are tracked as

$$
\begin{aligned}
\Delta A_t&=R_t-A_{t-1}, & A_t&=A_{t-1}+\eta\Delta A_t,\\
\Delta B_t&=R_t^2-B_{t-1}, & B_t&=B_{t-1}+\eta\Delta B_t,
\end{aligned}
$$

where $A_t$ and $B_t$ estimate the mean and the mean square of recent returns, and the adaptation rate $\eta$ sets how quickly older returns are forgotten. The reward is the derivative of the Sharpe ratio $A_t/\sqrt{B_t-A_t^2}$ with respect to $\eta$, evaluated at $\eta=0$,

$$
D_t=\frac{B_{t-1}\Delta A_t-\tfrac12 A_{t-1}\Delta B_t}
{\left(B_{t-1}-A_{t-1}^{2}\right)^{3/2}}.
$$

The first term of the numerator rewards a return above the recent mean, and, when the recent mean is positive, the second penalizes a return that raises the recent variance. The reward is therefore positive when the latest return improves the risk adjusted performance of the account and negative when it lowers it. The agent maximizes the expected discounted sum of these rewards with a discount factor $\gamma=0.98$, which gives an effective horizon of about 50 hours.

## Agent Architecture

The agent follows the recurrent PPO implementation of CleanRL, with separate networks for the policy and the value function, as recommended by Andrychowicz et al. The actor assigns probabilities to the three positions, and the critic estimates the discounted rewards expected from the current observation history. Each network processes the observation with a long short term memory (LSTM) layer, which learns what to retain or forget across observations, followed by a fully connected layer with hyperbolic tangent activation and a linear output layer. The recurrent memory of each network is carried from one hour to the next.

![Figure 2: Architecture of the recurrent actor and critic](../../assets/images/rl_btc_perpetuals/architecture.png)
*Figure 2: Architecture of the recurrent actor and critic.*

## Learning Algorithm

PPO, introduced by Schulman et al., alternates between collecting experience with the current policy and updating both networks from that experience. The quality of an action is measured by its advantage, the amount by which its outcome exceeded what the critic expected. Generalized advantage estimation computes it from the temporal difference errors $\delta_t$,

$$
\delta_t=D_{t+1}+\gamma V_\phi(\mathcal{H}_{t+1})-V_\phi(\mathcal{H}_t),\qquad
\widehat A_t=\delta_t+\gamma\lambda\widehat A_{t+1},
$$

where $\lambda=0.95$ controls how many future errors are accumulated, trading the low variance of a single error against the low bias of a long sum. The actor maximizes the clipped objective with an entropy bonus,

$$
J(\theta)=\frac{1}{|\mathcal B|}\sum_{t\in\mathcal B}
\left[\min\{\rho_t(\theta)\widetilde A_t,\,
\operatorname{clip}(\rho_t(\theta),1-\epsilon,1+\epsilon)\widetilde A_t\}
+c_H H\big(\pi_\theta(\cdot\mid\mathcal H_t)\big)\right],
$$

where $\mathcal B$ is a minibatch, $\rho_t(\theta)$ is the ratio between the probabilities of the chosen action under the updated policy and under the policy that collected the data, $\widetilde A_t$ is the standardized advantage, and $H$ is the entropy of the policy. The clipping with $\epsilon=0.2$ removes the incentive to change the probability of an action by more than about 20 percent on the basis of a single sample, and the entropy bonus encourages the agent to try different actions during training. The critic minimizes the squared error between its estimates and the targets $G_t=\widehat A_t+V_\phi(\mathcal{H}_t)$,

$$
L(\phi)=\frac{1}{2|\mathcal B|}\sum_{t\in\mathcal B}\big(G_t-V_\phi(\mathcal H_t)\big)^2.
$$

The training data are presented as one continuous path rather than as separate episodes. Eight copies of the environment traverse the path from evenly spaced starting points, so every update combines experience from different market conditions. Each update collects 64 consecutive hours from each copy and performs three epochs over four minibatches of complete copy sequences, replayed from the memory stored at the start of the collection.

Because the outcome of a single training run can vary considerably with the random initialization, as Henderson et al. show, ten agents are trained from different initializations. The reported PPO agent is the average of their separately evaluated results. During evaluation, every agent takes its most probable position, processes the preceding week of observations without trading to initialize its memory, and starts each test year flat.

## Walk Forward Evaluation

The agent is evaluated with an expanding walk forward design, in the form used by Gu, Kelly and Xiu. Each calendar year from 2021 to 2026 is a test year. Before each test year, the settings of the agent are chosen using only the preceding years, the agent is trained with these settings on all data from 12 August 2017 to the end of the previous year, and its parameters remain fixed while it trades. Each test year then becomes part of the training data for the following years, as it would in practice.

![Figure 3: Expanding walk forward design](../../assets/images/rl_btc_perpetuals/walk_forward.png)
*Figure 3: Expanding walk forward design.*

The settings chosen for every test year are the actor learning rate, the width of the networks, the entropy coefficient, and the adaptation rate of the reward, each at two levels, which gives 16 candidate configurations. Each candidate is trained three times for every validation year from 2019 to 2025, each time on the data before that year only, and its Sharpe ratio is recorded after every pass through the training data, up to 15 passes. The number of passes then follows the one standard error rule of Hastie et al., and the candidate with the highest mean minus one standard error is selected, which favours configurations that perform consistently across years.

| Test year | Width | $\eta$ | Passes | Selection Sharpe |
|---|--:|--:|--:|--:|
| 2021 | 128 | 1/120 | 10 | 2.79 |
| 2022 | 64 | 1/336 | 13 | 1.93 |
| 2023 | 64 | 1/336 | 13 | 1.80 |
| 2024 | 64 | 1/336 | 10 | 1.70 |
| 2025 | 128 | 1/336 | 12 | 2.17 |
| 2026* | 128 | 1/120 | 14 | 1.57 |

The choices were stable. The lower actor learning rate of $8.4\times10^{-5}$ and the higher entropy coefficient of 0.03 were selected in every year, and the one standard error rule shortened training below the limit of 15 passes in every year. All experiments ran on eight processor cores without a graphics processor. The 336 selection runs required 11.9 hours and the 60 final models a further 2.4 hours.

The agent is compared with widely used benchmarks on the same hours and under the same accounting, with signals computed from daily closing prices. Buy and hold keeps a long position throughout. The 50 day and 200 day moving average rules of Brock et al. are long above the average and short below it. Time series momentum, following Moskowitz et al., takes the sign of the return over the previous twelve months and rebalances monthly. The study also includes the moving average convergence divergence (MACD) rule, the relative strength index (RSI) rule, and a random policy simulated over 1,000 paths.

## Results

### Performance over the Test Period

The table summarizes performance from January 2021 to August 2026. CAGR is the compounded annual growth rate, and the Sharpe ratio is annualized with a zero risk free rate.

| Strategy | CAGR (%) | Sharpe | Max. drawdown (%) |
|---|--:|--:|--:|
| **PPO agent** | **89.7** | **1.39** | **64.6** |
| Buy and hold | 14.8 | 0.53 | 77.3 |
| 50 day moving average | 28.6 | 0.72 | 64.9 |
| 200 day moving average | 1.8 | 0.33 | 87.3 |
| Time series momentum | 33.5 | 0.78 | 64.4 |
| MACD | −5.0 | 0.21 | 66.3 |
| RSI | −16.2 | −0.50 | 66.4 |
| Random policy (median) | −10.9 | 0.00 | 79.9 |

The PPO agent outperformed every benchmark in growth and on a risk adjusted basis. Its maximum drawdown was smaller than that of buy and hold and similar to those of the 50 day moving average and time series momentum rules, so its higher growth was not obtained at the cost of larger losses than those of the strongest benchmarks. All ten individual agents achieved Sharpe ratios between 1.06 and 1.63, above that of every benchmark.

The agent traded actively and in both directions. It held a long position in 54.4 percent of the hours, a short position in 38.8 percent, and a flat position in the remaining 6.9 percent. It changed its position about 4.2 times per day and closed 55.9 percent of its trades with a profit. This win rate measures the share of profitable trades, not the accuracy of a forecast of the next price movement.

### Performance across Market Conditions

The yearly view matters most for the research question, because it shows whether the agent remains profitable as the market moves from one condition to another. In the figure, the equity of every strategy is rebased to 10,000 USD at the start of each year, and only buy and hold and time series momentum are drawn. Time series momentum stayed long throughout 2021 and 2024, so its dashed line coincides with buy and hold in those years. The tables below report every strategy.

![Figure 4: Equity by calendar year, rebased to 10,000 USD at the start of every year](../../assets/images/rl_btc_perpetuals/equity_by_year.png)
*Figure 4: Equity by calendar year, rebased to 10,000 USD at the start of every year.*

| Return (%) | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|--:|--:|--:|--:|--:|--:|
| **PPO agent** | **107.9** | **207.0** | **63.2** | **181.8** | **33.6** | **20.9** |
| Buy and hold | 59.6 | −64.2 | 156.1 | 120.7 | −6.3 | −28.3 |
| 50 day moving average | 131.3 | −48.6 | 118.9 | 31.2 | 7.5 | 11.1 |
| 200 day moving average | −67.1 | 85.1 | 45.3 | 41.6 | −28.9 | 24.0 |
| Time series momentum | 59.6 | 75.1 | −33.0 | 120.7 | −1.8 | 24.0 |
| MACD | −17.9 | −13.2 | 12.0 | 5.8 | −36.7 | 40.8 |
| RSI | −23.5 | 19.3 | −27.0 | −35.2 | −2.4 | −11.2 |

| Sharpe ratio | 2021 | 2022 | 2023 | 2024 | 2025 | 2026* |
|---|--:|--:|--:|--:|--:|--:|
| **PPO agent** | **1.19** | **1.90** | **1.35** | **2.14** | **0.87** | **0.94** |
| Buy and hold | 0.97 | −1.28 | 2.39 | 1.75 | 0.08 | −1.04 |
| 50 day moving average | 1.40 | −0.71 | 2.03 | 0.78 | 0.39 | 0.62 |
| 200 day moving average | −0.84 | 1.28 | 1.08 | 0.92 | −0.54 | 1.04 |
| Time series momentum | 0.97 | 1.19 | −0.71 | 1.75 | 0.18 | 1.04 |
| MACD | 0.21 | 0.10 | 0.48 | 0.37 | −0.80 | 1.53 |
| RSI | −0.45 | 0.71 | −1.21 | −1.74 | −0.11 | −0.87 |

The PPO agent was profitable in all six years, both when the price rose and when it fell. In 2022, when buy and hold lost 64.2 percent, the agent gained 207.0 percent. In 2025 and the first seven months of 2026, when the price fell by 6.3 and 28.3 percent, it gained 33.6 and 20.9 percent. It trailed buy and hold in 2023, the year of the strongest and least volatile advance, when it gained 63.2 percent against 156.1 percent. Across the 60 combinations of the ten agents and the six years, 59 were profitable. The sole loss was 7.4 percent for one run in 2021.

The benchmarks depended on the conditions they encountered. Buy and hold and the 50 day moving average rule gained strongly in 2023 but lost heavily in 2022. Time series momentum profited from the decline of 2022 but lost in 2023, when the direction of the market reversed. Every benchmark lost money in at least one year, and none had a positive Sharpe ratio in every year, whereas the Sharpe ratio of the PPO agent was positive in all six. The agent did not need to be the best strategy in every year to outperform over the complete period. What distinguishes it is that it remained profitable as the market moved from one condition to another.

## Conclusion

The study asked whether an RL agent can learn a trading policy that remains profitable as market conditions change, and whether such a policy generalizes to data it has not seen. Within the frictionless setting of the study, the answer is positive. The agent adjusted its exposure as new observations arrived while its learned parameters remained fixed within each test year, which separates responding to market information from retraining the model. The findings support learning trading decisions directly from a risk adjusted objective, although the experiment does not establish an advantage over models trained to forecast returns.

Several directions follow from here. Transaction costs and funding payments could be introduced into both the reward and the evaluation, which would also discourage frequent trading. Perpetual contracts provide a single realized history of limited length, so synthetic data and market simulators such as ABIDES could offer alternative price histories for training and testing. The agent could be compared with supervised networks that forecast returns and trade on their predictions, which would measure the benefit of learning the decision directly. Finally, ensembles of RL agents and multi agent frameworks that assign agents to different timeframes could show how short term and long term trading decisions interact.
