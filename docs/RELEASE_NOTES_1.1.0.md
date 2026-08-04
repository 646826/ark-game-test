# Release notes 1.1.0 — Adaptive living conservatory

Version 1.1.0 focuses on mobile speed, browser stability, immediate response, and a more living presentation without replacing the interactive board with static imagery.

## Presentation

- Added glass sheen and highlighted tile edges in High quality.
- Added staged aetherlight propagation, moving energy travelers, powered mechanism motion, impact pulses, progress flashes, plant sway, bloom petals, sparks, leak-seal droplets, and a richer victory flourish.
- Added restoration-driven environmental brightness and saturation.
- Added subtle high-quality menu lighting, progress shimmer, current chamber glow, and living mode-card accents.
- Increased mobile board use of vertical space while preserving HUD and toolbar safe areas.
- Improved menu opacity and text contrast after the original premium pass.
- Added animated score count-up and staggered stars on completion.

## Mobile and browser performance

- Added Auto, High, and Balanced render profiles.
- Added device/network quality selection and sustained-load adaptive downgrade.
- Capped physical Canvas allocation independently of device DPR.
- Added active, ambient, idle, and fully sleeping renderer states.
- Removed the periodic HUD timer and made UI updates event-driven.
- Coalesced hover hit-testing and disabled hover work on touch.
- Reduced expensive blur, blend, shadow, filter, and particle work on constrained/touch profiles.
- Optimized runtime backgrounds and responsive preload selection.

## Stability and response

- Added pointer capture, drag rejection, lost-capture recovery, and touch-safe interaction.
- Added immediate haptic and board feedback where supported.
- Added run tokens and navigation locks to reject stale asynchronous work and duplicate transitions.
- Serialized save writes and cloned payloads to prevent overlapping mutation.
- Bounded platform work during completion so a slow host cannot hold the victory UI.
- Added Page Lifecycle freeze/resume, visibility, BFCache, focus, resize, and orientation handling.
- Hardened Canvas, ResizeObserver, network-information, and browser capability fallbacks.
- Reduced Motion now clears and bypasses all renderer animation queues rather than merely shortening animations.

## Verification

- 828 deterministic gameplay assertions pass.
- Chromium responsive smoke matrix passes across desktop, 390×844, 320×568, 844×390, High Contrast/Reduced Motion, tutorial, victory, and level 36.
- Resize preservation and Reduced Motion renderer-sleep assertions pass.
- Performance guardrails pass for constrained mobile, strong mobile, desktop, static-menu sleep, input latency, and a 72-cycle low-end stress scenario.
- The GitHub Actions workflow is configured to run the smoke matrix in Chromium, Firefox, and WebKit after publication.
- Production build is approximately 605 KiB initial and 809 KiB complete, including source maps and report.
