# Starlight Relay

**Playable URL:** https://646826.github.io/ark-game-test/starlight-relay/

Starlight Relay is published as a generated static release under `public/starlight-relay/`. The existing Clockwork Conservatory game remains at the repository root.

## Source binding

- Private source repository: `646826/arkadium-game-factory`
- Source path: `apps/starlight-relay`
- Verified source commit: `9e1a39bc1a86267b7afe9e3b8cc90e7e3cf48643`
- Source workflow run: `31186053332`
- Source artifact ID: `8996763764`
- Source artifact ZIP SHA-256: `495490d2116cbc0819d79c08506a962f0d046efacd3aef7d02d883ccecf04d18`

The public build uses the exact game application bytes from that verified artifact, with the bundled Phaser module replaced by the pinned Phaser `4.2.1` jsDelivr browser runtime. The adapted application passed a Chromium smoke test before publication: the page reached ready state, created a canvas, started a run, displayed Energy, and emitted no console or page errors.

## Reproducible public build

The checked-in JavaScript parts under `public/starlight-relay/.bundle-parts/` are concatenated by `scripts/build.mjs`. The build fails unless the final JavaScript SHA-256 is:

```text
603e16eebb7c4ddcd0ea4fe79bd5b38f8e2caa4804f7458ec302901514f17637
```

The part directory is removed from `dist/`; GitHub Pages receives only the final JavaScript, CSS, HTML, metadata, and `.nojekyll` files. Source maps and private repository files are not published.

The Pages workflow verifies the existing root game, every local Starlight asset, the pinned Phaser runtime, `build-info.json`, and a headless Chromium boot before it records the URL as verified.
