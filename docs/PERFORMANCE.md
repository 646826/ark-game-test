# Performance and responsiveness

Clockwork Conservatory uses one adaptive Canvas 2D renderer and a small DOM interface. The primary performance objective is consistent interaction on mobile hardware without flattening the premium presentation on capable devices.

## Adaptive quality

The player can choose **Auto**, **High**, or **Balanced**.

Auto considers:

- viewport and physical Canvas size;
- device pixel ratio;
- reported device memory and logical CPU count;
- coarse-pointer/touch characteristics;
- Data Saver and effective network type;
- sustained draw cost measured only while the renderer is genuinely under load.

A strong device starts in High. Constrained hardware, a slow/Data Saver connection, or an oversized high-DPR surface starts in Balanced. Auto can downgrade High after sustained expensive frames, but a single garbage-collection pause, background interval, idle cadence, or DevTools stall cannot trigger a downgrade.

| Profile | Maximum DPR | Canvas pixel budget | Active | Ambient | Idle |
|---|---:|---:|---:|---:|---:|
| High | 2.0 | 2,800,000 | 60 FPS | 24 FPS | 10 FPS |
| Balanced | 1.5 | 1,350,000 | 30 FPS | 12 FPS | 6 FPS |

Balanced also reduces particles and dust, removes costly Canvas filters and shadows, disables backdrop blur and blend effects, and avoids decorative CSS animation on touch-heavy layouts.

## Event-driven rendering

The renderer does not run a permanent 60 FPS loop.

- Menu and map scenes contain no active Canvas puzzle and fully sleep after their initial invalidation.
- Reduced Motion draws only on state changes and clears animation queues immediately.
- Gameplay uses the active rate only while rotating, propagating power, showing effects, or responding to input.
- Recently active boards drop to the ambient rate and later to the idle rate.
- Hidden, frozen, paused, or discarded pages stop renderer and audio work.
- Resize work is coalesced through one animation frame.

## Bounded resources

- High particles are capped at 180; Balanced particles are capped at 84.
- Pending bloom/leak bursts are capped at 20.
- Lifecycle delivery uses a bounded ordered outbox.
- Hover hit-testing is coalesced to one animation frame and is disabled for touch pointers.
- HUD updates are event-driven rather than interval-driven.
- Audio scheduling stops when hidden, suspended, or disabled.
- Saves are serialized through one queue using an immutable cloned payload.

## Automated browser evidence

`npm run perf` builds the production package and validates:

1. a static mobile menu sleeps with no recurring Canvas frames;
2. a constrained 4 GB / 4-core phone profile selects Balanced under 2× CPU throttling;
3. a strong 8 GB / 8-core phone profile retains High;
4. desktop retains High;
5. Canvas pixel and draw-cost budgets;
6. input-to-render latency;
7. DOM and horizontal-overflow bounds;
8. a 72-cycle low-end mobile stress run with repeated rotations, undo, view movement, pause/resume, and orientation changes;
9. renderer queue bounds and measured heap growth;
10. first-menu and cumulative first-game network payload budgets, so hidden HD art cannot silently regress startup.

The current report is written to `artifacts/performance-report.json`. In the latest local Chromium run, the mobile menu used about 738 KiB encoded, the Balanced first-game path used about 881 KiB, and the High first-game path used about 1.06 MiB. Hidden map, gameplay, and victory images are promoted from `data-src` only when their screen becomes active. These measurements are local guardrails and must be complemented by physical-device profiling.

## Physical-device release targets

- common phones: responsive controls and stable 30 FPS or better during active effects;
- capable phones/tablets/desktops: 60 FPS target during direct interaction;
- first interactive screen under five seconds on the agreed throttled-network profile;
- no lost state through orientation, resize, background/foreground, or BFCache;
- no reproducible crash, timer growth, audio growth, DOM growth, or save corruption during a one-hour session;
- acceptable battery and thermal behaviour during a 20-minute mobile session.
