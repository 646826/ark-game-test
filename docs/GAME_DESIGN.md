# Game Design — Clockwork Conservatory

## Product promise

A calm, premium spatial puzzle for adult casual players: rotate one mechanism at a time, watch a living current travel through a miniature conservatory, and restore every flower without leaving an active leak.

## Core loop

1. Read the Sunwell source and the unlit network.
2. Rotate brass mechanisms clockwise.
3. Use immediate light, sound, bloom, and leak feedback to judge the result.
4. Connect every plant and seal every powered open endpoint.
5. Earn a one-to-three-star result based on moves, time, and hint use.
6. Restore the next chamber, unlock a specimen, or return for the Daily Bloom.

The standard game is untimed in the sense that no countdown causes failure. Time only contributes to optional mastery scoring.

## Modes

### Campaign

Three authored onboarding levels lead into deterministic, solver-verifiable generated boards. Each six-level group represents one conservatory chamber. Progress, stars, and specimens persist.

### Daily Bloom

A UTC date seed creates one shared puzzle per day. The best local score, streak, and optional Arkadium leaderboard result provide a recurring ritual.

### Zen Garden

A fresh deterministic board is created for a relaxed session. There is no pressure to maintain a streak or beat a shared score.

## Puzzle contract

- Active cells form a connected grid.
- The solved circuit is a tree, so the solution has no powered leak.
- Every plant is a leaf of the solved tree.
- The Sunwell and selected anchored mechanisms are fixed.
- The zero-rotation orientation is authoritative and validated by tests.
- The starting orientation is guaranteed not to be solved.
- Hints recommend a legal clockwise correction and never require a network service.

## Difficulty

Difficulty grows through board dimensions, holes, active-cell count, anchored mechanisms, and required rotations. It does not change during a level and is never coupled to monetization. Dense mobile layouts switch projection rather than shrinking targets below a useful size.

## Retention

- Visible chamber progress and total restoration.
- Five specimen unlocks.
- Daily seed, streak, best score, and optional leaderboard.
- Campaign stars and cumulative score.
- Short natural sessions with a clear next-level action.

## Monetization boundaries

- Interstitials occur only after completed campaign groups.
- Three hints are free per level.
- Additional hints may use a player-initiated rewarded ad.
- Missing, failed, or cancelled rewarded ads grant nothing in production.
- Difficulty does not manufacture failure before an ad or purchase prompt.

## Accessibility and comfort

- Touch, mouse, and keyboard support.
- DOM-based menus, controls, settings, tutorial copy, completion copy, and live announcements around the canvas.
- Clear non-color indicators for selection, fixed pieces, leaks, and tutorial targets.
- Reduced-motion and high-contrast modes.
- Auto/high/balanced/low rendering profiles.
- English required; Spanish, French, German, and Italian tables included for review.
