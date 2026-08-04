# Release notes 1.2.0 — Illustrated production presentation

Version 1.2.0 replaces the remaining prototype-like presentation with a high-definition interactive art layer while keeping the deterministic puzzle, Arkadium integration, accessibility, and adaptive renderer intact.

## Visual production upgrade

- New 1600×900 and portrait ultra environment plates for menu, map, gameplay, and victory states.
- New reproducible transparent WebP art for detailed glass platforms, couplers, locks, leaks, source machinery, botanical cloches, map domes, crest, and reward chest.
- Cached high-resolution Canvas art for platforms, source pedestals, planters, and four topology-specific clockwork assemblies.
- Desktop cockpit with objective rail, resource bar, daily challenge, restoration progress, specimen collection, and engraved action controls.
- Richer brass, ceramic, glass, foliage, etched patterns, rivets, material highlights, ambient occlusion, animated aether travelers, and powered couplers.
- Distinct terminal, straight, elbow, and multi-way mechanism silhouettes so dense boards no longer look like repeated icons.
- Premium cloche specimens cross-fade between dormant and powered artwork while keeping the bloom transition dynamic.
- Refined menu, map, loading, pause, completion, typography, buttons, chamber domes, and decorative framing.

## Performance and stability

- High-definition art is raster-cached or pre-rendered rather than rebuilt from complex vector paths each frame.
- Auto quality resolves before first render; constrained devices keep the Balanced profile.
- Only core safety sprites load immediately on Balanced devices; the full illustrated set is loaded for High quality.
- Existing DPR and Canvas-pixel budgets, idle sleep, bounded effect queues, pointer safeguards, lifecycle handling, save serialization, and adaptive downgrade remain in place.
- Desktop side rails reserve actual projection space, so no board tile is hidden behind the interface.

## Measured release envelope

- Production package before source maps: 2,223,497 bytes (about 2.12 MiB).
- Complete `dist/` including source maps/report: 2,494,312 bytes (about 2.38 MiB).
- Mobile menu: 755,704 encoded resource bytes in the automated Chromium sample.
- Balanced first gameplay: 902,600 encoded resource bytes; High first gameplay: 1,085,996 bytes.
- Static menu: zero Canvas frames during the one-second sleep sample.
- Constrained/mobile/desktop draw-cost and input-latency guardrails pass; the 72-cycle stress run finishes with no DOM growth, overflow, or retained effect queues.

## Release validation

The release gate covers deterministic puzzles, build safety, desktop/mobile layouts, resize preservation, reduced motion, high contrast, victory flow, and adaptive performance. Physical iPhone Safari, Android Chrome, Arkadium Sandbox, and one-hour soak testing remain publishing gates rather than repository claims.
