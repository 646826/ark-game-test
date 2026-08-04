# Credits and asset provenance

## Original project art

All visual concepts, environmental treatments, specimen crops, UI ornament, procedural board rendering, and effects in this repository were created specifically for **Clockwork Conservatory: Bloom Circuit**.

The six high-resolution concept images under `artifacts/concepts/` were generated as original visual-development material for this project. The optimized runtime environmental images under `public/assets/` were derived from project-owned source plates and rebuilt into clean, UI-free scene layers. The reproducible scripts `scripts/generate_hd_assets.py`, `scripts/generate_ui_assets.py`, `scripts/generate_ultra_backgrounds.py`, `scripts/generate_cinematic_assets.py`, and `scripts/generate_cinematic_v3_assets.py` create the interface ornaments, glasshouse domes, reward chest, botanical crest, environmental plates, and independent transparent cinematic platforms, regulators, pipes, ports, plants, source, lock, and leak assets shipped by version 1.3.0.

No third-party game screenshots, trademarks, franchise characters, stock art, external fonts, or copied UI assets ship in the production build.

## Audio

Sound effects and ambient harmonic layers are synthesized at runtime with the Web Audio API. No external music or sound recordings ship with the game.

## Software

The implementation uses standards-based TypeScript, HTML, CSS, Canvas 2D, Web Audio, and browser APIs. TypeScript is the only development dependency.
