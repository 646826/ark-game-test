# Game Design: Clockwork Conservatory

## High concept

A clockmaker-botanist left behind a glasshouse whose irrigation machinery has fallen out of alignment. The player rotates beautifully machined garden tiles until the source can energize every plant through one sealed network.

The core fantasy is not merely “connect the pipes.” Each move wakes a miniature mechanical garden: channels glow, gears turn, pollen drifts, and flowers bloom. The visual transformation is the reward.

## Audience and session shape

The game is aimed at adult casual puzzle players who value clarity, relaxation, mastery, and daily ritual. A level is readable immediately and normally takes two to six minutes. There is no fail timer in the core campaign, avoiding frustration while allowing score-focused players to optimize.

## Core rules

1. Every active tile belongs to one hidden spanning network.
2. Clicking a non-fixed tile rotates its connections clockwise.
3. Power spreads only through mutually connected edges.
4. The puzzle is complete when every tile and plant is powered and no connection leaks into empty space or a mismatched neighbor.

Every generated level is validated by applying its target rotations and running the same board analyzer used during play. A level that is already solved or has no meaningful moves is rejected.

## Modes

### Restoration campaign

An endless chapter progression with themed environments. Difficulty grows gradually and is adjusted by the AI Garden Director. An interstitial opportunity appears only after every third completed campaign level, before the next level starts.

### Daily Bloom

All players receive the same deterministic UTC puzzle for the day. Score is submitted automatically to an Arkadium leaderboard when supported. This mode creates a repeatable daily habit and makes the leaderboard meaningful.

### Zen Garden

A lower-pressure, untimed adaptive puzzle with a gentler configuration. It provides an accessible alternative for players who prefer relaxation over optimization.

## AI Garden Director

The AI is intentionally local, fast, explainable, and privacy-preserving.

A compact skill profile tracks:

- exponentially weighted move efficiency;
- seconds per active tile;
- hint usage;
- successful-level streak;
- completed level count.

After a completion, these signals update a bounded rating. The next campaign puzzle maps rating plus progression to board dimensions, active-cell count, plant count, fixed-piece probability, and pre-solved probability. New players receive learnable boards; efficient players reach denser networks sooner.

The hint engine tests legal rotations and scores their effect on powered plants, powered tiles, and leaks. It prefers an immediately useful move. If no greedy improvement exists, it identifies a frontier or target-orientation correction, ensuring the hint never stalls or invents an impossible action.

The hint response is normally computed in a few milliseconds. A visible “thinking” state exists to satisfy slow-device and accessibility expectations, and the game never waits on a remote model.

## Retention loop

- Immediate: rotate, see flow, hear/see positive feedback.
- Level: restore a chamber and earn a score/stars result.
- Session: advance the chapter and receive a new adaptive board.
- Daily: solve the shared puzzle and compare score.
- Long term: build campaign score and mastery while visual themes change every five levels.

## Monetization principles

- Preserve trust: no ad interrupts an active puzzle.
- Interstitial: only between completed chapter groups.
- Rewarded: after three free hints, initiated by the player for one additional hint.
- Arena banners and prerolls remain controlled by Arkadium.
- No paywall, dark pattern, external purchase flow, or child-oriented economy.

## Future production expansion

The current game is a complete vertical slice with endless procedural play. A post-acceptance content pass could add authored tutorial beats, restoration metagame rooms, more plant silhouettes, seasonal daily modifiers, achievement badges, and Arkadium-approved Gems cosmetics without changing the deterministic puzzle core.
