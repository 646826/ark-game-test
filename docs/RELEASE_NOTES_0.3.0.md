# Release Notes 0.3.0 — Premium Conservatory

## Player-facing changes

- Rebuilt the complete presentation as a premium brass, glass, and botanical 2.5D conservatory.
- Added optimized greenhouse environments, dynamic lighting, layered tile materials, illuminated flow, pulse animation, leak fountains, bloom particles, and a stronger victory payoff.
- Added a responsive composition strategy: isometric dioramas where space permits and a larger readable top-down composition for dense portrait boards.
- Added a restoration-focused main menu with campaign progress, Daily Bloom, Zen Garden, specimens, streaks, best score, and a map.
- Added three guided tutorial boards and a locked target during assisted onboarding.
- Added five specimen looks, chamber naming, quality modes, reduced motion, high contrast, keyboard navigation, and five UI languages.
- Renamed player-facing AI language to **Garden Hint**. Hints are deterministic and local.

## Platform and reliability changes

- Upgraded the Arkadium adapter to SDK v2 and made `onTestReady` non-negotiable.
- Added a bounded lifecycle outbox so mandatory events preserve order if the SDK connects after gameplay becomes interactive.
- Enforced one `onGameStart` and one `onGameEnd` per page load.
- Added Arena pause/resume callbacks and tab-focus audio suspension.
- Added SDK local persistence and authenticated remote persistence with a standalone local fallback.
- Rewarded failure or absence grants no production reward; an explicit local debug flag is required for preview success.
- Added interstitial breaks only after completed campaign groups and optional rewarded hints only after free hints.
- Added daily leaderboard feature detection and posting.

## Quality gates

- Strict TypeScript with no unchecked indexing, unused locals, or implicit unsafe values.
- Property coverage over 234 deterministic generated puzzles plus all tutorials.
- Corrupted-save sanitation and save-size assertions.
- Browser smoke coverage for 1440×900 and 390×844 menu, gameplay, completion, dense boards, and a mocked Arkadium lifecycle.
- Build budgets enforced at 15 MB initial and 100 MB total.

## Known onboarding items

These require Arkadium-side access and are deliberately not represented as locally complete:

- Production App Insights application ID.
- Sandbox acceptance evidence with authenticated remote storage.
- Final ad cadence and subscriber behavior.
- Production leaderboard configuration.
- Native-speaker review of ES/FR/DE/IT strings.
- Real-device and one-hour soak sign-off.
