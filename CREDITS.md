# Credits and Asset Provenance

## Product and implementation

Clockwork Conservatory's game design, puzzle model, TypeScript runtime, Canvas renderer, user interface, synthesized audio, automated tests, and documentation are original project work for the `646826/ark-game-test` repository.

## Visual assets

The greenhouse concept images used during the 0.3.0 art direction pass were generated for this project with OpenAI image generation on 2026-08-04. They were then cropped, recomposed, blurred, color graded, darkened, resized, and encoded locally as WebP backdrops. The shipped runtime does not contact an image-generation service.

| Shipped file | Purpose | Local production treatment |
|---|---|---|
| `public/assets/atrium-desktop.webp` | Menu atmosphere | Edge reconstruction, compositing, color grade, blur, vignette |
| `public/assets/garden-desktop.webp` | Landscape gameplay atmosphere | UI-free edge reconstruction, compositing, blur, teal grade |
| `public/assets/garden-portrait.webp` | Portrait gameplay atmosphere | Crop from cleaned environment, resize, blur, vignette |
| `public/assets/map-desktop.webp` | Restoration map atmosphere | Edge reconstruction, compositing, blur, grade |
| `public/assets/victory-desktop.webp` | Completion atmosphere | Edge reconstruction, compositing, glow treatment, grade |

All foreground mechanisms, tiles, pipes, energy, flowers, leaks, particles, highlights, shadows, ornaments, and icons are rendered procedurally by the game at runtime.

## Audio and typography

- Audio is synthesized with the Web Audio API after the player's first interaction. No music or sound files are shipped.
- The interface uses browser/system fonts and Georgia. No font files or commercial typefaces are distributed.

## Third-party services and marks

The game loads the official Arkadium Game SDK v2 only when available in an Arena context. Arkadium and related marks belong to their respective owner. This repository does not include Arkadium proprietary source code.

No third-party art packs, tracking SDKs, remote fonts, account systems, or runtime AI services are included.
