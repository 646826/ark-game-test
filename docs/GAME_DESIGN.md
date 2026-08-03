# Game Design: Clockwork Conservatory

## High concept

A clockmaker-botanist left behind a glasshouse whose irrigation machinery has fallen out of alignment. The player rotates beautifully machined garden mechanisms until the Sunwell energizes every plant through one sealed network.

The fantasy is not merely “connect the pipes.” Each move wakes a miniature mechanical garden: dark channels gain color, energy pulses travel through the network, gears turn, pollen drifts, flowers bloom, and the whole conservatory responds when the circuit becomes perfect.

## Audience and session shape

The game is aimed at adult casual puzzle players who value clarity, relaxation, mastery, and a daily ritual. A normal procedural level is intended to take roughly two to six minutes. There is no fail timer in the campaign, avoiding frustration while allowing score-focused players to optimize moves and completion time.

## First-session experience

The first three campaign levels are authored lessons rather than procedural boards. Each starts unsolved, highlights one adjustable mechanism, and completes with one clockwise turn.

1. **Wake the first bloom** — distinguishes the Sunwell, an adjustable channel, and a plant. Leak warnings stay hidden so the player learns only flow and reward.
2. **Seal the leak** — introduces the active red leak marker and teaches that a powered open channel must be aligned.
3. **Read the whole circuit** — introduces a branch, two plants, and visible anchored mechanisms that cannot turn.

Wrong tutorial selections do not consume moves. Keyboard focus starts on the glowing target, and localized coach text explains the current concept without requiring a separate help screen. Tutorial results do not train the adaptive skill profile, preventing assisted one-move lessons from causing an unfair difficulty jump.

## Core rules

1. Every active mechanism belongs to one hidden spanning network.
2. Clicking a non-fixed mechanism rotates its connections clockwise.
3. Power spreads only through mutually connected edges.
4. Active red markers show energy escaping from the currently powered network; the HUD reports these active leaks instead of cluttering the board with every disconnected edge.
5. The puzzle is complete when every mechanism and plant is powered and no connection leaks into empty space or a mismatched neighbor.

Every generated level is validated by applying its target rotations and running the same board analyzer used during play. A generated level that is already solved or has no meaningful moves is rejected.

## Modes

### Restoration Campaign

An endless chapter progression with themed environments. After the three guided lessons, difficulty grows gradually and is adjusted by the local Garden Director. The menu exposes completed circuits, progress through the current five-level chamber, and a collection of plant specimens unlocked at campaign milestones. An interstitial opportunity appears only after every third completed campaign level, before the next level starts.

### Daily Bloom

All players receive the same deterministic UTC puzzle for the day. Score is submitted automatically to an Arkadium leaderboard when supported. This creates a repeatable daily habit and makes leaderboard comparison meaningful.

### Zen Garden

A lower-pressure, untimed adaptive puzzle with a gentler configuration. It provides an accessible alternative for players who prefer relaxation over optimization.

## Garden Director and hinting

The adaptive system is intentionally local, fast, explainable, and privacy-preserving.

A compact skill profile tracks exponentially weighted move efficiency, seconds per active tile, hint usage, successful-level streak, and completed procedural levels. After a non-tutorial completion, these signals update a bounded rating. The next campaign puzzle maps rating plus progression to board dimensions, active-cell count, plant count, fixed-piece probability, and pre-solved probability.

The hint engine tests legal rotations and scores their effect on powered plants, powered tiles, and leaks. It prefers an immediately useful move. When no greedy improvement exists, it identifies a frontier or target-orientation correction, so the hint does not invent an impossible action.

Player-facing copy calls this feature **Garden Hint**. The technology label is intentionally kept out of the core button because the value is a fair, useful action—not the fact that an algorithm computed it. The response is normally available in milliseconds, with a visible thinking state for slow devices and accessibility.

## Reward and visual payoff

The solved state is a staged game event:

1. the final rotation settles and the full network becomes energized;
2. moving energy pulses traverse powered channels;
3. plants open and particles burst from their positions;
4. a radial conservatory glow and light rays emphasize the restored board;
5. the result card enters with stars, score, moves, time, daily status, and any newly collected specimen.

Reduced-motion mode keeps the state change and result information but shortens camera/ray movement.

## Retention loop

- **Immediate:** rotate, see flow, hear/see feedback, remove active leaks.
- **Level:** trigger the full restoration sequence and earn score/stars.
- **Session:** advance a five-level chamber and reveal the next specimen milestone.
- **Daily:** solve the shared puzzle and compare score.
- **Long term:** complete chapters, build the specimen collection, improve mastery, and encounter denser networks and new visual themes.

## Monetization principles

- Never interrupt an active puzzle with an ad.
- Interstitials occur only between completed campaign groups.
- After three free hints, a rewarded ad can grant one additional optional hint.
- Rewarded failure, cancellation, or missing SDK support grants nothing; only an explicit local debug flag can simulate success.
- Arena banners and prerolls remain controlled by Arkadium.
- No paywall, dark pattern, external purchase flow, or child-oriented economy.

## Future production expansion

The current release candidate contains onboarding, procedural campaign, a lightweight restoration track, specimen milestones, Daily Bloom, Zen, adaptive difficulty, and the complete victory payoff. A post-acceptance content pass can deepen—not replace—this foundation with fully illustrated restoration rooms, additional mechanism families, seasonal daily modifiers, achievements, daily streak rewards, Arkadium-approved cosmetics, and authored challenge chapters.
