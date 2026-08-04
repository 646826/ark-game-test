# Security and Privacy Notes

- The game does not collect credentials or provide its own account system.
- It does not use clipboard, geolocation, camera, microphone, fullscreen, or external redirects.
- Gameplay state contains puzzle progress and settings only.
- Host analytics, persistence, ads, and leaderboard calls are isolated behind the Arkadium SDK adapter.
- Core gameplay remains available when those remote services fail.
- No player-supplied HTML is rendered.
- Save data is sanitized before use.
- Rewarded content fails closed in production.

Report security issues privately to the repository owner rather than opening a public issue containing exploit details.
