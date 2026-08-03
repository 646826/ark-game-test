# Release Notes — 0.2.0 Publishing Candidate

## Player experience

- Added three authored, localized, interactive onboarding levels.
- Added target coaching, wrong-selection recovery, and keyboard-first tutorial focus.
- Enlarged board use of the viewport and improved powered/unpowered contrast.
- Added endpoint ports, active-leak visualization, hover feedback, and clearer anchor badges.
- Changed player-facing “AI Hint” to “Garden Hint.”
- Added staged victory glow, camera emphasis, light rays, particles, bloom transformation, and animated result entry.
- Added chamber restoration progress and five collectible plant specimens.
- Added specimen unlock messaging to campaign results.
- Smoothed the difficulty transition from guided lessons to the first procedural board.

## Platform safety

- Added a bounded ordered lifecycle outbox for late Arkadium SDK connection.
- Added an automated browser test for late `onTestReady`, `onGameStart`, and `onLevelStart` replay.
- Changed successful round analytics from `No_Moves` to `Completed`.
- Rewarded hints now fail closed when the API is missing or the ad fails/cancels.
- Local reward simulation is available only with `debug=1&devReward=1`.
- Duplicate lifecycle pause/resume callback registration is guarded.
- Clean completions clear the persisted active run; snapshots interrupted during the final flourish resume as completion.

## Verification

- Strict TypeScript and static production checks pass.
- Seven core test groups pass, including all authored tutorials.
- 240 procedural levels remain deterministic and solution verified.
- 100 Garden Hint samples remain legal and useful.
- Browser smoke covers desktop, portrait, 2:1 landscape, victory, result, persisted completion cleanup, overflow, and late SDK behavior.
- Initial payload remains 202.6 KB uncompressed; total build 377.1 KB.
