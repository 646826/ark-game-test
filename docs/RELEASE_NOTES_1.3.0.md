# Release notes 1.3.0 — Cinematic interactive board

Version 1.3.0 replaces the remaining vector-dominant board presentation with an independent, high-detail cinematic runtime art system. The puzzle is still fully procedural and interactive: every platform, regulator, pipe, port, source, plant, lock, leak, selection state, power route, and particle is assembled from live game state rather than a baked screenshot.

## Visual architecture

- Four 1024-pixel isometric platform variants use project-owned glasshouse texture, physical extrusion, dark cast-metal sides, multi-stage brass bevels, engraved tracks, rivets, wear, and contact shadow.
- Four topology-aware regulator sprites cover terminal, straight, elbow, and junction mechanisms. Their painterly brass rings are derived from the project’s ultra-quality concept plate and rebuilt over independent plinths, sockets, secondary gears, screws, patina, and glass recesses.
- A new physically shaded pipe and dark coupler system carries live aetherlight. Brass shells remain static while cyan outer light, white core light, bridge flow, endpoint glow, and traveler particles are drawn from the current solved network.
- The Sunwell, five powered/dormant specimen pairs, active leak, and lock are separate transparent assets with live glow, bloom, warning, and feedback layers.
- Adjacent platforms now retain a deliberate physical gap. Independent bridge pieces connect only mutually aligned ports, making the network easier to read and the board feel constructed rather than printed.
- High mode reveals a brighter, more detailed glasshouse environment with local teal and warm-gold light, while Balanced preserves the lighter procedural path.

## Sharpness and material quality

- Runtime artwork is generated at 360–1024 pixels per element and downsampled with high-quality Canvas filtering.
- Platform variety prevents the repeated-tile look of the previous board.
- Plant matte cleanup removes screenshot backplates and cyan edge contamination while preserving petal, leaf, pot, and pedestal detail.
- Gold outlines were replaced with dark body edges, bronze mid-bevels, and restrained hairline highlights.
- Powered channels use a three-layer cyan/white energy treatment instead of a single white line.
- Selection, hint, source-orbit, regulator-dial, pollen, impact, and completion effects remain live and motion-responsive.

## Performance architecture

High-detail sprites are not redrawn individually on every animation frame. After a real board state change, the renderer assembles the heavy illustrated shell into a DPR-aware offscreen cache. Normal frames then draw one cached board image plus lightweight live energy, selection, source orbit, regulator dial, pollen, particles, and victory effects.

- Static high-quality frame cost is typically below 1 ms in the local Chromium guardrail.
- The cache is invalidated only by puzzle state, rotation, quality, viewport, theme, or asset changes.
- High-mode tile rotations and view changes snap the static shell immediately and use impact/light feedback rather than repeatedly compositing dozens of large transparent images.
- Current-puzzle assets are selected by actual platform variants, mechanism topologies, fixed state, and specimen kinds; unused cinematic sprites are not requested for the first board.
- High-mode assets are prepared before gameplay is exposed, preventing the visible procedural-to-cinematic pop-in present in earlier builds.
- Balanced mode continues to use the compact procedural renderer and avoids the cinematic network payload.

## Reliability and QA

- `npm run art:check` validates transparent RGBA content, minimum dimensions, tonal entropy, edge detail, colour diversity, and a 4.2 MB complete cinematic-pack ceiling.
- `npm run cinematic:smoke` verifies that High mode requests the independent assets, reaches cinematic mode, settles its cache, and remains under the cached-frame cost threshold.
- The normal responsive smoke matrix waits for cinematic readiness in High scenarios before capturing evidence.
- Performance guardrails retain separate payload budgets for Balanced and High, with High capped at 3.6 MB cumulative first-game resources.
- Existing deterministic, mobile, compact, landscape, resize, reduced-motion, high-contrast, victory, memory, and 72-cycle stability checks remain in place.

## Package

The complete production package remains below Arkadium’s public 15 MB initial and 100 MB total limits. Balanced first gameplay remains close to 1 MB encoded in the automated local profile; High gameplay loads approximately 2.7 MB encoded, including the current-puzzle cinematic art pack.
