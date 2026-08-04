var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ConservatoryRenderer_instances, _ConservatoryRenderer_canvas, _ConservatoryRenderer_context, _ConservatoryRenderer_resizeObserver, _ConservatoryRenderer_assets, _ConservatoryRenderer_puzzle, _ConservatoryRenderer_analysis, _ConservatoryRenderer_selectedId, _ConservatoryRenderer_hoveredId, _ConservatoryRenderer_hintId, _ConservatoryRenderer_coachId, _ConservatoryRenderer_hintUntil, _ConservatoryRenderer_displayTurns, _ConservatoryRenderer_projectedTiles, _ConservatoryRenderer_viewTurns, _ConservatoryRenderer_targetViewTurns, _ConservatoryRenderer_width, _ConservatoryRenderer_height, _ConservatoryRenderer_dpr, _ConservatoryRenderer_lastTimestamp, _ConservatoryRenderer_animationFrame, _ConservatoryRenderer_running, _ConservatoryRenderer_reducedMotion, _ConservatoryRenderer_highContrast, _ConservatoryRenderer_quality, _ConservatoryRenderer_profile, _ConservatoryRenderer_particles, _ConservatoryRenderer_motes, _ConservatoryRenderer_scene, _ConservatoryRenderer_victoryStartedAt, _ConservatoryRenderer_victoryEndsAt, _ConservatoryRenderer_boardPulse, _ConservatoryRenderer_assetsReady, _ConservatoryRenderer_ensureAsset, _ConservatoryRenderer_resolveProfile, _ConservatoryRenderer_createMotes, _ConservatoryRenderer_frame, _ConservatoryRenderer_update, _ConservatoryRenderer_draw, _ConservatoryRenderer_drawBackground, _ConservatoryRenderer_projectBoard, _ConservatoryRenderer_projectPoint, _ConservatoryRenderer_drawBoardShadow, _ConservatoryRenderer_drawTile, _ConservatoryRenderer_drawTileTexture, _ConservatoryRenderer_drawRivets, _ConservatoryRenderer_drawMechanism, _ConservatoryRenderer_drawPipe, _ConservatoryRenderer_drawGear, _ConservatoryRenderer_drawSunwell, _ConservatoryRenderer_drawPlant, _ConservatoryRenderer_drawAnchor, _ConservatoryRenderer_drawHover, _ConservatoryRenderer_drawCoach, _ConservatoryRenderer_drawHint, _ConservatoryRenderer_drawTileLeaks, _ConservatoryRenderer_drawLeak, _ConservatoryRenderer_offsetPoint, _ConservatoryRenderer_spawnBloomParticles, _ConservatoryRenderer_drawParticles, _ConservatoryRenderer_drawCelebration, _ConservatoryRenderer_drawAmbientForeground;
import { hashSeed } from '../core/random.js';
import { DIRECTIONS, EAST, NORTH, SOUTH, WEST, } from '../core/types.js';
const PROFILES = {
    high: { dprCap: 2, motes: 72, pipeGlow: 22, shadows: true, texture: true },
    balanced: { dprCap: 1.65, motes: 40, pipeGlow: 14, shadows: true, texture: true },
    low: { dprCap: 1.2, motes: 16, pipeGlow: 7, shadows: false, texture: false },
};
const PLANT_COLORS = {
    lumen: ['#d7fff5', '#73eaff', '#2a86c7'],
    orchid: ['#ffe0ff', '#c176ff', '#6e43c5'],
    starbell: ['#fffbd9', '#fff2a4', '#7adcc8'],
    ember: ['#fff0aa', '#ff8d58', '#c93655'],
    moonfern: ['#c8ffdc', '#54d7ad', '#237c7f'],
};
const DIRECTION_VECTOR = {
    [NORTH]: [0, -1],
    [EAST]: [1, 0],
    [SOUTH]: [0, 1],
    [WEST]: [-1, 0],
};
export class ConservatoryRenderer {
    constructor(canvas) {
        _ConservatoryRenderer_instances.add(this);
        _ConservatoryRenderer_canvas.set(this, void 0);
        _ConservatoryRenderer_context.set(this, void 0);
        _ConservatoryRenderer_resizeObserver.set(this, void 0);
        _ConservatoryRenderer_assets.set(this, new Map());
        _ConservatoryRenderer_puzzle.set(this, null);
        _ConservatoryRenderer_analysis.set(this, null);
        _ConservatoryRenderer_selectedId.set(this, null);
        _ConservatoryRenderer_hoveredId.set(this, null);
        _ConservatoryRenderer_hintId.set(this, null);
        _ConservatoryRenderer_coachId.set(this, null);
        _ConservatoryRenderer_hintUntil.set(this, 0);
        _ConservatoryRenderer_displayTurns.set(this, new Map());
        _ConservatoryRenderer_projectedTiles.set(this, []);
        _ConservatoryRenderer_viewTurns.set(this, 0);
        _ConservatoryRenderer_targetViewTurns.set(this, 0);
        _ConservatoryRenderer_width.set(this, 1);
        _ConservatoryRenderer_height.set(this, 1);
        _ConservatoryRenderer_dpr.set(this, 1);
        _ConservatoryRenderer_lastTimestamp.set(this, 0);
        _ConservatoryRenderer_animationFrame.set(this, 0);
        _ConservatoryRenderer_running.set(this, true);
        _ConservatoryRenderer_reducedMotion.set(this, false);
        _ConservatoryRenderer_highContrast.set(this, false);
        _ConservatoryRenderer_quality.set(this, 'auto');
        _ConservatoryRenderer_profile.set(this, PROFILES.balanced);
        _ConservatoryRenderer_particles.set(this, []);
        _ConservatoryRenderer_motes.set(this, []);
        _ConservatoryRenderer_scene.set(this, 'menu');
        _ConservatoryRenderer_victoryStartedAt.set(this, 0);
        _ConservatoryRenderer_victoryEndsAt.set(this, 0);
        _ConservatoryRenderer_boardPulse.set(this, 0);
        _ConservatoryRenderer_assetsReady.set(this, false);
        __classPrivateFieldSet(this, _ConservatoryRenderer_canvas, canvas, "f");
        const context = canvas.getContext('2d', { alpha: false });
        if (!context)
            throw new Error('Canvas 2D is unavailable.');
        __classPrivateFieldSet(this, _ConservatoryRenderer_context, context, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_resizeObserver, new ResizeObserver(() => this.resize()), "f");
        __classPrivateFieldGet(this, _ConservatoryRenderer_resizeObserver, "f").observe(canvas);
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_resolveProfile).call(this);
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_createMotes).call(this);
        this.resize();
        __classPrivateFieldSet(this, _ConservatoryRenderer_animationFrame, requestAnimationFrame((timestamp) => __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_frame).call(this, timestamp)), "f");
    }
    async preload() {
        // Only the title-scene art blocks first interaction. Gameplay, map and victory
        // backdrops are streamed when their scene is requested.
        await __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_ensureAsset).call(this, 'atrium');
        __classPrivateFieldSet(this, _ConservatoryRenderer_assetsReady, true, "f");
    }
    destroy() {
        __classPrivateFieldSet(this, _ConservatoryRenderer_running, false, "f");
        cancelAnimationFrame(__classPrivateFieldGet(this, _ConservatoryRenderer_animationFrame, "f"));
        __classPrivateFieldGet(this, _ConservatoryRenderer_resizeObserver, "f").disconnect();
    }
    setScene(scene) {
        __classPrivateFieldSet(this, _ConservatoryRenderer_scene, scene, "f");
        if (scene === 'menu')
            void __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_ensureAsset).call(this, 'atrium');
        else if (scene === 'game') {
            void __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_ensureAsset).call(this, 'garden');
            void __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_ensureAsset).call(this, 'portrait');
        }
        else if (scene === 'map')
            void __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_ensureAsset).call(this, 'map');
        else
            void __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_ensureAsset).call(this, 'victory');
    }
    setPuzzle(puzzle) {
        __classPrivateFieldSet(this, _ConservatoryRenderer_puzzle, puzzle, "f");
        __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").clear();
        for (const tile of puzzle.tiles)
            __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").set(tile.id, tile.visualTurns);
        __classPrivateFieldSet(this, _ConservatoryRenderer_selectedId, puzzle.sourceId, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_hoveredId, null, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_hintId, null, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_coachId, null, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_particles, [], "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_victoryStartedAt, 0, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_victoryEndsAt, 0, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_boardPulse, 0, "f");
    }
    setAnalysis(analysis) { __classPrivateFieldSet(this, _ConservatoryRenderer_analysis, analysis, "f"); }
    setSelected(tileId) { __classPrivateFieldSet(this, _ConservatoryRenderer_selectedId, tileId, "f"); }
    setHovered(tileId) { __classPrivateFieldSet(this, _ConservatoryRenderer_hoveredId, tileId, "f"); }
    setCoach(tileId) { __classPrivateFieldSet(this, _ConservatoryRenderer_coachId, tileId, "f"); }
    setHint(tileId, durationMs = 5000) {
        __classPrivateFieldSet(this, _ConservatoryRenderer_hintId, tileId, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_hintUntil, performance.now() + durationMs, "f");
    }
    clearHint() { __classPrivateFieldSet(this, _ConservatoryRenderer_hintId, null, "f"); }
    setReducedMotion(enabled) {
        __classPrivateFieldSet(this, _ConservatoryRenderer_reducedMotion, enabled, "f");
        if (enabled) {
            __classPrivateFieldSet(this, _ConservatoryRenderer_viewTurns, __classPrivateFieldGet(this, _ConservatoryRenderer_targetViewTurns, "f"), "f");
            if (__classPrivateFieldGet(this, _ConservatoryRenderer_puzzle, "f")) {
                for (const tile of __classPrivateFieldGet(this, _ConservatoryRenderer_puzzle, "f").tiles)
                    __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").set(tile.id, tile.visualTurns);
            }
        }
    }
    setHighContrast(enabled) { __classPrivateFieldSet(this, _ConservatoryRenderer_highContrast, enabled, "f"); }
    setQuality(quality) {
        __classPrivateFieldSet(this, _ConservatoryRenderer_quality, quality, "f");
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_resolveProfile).call(this);
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_createMotes).call(this);
        this.resize();
    }
    rotateView(delta) {
        __classPrivateFieldSet(this, _ConservatoryRenderer_targetViewTurns, __classPrivateFieldGet(this, _ConservatoryRenderer_targetViewTurns, "f") + delta, "f");
        if (__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f"))
            __classPrivateFieldSet(this, _ConservatoryRenderer_viewTurns, __classPrivateFieldGet(this, _ConservatoryRenderer_targetViewTurns, "f"), "f");
    }
    syncTile(tile) {
        if (!__classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").has(tile.id))
            __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").set(tile.id, tile.visualTurns);
        __classPrivateFieldSet(this, _ConservatoryRenderer_boardPulse, 1, "f");
    }
    hitTest(clientX, clientY) {
        const rect = __classPrivateFieldGet(this, _ConservatoryRenderer_canvas, "f").getBoundingClientRect();
        const point = { x: clientX - rect.left, y: clientY - rect.top };
        for (let index = __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").length - 1; index >= 0; index -= 1) {
            const projected = __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f")[index];
            if (projected && pointInPolygon(point, projected.polygon))
                return projected.tile.id;
        }
        return null;
    }
    startVictorySequence(durationMs = 2150) {
        const now = performance.now();
        __classPrivateFieldSet(this, _ConservatoryRenderer_victoryStartedAt, now, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_victoryEndsAt, now + Math.max(400, durationMs), "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_selectedId, null, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_hoveredId, null, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_hintId, null, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_coachId, null, "f");
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_spawnBloomParticles).call(this);
    }
    pause() {
        __classPrivateFieldSet(this, _ConservatoryRenderer_running, false, "f");
        cancelAnimationFrame(__classPrivateFieldGet(this, _ConservatoryRenderer_animationFrame, "f"));
    }
    resume() {
        if (__classPrivateFieldGet(this, _ConservatoryRenderer_running, "f"))
            return;
        __classPrivateFieldSet(this, _ConservatoryRenderer_running, true, "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_lastTimestamp, performance.now(), "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_animationFrame, requestAnimationFrame((timestamp) => __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_frame).call(this, timestamp)), "f");
    }
    resize() {
        const rect = __classPrivateFieldGet(this, _ConservatoryRenderer_canvas, "f").getBoundingClientRect();
        __classPrivateFieldSet(this, _ConservatoryRenderer_width, Math.max(1, rect.width), "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_height, Math.max(1, rect.height), "f");
        __classPrivateFieldSet(this, _ConservatoryRenderer_dpr, Math.min(__classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").dprCap, Math.max(1, window.devicePixelRatio || 1)), "f");
        const physicalWidth = Math.round(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * __classPrivateFieldGet(this, _ConservatoryRenderer_dpr, "f"));
        const physicalHeight = Math.round(__classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * __classPrivateFieldGet(this, _ConservatoryRenderer_dpr, "f"));
        if (__classPrivateFieldGet(this, _ConservatoryRenderer_canvas, "f").width !== physicalWidth || __classPrivateFieldGet(this, _ConservatoryRenderer_canvas, "f").height !== physicalHeight) {
            __classPrivateFieldGet(this, _ConservatoryRenderer_canvas, "f").width = physicalWidth;
            __classPrivateFieldGet(this, _ConservatoryRenderer_canvas, "f").height = physicalHeight;
        }
        __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f").setTransform(__classPrivateFieldGet(this, _ConservatoryRenderer_dpr, "f"), 0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_dpr, "f"), 0, 0);
    }
}
_ConservatoryRenderer_canvas = new WeakMap(), _ConservatoryRenderer_context = new WeakMap(), _ConservatoryRenderer_resizeObserver = new WeakMap(), _ConservatoryRenderer_assets = new WeakMap(), _ConservatoryRenderer_puzzle = new WeakMap(), _ConservatoryRenderer_analysis = new WeakMap(), _ConservatoryRenderer_selectedId = new WeakMap(), _ConservatoryRenderer_hoveredId = new WeakMap(), _ConservatoryRenderer_hintId = new WeakMap(), _ConservatoryRenderer_coachId = new WeakMap(), _ConservatoryRenderer_hintUntil = new WeakMap(), _ConservatoryRenderer_displayTurns = new WeakMap(), _ConservatoryRenderer_projectedTiles = new WeakMap(), _ConservatoryRenderer_viewTurns = new WeakMap(), _ConservatoryRenderer_targetViewTurns = new WeakMap(), _ConservatoryRenderer_width = new WeakMap(), _ConservatoryRenderer_height = new WeakMap(), _ConservatoryRenderer_dpr = new WeakMap(), _ConservatoryRenderer_lastTimestamp = new WeakMap(), _ConservatoryRenderer_animationFrame = new WeakMap(), _ConservatoryRenderer_running = new WeakMap(), _ConservatoryRenderer_reducedMotion = new WeakMap(), _ConservatoryRenderer_highContrast = new WeakMap(), _ConservatoryRenderer_quality = new WeakMap(), _ConservatoryRenderer_profile = new WeakMap(), _ConservatoryRenderer_particles = new WeakMap(), _ConservatoryRenderer_motes = new WeakMap(), _ConservatoryRenderer_scene = new WeakMap(), _ConservatoryRenderer_victoryStartedAt = new WeakMap(), _ConservatoryRenderer_victoryEndsAt = new WeakMap(), _ConservatoryRenderer_boardPulse = new WeakMap(), _ConservatoryRenderer_assetsReady = new WeakMap(), _ConservatoryRenderer_instances = new WeakSet(), _ConservatoryRenderer_ensureAsset = async function _ConservatoryRenderer_ensureAsset(key) {
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_assets, "f").has(key))
        return;
    const defaults = {
        atrium: './assets/atrium-desktop.webp',
        garden: './assets/garden-desktop.webp',
        portrait: './assets/garden-portrait.webp',
        map: './assets/map-desktop.webp',
        victory: './assets/victory-desktop.webp',
    };
    const source = window.__clockworkAssetUrls?.[key] ?? defaults[key];
    try {
        __classPrivateFieldGet(this, _ConservatoryRenderer_assets, "f").set(key, await loadImage(source));
    }
    catch {
        // The procedural fallback remains fully playable when an image is unavailable.
    }
}, _ConservatoryRenderer_resolveProfile = function _ConservatoryRenderer_resolveProfile() {
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_quality, "f") !== 'auto') {
        __classPrivateFieldSet(this, _ConservatoryRenderer_profile, PROFILES[__classPrivateFieldGet(this, _ConservatoryRenderer_quality, "f")], "f");
        return;
    }
    const memory = Number(navigator.deviceMemory ?? 4);
    const cores = navigator.hardwareConcurrency || 4;
    __classPrivateFieldSet(this, _ConservatoryRenderer_profile, memory <= 2 || cores <= 2 ? PROFILES.low : memory <= 4 || cores <= 4 ? PROFILES.balanced : PROFILES.high, "f");
}, _ConservatoryRenderer_createMotes = function _ConservatoryRenderer_createMotes() {
    const count = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").motes;
    __classPrivateFieldSet(this, _ConservatoryRenderer_motes, Array.from({ length: count }, (_, index) => ({
        x: ((hashSeed(`mote-x-${index}`) % 10000) / 10000),
        y: ((hashSeed(`mote-y-${index}`) % 10000) / 10000),
        speed: 0.012 + ((hashSeed(`mote-speed-${index}`) % 1000) / 1000) * 0.026,
        drift: 0.8 + ((hashSeed(`mote-drift-${index}`) % 1000) / 1000) * 2.6,
        phase: ((hashSeed(`mote-phase-${index}`) % 6283) / 1000),
        size: 0.7 + ((hashSeed(`mote-size-${index}`) % 1000) / 1000) * 2.1,
    })), "f");
}, _ConservatoryRenderer_frame = function _ConservatoryRenderer_frame(timestamp) {
    if (!__classPrivateFieldGet(this, _ConservatoryRenderer_running, "f"))
        return;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - __classPrivateFieldGet(this, _ConservatoryRenderer_lastTimestamp, "f")) / 1000 || 0));
    __classPrivateFieldSet(this, _ConservatoryRenderer_lastTimestamp, timestamp, "f");
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_update).call(this, deltaSeconds, timestamp);
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_draw).call(this, timestamp);
    __classPrivateFieldSet(this, _ConservatoryRenderer_animationFrame, requestAnimationFrame((next) => __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_frame).call(this, next)), "f");
}, _ConservatoryRenderer_update = function _ConservatoryRenderer_update(deltaSeconds, timestamp) {
    const smoothing = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 1 : 1 - Math.exp(-deltaSeconds * 9.8);
    __classPrivateFieldSet(this, _ConservatoryRenderer_viewTurns, __classPrivateFieldGet(this, _ConservatoryRenderer_viewTurns, "f") + (__classPrivateFieldGet(this, _ConservatoryRenderer_targetViewTurns, "f") - __classPrivateFieldGet(this, _ConservatoryRenderer_viewTurns, "f")) * smoothing, "f");
    if (Math.abs(__classPrivateFieldGet(this, _ConservatoryRenderer_targetViewTurns, "f") - __classPrivateFieldGet(this, _ConservatoryRenderer_viewTurns, "f")) < 0.0005)
        __classPrivateFieldSet(this, _ConservatoryRenderer_viewTurns, __classPrivateFieldGet(this, _ConservatoryRenderer_targetViewTurns, "f"), "f");
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_puzzle, "f")) {
        for (const tile of __classPrivateFieldGet(this, _ConservatoryRenderer_puzzle, "f").tiles) {
            const current = __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").get(tile.id) ?? tile.visualTurns;
            const next = current + (tile.visualTurns - current) * smoothing;
            __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").set(tile.id, Math.abs(tile.visualTurns - next) < 0.001 ? tile.visualTurns : next);
        }
    }
    __classPrivateFieldSet(this, _ConservatoryRenderer_boardPulse, Math.max(0, __classPrivateFieldGet(this, _ConservatoryRenderer_boardPulse, "f") - deltaSeconds * 2.4), "f");
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_hintId, "f") && timestamp > __classPrivateFieldGet(this, _ConservatoryRenderer_hintUntil, "f"))
        __classPrivateFieldSet(this, _ConservatoryRenderer_hintId, null, "f");
    if (!__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f")) {
        for (const mote of __classPrivateFieldGet(this, _ConservatoryRenderer_motes, "f")) {
            mote.y -= mote.speed * deltaSeconds;
            mote.x += Math.sin(timestamp * 0.00035 + mote.phase) * deltaSeconds * 0.004 * mote.drift;
            if (mote.y < -0.03) {
                mote.y = 1.03;
                mote.x = (mote.x + 0.37) % 1;
            }
            if (mote.x < -0.04)
                mote.x = 1.04;
            if (mote.x > 1.04)
                mote.x = -0.04;
        }
        for (const particle of __classPrivateFieldGet(this, _ConservatoryRenderer_particles, "f")) {
            particle.life -= deltaSeconds;
            particle.x += particle.vx * deltaSeconds;
            particle.y += particle.vy * deltaSeconds;
            particle.vy += 31 * deltaSeconds;
            particle.vx *= Math.pow(0.965, deltaSeconds * 60);
            particle.spin += deltaSeconds * 3;
        }
        __classPrivateFieldSet(this, _ConservatoryRenderer_particles, __classPrivateFieldGet(this, _ConservatoryRenderer_particles, "f").filter((particle) => particle.life > 0), "f");
    }
}, _ConservatoryRenderer_draw = function _ConservatoryRenderer_draw(timestamp) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    context.setTransform(__classPrivateFieldGet(this, _ConservatoryRenderer_dpr, "f"), 0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_dpr, "f"), 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawBackground).call(this, timestamp);
    if (!__classPrivateFieldGet(this, _ConservatoryRenderer_puzzle, "f") || __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'menu' || __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'map') {
        __classPrivateFieldSet(this, _ConservatoryRenderer_projectedTiles, [], "f");
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawAmbientForeground).call(this, timestamp);
        return;
    }
    __classPrivateFieldSet(this, _ConservatoryRenderer_projectedTiles, __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_projectBoard).call(this, __classPrivateFieldGet(this, _ConservatoryRenderer_puzzle, "f"), timestamp), "f");
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawBoardShadow).call(this);
    for (const projected of __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f"))
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawTile).call(this, projected, timestamp);
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawParticles).call(this);
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawCelebration).call(this, timestamp);
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawAmbientForeground).call(this, timestamp);
}, _ConservatoryRenderer_drawBackground = function _ConservatoryRenderer_drawBackground(timestamp) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const portrait = __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") > __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 1.18;
    const key = __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'menu' ? 'atrium' : __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'map' ? 'map' : __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'victory' ? 'victory' : portrait ? 'portrait' : 'garden';
    const image = __classPrivateFieldGet(this, _ConservatoryRenderer_assets, "f").get(key) ?? __classPrivateFieldGet(this, _ConservatoryRenderer_assets, "f").get('garden');
    if (image?.complete && image.naturalWidth > 0) {
        const parallax = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 0 : Math.sin(timestamp * 0.00007) * Math.min(12, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.008);
        drawImageCover(context, image, -parallax, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") + Math.abs(parallax) * 2, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    }
    else {
        const gradient = context.createLinearGradient(0, 0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
        gradient.addColorStop(0, '#071f24');
        gradient.addColorStop(0.52, '#0d4a42');
        gradient.addColorStop(1, '#061d1b');
        context.fillStyle = gradient;
        context.fillRect(0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    }
    const overlay = context.createLinearGradient(0, 0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    overlay.addColorStop(0, __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'menu' ? 'rgba(2,15,15,.18)' : 'rgba(2,15,15,.28)');
    overlay.addColorStop(0.45, 'rgba(3,24,22,.16)');
    overlay.addColorStop(1, __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'menu' ? 'rgba(1,13,13,.24)' : 'rgba(1,13,13,.52)');
    context.fillStyle = overlay;
    context.fillRect(0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    const centerGlow = context.createRadialGradient(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.5, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.47, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.5, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.47, Math.max(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f")) * 0.56);
    centerGlow.addColorStop(0, 'rgba(39,153,127,.14)');
    centerGlow.addColorStop(0.48, 'rgba(9,50,46,.05)');
    centerGlow.addColorStop(1, __classPrivateFieldGet(this, _ConservatoryRenderer_scene, "f") === 'menu' ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.34)');
    context.fillStyle = centerGlow;
    context.fillRect(0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_assetsReady, "f")) {
        context.save();
        context.globalCompositeOperation = 'screen';
        for (const mote of __classPrivateFieldGet(this, _ConservatoryRenderer_motes, "f")) {
            const alpha = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 0.08 : 0.055 + Math.sin(timestamp * 0.0012 + mote.phase) * 0.035;
            context.fillStyle = `rgba(235, 225, 151, ${Math.max(0.02, alpha)})`;
            context.beginPath();
            context.arc(mote.x * __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), mote.y * __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"), mote.size, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }
}, _ConservatoryRenderer_projectBoard = function _ConservatoryRenderer_projectBoard(puzzle, timestamp) {
    const densePortrait = __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") < 680 && __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") > __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 1.15 && puzzle.tiles.length > 12;
    const cameraAngle = (densePortrait ? 0 : Math.PI / 4) + __classPrivateFieldGet(this, _ConservatoryRenderer_viewTurns, "f") * Math.PI / 2;
    const verticalScale = densePortrait ? 0.72 : 0.52;
    const viewTop = __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") < 680 ? Math.max(150, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.16) : Math.max(98, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.105);
    const viewBottom = __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") < 680 ? Math.max(128, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.125) : Math.max(98, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.11);
    const side = __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") < 680 ? 18 : 38;
    const worldCenterX = (puzzle.width - 1) / 2;
    const worldCenterY = (puzzle.height - 1) / 2;
    const sample = [];
    for (const tile of puzzle.tiles) {
        for (const [ox, oy] of [[-0.52, -0.52], [0.52, -0.52], [0.52, 0.52], [-0.52, 0.52]]) {
            sample.push(projectUnit(tile.x + ox - worldCenterX, tile.y + oy - worldCenterY, cameraAngle, verticalScale));
        }
    }
    const minX = Math.min(...sample.map((point) => point.x));
    const maxX = Math.max(...sample.map((point) => point.x));
    const minY = Math.min(...sample.map((point) => point.y));
    const maxY = Math.max(...sample.map((point) => point.y));
    const rawWidth = Math.max(0.1, maxX - minX);
    const rawHeight = Math.max(0.1, maxY - minY);
    const availableWidth = Math.max(120, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") - side * 2);
    const availableHeight = Math.max(120, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") - viewTop - viewBottom);
    const victoryProgress = __classPrivateFieldGet(this, _ConservatoryRenderer_victoryStartedAt, "f") > 0 ? clamp((timestamp - __classPrivateFieldGet(this, _ConservatoryRenderer_victoryStartedAt, "f")) / 600, 0, 1) : 0;
    const pulse = 1 + __classPrivateFieldGet(this, _ConservatoryRenderer_boardPulse, "f") * 0.008 + easeOutBack(victoryProgress) * 0.028;
    let unit = Math.min(availableWidth / rawWidth, availableHeight / rawHeight) * 0.93 * pulse;
    const maxUnit = __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") < 680 ? Math.min(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.36, 180) : Math.min(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.21, 235);
    unit = Math.min(unit, maxUnit);
    const boardHeight = rawHeight * unit;
    const centerX = __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.5 - ((minX + maxX) * 0.5) * unit;
    const centerY = viewTop + (availableHeight - boardHeight) * 0.48 - minY * unit;
    const projected = puzzle.tiles.map((tile) => {
        const corners = [
            __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_projectPoint).call(this, tile.x - 0.48 - worldCenterX, tile.y - 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
            __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_projectPoint).call(this, tile.x + 0.48 - worldCenterX, tile.y - 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
            __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_projectPoint).call(this, tile.x + 0.48 - worldCenterX, tile.y + 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
            __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_projectPoint).call(this, tile.x - 0.48 - worldCenterX, tile.y + 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
        ];
        const center = __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_projectPoint).call(this, tile.x - worldCenterX, tile.y - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY);
        return {
            tile,
            center,
            polygon: corners,
            depth: center.y + center.x * 0.0001,
            tileWidth: Math.max(distance(corners[0], corners[1]), distance(corners[1], corners[2])),
            tileHeight: Math.min(distance(corners[0], corners[1]), distance(corners[1], corners[2])),
            unit,
            cameraAngle,
            verticalScale,
        };
    });
    return projected.sort((left, right) => left.depth - right.depth);
}, _ConservatoryRenderer_projectPoint = function _ConservatoryRenderer_projectPoint(wx, wy, angle, verticalScale, unit, centerX, centerY) {
    const point = projectUnit(wx, wy, angle, verticalScale);
    return { x: centerX + point.x * unit, y: centerY + point.y * unit };
}, _ConservatoryRenderer_drawBoardShadow = function _ConservatoryRenderer_drawBoardShadow() {
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").length === 0)
        return;
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const xs = __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").flatMap((tile) => tile.polygon.map((point) => point.x));
    const ys = __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").flatMap((tile) => tile.polygon.map((point) => point.y));
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    context.save();
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").shadows)
        context.filter = 'blur(18px)';
    context.fillStyle = 'rgba(0, 7, 7, .56)';
    context.beginPath();
    context.ellipse((left + right) / 2, bottom + (bottom - top) * 0.12, (right - left) * 0.52, Math.max(18, (bottom - top) * 0.17), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
}, _ConservatoryRenderer_drawTile = function _ConservatoryRenderer_drawTile(projected, timestamp) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const { tile, polygon, center, tileWidth, tileHeight } = projected;
    const powered = __classPrivateFieldGet(this, _ConservatoryRenderer_analysis, "f")?.powered.has(tile.id) ?? false;
    const selected = tile.id === __classPrivateFieldGet(this, _ConservatoryRenderer_selectedId, "f");
    const hovered = tile.id === __classPrivateFieldGet(this, _ConservatoryRenderer_hoveredId, "f");
    const hinted = tile.id === __classPrivateFieldGet(this, _ConservatoryRenderer_hintId, "f");
    const coached = tile.id === __classPrivateFieldGet(this, _ConservatoryRenderer_coachId, "f");
    const thickness = Math.max(8, tileHeight * 0.29);
    context.save();
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").shadows) {
        context.shadowColor = 'rgba(0, 0, 0, .4)';
        context.shadowBlur = Math.max(8, tileWidth * 0.08);
        context.shadowOffsetY = Math.max(6, tileHeight * 0.16);
    }
    for (let index = 0; index < 4; index += 1) {
        const a = polygon[index];
        const b = polygon[(index + 1) % 4];
        const brightness = ((a.x + b.x) / 2 < center.x ? 0.82 : 1);
        const gradient = context.createLinearGradient(0, Math.min(a.y, b.y), 0, Math.max(a.y, b.y) + thickness);
        gradient.addColorStop(0, brightness < 0.9 ? '#173f3a' : '#24544a');
        gradient.addColorStop(0.18, '#12352f');
        gradient.addColorStop(1, '#061b1a');
        context.fillStyle = gradient;
        tracePolygon(context, [a, b, { x: b.x, y: b.y + thickness }, { x: a.x, y: a.y + thickness }]);
        context.fill();
        context.strokeStyle = 'rgba(3, 14, 13, .72)';
        context.lineWidth = 1;
        context.stroke();
    }
    context.restore();
    context.save();
    const topGradient = context.createLinearGradient(center.x - tileWidth * 0.34, center.y - tileHeight * 0.48, center.x + tileWidth * 0.36, center.y + tileHeight * 0.5);
    if (powered) {
        topGradient.addColorStop(0, __classPrivateFieldGet(this, _ConservatoryRenderer_highContrast, "f") ? '#2b7665' : '#23635a');
        topGradient.addColorStop(0.52, __classPrivateFieldGet(this, _ConservatoryRenderer_highContrast, "f") ? '#1f675d' : '#194e47');
        topGradient.addColorStop(1, '#123c38');
    }
    else {
        topGradient.addColorStop(0, __classPrivateFieldGet(this, _ConservatoryRenderer_highContrast, "f") ? '#31554d' : '#244a43');
        topGradient.addColorStop(0.52, __classPrivateFieldGet(this, _ConservatoryRenderer_highContrast, "f") ? '#26483f' : '#183b37');
        topGradient.addColorStop(1, '#102f2d');
    }
    context.fillStyle = topGradient;
    tracePolygon(context, polygon);
    context.fill();
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").texture)
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawTileTexture).call(this, projected, timestamp, powered);
    const borderGradient = context.createLinearGradient(polygon[0].x, polygon[0].y, polygon[2].x, polygon[2].y);
    borderGradient.addColorStop(0, selected || hinted || coached ? '#fff0a7' : '#e7be72');
    borderGradient.addColorStop(0.5, selected || hinted || coached ? '#ffd15d' : '#8f6d3d');
    borderGradient.addColorStop(1, selected || hinted || coached ? '#fff4be' : '#d7a95d');
    context.strokeStyle = borderGradient;
    context.lineWidth = selected || hinted || coached ? Math.max(2.5, tileWidth * 0.022) : Math.max(1.1, tileWidth * 0.009);
    if (selected || hinted || coached) {
        context.shadowColor = hinted ? '#8bfff0' : '#ffd96e';
        context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow;
    }
    tracePolygon(context, polygon);
    context.stroke();
    context.strokeStyle = powered ? 'rgba(120, 255, 230, .35)' : 'rgba(255, 248, 207, .12)';
    context.lineWidth = Math.max(0.8, tileWidth * 0.005);
    tracePolygon(context, polygon.map((point) => lerpPoint(point, center, 0.07)));
    context.stroke();
    context.restore();
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawRivets).call(this, projected, powered);
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawMechanism).call(this, projected, timestamp, powered);
    if (tile.fixed)
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawAnchor).call(this, projected);
    if (hovered && !selected)
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawHover).call(this, projected);
    if (coached)
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawCoach).call(this, projected, timestamp);
    if (hinted)
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawHint).call(this, projected, timestamp);
    __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawTileLeaks).call(this, projected, timestamp);
}, _ConservatoryRenderer_drawTileTexture = function _ConservatoryRenderer_drawTileTexture(projected, timestamp, powered) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const { tile, polygon, center, tileWidth, tileHeight } = projected;
    const seed = hashSeed(`${tile.id}:surface`);
    context.save();
    tracePolygon(context, polygon);
    context.clip();
    context.globalAlpha = powered ? 0.13 : 0.09;
    context.strokeStyle = powered ? '#7df6dd' : '#9fc6b8';
    context.lineWidth = Math.max(0.5, tileWidth * 0.004);
    for (let index = 0; index < 4; index += 1) {
        const phase = ((seed >>> (index * 4)) & 15) / 15;
        const radius = tileWidth * (0.12 + phase * 0.14);
        context.beginPath();
        context.ellipse(center.x + Math.sin(seed + index) * tileWidth * 0.12, center.y + Math.cos(seed * 0.01 + index) * tileHeight * 0.16, radius, radius * 0.34, (index + phase) * 0.7, Math.PI * 0.2, Math.PI * 1.5);
        context.stroke();
    }
    context.globalAlpha = 0.08;
    context.fillStyle = '#f1d799';
    const count = 8;
    for (let index = 0; index < count; index += 1) {
        const x = center.x + (((seed + index * 2654435761) % 1000) / 1000 - 0.5) * tileWidth * 0.68;
        const y = center.y + (((seed * 3 + index * 7919) % 1000) / 1000 - 0.5) * tileHeight * 0.55;
        context.beginPath();
        context.arc(x, y, Math.max(0.5, tileWidth * 0.004), 0, Math.PI * 2);
        context.fill();
    }
    if (powered && !__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f")) {
        const sweep = ((timestamp * 0.00009 + (seed % 100) / 100) % 1) * tileWidth * 1.2 - tileWidth * 0.6;
        const sheen = context.createLinearGradient(center.x + sweep - tileWidth * 0.12, center.y, center.x + sweep + tileWidth * 0.12, center.y);
        sheen.addColorStop(0, 'rgba(255,255,255,0)');
        sheen.addColorStop(0.5, 'rgba(167,255,236,.22)');
        sheen.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = sheen;
        context.fillRect(center.x - tileWidth, center.y - tileHeight, tileWidth * 2, tileHeight * 2);
    }
    context.restore();
}, _ConservatoryRenderer_drawRivets = function _ConservatoryRenderer_drawRivets(projected, powered) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const { polygon, center, tileWidth } = projected;
    const radius = Math.max(1.8, tileWidth * 0.018);
    for (const corner of polygon) {
        const point = lerpPoint(corner, center, 0.14);
        const gradient = context.createRadialGradient(point.x - radius * 0.4, point.y - radius * 0.5, 0, point.x, point.y, radius * 1.25);
        gradient.addColorStop(0, '#fff0a8');
        gradient.addColorStop(0.35, powered ? '#cfaa57' : '#b68c49');
        gradient.addColorStop(1, '#4b351e');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(36,22,11,.72)';
        context.lineWidth = Math.max(0.6, radius * 0.28);
        context.stroke();
    }
}, _ConservatoryRenderer_drawMechanism = function _ConservatoryRenderer_drawMechanism(projected, timestamp, powered) {
    const { tile } = projected;
    const displayTurns = __classPrivateFieldGet(this, _ConservatoryRenderer_displayTurns, "f").get(tile.id) ?? tile.visualTurns;
    const armPoints = [];
    const rotation = displayTurns * Math.PI / 2;
    for (const direction of DIRECTIONS) {
        if ((tile.baseMask & direction) === 0)
            continue;
        const [baseX, baseY] = DIRECTION_VECTOR[direction];
        const dx = baseX * Math.cos(rotation) - baseY * Math.sin(rotation);
        const dy = baseX * Math.sin(rotation) + baseY * Math.cos(rotation);
        armPoints.push(__classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_offsetPoint).call(this, projected, dx * 0.43, dy * 0.43));
    }
    for (const endpoint of armPoints)
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawPipe).call(this, projected.center, endpoint, projected.tileWidth, timestamp, powered, tile.id);
    if (tile.kind === 'source')
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawSunwell).call(this, projected, timestamp, powered);
    else
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawGear).call(this, projected, displayTurns, powered);
    if (tile.kind === 'plant')
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawPlant).call(this, projected, timestamp, powered, tile.plantKind ?? 'lumen');
}, _ConservatoryRenderer_drawPipe = function _ConservatoryRenderer_drawPipe(start, end, tileWidth, timestamp, powered, id) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const bodyWidth = Math.max(5.5, tileWidth * 0.092);
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = 'rgba(0, 8, 8, .64)';
    context.lineWidth = bodyWidth * 1.52;
    context.beginPath();
    context.moveTo(start.x, start.y + bodyWidth * 0.22);
    context.lineTo(end.x, end.y + bodyWidth * 0.22);
    context.stroke();
    const brass = context.createLinearGradient(start.x, start.y - bodyWidth, end.x, end.y + bodyWidth);
    brass.addColorStop(0, '#6c4924');
    brass.addColorStop(0.22, '#e6bb6d');
    brass.addColorStop(0.48, '#9c6c34');
    brass.addColorStop(0.72, '#f0ca79');
    brass.addColorStop(1, '#5b3c20');
    context.strokeStyle = brass;
    context.lineWidth = bodyWidth;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    context.strokeStyle = 'rgba(42,24,13,.72)';
    context.lineWidth = bodyWidth * 0.48;
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineTo(end.x, end.y);
    context.stroke();
    if (powered) {
        context.globalCompositeOperation = 'screen';
        context.shadowColor = '#65fff0';
        context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow;
        context.strokeStyle = 'rgba(72,255,235,.54)';
        context.lineWidth = bodyWidth * 0.72;
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
        context.shadowBlur = Math.max(4, __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 0.45);
        context.strokeStyle = '#bafff5';
        context.lineWidth = Math.max(1.7, bodyWidth * 0.2);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
        if (!__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f")) {
            const phase = (timestamp * 0.00055 + (hashSeed(id) % 1000) / 1000) % 1;
            const pulse = lerpPoint(start, end, phase);
            context.fillStyle = '#ffffff';
            context.shadowColor = '#8ffff2';
            context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow;
            context.beginPath();
            context.arc(pulse.x, pulse.y, Math.max(2, bodyWidth * 0.27), 0, Math.PI * 2);
            context.fill();
        }
    }
    context.restore();
    const ringRadius = bodyWidth * 0.62;
    const ring = context.createRadialGradient(end.x - ringRadius * 0.3, end.y - ringRadius * 0.4, 0, end.x, end.y, ringRadius);
    ring.addColorStop(0, powered ? '#dbfff8' : '#f7d78a');
    ring.addColorStop(0.32, powered ? '#65e8d7' : '#b08341');
    ring.addColorStop(0.66, '#171f1c');
    ring.addColorStop(1, '#060d0c');
    context.fillStyle = ring;
    context.beginPath();
    context.arc(end.x, end.y, ringRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = powered ? '#9effed' : '#d4a958';
    context.lineWidth = Math.max(1, bodyWidth * 0.12);
    context.stroke();
    context.fillStyle = powered ? '#d9fff9' : '#0d1c1a';
    context.beginPath();
    context.arc(end.x, end.y, ringRadius * 0.42, 0, Math.PI * 2);
    context.fill();
}, _ConservatoryRenderer_drawGear = function _ConservatoryRenderer_drawGear(projected, turns, powered) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const radius = Math.max(11, projected.tileWidth * 0.115);
    const teeth = 12;
    context.save();
    context.translate(projected.center.x, projected.center.y);
    context.scale(1, 0.72);
    context.rotate(turns * Math.PI / 2 + __classPrivateFieldGet(this, _ConservatoryRenderer_viewTurns, "f") * Math.PI * 0.04);
    const gearGradient = context.createRadialGradient(-radius * 0.25, -radius * 0.32, 0, 0, 0, radius * 1.28);
    gearGradient.addColorStop(0, '#fff1ae');
    gearGradient.addColorStop(0.32, '#d7a653');
    gearGradient.addColorStop(0.68, '#8b5e2f');
    gearGradient.addColorStop(1, '#392619');
    context.fillStyle = gearGradient;
    context.shadowColor = powered ? '#6dffea' : 'rgba(0,0,0,.5)';
    context.shadowBlur = powered ? __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 0.55 : 5;
    context.beginPath();
    for (let index = 0; index < teeth * 2; index += 1) {
        const angle = index * Math.PI / teeth;
        const distanceValue = index % 2 === 0 ? radius * 1.22 : radius * 0.94;
        const x = Math.cos(angle) * distanceValue;
        const y = Math.sin(angle) * distanceValue;
        if (index === 0)
            context.moveTo(x, y);
        else
            context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.strokeStyle = '#f1ca77';
    context.lineWidth = Math.max(1, radius * 0.08);
    context.stroke();
    context.fillStyle = '#15332e';
    context.beginPath();
    context.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = powered ? '#98fff0' : '#b48748';
    context.lineWidth = Math.max(1, radius * 0.11);
    context.stroke();
    context.fillStyle = powered ? '#c6fff7' : '#071918';
    context.shadowColor = powered ? '#72fff0' : 'transparent';
    context.shadowBlur = powered ? __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow : 0;
    context.beginPath();
    context.arc(0, 0, radius * 0.23, 0, Math.PI * 2);
    context.fill();
    context.restore();
}, _ConservatoryRenderer_drawSunwell = function _ConservatoryRenderer_drawSunwell(projected, timestamp, powered) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const center = projected.center;
    const radius = Math.max(16, projected.tileWidth * 0.14);
    const pulse = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 1 : 1 + Math.sin(timestamp * 0.004) * 0.045;
    context.save();
    context.translate(center.x, center.y - radius * 0.1);
    context.scale(1, 0.72);
    context.shadowColor = '#72fff0';
    context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 1.4;
    const base = context.createRadialGradient(-radius * 0.3, -radius * 0.35, 0, 0, 0, radius * 1.35);
    base.addColorStop(0, '#fff1ad');
    base.addColorStop(0.35, '#c99a4c');
    base.addColorStop(0.7, '#57401f');
    base.addColorStop(1, '#15201a');
    context.fillStyle = base;
    context.beginPath();
    context.arc(0, 0, radius * 1.08, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#f1ca72';
    context.lineWidth = radius * 0.09;
    context.stroke();
    context.strokeStyle = '#77f9e6';
    context.lineWidth = radius * 0.12;
    context.beginPath();
    context.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#0a3c37';
    context.beginPath();
    context.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    const starY = center.y - radius * 0.55;
    context.save();
    context.translate(center.x, starY);
    context.scale(pulse, pulse);
    context.globalCompositeOperation = 'screen';
    context.shadowColor = '#a8fff5';
    context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 1.8;
    context.fillStyle = '#e9fffb';
    drawStar(context, 8, radius * 0.74, radius * 0.18);
    context.fill();
    context.restore();
    context.save();
    context.strokeStyle = powered ? '#bafff5' : '#6de9db';
    context.lineWidth = Math.max(1.6, radius * 0.09);
    context.shadowColor = '#6ffff0';
    context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow;
    context.beginPath();
    context.arc(center.x, center.y - radius * 0.24, radius * 1.16, Math.PI * 1.08, Math.PI * 1.92);
    context.stroke();
    context.restore();
}, _ConservatoryRenderer_drawPlant = function _ConservatoryRenderer_drawPlant(projected, timestamp, powered, plantKind) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const center = projected.center;
    const scale = Math.max(0.75, projected.tileWidth / 120);
    const [light, mid, dark] = PLANT_COLORS[plantKind];
    const bloom = powered ? 1 : 0.63;
    const sway = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 0 : Math.sin(timestamp * 0.0016 + hashSeed(projected.tile.id) * 0.001) * 2.4 * scale;
    const potY = center.y - 2 * scale;
    context.save();
    if (powered) {
        context.shadowColor = mid;
        context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 0.9;
    }
    const potGradient = context.createLinearGradient(center.x - 16 * scale, potY - 4 * scale, center.x + 16 * scale, potY + 22 * scale);
    potGradient.addColorStop(0, '#edc886');
    potGradient.addColorStop(0.3, '#9a5f35');
    potGradient.addColorStop(0.65, '#6b3b27');
    potGradient.addColorStop(1, '#2f2119');
    context.fillStyle = potGradient;
    context.beginPath();
    context.moveTo(center.x - 15 * scale, potY - 1 * scale);
    context.quadraticCurveTo(center.x, potY + 5 * scale, center.x + 15 * scale, potY - 1 * scale);
    context.lineTo(center.x + 11 * scale, potY + 18 * scale);
    context.quadraticCurveTo(center.x, potY + 24 * scale, center.x - 11 * scale, potY + 18 * scale);
    context.closePath();
    context.fill();
    context.strokeStyle = '#e0b465';
    context.lineWidth = Math.max(1, scale * 1.1);
    context.stroke();
    context.strokeStyle = 'rgba(255,225,155,.45)';
    context.beginPath();
    context.arc(center.x, potY + 8 * scale, 7 * scale, 0.2, Math.PI - 0.2);
    context.stroke();
    const stemTop = potY - 30 * scale * bloom;
    context.strokeStyle = powered ? '#6be4a9' : '#477760';
    context.lineWidth = 4.2 * scale;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(center.x, potY + 2 * scale);
    context.quadraticCurveTo(center.x + sway * 0.4, potY - 15 * scale, center.x + sway, stemTop);
    context.stroke();
    for (const side of [-1, 1]) {
        context.save();
        context.translate(center.x + sway * 0.45, potY - 14 * scale);
        context.rotate(side * 0.52 + sway * 0.004);
        context.fillStyle = powered ? '#5cbd77' : '#365c49';
        context.beginPath();
        context.ellipse(side * 7 * scale, 0, 11 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
    const blossomX = center.x + sway;
    const blossomY = stemTop;
    const petalCount = plantKind === 'orchid' ? 6 : plantKind === 'moonfern' ? 8 : 10;
    context.translate(blossomX, blossomY);
    context.rotate(Math.sin(timestamp * 0.001 + hashSeed(projected.tile.id)) * 0.025);
    for (let index = 0; index < petalCount; index += 1) {
        const angle = index * Math.PI * 2 / petalCount;
        const length = (plantKind === 'starbell' ? 15 : 12) * scale * bloom;
        const width = (plantKind === 'orchid' ? 7 : 5.6) * scale * bloom;
        context.save();
        context.rotate(angle);
        const petalGradient = context.createLinearGradient(0, 0, length, 0);
        petalGradient.addColorStop(0, light);
        petalGradient.addColorStop(0.52, mid);
        petalGradient.addColorStop(1, dark);
        context.fillStyle = petalGradient;
        context.beginPath();
        context.moveTo(0, 0);
        context.bezierCurveTo(length * 0.3, -width, length * 0.86, -width * 0.45, length, 0);
        context.bezierCurveTo(length * 0.86, width * 0.45, length * 0.3, width, 0, 0);
        context.fill();
        context.restore();
    }
    context.fillStyle = powered ? '#fff6ac' : '#9c824c';
    context.shadowColor = powered ? '#fff09a' : 'transparent';
    context.shadowBlur = powered ? __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 0.55 : 0;
    context.beginPath();
    context.arc(0, 0, 4.8 * scale * bloom, 0, Math.PI * 2);
    context.fill();
    context.restore();
}, _ConservatoryRenderer_drawAnchor = function _ConservatoryRenderer_drawAnchor(projected) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const radius = Math.max(7, projected.tileWidth * 0.055);
    const position = lerpPoint(projected.polygon[2], projected.center, 0.28);
    context.save();
    context.translate(position.x, position.y);
    context.scale(1, 0.84);
    context.fillStyle = 'rgba(8, 24, 22, .88)';
    context.strokeStyle = '#e5b963';
    context.lineWidth = Math.max(1.1, radius * 0.13);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(0, -radius * 0.15, radius * 0.35, Math.PI, 0);
    context.stroke();
    context.fillStyle = '#e8c474';
    context.fillRect(-radius * 0.35, -radius * 0.06, radius * 0.7, radius * 0.48);
    context.restore();
}, _ConservatoryRenderer_drawHover = function _ConservatoryRenderer_drawHover(projected) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    context.save();
    context.strokeStyle = 'rgba(192, 255, 239, .62)';
    context.lineWidth = Math.max(1.6, projected.tileWidth * 0.013);
    context.shadowColor = '#88fce7';
    context.shadowBlur = Math.max(6, __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 0.55);
    tracePolygon(context, projected.polygon.map((point) => lerpPoint(point, projected.center, -0.025)));
    context.stroke();
    context.restore();
}, _ConservatoryRenderer_drawCoach = function _ConservatoryRenderer_drawCoach(projected, timestamp) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const pulse = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 0 : Math.sin(timestamp * 0.006) * projected.tileWidth * 0.018;
    const radius = projected.tileWidth * 0.31 + pulse;
    context.save();
    context.strokeStyle = '#ffe27f';
    context.lineWidth = Math.max(2, projected.tileWidth * 0.02);
    context.setLineDash([Math.max(5, projected.tileWidth * 0.05), Math.max(4, projected.tileWidth * 0.035)]);
    context.lineDashOffset = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 0 : -timestamp * 0.025;
    context.shadowColor = '#ffd75b';
    context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 1.2;
    context.beginPath();
    context.ellipse(projected.center.x, projected.center.y, radius, radius * 0.52, 0, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    const arrowX = projected.center.x + projected.tileWidth * 0.36;
    const arrowY = projected.center.y + projected.tileHeight * 0.2;
    context.translate(arrowX, arrowY);
    context.rotate(-0.4);
    context.fillStyle = '#ffe88e';
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(projected.tileWidth * 0.11, -projected.tileWidth * 0.05);
    context.lineTo(projected.tileWidth * 0.08, projected.tileWidth * 0.005);
    context.lineTo(projected.tileWidth * 0.16, projected.tileWidth * 0.02);
    context.lineTo(projected.tileWidth * 0.07, projected.tileWidth * 0.045);
    context.lineTo(projected.tileWidth * 0.075, projected.tileWidth * 0.095);
    context.closePath();
    context.fill();
    context.restore();
}, _ConservatoryRenderer_drawHint = function _ConservatoryRenderer_drawHint(projected, timestamp) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const pulse = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 1 : 1 + Math.sin(timestamp * 0.009) * 0.08;
    const radius = projected.tileWidth * 0.24 * pulse;
    context.save();
    context.globalCompositeOperation = 'screen';
    context.strokeStyle = '#91fff0';
    context.lineWidth = Math.max(2, projected.tileWidth * 0.017);
    context.shadowColor = '#6dffee';
    context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 1.5;
    context.beginPath();
    context.ellipse(projected.center.x, projected.center.y, radius, radius * 0.55, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
}, _ConservatoryRenderer_drawTileLeaks = function _ConservatoryRenderer_drawTileLeaks(projected, timestamp) {
    if (!__classPrivateFieldGet(this, _ConservatoryRenderer_analysis, "f"))
        return;
    const leaks = __classPrivateFieldGet(this, _ConservatoryRenderer_analysis, "f").leaks.filter((leak) => leak.tileId === projected.tile.id);
    if (leaks.length === 0)
        return;
    for (const leak of leaks) {
        const [dx, dy] = DIRECTION_VECTOR[leak.direction];
        const endpoint = __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_offsetPoint).call(this, projected, dx * 0.44, dy * 0.44);
        __classPrivateFieldGet(this, _ConservatoryRenderer_instances, "m", _ConservatoryRenderer_drawLeak).call(this, endpoint, projected.tileWidth, timestamp, hashSeed(`${projected.tile.id}:${leak.direction}`));
    }
}, _ConservatoryRenderer_drawLeak = function _ConservatoryRenderer_drawLeak(endpoint, tileWidth, timestamp, seed) {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const scale = Math.max(0.65, tileWidth / 130);
    context.save();
    context.globalCompositeOperation = 'screen';
    context.strokeStyle = 'rgba(84, 239, 255, .75)';
    context.lineWidth = 2.5 * scale;
    context.shadowColor = '#55eaff';
    context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow;
    const phase = __classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f") ? 0 : Math.sin(timestamp * 0.007 + seed) * 3 * scale;
    for (let index = 0; index < 3; index += 1) {
        context.beginPath();
        context.moveTo(endpoint.x + (index - 1) * 3 * scale, endpoint.y);
        context.quadraticCurveTo(endpoint.x + (index - 1) * 8 * scale + phase, endpoint.y - (13 + index * 5) * scale, endpoint.x + (index - 1) * 5 * scale - phase * 0.4, endpoint.y - (25 + index * 7) * scale);
        context.stroke();
    }
    context.restore();
    const badgeX = endpoint.x + 13 * scale;
    const badgeY = endpoint.y - 22 * scale;
    context.save();
    context.fillStyle = '#d8524b';
    context.shadowColor = '#ff6860';
    context.shadowBlur = 8 * scale;
    context.beginPath();
    context.arc(badgeX, badgeY, 9 * scale, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff3df';
    context.lineWidth = 1.5 * scale;
    context.stroke();
    context.fillStyle = '#fff';
    context.font = `800 ${12 * scale}px system-ui`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('!', badgeX, badgeY + 0.6 * scale);
    context.restore();
}, _ConservatoryRenderer_offsetPoint = function _ConservatoryRenderer_offsetPoint(projected, dx, dy) {
    const offset = projectUnit(dx, dy, projected.cameraAngle, projected.verticalScale);
    return { x: projected.center.x + offset.x * projected.unit, y: projected.center.y + offset.y * projected.unit };
}, _ConservatoryRenderer_spawnBloomParticles = function _ConservatoryRenderer_spawnBloomParticles() {
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f"))
        return;
    for (const projected of __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f")) {
        if (projected.tile.kind !== 'plant')
            continue;
        const [, , dark] = PLANT_COLORS[projected.tile.plantKind ?? 'lumen'];
        const hue = colorHue(dark);
        for (let index = 0; index < (__classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f") === PROFILES.low ? 8 : 20); index += 1) {
            const angle = (Math.PI * 2 * index) / 20 + Math.random() * 0.45;
            const speed = 30 + Math.random() * 78;
            __classPrivateFieldGet(this, _ConservatoryRenderer_particles, "f").push({
                x: projected.center.x,
                y: projected.center.y - projected.tileWidth * 0.22,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 45,
                life: 0.8 + Math.random() * 1.2,
                maxLife: 1.8,
                size: 2 + Math.random() * 4.5,
                hue,
                spin: Math.random() * Math.PI * 2,
            });
        }
    }
}, _ConservatoryRenderer_drawParticles = function _ConservatoryRenderer_drawParticles() {
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    context.save();
    context.globalCompositeOperation = 'screen';
    for (const particle of __classPrivateFieldGet(this, _ConservatoryRenderer_particles, "f")) {
        const alpha = clamp(particle.life / Math.max(0.001, particle.maxLife), 0, 1);
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.spin);
        context.fillStyle = `hsla(${particle.hue}, 86%, 72%, ${alpha})`;
        context.shadowColor = `hsla(${particle.hue}, 95%, 68%, ${alpha})`;
        context.shadowBlur = __classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f").pipeGlow * 0.55;
        context.beginPath();
        context.ellipse(0, 0, particle.size * 1.8, particle.size * 0.65, 0, 0, Math.PI * 2);
        context.fill();
        context.restore();
    }
    context.restore();
}, _ConservatoryRenderer_drawCelebration = function _ConservatoryRenderer_drawCelebration(timestamp) {
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_victoryStartedAt, "f") <= 0 || timestamp > __classPrivateFieldGet(this, _ConservatoryRenderer_victoryEndsAt, "f"))
        return;
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    const duration = Math.max(1, __classPrivateFieldGet(this, _ConservatoryRenderer_victoryEndsAt, "f") - __classPrivateFieldGet(this, _ConservatoryRenderer_victoryStartedAt, "f"));
    const progress = clamp((timestamp - __classPrivateFieldGet(this, _ConservatoryRenderer_victoryStartedAt, "f")) / duration, 0, 1);
    const envelope = Math.sin(progress * Math.PI);
    const center = __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").length > 0
        ? __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").reduce((sum, tile) => ({ x: sum.x + tile.center.x / __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").length, y: sum.y + tile.center.y / __classPrivateFieldGet(this, _ConservatoryRenderer_projectedTiles, "f").length }), { x: 0, y: 0 })
        : { x: __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") / 2, y: __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") / 2 };
    context.save();
    context.globalCompositeOperation = 'screen';
    const glow = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f")) * 0.48);
    glow.addColorStop(0, `rgba(190, 255, 234, ${0.24 * envelope})`);
    glow.addColorStop(0.28, `rgba(89, 246, 213, ${0.12 * envelope})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    if (!__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f")) {
        context.strokeStyle = `rgba(255, 226, 130, ${0.1 * envelope})`;
        context.lineWidth = 2;
        for (let index = 0; index < 18; index += 1) {
            const angle = index * Math.PI * 2 / 18 + timestamp * 0.00008;
            context.beginPath();
            context.moveTo(center.x + Math.cos(angle) * 50, center.y + Math.sin(angle) * 28);
            context.lineTo(center.x + Math.cos(angle) * __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.7, center.y + Math.sin(angle) * __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.7);
            context.stroke();
        }
    }
    context.restore();
}, _ConservatoryRenderer_drawAmbientForeground = function _ConservatoryRenderer_drawAmbientForeground(timestamp) {
    if (__classPrivateFieldGet(this, _ConservatoryRenderer_profile, "f") === PROFILES.low)
        return;
    const context = __classPrivateFieldGet(this, _ConservatoryRenderer_context, "f");
    context.save();
    const bottomMist = context.createLinearGradient(0, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.7, 0, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f"));
    bottomMist.addColorStop(0, 'rgba(5, 49, 42, 0)');
    bottomMist.addColorStop(1, 'rgba(8, 64, 54, .18)');
    context.fillStyle = bottomMist;
    context.fillRect(0, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.65, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f"), __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.35);
    if (!__classPrivateFieldGet(this, _ConservatoryRenderer_reducedMotion, "f")) {
        context.globalAlpha = 0.035;
        context.fillStyle = '#8effdd';
        const drift = Math.sin(timestamp * 0.00012) * __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.05;
        context.beginPath();
        context.ellipse(__classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.38 + drift, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.82, __classPrivateFieldGet(this, _ConservatoryRenderer_width, "f") * 0.38, __classPrivateFieldGet(this, _ConservatoryRenderer_height, "f") * 0.08, 0, 0, Math.PI * 2);
        context.fill();
    }
    context.restore();
};
function projectUnit(wx, wy, angle, verticalScale = 0.52) {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
        x: wx * cosine - wy * sine,
        y: (wx * sine + wy * cosine) * verticalScale,
    };
}
function pointInPolygon(point, polygon) {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const a = polygon[index];
        const b = polygon[previous];
        const intersect = ((a.y > point.y) !== (b.y > point.y)) &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
        if (intersect)
            inside = !inside;
    }
    return inside;
}
function tracePolygon(context, points) {
    context.beginPath();
    points.forEach((point, index) => {
        if (index === 0)
            context.moveTo(point.x, point.y);
        else
            context.lineTo(point.x, point.y);
    });
    context.closePath();
}
function drawImageCover(context, image, x, y, width, height) {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    if (imageRatio > targetRatio) {
        sourceWidth = image.naturalHeight * targetRatio;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
    }
    else {
        sourceHeight = image.naturalWidth / targetRatio;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
    }
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}
function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load ${source}`));
        image.src = source;
    });
}
function distance(left, right) {
    return Math.hypot(right.x - left.x, right.y - left.y);
}
function lerpPoint(from, to, amount) {
    return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
}
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
function easeOutBack(value) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}
function drawStar(context, points, outerRadius, innerRadius) {
    context.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
        const radius = index % 2 === 0 ? outerRadius : innerRadius;
        const angle = index * Math.PI / points - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0)
            context.moveTo(x, y);
        else
            context.lineTo(x, y);
    }
    context.closePath();
}
function colorHue(color) {
    const red = Number.parseInt(color.slice(1, 3), 16) / 255;
    const green = Number.parseInt(color.slice(3, 5), 16) / 255;
    const blue = Number.parseInt(color.slice(5, 7), 16) / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    if (delta === 0)
        return 45;
    let hue = maximum === red ? ((green - blue) / delta) % 6 : maximum === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
    hue = Math.round(hue * 60);
    return hue < 0 ? hue + 360 : hue;
}
//# sourceMappingURL=renderer.js.map