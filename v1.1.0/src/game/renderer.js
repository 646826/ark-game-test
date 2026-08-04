import { currentMask } from '../core/board.js';
import { detectDeviceSignals, fitDevicePixelRatio, resolveRenderProfile, shouldAutoDowngrade } from '../core/performance.js';
import { DIRECTIONS, EAST, NORTH, SOUTH, } from '../core/types.js';
const THEMES = [
    { glass: '#174c49', glassLight: '#2a7770', edge: '#7caea0', side: '#071f22', brass: '#b9843d', brassLight: '#f1ce79', aqua: '#83fff0', aquaSoft: '#1dd8c7', ink: '#042b2a', accent: '#ffd978' },
    { glass: '#294e3b', glassLight: '#4d7958', edge: '#91ad77', side: '#10261d', brass: '#c18b42', brassLight: '#f5d784', aqua: '#d1ff8c', aquaSoft: '#7ed65d', ink: '#1d2d1b', accent: '#ffe598' },
    { glass: '#34405e', glassLight: '#5c6288', edge: '#8f9bd1', side: '#151a31', brass: '#c6924d', brassLight: '#f0d18e', aqua: '#b9e9ff', aquaSoft: '#7dbdf0', ink: '#202442', accent: '#ffc8e7' },
    { glass: '#214c61', glassLight: '#39748c', edge: '#87b5bf', side: '#0b2633', brass: '#c79551', brassLight: '#f4d98f', aqua: '#92fff5', aquaSoft: '#39d9dd', ink: '#0c3040', accent: '#f3d4ff' },
];
const PLANT_PALETTES = {
    'lumen-orchid': ['#7bc6ff', '#d6f4ff', '#7ffff0'],
    moonbell: ['#b59cff', '#eee5ff', '#82c6ff'],
    'sun-dahlia': ['#ff8e9d', '#ffd287', '#fff2bd'],
    'mist-lily': ['#ffffff', '#b8efff', '#88ffd9'],
    'ember-bloom': ['#ff9d53', '#ffd05d', '#ff6e75'],
};
export class ConservatoryRenderer {
    #canvas;
    #context;
    #onWindowResize = () => this.#queueResize();
    #observer = null;
    #resizeFrame = 0;
    #puzzle = null;
    #analysis = null;
    #leaksByTile = new Map();
    #selectedId = null;
    #hoveredId = null;
    #pressedId = null;
    #coachId = null;
    #hintId = null;
    #hintUntil = 0;
    #displayTurns = new Map();
    #powerTransitions = new Map();
    #impacts = new Map();
    #projected = [];
    #projectionDirty = true;
    #width = 1;
    #height = 1;
    #dpr = 1;
    #running = true;
    #frameId = 0;
    #frameTimer = 0;
    #lastTime = 0;
    #lastDrawAt = 0;
    #dirty = true;
    #activeUntil = 0;
    #viewTurns = 0;
    #targetViewTurns = 0;
    #parallax = { x: 0, y: 0 };
    #targetParallax = { x: 0, y: 0 };
    #reducedMotion = false;
    #highContrast = false;
    #profile = resolveRenderProfile('high', detectDeviceSignals());
    #profileAppliedAt = performance.now();
    #adaptiveDowngraded = false;
    #drawSamples = [];
    #loadSamples = [];
    #renderedFrames = 0;
    #skippedFrames = 0;
    #lastDrawCost = 0;
    #particles = [];
    #pendingBursts = [];
    #dust = [];
    #progressFlashStart = 0;
    #progressFlashEnd = 0;
    #victoryStart = 0;
    #victoryEnd = 0;
    constructor(canvas) {
        this.#canvas = canvas;
        const context = canvas.getContext('2d', { alpha: true, desynchronized: true }) ?? canvas.getContext('2d');
        if (!context)
            throw new Error('Canvas 2D is unavailable.');
        this.#context = context;
        if (typeof ResizeObserver === 'function') {
            this.#observer = new ResizeObserver(() => this.#queueResize());
            this.#observer.observe(canvas);
        }
        else {
            window.addEventListener('resize', this.#onWindowResize, { passive: true });
        }
        this.#createDust();
        this.resize();
        this.#invalidate(700);
    }
    destroy() {
        this.#running = false;
        cancelAnimationFrame(this.#frameId);
        window.clearTimeout(this.#frameTimer);
        cancelAnimationFrame(this.#resizeFrame);
        this.#observer?.disconnect();
        window.removeEventListener('resize', this.#onWindowResize);
    }
    clearPuzzle() {
        this.#puzzle = null;
        this.#analysis = null;
        this.#leaksByTile.clear();
        this.#projected = [];
        this.#particles = [];
        this.#pendingBursts = [];
        this.#progressFlashStart = 0;
        this.#progressFlashEnd = 0;
        this.#powerTransitions.clear();
        this.#impacts.clear();
        this.#projectionDirty = true;
        this.#invalidate();
    }
    setPuzzle(puzzle) {
        this.#puzzle = puzzle;
        // Analyses belong to one immutable puzzle graph. Clearing the previous graph here
        // prevents coordinate ids shared by consecutive levels from animating from stale state.
        this.#analysis = null;
        this.#leaksByTile.clear();
        this.#displayTurns.clear();
        for (const tile of puzzle.tiles)
            this.#displayTurns.set(tile.id, tile.visualTurns);
        this.#selectedId = puzzle.sourceId;
        this.#hoveredId = null;
        this.#pressedId = null;
        this.#coachId = puzzle.tutorial?.targetId ?? null;
        this.#hintId = null;
        this.#particles = [];
        this.#pendingBursts = [];
        this.#progressFlashStart = 0;
        this.#progressFlashEnd = 0;
        this.#powerTransitions.clear();
        this.#impacts.clear();
        this.#victoryStart = 0;
        this.#victoryEnd = 0;
        this.#projectionDirty = true;
        this.#invalidate(1_200);
    }
    setAnalysis(analysis) {
        const now = performance.now();
        const previous = this.#analysis;
        const previousLeakCounts = new Map();
        for (const [tileId, directions] of this.#leaksByTile)
            previousLeakCounts.set(tileId, directions.length);
        const currentLevels = new Map();
        if (this.#puzzle) {
            for (const tile of this.#puzzle.tiles) {
                currentLevels.set(tile.id, this.#powerValue(tile.id, now, previous?.powered.has(tile.id) ? 1 : 0));
            }
        }
        this.#analysis = analysis;
        this.#leaksByTile.clear();
        for (const leak of analysis.leaks) {
            const directions = this.#leaksByTile.get(leak.tileId) ?? [];
            directions.push(leak.direction);
            this.#leaksByTile.set(leak.tileId, directions);
        }
        if (this.#puzzle && !this.#reducedMotion) {
            const depths = this.#powerDepths(this.#puzzle, analysis);
            for (const tile of this.#puzzle.tiles) {
                const from = currentLevels.get(tile.id) ?? 0;
                const to = analysis.powered.has(tile.id) ? 1 : 0;
                if (Math.abs(to - from) < 0.002) {
                    this.#powerTransitions.delete(tile.id);
                    continue;
                }
                const newlyPowered = to > from;
                const start = now + (newlyPowered ? Math.min(420, (depths.get(tile.id) ?? 0) * 48) : 0);
                this.#powerTransitions.set(tile.id, { from, to, start, duration: newlyPowered ? 420 : 240 });
                if (newlyPowered) {
                    this.#impacts.set(tile.id, { start, duration: 720, strength: tile.kind === 'plant' ? 1.35 : 0.78, kind: 'power' });
                    if (previous && tile.kind === 'plant')
                        this.#pendingBursts.push({ tileId: tile.id, start: start + 210, kind: 'bloom' });
                }
            }
            if (previous) {
                for (const [tileId, oldCount] of previousLeakCounts) {
                    const currentCount = this.#leaksByTile.get(tileId)?.length ?? 0;
                    if (currentCount < oldCount)
                        this.#pendingBursts.push({ tileId, start: now + 90, kind: 'seal' });
                }
                if (analysis.progress > previous.progress + 0.012) {
                    this.#progressFlashStart = now;
                    this.#progressFlashEnd = now + 720;
                }
            }
        }
        else if (this.#reducedMotion) {
            this.#powerTransitions.clear();
            this.#impacts.clear();
            this.#pendingBursts = [];
            this.#progressFlashStart = 0;
            this.#progressFlashEnd = 0;
        }
        if (this.#pendingBursts.length > 20)
            this.#pendingBursts.splice(0, this.#pendingBursts.length - 20);
        this.#invalidate(this.#reducedMotion ? 0 : 1_200);
    }
    setSelected(id) {
        if (id === this.#selectedId)
            return;
        this.#selectedId = id;
        this.#invalidate(420);
    }
    setHovered(id) {
        if (id === this.#hoveredId)
            return;
        this.#hoveredId = id;
        this.#invalidate(id ? 220 : 120);
    }
    setPressed(id) {
        if (id === this.#pressedId)
            return;
        this.#pressedId = id;
        this.#invalidate(220);
    }
    setPointer(clientX, clientY) {
        if (this.#reducedMotion || this.#profile.parallaxStrength <= 0)
            return;
        const rect = this.#canvas.getBoundingClientRect();
        const nx = clamp(((clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2, -1, 1);
        const ny = clamp(((clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2, -1, 1);
        this.#targetParallax = { x: nx, y: ny };
        this.#projectionDirty = true;
        this.#invalidate(520);
    }
    resetPointer() {
        if (this.#targetParallax.x === 0 && this.#targetParallax.y === 0)
            return;
        this.#targetParallax = { x: 0, y: 0 };
        this.#projectionDirty = true;
        this.#invalidate(520);
    }
    setCoach(id) {
        if (id === this.#coachId)
            return;
        this.#coachId = id;
        this.#invalidate(id ? 900 : 180);
    }
    setHint(id, durationMs = 5_000) {
        this.#hintId = id;
        this.#hintUntil = performance.now() + durationMs;
        if (!this.#reducedMotion) {
            this.#impacts.set(id, { start: performance.now(), duration: Math.min(durationMs, 1_200), strength: 1.25, kind: 'hint' });
        }
        this.#invalidate(this.#reducedMotion ? 0 : durationMs);
    }
    clearHint() {
        if (!this.#hintId)
            return;
        this.#hintId = null;
        this.#invalidate(180);
    }
    pulseTile(id, strength = 1) {
        if (!this.#reducedMotion) {
            this.#impacts.set(id, { start: performance.now(), duration: 520, strength: clamp(strength, 0.4, 1.8), kind: 'turn' });
        }
        this.#invalidate(this.#reducedMotion ? 0 : 620);
    }
    setReducedMotion(enabled) {
        if (enabled === this.#reducedMotion)
            return;
        this.#reducedMotion = enabled;
        if (enabled) {
            this.#viewTurns = this.#targetViewTurns;
            this.#parallax = { x: 0, y: 0 };
            this.#targetParallax = { x: 0, y: 0 };
            this.#particles = [];
            this.#pendingBursts = [];
            this.#powerTransitions.clear();
            this.#impacts.clear();
            this.#progressFlashStart = 0;
            this.#progressFlashEnd = 0;
            if (this.#puzzle) {
                for (const tile of this.#puzzle.tiles)
                    this.#displayTurns.set(tile.id, tile.visualTurns);
            }
        }
        this.#projectionDirty = true;
        this.#invalidate(enabled ? 0 : 300);
    }
    setHighContrast(enabled) {
        if (enabled === this.#highContrast)
            return;
        this.#highContrast = enabled;
        this.#invalidate(240);
    }
    setRenderProfile(profile) {
        const changed = profile.quality !== this.#profile.quality || profile.adaptive !== this.#profile.adaptive || profile.maxCanvasPixels !== this.#profile.maxCanvasPixels;
        this.#profile = profile;
        this.#profileAppliedAt = performance.now();
        this.#adaptiveDowngraded = false;
        this.#drawSamples = [];
        this.#loadSamples = [];
        if (changed) {
            this.#createDust();
            this.resize();
            this.#invalidate(700);
        }
    }
    rotateView(delta) {
        this.#targetViewTurns += delta;
        if (this.#reducedMotion)
            this.#viewTurns = this.#targetViewTurns;
        this.#projectionDirty = true;
        this.#invalidate(1_000);
    }
    syncTile(tile) {
        if (!this.#displayTurns.has(tile.id))
            this.#displayTurns.set(tile.id, tile.visualTurns);
        this.#projectionDirty = true;
        this.#invalidate(760);
    }
    startVictorySequence(durationMs = 1_850) {
        const now = performance.now();
        this.#victoryStart = this.#reducedMotion ? 0 : now;
        this.#victoryEnd = this.#reducedMotion ? 0 : now + Math.max(320, durationMs);
        this.#selectedId = null;
        this.#hoveredId = null;
        this.#pressedId = null;
        this.#coachId = null;
        this.#hintId = null;
        this.#bloomBurst();
        this.#invalidate(this.#reducedMotion ? 0 : durationMs + 350);
    }
    pause() {
        this.#running = false;
        cancelAnimationFrame(this.#frameId);
        window.clearTimeout(this.#frameTimer);
        this.#frameId = 0;
        this.#frameTimer = 0;
    }
    resume() {
        if (this.#running)
            return;
        this.#running = true;
        this.#lastTime = performance.now();
        this.#invalidate(900);
    }
    resize() {
        const rect = this.#canvas.getBoundingClientRect();
        this.#width = Math.max(1, rect.width);
        this.#height = Math.max(1, rect.height);
        this.#dpr = fitDevicePixelRatio(this.#width, this.#height, Math.max(1, window.devicePixelRatio || 1), this.#profile);
        const width = Math.max(1, Math.round(this.#width * this.#dpr));
        const height = Math.max(1, Math.round(this.#height * this.#dpr));
        if (this.#canvas.width !== width || this.#canvas.height !== height) {
            this.#canvas.width = width;
            this.#canvas.height = height;
        }
        this.#context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
        this.#projectionDirty = true;
        this.#invalidate(420);
    }
    getDiagnostics() {
        const average = this.#drawSamples.length === 0 ? 0 : this.#drawSamples.reduce((sum, value) => sum + value, 0) / this.#drawSamples.length;
        return {
            quality: this.#profile.quality,
            adaptive: this.#profile.adaptive,
            effectiveDpr: round(this.#dpr, 3),
            canvasPixels: this.#canvas.width * this.#canvas.height,
            renderedFrames: this.#renderedFrames,
            skippedFrames: this.#skippedFrames,
            lastDrawCostMs: round(this.#lastDrawCost, 3),
            averageDrawCostMs: round(average, 3),
            activeFps: this.#profile.activeFps,
            ambientFps: this.#profile.ambientFps,
            particleCount: this.#particles.length,
            pendingBurstCount: this.#pendingBursts.length,
            powerTransitionCount: this.#powerTransitions.size,
            impactCount: this.#impacts.size,
            sleeping: this.#frameId === 0 && this.#frameTimer === 0 && !this.#dirty,
        };
    }
    hitTest(clientX, clientY) {
        const rect = this.#canvas.getBoundingClientRect();
        const point = { x: clientX - rect.left, y: clientY - rect.top };
        for (let index = this.#projected.length - 1; index >= 0; index -= 1) {
            const projected = this.#projected[index];
            if (pointInPolygon(point, projected.polygon))
                return projected.tile.id;
        }
        return null;
    }
    #queueResize() {
        cancelAnimationFrame(this.#resizeFrame);
        this.#resizeFrame = requestAnimationFrame(() => {
            this.#resizeFrame = 0;
            this.resize();
        });
    }
    #invalidate(activeMs = 0) {
        this.#dirty = true;
        this.#activeUntil = Math.max(this.#activeUntil, performance.now() + Math.max(0, activeMs));
        this.#scheduleFrame();
    }
    #scheduleFrame(delayMs = 0) {
        if (!this.#running || this.#frameId || this.#frameTimer)
            return;
        if (delayMs > 1) {
            this.#frameTimer = window.setTimeout(() => {
                this.#frameTimer = 0;
                if (this.#running && !this.#frameId)
                    this.#frameId = requestAnimationFrame((time) => this.#frame(time));
            }, delayMs);
        }
        else {
            this.#frameId = requestAnimationFrame((time) => this.#frame(time));
        }
    }
    #frame(time) {
        this.#frameId = 0;
        if (!this.#running)
            return;
        const interval = this.#frameInterval(time);
        const sinceDraw = time - this.#lastDrawAt;
        if (!this.#dirty && Number.isFinite(interval) && sinceDraw + 0.5 < interval) {
            this.#skippedFrames += 1;
            this.#scheduleFrame(Math.max(0, interval - sinceDraw - 4));
            return;
        }
        if (!this.#dirty && !Number.isFinite(interval))
            return;
        const delta = Math.min(0.05, Math.max(0, (time - this.#lastTime) / 1_000 || 0));
        this.#lastTime = time;
        this.#update(delta, time);
        const started = performance.now();
        this.#draw(time);
        this.#lastDrawCost = performance.now() - started;
        this.#recordDrawCost(this.#lastDrawCost, time, this.#hasTransientMotion(time) || time < this.#activeUntil);
        this.#renderedFrames += 1;
        this.#lastDrawAt = time;
        this.#dirty = false;
        const nextInterval = this.#frameInterval(time);
        if (Number.isFinite(nextInterval)) {
            // A full timeout plus a requestAnimationFrame would halve the requested frame rate.
            // For 60 FPS, hand control straight back to RAF; for slower ambient cadences,
            // wake a few milliseconds early and let RAF align with the display refresh.
            this.#scheduleFrame(nextInterval <= 20 ? 0 : Math.max(0, nextInterval - 5));
        }
    }
    #frameInterval(time) {
        if (!this.#puzzle)
            return this.#dirty ? 0 : Number.POSITIVE_INFINITY;
        const transient = this.#hasTransientMotion(time);
        if (this.#reducedMotion && !transient)
            return this.#dirty ? 0 : Number.POSITIVE_INFINITY;
        if (transient || time < this.#activeUntil)
            return 1_000 / this.#profile.activeFps;
        const recentlyInteractive = time < this.#activeUntil + 5_000;
        const fps = recentlyInteractive ? this.#profile.ambientFps : this.#profile.idleFps;
        return 1_000 / Math.max(1, fps);
    }
    #hasTransientMotion(time) {
        if (Math.abs(this.#targetViewTurns - this.#viewTurns) > 0.0005)
            return true;
        if (Math.abs(this.#targetParallax.x - this.#parallax.x) > 0.002 || Math.abs(this.#targetParallax.y - this.#parallax.y) > 0.002)
            return true;
        if (this.#particles.length > 0 || this.#pendingBursts.length > 0 || this.#powerTransitions.size > 0 || this.#impacts.size > 0)
            return true;
        if (this.#progressFlashStart > 0 && time < this.#progressFlashEnd)
            return true;
        if (this.#victoryStart > 0 && time < this.#victoryEnd)
            return true;
        if (!this.#reducedMotion && this.#hintId && time < this.#hintUntil)
            return true;
        if (this.#puzzle) {
            for (const tile of this.#puzzle.tiles) {
                if (Math.abs((this.#displayTurns.get(tile.id) ?? tile.visualTurns) - tile.visualTurns) > 0.001)
                    return true;
            }
        }
        return false;
    }
    #update(delta, time) {
        const smoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-delta * 10.5);
        const oldView = this.#viewTurns;
        this.#viewTurns += (this.#targetViewTurns - this.#viewTurns) * smoothing;
        if (Math.abs(this.#targetViewTurns - this.#viewTurns) < 0.0005)
            this.#viewTurns = this.#targetViewTurns;
        const parallaxSmoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-delta * 6.5);
        this.#parallax.x += (this.#targetParallax.x - this.#parallax.x) * parallaxSmoothing;
        this.#parallax.y += (this.#targetParallax.y - this.#parallax.y) * parallaxSmoothing;
        if (Math.abs(this.#targetParallax.x - this.#parallax.x) < 0.001)
            this.#parallax.x = this.#targetParallax.x;
        if (Math.abs(this.#targetParallax.y - this.#parallax.y) < 0.001)
            this.#parallax.y = this.#targetParallax.y;
        if (oldView !== this.#viewTurns || this.#parallax.x !== this.#targetParallax.x || this.#parallax.y !== this.#targetParallax.y)
            this.#projectionDirty = true;
        if (this.#puzzle) {
            for (const tile of this.#puzzle.tiles) {
                const current = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
                const next = current + (tile.visualTurns - current) * smoothing;
                this.#displayTurns.set(tile.id, Math.abs(tile.visualTurns - next) < 0.001 ? tile.visualTurns : next);
            }
        }
        if (this.#hintId && time > this.#hintUntil) {
            this.#hintId = null;
            this.#dirty = true;
        }
        if (!this.#reducedMotion) {
            this.#emitPendingBursts(time);
            for (const dust of this.#dust) {
                dust.y -= dust.speed * delta;
                dust.x += Math.sin(time * 0.00045 + dust.phase) * delta * 0.006;
                if (dust.y < -0.05) {
                    dust.y = 1.05;
                    dust.x = Math.random();
                }
            }
            for (const particle of this.#particles) {
                particle.life -= delta;
                particle.x += particle.vx * delta;
                particle.y += particle.vy * delta;
                particle.vy += particle.gravity * delta;
                particle.rotation += particle.spin * delta;
                particle.vx *= Math.pow(particle.kind === 'droplet' ? 0.988 : 0.975, delta * 60);
            }
            this.#particles = this.#particles.filter((particle) => particle.life > 0);
        }
        for (const [id, impact] of this.#impacts) {
            if (time > impact.start + impact.duration)
                this.#impacts.delete(id);
        }
    }
    #recordDrawCost(cost, time, underLoad) {
        this.#drawSamples.push(cost);
        if (this.#drawSamples.length > 240)
            this.#drawSamples.splice(0, this.#drawSamples.length - 240);
        if (underLoad) {
            this.#loadSamples.push(cost);
            if (this.#loadSamples.length > 180)
                this.#loadSamples.splice(0, this.#loadSamples.length - 180);
        }
        if (!underLoad || !this.#profile.adaptive || this.#profile.quality !== 'high' || this.#adaptiveDowngraded || time - this.#profileAppliedAt < 4_500)
            return;
        if (!shouldAutoDowngrade(this.#loadSamples))
            return;
        this.#adaptiveDowngraded = true;
        this.#profile = { ...resolveRenderProfile('balanced', detectDeviceSignals()), adaptive: true };
        this.#profileAppliedAt = time;
        this.#drawSamples = [];
        this.#loadSamples = [];
        this.#createDust();
        this.resize();
        this.#canvas.dispatchEvent(new CustomEvent('renderqualitychange', { detail: { quality: 'balanced', reason: 'sustained-load' } }));
    }
    #powerValue(id, time, fallback) {
        const transition = this.#powerTransitions.get(id);
        if (!transition)
            return fallback;
        if (time <= transition.start)
            return transition.from;
        const progress = clamp((time - transition.start) / Math.max(1, transition.duration), 0, 1);
        if (progress >= 1) {
            this.#powerTransitions.delete(id);
            return transition.to;
        }
        const eased = transition.to > transition.from ? easeOutBack(progress, 0.45) : easeInOut(progress);
        return clamp(transition.from + (transition.to - transition.from) * eased, 0, 1.08);
    }
    #powerDepths(puzzle, analysis) {
        const depths = new Map([[puzzle.sourceId, 0]]);
        const byPosition = new Map(puzzle.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
        const byId = new Map(puzzle.tiles.map((tile) => [tile.id, tile]));
        const queue = [puzzle.sourceId];
        while (queue.length > 0) {
            const id = queue.shift();
            const tile = id ? byId.get(id) : undefined;
            if (!tile)
                continue;
            const depth = depths.get(tile.id) ?? 0;
            const mask = currentMask(tile);
            for (const direction of DIRECTIONS) {
                if ((mask & direction.bit) === 0)
                    continue;
                const neighbor = byPosition.get(`${tile.x + direction.dx},${tile.y + direction.dy}`);
                if (!neighbor || !analysis.powered.has(neighbor.id) || depths.has(neighbor.id))
                    continue;
                if ((currentMask(neighbor) & direction.opposite) === 0)
                    continue;
                depths.set(neighbor.id, depth + 1);
                queue.push(neighbor.id);
            }
        }
        return depths;
    }
    #draw(time) {
        const context = this.#context;
        context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
        context.clearRect(0, 0, this.#width, this.#height);
        this.#drawAtmosphere(time);
        const puzzle = this.#puzzle;
        if (!puzzle)
            return;
        const theme = THEMES[puzzle.theme % THEMES.length];
        this.#drawProgressFlash(time, theme);
        if (this.#projectionDirty || this.#projected.length === 0) {
            this.#projected = this.#projectBoard(puzzle);
            this.#projectionDirty = false;
        }
        this.#drawBoardShadow(theme);
        for (const projected of this.#projected)
            this.#drawTile(projected, theme, time);
        this.#drawParticles(time, theme);
        this.#drawVictory(time, theme);
    }
    #drawAtmosphere(time) {
        const context = this.#context;
        context.save();
        const top = context.createLinearGradient(0, 0, 0, this.#height);
        top.addColorStop(0, 'rgba(1, 16, 20, .12)');
        top.addColorStop(0.55, 'rgba(2, 19, 20, .02)');
        top.addColorStop(1, 'rgba(1, 10, 12, .34)');
        context.fillStyle = top;
        context.fillRect(0, 0, this.#width, this.#height);
        for (const dust of this.#dust) {
            const pulse = this.#reducedMotion ? 0.34 : 0.28 + Math.sin(time * 0.001 + dust.phase) * 0.14;
            context.fillStyle = `rgba(255, 232, 154, ${Math.max(0.08, pulse)})`;
            if (this.#profile.useExpensiveShadows) {
                context.shadowColor = 'rgba(255, 220, 126, .65)';
                context.shadowBlur = dust.size * 4;
            }
            const driftX = this.#parallax.x * 8 * this.#profile.parallaxStrength;
            const driftY = this.#parallax.y * 5 * this.#profile.parallaxStrength;
            context.beginPath();
            context.arc(dust.x * this.#width + driftX, dust.y * this.#height + driftY, dust.size, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }
    #projectBoard(puzzle) {
        const portrait = this.#height > this.#width * 1.14;
        const topReserve = portrait ? Math.min(285, this.#height * 0.22) : Math.min(126, this.#height * 0.18);
        const bottomReserve = portrait ? Math.min(245, this.#height * 0.18) : Math.min(128, this.#height * 0.18);
        const available = {
            left: this.#width * (portrait ? 0.035 : 0.055),
            right: this.#width * (portrait ? 0.965 : 0.945),
            top: topReserve,
            bottom: this.#height - bottomReserve,
        };
        const angle = this.#viewTurns * Math.PI * 0.5;
        const centerX = (puzzle.width - 1) / 2;
        const centerY = (puzzle.height - 1) / 2;
        // A steeper portrait projection uses otherwise-empty vertical space and keeps
        // mechanisms comfortably tappable without allocating additional canvas pixels.
        const isoY = portrait ? 0.365 : 0.285;
        const unitCenters = puzzle.tiles.map((tile) => {
            const dx = tile.x - centerX;
            const dy = tile.y - centerY;
            const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
            const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
            return { tile, x: (rx - ry) * 0.5, y: (rx + ry) * isoY };
        });
        const minX = Math.min(...unitCenters.map((item) => item.x - 0.54));
        const maxX = Math.max(...unitCenters.map((item) => item.x + 0.54));
        const minY = Math.min(...unitCenters.map((item) => item.y - (portrait ? 0.37 : 0.31)));
        const maxY = Math.max(...unitCenters.map((item) => item.y + (portrait ? 0.54 : 0.43)));
        const availW = available.right - available.left;
        const availH = available.bottom - available.top;
        const scale = Math.max(54, Math.min(availW / Math.max(1, maxX - minX), availH / Math.max(0.7, maxY - minY), portrait ? 225 : 300));
        const tileWidth = scale;
        const tileHeight = scale * (portrait ? 0.68 : 0.57);
        const boardW = (maxX - minX) * scale;
        const boardH = (maxY - minY) * scale;
        const parallaxX = this.#parallax.x * (portrait ? 4 : 10) * this.#profile.parallaxStrength;
        const parallaxY = this.#parallax.y * (portrait ? 3 : 6) * this.#profile.parallaxStrength;
        const originX = available.left + (availW - boardW) / 2 - minX * scale + parallaxX;
        const originY = available.top + (availH - boardH) / 2 - minY * scale + (portrait ? 2 : 10) + parallaxY;
        const result = unitCenters.map(({ tile, x, y }) => {
            const center = { x: originX + x * scale, y: originY + y * scale };
            const polygon = diamond(center, tileWidth, tileHeight);
            return { tile, center, polygon, tileWidth, tileHeight, depth: center.y };
        });
        return result.sort((left, right) => left.depth - right.depth || left.center.x - right.center.x);
    }
    #drawBoardShadow(theme) {
        if (this.#projected.length === 0)
            return;
        const context = this.#context;
        const minX = Math.min(...this.#projected.map((item) => item.center.x - item.tileWidth * 0.62));
        const maxX = Math.max(...this.#projected.map((item) => item.center.x + item.tileWidth * 0.62));
        const minY = Math.min(...this.#projected.map((item) => item.center.y - item.tileHeight * 0.52));
        const maxY = Math.max(...this.#projected.map((item) => item.center.y + item.tileHeight * 0.95));
        context.save();
        context.translate(0, (maxY - minY) * 0.08);
        if (this.#profile.useFilters && 'filter' in context)
            context.filter = 'blur(18px)';
        context.fillStyle = this.#profile.useFilters ? 'rgba(0, 0, 0, .48)' : 'rgba(0, 0, 0, .34)';
        context.beginPath();
        context.ellipse((minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.48, (maxY - minY) * 0.34, 0, 0, Math.PI * 2);
        context.fill();
        if ('filter' in context)
            context.filter = 'none';
        if (this.#profile.quality === 'high') {
            const aura = context.createRadialGradient((minX + maxX) / 2, (minY + maxY) / 2, 0, (minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.62);
            aura.addColorStop(0, `${theme.aquaSoft}20`);
            aura.addColorStop(1, 'rgba(0,0,0,0)');
            context.fillStyle = aura;
            context.fillRect(minX - 50, minY - 50, maxX - minX + 100, maxY - minY + 100);
        }
        context.restore();
    }
    #drawTile(projected, theme, time) {
        const { tile, center, polygon, tileWidth, tileHeight } = projected;
        const context = this.#context;
        const power = this.#powerValue(tile.id, time, this.#analysis?.powered.has(tile.id) ? 1 : 0);
        const powered = power > 0.025;
        const selected = tile.id === this.#selectedId;
        const hovered = tile.id === this.#hoveredId;
        const pressed = tile.id === this.#pressedId;
        const coached = tile.id === this.#coachId;
        const hinted = tile.id === this.#hintId;
        const baseLift = selected || hovered || coached || hinted ? Math.max(2, tileHeight * 0.045) : 0;
        const lift = pressed ? Math.max(0, baseLift - tileHeight * 0.035) : baseLift;
        const topPolygon = polygon.map((point) => ({ x: point.x, y: point.y - lift }));
        const extrusion = tileHeight * 0.26;
        context.save();
        context.shadowColor = 'rgba(0,0,0,.5)';
        context.shadowBlur = this.#profile.useExpensiveShadows ? tileHeight * 0.24 : tileHeight * 0.08;
        context.shadowOffsetY = tileHeight * 0.22;
        pathPolygon(context, [topPolygon[3], topPolygon[2], { x: topPolygon[2].x, y: topPolygon[2].y + extrusion }, { x: topPolygon[3].x, y: topPolygon[3].y + extrusion }]);
        context.fillStyle = theme.side;
        context.fill();
        pathPolygon(context, [topPolygon[1], topPolygon[2], { x: topPolygon[2].x, y: topPolygon[2].y + extrusion }, { x: topPolygon[1].x, y: topPolygon[1].y + extrusion }]);
        if (this.#profile.quality === 'high') {
            const sideGradient = context.createLinearGradient(topPolygon[1].x, topPolygon[1].y, topPolygon[2].x, topPolygon[2].y + extrusion);
            sideGradient.addColorStop(0, '#173837');
            sideGradient.addColorStop(1, '#061a1d');
            context.fillStyle = sideGradient;
        }
        else {
            context.fillStyle = theme.side;
        }
        context.fill();
        context.shadowColor = 'transparent';
        pathPolygon(context, topPolygon);
        if (this.#profile.quality === 'high') {
            const topGradient = context.createLinearGradient(center.x, topPolygon[0].y, center.x, topPolygon[2].y);
            topGradient.addColorStop(0, powered ? mixHex(theme.glass, theme.glassLight, clamp(power, 0, 1)) : theme.glass);
            topGradient.addColorStop(1, powered ? mixHex(theme.ink, theme.glass, clamp(power, 0, 1)) : theme.ink);
            context.fillStyle = topGradient;
        }
        else {
            context.fillStyle = powered ? mixHex(theme.glass, theme.glassLight, clamp(power * 0.64, 0, 1)) : theme.glass;
        }
        context.fill();
        context.strokeStyle = this.#highContrast ? '#f8fff4' : powered ? withAlpha(theme.aqua, 0.28 + clamp(power, 0, 1) * 0.38) : `${theme.edge}88`;
        context.lineWidth = Math.max(1.1, tileWidth * 0.009);
        context.stroke();
        if (this.#profile.quality === 'high') {
            context.save();
            pathPolygon(context, topPolygon);
            context.clip();
            const sheen = context.createLinearGradient(topPolygon[3].x, topPolygon[3].y, topPolygon[1].x, topPolygon[1].y);
            sheen.addColorStop(0, 'rgba(255,255,255,0)');
            sheen.addColorStop(0.38, 'rgba(218,255,246,.025)');
            sheen.addColorStop(0.5, powered ? withAlpha(theme.aqua, 0.12 * clamp(power, 0, 1)) : 'rgba(255,255,255,.085)');
            sheen.addColorStop(0.64, 'rgba(255,255,255,.018)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            context.fillStyle = sheen;
            context.fillRect(center.x - tileWidth * 0.58, center.y - tileHeight, tileWidth * 1.16, tileHeight * 2);
            context.restore();
            context.strokeStyle = powered ? withAlpha(theme.aqua, 0.22 + clamp(power, 0, 1) * 0.18) : 'rgba(230,255,247,.18)';
            context.lineWidth = Math.max(0.8, tileWidth * 0.006);
            context.beginPath();
            context.moveTo(topPolygon[3].x, topPolygon[3].y);
            context.lineTo(topPolygon[0].x, topPolygon[0].y);
            context.lineTo(topPolygon[1].x, topPolygon[1].y);
            context.stroke();
        }
        // Inner glass plate and engraved filigree.
        const inset = insetDiamond({ x: center.x, y: center.y - lift }, tileWidth * 0.84, tileHeight * 0.80);
        pathPolygon(context, inset);
        context.fillStyle = powered ? withAlpha(theme.aquaSoft, 0.035 + clamp(power, 0, 1) * 0.055) : 'rgba(255,255,255,.025)';
        context.fill();
        context.strokeStyle = powered ? withAlpha(theme.aqua, 0.12 + clamp(power, 0, 1) * 0.18) : 'rgba(231, 255, 244, .10)';
        context.lineWidth = 1;
        context.stroke();
        context.globalAlpha = 0.15;
        context.strokeStyle = theme.brassLight;
        context.beginPath();
        context.moveTo(inset[0].x, inset[0].y + tileHeight * 0.14);
        context.quadraticCurveTo(center.x, center.y - lift, inset[2].x, inset[2].y - tileHeight * 0.14);
        context.moveTo(inset[3].x + tileWidth * 0.12, inset[3].y);
        context.quadraticCurveTo(center.x, center.y - lift, inset[1].x - tileWidth * 0.12, inset[1].y);
        context.stroke();
        context.globalAlpha = 1;
        this.#drawCornerRivets({ x: center.x, y: center.y - lift }, tileWidth, tileHeight, theme);
        this.#drawChannels(projected, { x: center.x, y: center.y - lift }, theme, power, time);
        if (tile.kind === 'source')
            this.#drawSource(projected, { x: center.x, y: center.y - lift }, theme, time);
        else if (tile.kind === 'plant')
            this.#drawPlant(projected, { x: center.x, y: center.y - lift }, theme, power, time);
        else
            this.#drawMechanism(projected, { x: center.x, y: center.y - lift }, theme, power, time);
        if (tile.fixed && tile.kind === 'pipe')
            this.#drawLock(center.x + tileWidth * 0.27, center.y - lift - tileHeight * 0.10, tileWidth * 0.08, theme);
        if (selected || hovered || coached || hinted || pressed)
            this.#drawSelection(topPolygon, tileWidth, theme, time, coached || hinted, pressed);
        this.#drawImpact(projected, { x: center.x, y: center.y - lift }, theme, time);
        context.restore();
        for (const direction of this.#leaksByTile.get(tile.id) ?? []) {
            this.#drawLeak(projected, { x: center.x, y: center.y - lift }, direction, theme, time);
        }
    }
    #drawCornerRivets(center, tileWidth, tileHeight, theme) {
        const context = this.#context;
        const points = diamond(center, tileWidth * 0.81, tileHeight * 0.75);
        const radius = Math.max(1.7, tileWidth * 0.018);
        for (const point of points) {
            if (this.#profile.quality === 'high') {
                const gradient = context.createRadialGradient(point.x - radius * 0.35, point.y - radius * 0.35, 0, point.x, point.y, radius * 1.25);
                gradient.addColorStop(0, theme.brassLight);
                gradient.addColorStop(0.45, theme.brass);
                gradient.addColorStop(1, '#51301a');
                context.fillStyle = gradient;
            }
            else {
                context.fillStyle = theme.brass;
            }
            context.beginPath();
            context.arc(point.x, point.y, radius, 0, Math.PI * 2);
            context.fill();
        }
    }
    #drawChannels(projected, center, theme, power, time) {
        const context = this.#context;
        const turns = this.#displayTurns.get(projected.tile.id) ?? projected.tile.visualTurns;
        const powered = power > 0.02;
        const normalizedPower = clamp(power, 0, 1);
        const pulse = this.#reducedMotion ? 0.82 : 0.72 + Math.sin(time * 0.006 + projected.tile.x * 1.7 + projected.tile.y) * 0.18;
        for (const direction of DIRECTIONS) {
            if ((projected.tile.baseMask & direction.bit) === 0)
                continue;
            const vector = this.#directionVector(direction.bit, turns, projected.tileWidth, projected.tileHeight);
            const end = { x: center.x + vector.x * 0.49, y: center.y + vector.y * 0.49 };
            const inner = { x: center.x + vector.x * 0.23, y: center.y + vector.y * 0.23 };
            const width = Math.max(4.2, projected.tileWidth * 0.055);
            context.save();
            context.lineCap = 'round';
            context.lineJoin = 'round';
            context.strokeStyle = '#4b2f1a';
            context.lineWidth = width * 1.9;
            context.beginPath();
            context.moveTo(inner.x, inner.y);
            context.lineTo(end.x, end.y);
            context.stroke();
            if (this.#profile.quality === 'high') {
                const brass = context.createLinearGradient(inner.x, inner.y - width, end.x, end.y + width);
                brass.addColorStop(0, theme.brassLight);
                brass.addColorStop(0.35, theme.brass);
                brass.addColorStop(0.72, '#755027');
                brass.addColorStop(1, theme.brassLight);
                context.strokeStyle = brass;
            }
            else {
                context.strokeStyle = theme.brass;
            }
            context.lineWidth = width * 1.25;
            context.stroke();
            context.strokeStyle = 'rgba(255, 238, 175, .45)';
            context.lineWidth = width * 0.18;
            context.stroke();
            if (powered) {
                if (this.#profile.useExpensiveShadows) {
                    context.shadowColor = theme.aqua;
                    context.shadowBlur = width * 2.5 * normalizedPower;
                }
                context.strokeStyle = withAlpha(theme.aqua, normalizedPower * pulse);
                context.lineWidth = width * (0.28 + normalizedPower * 0.34);
                context.stroke();
                context.shadowBlur = 0;
                if (!this.#reducedMotion) {
                    const travelerCount = this.#profile.quality === 'high' ? 2 : 1;
                    const basePhase = projected.tile.x * 0.131 + projected.tile.y * 0.193 + direction.bit * 0.071;
                    for (let index = 0; index < travelerCount; index += 1) {
                        const flow = (time * (this.#profile.quality === 'high' ? 0.00042 : 0.00031) + basePhase + index / travelerCount) % 1;
                        const easedFlow = 0.08 + flow * 0.84;
                        const fx = inner.x + (end.x - inner.x) * easedFlow;
                        const fy = inner.y + (end.y - inner.y) * easedFlow;
                        context.globalAlpha = normalizedPower * (0.7 + Math.sin(flow * Math.PI) * 0.3);
                        context.fillStyle = '#ffffff';
                        if (this.#profile.useExpensiveShadows) {
                            context.shadowColor = theme.aqua;
                            context.shadowBlur = 8 + width;
                        }
                        context.beginPath();
                        context.arc(fx, fy, Math.max(1.2, width * (0.13 + normalizedPower * 0.08)), 0, Math.PI * 2);
                        context.fill();
                    }
                    context.globalAlpha = 1;
                }
            }
            // End coupling.
            context.shadowBlur = 0;
            context.fillStyle = '#271a12';
            context.strokeStyle = theme.brass;
            context.lineWidth = Math.max(1.5, width * 0.26);
            context.beginPath();
            context.ellipse(end.x, end.y, width * 0.75, width * 0.46, Math.atan2(vector.y, vector.x), 0, Math.PI * 2);
            context.fill();
            context.stroke();
            if (powered) {
                context.fillStyle = withAlpha(theme.aqua, 0.35 + normalizedPower * 0.65);
                if (this.#profile.useExpensiveShadows) {
                    context.shadowColor = theme.aqua;
                    context.shadowBlur = width * 1.8;
                }
                context.beginPath();
                context.ellipse(end.x, end.y, width * (0.2 + normalizedPower * 0.18), width * (0.1 + normalizedPower * 0.09), Math.atan2(vector.y, vector.x), 0, Math.PI * 2);
                context.fill();
            }
            context.restore();
        }
    }
    #drawMechanism(projected, center, theme, power, time) {
        const context = this.#context;
        const radius = projected.tileWidth * 0.105;
        const normalizedPower = clamp(power, 0, 1);
        context.save();
        context.translate(center.x, center.y);
        const spin = this.#reducedMotion ? 0 : time * 0.00018 * (0.28 + normalizedPower * 0.88);
        context.rotate(spin);
        context.fillStyle = '#2e1d12';
        context.strokeStyle = theme.brassLight;
        context.lineWidth = Math.max(1.2, radius * 0.13);
        for (let index = 0; index < 8; index += 1) {
            context.rotate(Math.PI / 4);
            roundedRect(context, radius * 0.72, -radius * 0.18, radius * 0.54, radius * 0.36, radius * 0.09);
            context.fillStyle = index % 2 ? theme.brass : theme.brassLight;
            context.fill();
        }
        context.rotate(-spin - Math.PI * 2);
        if (this.#profile.quality === 'high') {
            const ring = context.createRadialGradient(-radius * 0.25, -radius * 0.35, 0, 0, 0, radius);
            ring.addColorStop(0, theme.brassLight);
            ring.addColorStop(0.48, theme.brass);
            ring.addColorStop(0.72, '#3b2618');
            ring.addColorStop(1, theme.brassLight);
            context.fillStyle = ring;
        }
        else {
            context.fillStyle = theme.brass;
        }
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = normalizedPower > 0.02 ? withAlpha(theme.aqua, 0.35 + normalizedPower * 0.65) : '#071e21';
        if (normalizedPower > 0.02 && this.#profile.useExpensiveShadows) {
            context.shadowColor = theme.aqua;
            context.shadowBlur = radius * (0.4 + normalizedPower * 1.2);
        }
        context.beginPath();
        context.arc(0, 0, radius * (0.38 + normalizedPower * 0.1), 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(255,255,255,.28)';
        context.lineWidth = Math.max(1, radius * 0.08);
        context.stroke();
        if (!this.#reducedMotion && normalizedPower > 0.25 && this.#profile.quality === 'high') {
            context.shadowBlur = 0;
            context.fillStyle = '#ffffff';
            for (let index = 0; index < 3; index += 1) {
                const angle = -time * 0.0011 + index * (Math.PI * 2 / 3);
                context.globalAlpha = 0.45 + normalizedPower * 0.45;
                context.beginPath();
                context.arc(Math.cos(angle) * radius * 0.64, Math.sin(angle) * radius * 0.64, Math.max(1, radius * 0.055), 0, Math.PI * 2);
                context.fill();
            }
        }
        context.restore();
    }
    #drawSource(projected, center, theme, time) {
        const context = this.#context;
        const radius = projected.tileWidth * 0.135;
        const baseY = center.y - projected.tileHeight * 0.06;
        context.save();
        context.translate(center.x, baseY);
        context.fillStyle = '#2d2116';
        context.strokeStyle = theme.brassLight;
        context.lineWidth = Math.max(1.5, radius * 0.12);
        context.beginPath();
        context.ellipse(0, radius * 0.28, radius * 1.05, radius * 0.55, 0, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (this.#profile.quality === 'high') {
            const bowl = context.createRadialGradient(-radius * 0.35, -radius * 0.5, 0, 0, 0, radius * 1.2);
            bowl.addColorStop(0, theme.brassLight);
            bowl.addColorStop(0.42, theme.brass);
            bowl.addColorStop(0.8, '#4a311a');
            bowl.addColorStop(1, theme.brassLight);
            context.fillStyle = bowl;
        }
        else {
            context.fillStyle = theme.brass;
        }
        context.beginPath();
        context.arc(0, 0, radius, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = theme.aqua;
        if (this.#profile.useExpensiveShadows) {
            context.shadowColor = theme.aqua;
            context.shadowBlur = radius * 2.2;
        }
        context.beginPath();
        context.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
        context.fill();
        context.restore();
        const pulse = this.#reducedMotion ? 1 : 0.92 + Math.sin(time * 0.0045) * 0.08;
        const starY = baseY - radius * 1.08;
        context.save();
        context.strokeStyle = theme.aqua;
        if (this.#profile.useExpensiveShadows) {
            context.shadowColor = theme.aqua;
            context.shadowBlur = radius * 1.1;
        }
        context.lineWidth = Math.max(1.6, radius * 0.09);
        context.beginPath();
        context.arc(center.x, baseY, radius * 1.22, Math.PI * 1.08, Math.PI * 1.92);
        context.stroke();
        drawStar(context, center.x, starY, radius * 0.36 * pulse, radius * 0.11 * pulse, 4, time * 0.0005);
        context.fillStyle = '#ffffff';
        context.fill();
        context.restore();
    }
    #drawPlant(projected, center, theme, power, time) {
        const context = this.#context;
        const scale = projected.tileWidth / 150;
        const normalizedPower = clamp(power, 0, 1);
        const bloom = 0.38 + normalizedPower * 0.62;
        const potY = center.y + projected.tileHeight * 0.03;
        const potW = 30 * scale;
        const potH = 23 * scale;
        context.save();
        context.shadowColor = 'rgba(0,0,0,.42)';
        context.shadowBlur = this.#profile.useExpensiveShadows ? 9 * scale : 3 * scale;
        context.shadowOffsetY = 6 * scale;
        if (this.#profile.quality === 'high') {
            const pot = context.createLinearGradient(center.x - potW / 2, potY, center.x + potW / 2, potY + potH);
            pot.addColorStop(0, '#f0c176');
            pot.addColorStop(0.32, '#8e4f2c');
            pot.addColorStop(0.72, '#bd7740');
            pot.addColorStop(1, '#49271c');
            context.fillStyle = pot;
        }
        else {
            context.fillStyle = '#a96237';
        }
        context.beginPath();
        context.moveTo(center.x - potW * 0.46, potY);
        context.lineTo(center.x + potW * 0.46, potY);
        context.lineTo(center.x + potW * 0.31, potY + potH);
        context.quadraticCurveTo(center.x, potY + potH * 1.17, center.x - potW * 0.31, potY + potH);
        context.closePath();
        context.fill();
        context.shadowColor = 'transparent';
        context.strokeStyle = theme.brassLight;
        context.lineWidth = Math.max(1, scale * 1.3);
        context.stroke();
        context.beginPath();
        context.ellipse(center.x, potY, potW * 0.48, potH * 0.17, 0, 0, Math.PI * 2);
        context.fillStyle = '#4a271b';
        context.fill();
        context.stroke();
        context.strokeStyle = 'rgba(255,226,153,.45)';
        context.beginPath();
        context.moveTo(center.x - potW * 0.25, potY + potH * 0.48);
        context.lineTo(center.x + potW * 0.25, potY + potH * 0.48);
        context.stroke();
        const stemTop = potY - (26 + normalizedPower * 5) * scale;
        context.strokeStyle = mixHex('#3e704c', '#61c276', normalizedPower);
        context.lineWidth = Math.max(2, 3.2 * scale);
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(center.x, potY);
        context.quadraticCurveTo(center.x - 2 * scale, potY - 15 * scale, center.x, stemTop);
        context.stroke();
        this.#drawLeaf(center.x - 5 * scale, potY - 14 * scale, -0.55, 10 * scale, normalizedPower);
        this.#drawLeaf(center.x + 5 * scale, potY - 19 * scale, Math.PI + 0.45, 10 * scale, normalizedPower);
        const kind = projected.tile.plantKind ?? 'lumen-orchid';
        const palette = PLANT_PALETTES[kind];
        if (normalizedPower > 0.05 && this.#profile.useExpensiveShadows) {
            context.shadowColor = palette[2];
            context.shadowBlur = (7 + normalizedPower * 14) * scale;
        }
        const sway = this.#reducedMotion ? 0 : Math.sin(time * 0.0018 + projected.tile.x * 0.8 + projected.tile.y * 0.37) * (0.025 + normalizedPower * 0.055);
        const petals = kind === 'sun-dahlia' || kind === 'ember-bloom' ? 10 : kind === 'mist-lily' ? 6 : 7;
        context.save();
        context.translate(center.x, stemTop);
        context.rotate(sway);
        for (let index = 0; index < petals; index += 1) {
            context.save();
            context.rotate((Math.PI * 2 * index) / petals + normalizedPower * 0.05);
            context.fillStyle = index % 2 === 0 ? palette[0] : palette[1];
            context.globalAlpha = 0.48 + normalizedPower * 0.52;
            context.beginPath();
            context.ellipse(0, -9 * scale * bloom, 4.2 * scale * bloom, 10 * scale * bloom, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
        context.globalAlpha = 0.5 + normalizedPower * 0.5;
        context.fillStyle = palette[2];
        context.beginPath();
        context.arc(0, 0, 4.8 * scale * bloom, 0, Math.PI * 2);
        context.fill();
        if (!this.#reducedMotion && normalizedPower > 0.65 && this.#profile.quality === 'high') {
            context.globalAlpha = (normalizedPower - 0.65) / 0.35;
            context.fillStyle = '#ffffff';
            for (let index = 0; index < 3; index += 1) {
                const angle = time * 0.001 + index * Math.PI * 2 / 3;
                context.beginPath();
                context.arc(Math.cos(angle) * 15 * scale, Math.sin(angle) * 9 * scale - 3 * scale, 1.2 * scale, 0, Math.PI * 2);
                context.fill();
            }
        }
        context.restore();
        context.restore();
    }
    #drawLeaf(x, y, angle, size, power) {
        const context = this.#context;
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.fillStyle = mixHex('#385f43', '#5eae65', clamp(power, 0, 1));
        context.beginPath();
        context.ellipse(0, 0, size * (0.86 + power * 0.14), size * (0.36 + power * 0.08), 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
    #drawLock(x, y, radius, theme) {
        const context = this.#context;
        context.save();
        context.fillStyle = '#0a2828';
        context.strokeStyle = theme.brassLight;
        context.lineWidth = Math.max(1, radius * 0.18);
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(x, y - radius * 0.12, radius * 0.33, Math.PI, 0);
        context.stroke();
        context.fillStyle = theme.brassLight;
        context.fillRect(x - radius * 0.27, y - radius * 0.05, radius * 0.54, radius * 0.43);
        context.restore();
    }
    #drawSelection(polygon, tileWidth, theme, time, strong, pressed) {
        const context = this.#context;
        const pulse = this.#reducedMotion ? 1 : 0.78 + Math.sin(time * 0.006) * 0.22;
        context.save();
        context.globalAlpha = pressed ? 0.72 : 1;
        context.strokeStyle = strong ? theme.accent : theme.brassLight;
        if (this.#profile.useExpensiveShadows) {
            context.shadowColor = strong ? theme.accent : theme.brassLight;
            context.shadowBlur = tileWidth * (strong ? 0.16 : 0.09) * pulse;
        }
        context.lineWidth = Math.max(2, tileWidth * (strong ? 0.026 : 0.018));
        pathPolygon(context, polygon);
        context.stroke();
        if (strong) {
            const top = polygon[0];
            context.fillStyle = theme.accent;
            context.beginPath();
            context.moveTo(top.x, top.y - tileWidth * 0.10);
            context.lineTo(top.x - tileWidth * 0.045, top.y - tileWidth * 0.17);
            context.lineTo(top.x + tileWidth * 0.045, top.y - tileWidth * 0.17);
            context.closePath();
            context.fill();
        }
        context.restore();
    }
    #drawImpact(projected, center, theme, time) {
        const impact = this.#impacts.get(projected.tile.id);
        if (!impact || time < impact.start)
            return;
        const progress = clamp((time - impact.start) / Math.max(1, impact.duration), 0, 1);
        if (progress >= 1)
            return;
        const context = this.#context;
        const alpha = (1 - progress) * impact.strength;
        const radius = projected.tileWidth * (0.12 + progress * 0.34) * impact.strength;
        context.save();
        context.globalAlpha = clamp(alpha, 0, 1);
        context.strokeStyle = impact.kind === 'hint' ? theme.accent : impact.kind === 'power' ? theme.aqua : theme.brassLight;
        if (this.#profile.useExpensiveShadows) {
            context.shadowColor = context.strokeStyle;
            context.shadowBlur = projected.tileWidth * 0.08 * (1 - progress);
        }
        context.lineWidth = Math.max(1.5, projected.tileWidth * 0.018 * (1 - progress * 0.55));
        context.beginPath();
        context.ellipse(center.x, center.y, radius, radius * 0.52, 0, 0, Math.PI * 2);
        context.stroke();
        context.restore();
    }
    #drawLeak(projected, center, direction, theme, time) {
        const context = this.#context;
        const vector = this.#directionVector(direction, Math.round(projected.tile.visualTurns), projected.tileWidth, projected.tileHeight);
        const x = center.x + vector.x * 0.48;
        const y = center.y + vector.y * 0.48;
        const scale = projected.tileWidth / 150;
        context.save();
        context.strokeStyle = theme.aqua;
        if (this.#profile.useExpensiveShadows) {
            context.shadowColor = theme.aqua;
            context.shadowBlur = 15 * scale;
        }
        context.lineCap = 'round';
        const streamCount = this.#profile.quality === 'high' ? 4 : 2;
        for (let index = 0; index < streamCount; index += 1) {
            const wobble = this.#reducedMotion ? 0 : Math.sin(time * 0.008 + index) * 4 * scale;
            context.globalAlpha = 0.35 + index * 0.12;
            context.lineWidth = (1.2 + index * 0.45) * scale;
            context.beginPath();
            context.moveTo(x, y);
            context.quadraticCurveTo(x + wobble, y - (15 + index * 5) * scale, x + (index - 1.5) * 5 * scale, y - (26 + index * 4) * scale);
            context.stroke();
        }
        context.globalAlpha = 1;
        const badgeX = x + 14 * scale;
        const badgeY = y - 24 * scale;
        context.shadowColor = 'rgba(0,0,0,.45)';
        context.shadowBlur = 7 * scale;
        context.fillStyle = '#d9504f';
        context.strokeStyle = '#fff0d7';
        context.lineWidth = 2 * scale;
        context.beginPath();
        context.arc(badgeX, badgeY, 9 * scale, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
        context.fillStyle = '#fff';
        context.font = `800 ${12 * scale}px system-ui`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('!', badgeX, badgeY + scale);
        context.restore();
    }
    #directionVector(bit, turns, tileWidth, tileHeight) {
        const base = bit === NORTH ? { x: 0, y: -1 } : bit === EAST ? { x: 1, y: 0 } : bit === SOUTH ? { x: 0, y: 1 } : { x: -1, y: 0 };
        const angle = (turns + this.#viewTurns) * Math.PI * 0.5;
        const rx = base.x * Math.cos(angle) - base.y * Math.sin(angle);
        const ry = base.x * Math.sin(angle) + base.y * Math.cos(angle);
        return { x: (rx - ry) * tileWidth * 0.5, y: (rx + ry) * tileHeight * 0.5 };
    }
    #emitPendingBursts(time) {
        if (this.#pendingBursts.length === 0)
            return;
        const remaining = [];
        for (const burst of this.#pendingBursts) {
            if (time < burst.start) {
                remaining.push(burst);
                continue;
            }
            const projected = this.#projected.find((candidate) => candidate.tile.id === burst.tileId);
            if (!projected) {
                remaining.push(burst);
                continue;
            }
            this.#spawnTileBurst(projected, burst.kind);
        }
        this.#pendingBursts = remaining;
    }
    #spawnTileBurst(projected, kind) {
        if (this.#reducedMotion)
            return;
        const high = this.#profile.quality === 'high';
        const count = kind === 'bloom'
            ? Math.max(5, Math.round((high ? 13 : 7) * this.#profile.particleScale))
            : Math.max(4, Math.round((high ? 9 : 5) * this.#profile.particleScale));
        const palette = projected.tile.plantKind ? PLANT_PALETTES[projected.tile.plantKind] : null;
        const originY = projected.center.y - projected.tileHeight * (kind === 'bloom' ? 0.48 : 0.08);
        for (let index = 0; index < count; index += 1) {
            const angle = kind === 'bloom'
                ? Math.random() * Math.PI * 2
                : -Math.PI * (0.18 + Math.random() * 0.64);
            const speed = kind === 'bloom' ? 26 + Math.random() * 62 : 18 + Math.random() * 46;
            const particleKind = kind === 'bloom'
                ? (Math.random() > 0.35 ? 'petal' : 'spark')
                : (Math.random() > 0.55 ? 'droplet' : 'spark');
            const color = kind === 'bloom'
                ? (palette?.[index % 3] ?? '#fff0a8')
                : (particleKind === 'droplet' ? '#83fff0' : '#fff2bd');
            const life = 0.65 + Math.random() * (kind === 'bloom' ? 0.8 : 0.45);
            this.#particles.push({
                x: projected.center.x + (Math.random() - 0.5) * projected.tileWidth * 0.08,
                y: originY + (Math.random() - 0.5) * projected.tileHeight * 0.08,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - (kind === 'bloom' ? 24 : 9),
                life,
                maxLife: life,
                size: 1.5 + Math.random() * (kind === 'bloom' ? 3.2 : 2.2),
                kind: particleKind,
                color,
                rotation: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 7,
                gravity: particleKind === 'droplet' ? 78 : particleKind === 'petal' ? 25 : 44,
            });
        }
        this.#trimParticles();
    }
    #bloomBurst() {
        if (this.#reducedMotion)
            return;
        for (const projected of this.#projected) {
            if (projected.tile.kind !== 'plant')
                continue;
            const count = Math.max(5, Math.round(18 * this.#profile.particleScale));
            const palette = projected.tile.plantKind ? PLANT_PALETTES[projected.tile.plantKind] : null;
            for (let index = 0; index < count; index += 1) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 22 + Math.random() * 66;
                const life = 0.9 + Math.random() * 0.9;
                this.#particles.push({
                    x: projected.center.x,
                    y: projected.center.y - projected.tileHeight * 0.48,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 32,
                    life,
                    maxLife: life,
                    size: 1.8 + Math.random() * 3.5,
                    kind: Math.random() > 0.45 ? 'petal' : 'spark',
                    color: palette?.[index % 3] ?? '#fff0a8',
                    rotation: Math.random() * Math.PI * 2,
                    spin: (Math.random() - 0.5) * 6,
                    gravity: 24 + Math.random() * 16,
                });
            }
        }
        this.#trimParticles();
    }
    #trimParticles() {
        const maximum = this.#profile.quality === 'high' ? 180 : 84;
        if (this.#particles.length > maximum)
            this.#particles.splice(0, this.#particles.length - maximum);
    }
    #drawParticles(_time, theme) {
        const context = this.#context;
        for (const particle of this.#particles) {
            const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
            context.save();
            context.globalAlpha = alpha;
            context.translate(particle.x, particle.y);
            context.rotate(particle.rotation);
            context.fillStyle = particle.color;
            if (this.#profile.useExpensiveShadows) {
                context.shadowColor = particle.kind === 'spark' ? theme.aqua : particle.color;
                context.shadowBlur = particle.size * 3;
            }
            if (particle.kind === 'petal') {
                context.beginPath();
                context.ellipse(0, 0, particle.size * 1.5, particle.size * 0.65, 0, 0, Math.PI * 2);
                context.fill();
            }
            else if (particle.kind === 'droplet') {
                context.beginPath();
                context.moveTo(0, -particle.size * 1.5);
                context.quadraticCurveTo(particle.size, -particle.size * 0.2, 0, particle.size * 1.25);
                context.quadraticCurveTo(-particle.size, -particle.size * 0.2, 0, -particle.size * 1.5);
                context.fill();
            }
            else {
                context.rotate(Math.PI / 4);
                context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
            }
            context.restore();
        }
    }
    #drawProgressFlash(time, theme) {
        if (this.#progressFlashStart <= 0 || time >= this.#progressFlashEnd)
            return;
        const progress = clamp((time - this.#progressFlashStart) / Math.max(1, this.#progressFlashEnd - this.#progressFlashStart), 0, 1);
        const alpha = Math.sin(progress * Math.PI) * (this.#profile.quality === 'high' ? 0.16 : 0.08);
        const context = this.#context;
        context.save();
        if (this.#profile.quality === 'high') {
            const radius = Math.max(this.#width, this.#height) * (0.18 + progress * 0.32);
            const glow = context.createRadialGradient(this.#width * 0.5, this.#height * 0.52, 0, this.#width * 0.5, this.#height * 0.52, radius);
            glow.addColorStop(0, withAlpha(theme.aqua, alpha));
            glow.addColorStop(0.48, withAlpha(theme.accent, alpha * 0.45));
            glow.addColorStop(1, 'rgba(0,0,0,0)');
            context.fillStyle = glow;
        }
        else {
            context.fillStyle = withAlpha(theme.aqua, alpha * 0.38);
        }
        context.fillRect(0, 0, this.#width, this.#height);
        context.restore();
    }
    #drawVictory(time, theme) {
        if (this.#victoryEnd <= time || this.#victoryStart <= 0)
            return;
        const progress = Math.max(0, Math.min(1, (time - this.#victoryStart) / (this.#victoryEnd - this.#victoryStart)));
        const context = this.#context;
        const alpha = Math.sin(progress * Math.PI);
        context.save();
        const glow = context.createRadialGradient(this.#width / 2, this.#height * 0.48, 0, this.#width / 2, this.#height * 0.48, Math.max(this.#width, this.#height) * 0.55);
        glow.addColorStop(0, `${theme.aqua}${Math.round(alpha * 76).toString(16).padStart(2, '0')}`);
        glow.addColorStop(0.35, `${theme.accent}${Math.round(alpha * 34).toString(16).padStart(2, '0')}`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, this.#width, this.#height);
        if (!this.#reducedMotion) {
            context.translate(this.#width / 2, this.#height * 0.48);
            context.strokeStyle = `${theme.accent}${Math.round(alpha * 120).toString(16).padStart(2, '0')}`;
            context.lineWidth = 2;
            const rayCount = this.#profile.quality === 'high' ? 16 : 8;
            for (let index = 0; index < rayCount; index += 1) {
                context.rotate(Math.PI * 2 / rayCount);
                context.beginPath();
                context.moveTo(80, 0);
                context.lineTo(100 + progress * this.#width * 0.28, 0);
                context.stroke();
            }
        }
        context.restore();
    }
    #createDust() {
        const count = this.#profile.dustCount;
        this.#dust = Array.from({ length: count }, () => ({
            x: Math.random(),
            y: Math.random(),
            phase: Math.random() * Math.PI * 2,
            speed: 0.006 + Math.random() * 0.014,
            size: 0.6 + Math.random() * 1.8,
        }));
    }
}
function diamond(center, width, height) {
    return [
        { x: center.x, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y },
        { x: center.x, y: center.y + height / 2 },
        { x: center.x - width / 2, y: center.y },
    ];
}
function insetDiamond(center, width, height) { return diamond(center, width, height); }
function pathPolygon(context, points) {
    context.beginPath();
    const first = points[0];
    if (!first)
        return;
    context.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        context.lineTo(point.x, point.y);
    }
    context.closePath();
}
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const currentPoint = polygon[index];
        const previousPoint = polygon[previous];
        const intersects = currentPoint.y > point.y !== previousPoint.y > point.y &&
            point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 1e-9) + currentPoint.x;
        if (intersects)
            inside = !inside;
    }
    return inside;
}
function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (typeof context.roundRect === 'function') {
        context.roundRect(x, y, width, height, radius);
        return;
    }
    const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
}
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
function round(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
function easeInOut(value) {
    const t = clamp(value, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
function easeOutBack(value, overshoot = 0.6) {
    const t = clamp(value, 0, 1) - 1;
    return 1 + (overshoot + 1) * t ** 3 + overshoot * t ** 2;
}
function withAlpha(hex, alpha) {
    const normalized = hex.replace('#', '');
    if (normalized.length !== 6)
        return `rgba(255,255,255,${clamp(alpha, 0, 1)})`;
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red},${green},${blue},${clamp(alpha, 0, 1)})`;
}
function mixHex(from, to, amount) {
    const first = parseHex(from);
    const second = parseHex(to);
    const t = clamp(amount, 0, 1);
    const red = Math.round(first[0] + (second[0] - first[0]) * t);
    const green = Math.round(first[1] + (second[1] - first[1]) * t);
    const blue = Math.round(first[2] + (second[2] - first[2]) * t);
    return `rgb(${red}, ${green}, ${blue})`;
}
function parseHex(value) {
    const normalized = value.replace('#', '');
    if (normalized.length !== 6)
        return [255, 255, 255];
    return [
        Number.parseInt(normalized.slice(0, 2), 16),
        Number.parseInt(normalized.slice(2, 4), 16),
        Number.parseInt(normalized.slice(4, 6), 16),
    ];
}
function drawStar(context, x, y, outer, inner, points, rotation) {
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
        const angle = rotation - Math.PI / 2 + (Math.PI * index) / points;
        const radius = index % 2 === 0 ? outer : inner;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (index === 0)
            context.moveTo(px, py);
        else
            context.lineTo(px, py);
    }
    context.closePath();
}
//# sourceMappingURL=renderer.js.map