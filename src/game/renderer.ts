import { currentMask } from '../core/board.js';
import { detectDeviceSignals, fitDevicePixelRatio, resolveRenderProfile, shouldAutoDowngrade, type RenderProfile } from '../core/performance.js';
import { ConservatoryArtCache } from './art.js';
import {
  DIRECTIONS,
  EAST,
  NORTH,
  SOUTH,
  WEST,
  type BoardAnalysis,
  type DirectionBit,
  type PlantKind,
  type PuzzleDefinition,
  type TileState,
} from '../core/types.js';

interface Point { x: number; y: number }
interface ProjectedTile {
  tile: TileState;
  center: Point;
  polygon: readonly [Point, Point, Point, Point];
  tileWidth: number;
  tileHeight: number;
  depth: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: 'spark' | 'petal' | 'droplet';
  color: string;
  rotation: number;
  spin: number;
  gravity: number;
}
interface PendingBurst { tileId: string; start: number; kind: 'bloom' | 'seal' }
interface Dust { x: number; y: number; phase: number; speed: number; size: number }
interface PowerTransition { from: number; to: number; start: number; duration: number }
interface ImpactPulse { start: number; duration: number; strength: number; kind: 'turn' | 'power' | 'hint' }
type PremiumSpriteKey =
  | 'coupler'
  | 'leak'
  | 'lock'
  | 'mechanism-terminal'
  | 'mechanism-straight'
  | 'mechanism-elbow'
  | 'mechanism-junction'
  | 'pipe'
  | 'platform-0'
  | 'platform-1'
  | 'platform-2'
  | 'platform-3'
  | 'source'
  | 'tile-base'
  | 'plant-lumen-orchid-off'
  | 'plant-lumen-orchid-on'
  | 'plant-moonbell-off'
  | 'plant-moonbell-on'
  | 'plant-sun-dahlia-off'
  | 'plant-sun-dahlia-on'
  | 'plant-mist-lily-off'
  | 'plant-mist-lily-on'
  | 'plant-ember-bloom-off'
  | 'plant-ember-bloom-on';
export interface RendererDiagnostics {
  readonly quality: 'high' | 'balanced';
  readonly adaptive: boolean;
  readonly effectiveDpr: number;
  readonly canvasPixels: number;
  readonly renderedFrames: number;
  readonly skippedFrames: number;
  readonly lastDrawCostMs: number;
  readonly averageDrawCostMs: number;
  readonly activeFps: number;
  readonly ambientFps: number;
  readonly particleCount: number;
  readonly pendingBurstCount: number;
  readonly powerTransitionCount: number;
  readonly impactCount: number;
  readonly sleeping: boolean;
  readonly staticCacheBuildMs: number;
  readonly staticCacheDirty: boolean;
  readonly artMode: 'cinematic' | 'procedural';
  readonly cinematicReady: number;
  readonly cinematicRequired: number;
  readonly cinematicMissing: readonly PremiumSpriteKey[];
}
interface Theme {
  glass: string;
  glassLight: string;
  edge: string;
  side: string;
  brass: string;
  brassLight: string;
  aqua: string;
  aquaSoft: string;
  ink: string;
  accent: string;
}

const THEMES: readonly Theme[] = [
  { glass: '#174c49', glassLight: '#2a7770', edge: '#7caea0', side: '#071f22', brass: '#b9843d', brassLight: '#f1ce79', aqua: '#83fff0', aquaSoft: '#1dd8c7', ink: '#042b2a', accent: '#ffd978' },
  { glass: '#294e3b', glassLight: '#4d7958', edge: '#91ad77', side: '#10261d', brass: '#c18b42', brassLight: '#f5d784', aqua: '#d1ff8c', aquaSoft: '#7ed65d', ink: '#1d2d1b', accent: '#ffe598' },
  { glass: '#34405e', glassLight: '#5c6288', edge: '#8f9bd1', side: '#151a31', brass: '#c6924d', brassLight: '#f0d18e', aqua: '#b9e9ff', aquaSoft: '#7dbdf0', ink: '#202442', accent: '#ffc8e7' },
  { glass: '#214c61', glassLight: '#39748c', edge: '#87b5bf', side: '#0b2633', brass: '#c79551', brassLight: '#f4d98f', aqua: '#92fff5', aquaSoft: '#39d9dd', ink: '#0c3040', accent: '#f3d4ff' },
];

const PLANT_PALETTES: Record<PlantKind, readonly [string, string, string]> = {
  'lumen-orchid': ['#7bc6ff', '#d6f4ff', '#7ffff0'],
  moonbell: ['#b59cff', '#eee5ff', '#82c6ff'],
  'sun-dahlia': ['#ff8e9d', '#ffd287', '#fff2bd'],
  'mist-lily': ['#ffffff', '#b8efff', '#88ffd9'],
  'ember-bloom': ['#ff9d53', '#ffd05d', '#ff6e75'],
};

const CORE_PREMIUM_SPRITES: readonly PremiumSpriteKey[] = ['leak', 'lock'] as const;

const CINEMATIC_SPRITES = new Set<PremiumSpriteKey>([
  'coupler',
  'leak',
  'lock',
  'mechanism-terminal',
  'mechanism-straight',
  'mechanism-elbow',
  'mechanism-junction',
  'pipe',
  'platform-0',
  'platform-1',
  'platform-2',
  'platform-3',
  'source',
  'plant-lumen-orchid-off',
  'plant-lumen-orchid-on',
  'plant-moonbell-off',
  'plant-moonbell-on',
  'plant-sun-dahlia-off',
  'plant-sun-dahlia-on',
  'plant-mist-lily-off',
  'plant-mist-lily-on',
  'plant-ember-bloom-off',
  'plant-ember-bloom-on',
]);

const PLANT_SPRITES: Record<PlantKind, readonly [PremiumSpriteKey, PremiumSpriteKey]> = {
  'lumen-orchid': ['plant-lumen-orchid-off', 'plant-lumen-orchid-on'],
  moonbell: ['plant-moonbell-off', 'plant-moonbell-on'],
  'sun-dahlia': ['plant-sun-dahlia-off', 'plant-sun-dahlia-on'],
  'mist-lily': ['plant-mist-lily-off', 'plant-mist-lily-on'],
  'ember-bloom': ['plant-ember-bloom-off', 'plant-ember-bloom-on'],
};

const PLATFORM_SPRITES = ['platform-0', 'platform-1', 'platform-2', 'platform-3'] as const;
const MECHANISM_SPRITES = ['mechanism-terminal', 'mechanism-straight', 'mechanism-elbow', 'mechanism-junction'] as const;

function platformSpriteKey(tile: TileState): PremiumSpriteKey {
  const variant = (tile.x * 3 + tile.y * 5 + tile.baseMask) & 3;
  return PLATFORM_SPRITES[variant] ?? 'platform-0';
}

function mechanismVariant(tile: TileState): 0 | 1 | 2 | 3 {
  const ports = DIRECTIONS.filter((direction) => (tile.baseMask & direction.bit) !== 0);
  const oppositePair =
    ports.length === 2 &&
    ((ports[0]?.bit === 1 && ports[1]?.bit === 4) ||
      (ports[0]?.bit === 4 && ports[1]?.bit === 1) ||
      (ports[0]?.bit === 2 && ports[1]?.bit === 8) ||
      (ports[0]?.bit === 8 && ports[1]?.bit === 2));
  return ports.length <= 1 ? 0 : oppositePair ? 1 : ports.length === 2 ? 2 : 3;
}

function mechanismSpriteKey(tile: TileState): PremiumSpriteKey {
  return MECHANISM_SPRITES[mechanismVariant(tile)] ?? 'mechanism-terminal';
}

export class ConservatoryRenderer {
  readonly #canvas: HTMLCanvasElement;
  #context: CanvasRenderingContext2D;
  readonly #staticCanvas: HTMLCanvasElement;
  readonly #staticContext: CanvasRenderingContext2D;
  readonly #art = new ConservatoryArtCache();
  readonly #sprites = new Map<PremiumSpriteKey, HTMLImageElement>();
  readonly #readySprites = new Set<PremiumSpriteKey>();
  readonly #onWindowResize = (): void => this.#queueResize();
  #observer: ResizeObserver | null = null;
  #resizeFrame = 0;
  #puzzle: PuzzleDefinition | null = null;
  #analysis: BoardAnalysis | null = null;
  #leaksByTile = new Map<string, DirectionBit[]>();
  #selectedId: string | null = null;
  #hoveredId: string | null = null;
  #pressedId: string | null = null;
  #coachId: string | null = null;
  #hintId: string | null = null;
  #hintUntil = 0;
  #displayTurns = new Map<string, number>();
  #powerTransitions = new Map<string, PowerTransition>();
  #impacts = new Map<string, ImpactPulse>();
  #projected: ProjectedTile[] = [];
  #projectionDirty = true;
  #staticDirty = true;
  #renderingStatic = false;
  #staticBuildCost = 0;
  #skipNextDrawSample = false;
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
  #profile: RenderProfile = resolveRenderProfile('auto', detectDeviceSignals());
  #profileAppliedAt = performance.now();
  #assetWarmupUntil = 0;
  #adaptiveDowngraded = false;
  #drawSamples: number[] = [];
  #loadSamples: number[] = [];
  #renderedFrames = 0;
  #skippedFrames = 0;
  #lastDrawCost = 0;
  #particles: Particle[] = [];
  #pendingBursts: PendingBurst[] = [];
  #dust: Dust[] = [];
  #progressFlashStart = 0;
  #progressFlashEnd = 0;
  #victoryStart = 0;
  #victoryEnd = 0;

  public constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true }) ?? canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    this.#context = context;
    this.#staticCanvas = document.createElement('canvas');
    const staticContext = this.#staticCanvas.getContext('2d', { alpha: true });
    if (!staticContext) throw new Error('Canvas 2D static cache is unavailable.');
    this.#staticContext = staticContext;
    if (typeof ResizeObserver === 'function') {
      this.#observer = new ResizeObserver(() => this.#queueResize());
      this.#observer.observe(canvas);
    } else {
      window.addEventListener('resize', this.#onWindowResize, { passive: true });
    }
    this.#createDust();
    this.resize();
    this.#invalidate(700);
  }

  public destroy(): void {
    this.#running = false;
    cancelAnimationFrame(this.#frameId);
    window.clearTimeout(this.#frameTimer);
    cancelAnimationFrame(this.#resizeFrame);
    this.#observer?.disconnect();
    window.removeEventListener('resize', this.#onWindowResize);
    for (const sprite of this.#sprites.values()) {
      sprite.onload = null;
      sprite.onerror = null;
    }
    this.#readySprites.clear();
  }

  public clearPuzzle(): void {
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
    this.#staticDirty = true;
    this.#invalidate();
  }

  public async preparePuzzle(puzzle: PuzzleDefinition, timeoutMs = 2_200): Promise<void> {
    if (this.#profile.quality !== 'high') return;
    const keys = this.#premiumSpritesForPuzzle(puzzle);
    this.#ensurePremiumSprites(keys);
    if (keys.every((key) => this.#readySprites.has(key))) return;
    const deadline = performance.now() + Math.max(0, timeoutMs);
    await new Promise<void>((resolve) => {
      const poll = (): void => {
        if (keys.every((key) => this.#readySprites.has(key)) || performance.now() >= deadline) {
          resolve();
          return;
        }
        window.setTimeout(poll, 24);
      };
      poll();
    });
  }

  public setPuzzle(puzzle: PuzzleDefinition): void {
    this.#puzzle = puzzle;
    // Analyses belong to one immutable puzzle graph. Clearing the previous graph here
    // prevents coordinate ids shared by consecutive levels from animating from stale state.
    this.#analysis = null;
    this.#leaksByTile.clear();
    this.#displayTurns.clear();
    for (const tile of puzzle.tiles) this.#displayTurns.set(tile.id, tile.visualTurns);
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
    this.#staticDirty = true;
    this.#ensurePremiumSprites(this.#profile.quality === 'high' ? this.#premiumSpritesForPuzzle(puzzle) : CORE_PREMIUM_SPRITES);
    this.#invalidate(1_200);
  }

  public setAnalysis(analysis: BoardAnalysis): void {
    const now = performance.now();
    const previous = this.#analysis;
    const previousLeakCounts = new Map<string, number>();
    for (const [tileId, directions] of this.#leaksByTile) previousLeakCounts.set(tileId, directions.length);
    const currentLevels = new Map<string, number>();
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
          if (previous && tile.kind === 'plant') this.#pendingBursts.push({ tileId: tile.id, start: start + 210, kind: 'bloom' });
        }
      }
      if (previous) {
        for (const [tileId, oldCount] of previousLeakCounts) {
          const currentCount = this.#leaksByTile.get(tileId)?.length ?? 0;
          if (currentCount < oldCount) this.#pendingBursts.push({ tileId, start: now + 90, kind: 'seal' });
        }
        if (analysis.progress > previous.progress + 0.012) {
          this.#progressFlashStart = now;
          this.#progressFlashEnd = now + 720;
        }
      }
    } else if (this.#reducedMotion) {
      this.#powerTransitions.clear();
      this.#impacts.clear();
      this.#pendingBursts = [];
      this.#progressFlashStart = 0;
      this.#progressFlashEnd = 0;
    }
    if (this.#pendingBursts.length > 20) this.#pendingBursts.splice(0, this.#pendingBursts.length - 20);
    this.#staticDirty = true;
    this.#invalidate(this.#reducedMotion ? 0 : 1_200);
  }

  public setSelected(id: string | null): void {
    if (id === this.#selectedId) return;
    this.#selectedId = id;
    this.#invalidate(420);
  }

  public setHovered(id: string | null): void {
    if (id === this.#hoveredId) return;
    this.#hoveredId = id;
    this.#invalidate(id ? 220 : 120);
  }

  public setPressed(id: string | null): void {
    if (id === this.#pressedId) return;
    this.#pressedId = id;
    this.#invalidate(220);
  }

  public setPointer(clientX: number, clientY: number): void {
    if (this.#reducedMotion || this.#profile.parallaxStrength <= 0) return;
    const rect = this.#canvas.getBoundingClientRect();
    const nx = clamp(((clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2, -1, 1);
    const ny = clamp(((clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2, -1, 1);
    this.#targetParallax = { x: nx, y: ny };
    this.#invalidate(520);
  }

  public resetPointer(): void {
    if (this.#targetParallax.x === 0 && this.#targetParallax.y === 0) return;
    this.#targetParallax = { x: 0, y: 0 };
    this.#invalidate(520);
  }

  public setCoach(id: string | null): void {
    if (id === this.#coachId) return;
    this.#coachId = id;
    this.#invalidate(id ? 900 : 180);
  }

  public setHint(id: string, durationMs = 5_000): void {
    this.#hintId = id;
    this.#hintUntil = performance.now() + durationMs;
    if (!this.#reducedMotion) {
      this.#impacts.set(id, { start: performance.now(), duration: Math.min(durationMs, 1_200), strength: 1.25, kind: 'hint' });
    }
    this.#invalidate(this.#reducedMotion ? 0 : durationMs);
  }

  public clearHint(): void {
    if (!this.#hintId) return;
    this.#hintId = null;
    this.#invalidate(180);
  }

  public pulseTile(id: string, strength = 1): void {
    if (!this.#reducedMotion) {
      this.#impacts.set(id, { start: performance.now(), duration: 520, strength: clamp(strength, 0.4, 1.8), kind: 'turn' });
    }
    this.#invalidate(this.#reducedMotion ? 0 : 620);
  }

  public setReducedMotion(enabled: boolean): void {
    if (enabled === this.#reducedMotion) return;
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
        for (const tile of this.#puzzle.tiles) this.#displayTurns.set(tile.id, tile.visualTurns);
      }
    }
    this.#projectionDirty = true;
    this.#staticDirty = true;
    this.#invalidate(enabled ? 0 : 300);
  }

  public setHighContrast(enabled: boolean): void {
    if (enabled === this.#highContrast) return;
    this.#highContrast = enabled;
    this.#staticDirty = true;
    this.#invalidate(240);
  }

  public setRenderProfile(profile: RenderProfile): void {
    const changed = profile.quality !== this.#profile.quality || profile.adaptive !== this.#profile.adaptive || profile.maxCanvasPixels !== this.#profile.maxCanvasPixels;
    this.#profile = profile;
    this.#profileAppliedAt = performance.now();
    this.#adaptiveDowngraded = false;
    this.#drawSamples = [];
    this.#loadSamples = [];
    if (changed) {
      this.#art.clear();
      if (profile.quality === 'high' && this.#puzzle) this.#ensurePremiumSprites(this.#premiumSpritesForPuzzle(this.#puzzle));
      this.#createDust();
      this.#staticDirty = true;
      this.resize();
      this.#invalidate(700);
    }
  }

  public rotateView(delta: -1 | 1): void {
    this.#targetViewTurns += delta;
    if (this.#reducedMotion || this.#canUseStaticCache()) this.#viewTurns = this.#targetViewTurns;
    this.#projectionDirty = true;
    this.#staticDirty = true;
    this.#invalidate(this.#canUseStaticCache() ? 220 : this.#reducedMotion ? 120 : 720);
  }

  public syncTile(tile: TileState): void {
    if (!this.#displayTurns.has(tile.id) || this.#canUseStaticCache()) this.#displayTurns.set(tile.id, tile.visualTurns);
    this.#staticDirty = true;
    this.#invalidate(this.#canUseStaticCache() ? 260 : this.#reducedMotion ? 120 : 520);
  }

  public startVictorySequence(durationMs = 1_850): void {
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

  public pause(): void {
    this.#running = false;
    cancelAnimationFrame(this.#frameId);
    window.clearTimeout(this.#frameTimer);
    this.#frameId = 0;
    this.#frameTimer = 0;
  }

  public resume(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTime = performance.now();
    this.#invalidate(900);
  }

  public resize(): void {
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
    if (this.#staticCanvas.width !== width || this.#staticCanvas.height !== height) {
      this.#staticCanvas.width = width;
      this.#staticCanvas.height = height;
    }
    this.#context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    this.#staticContext.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    this.#projectionDirty = true;
    this.#staticDirty = true;
    this.#invalidate(420);
  }

  public getDiagnostics(): RendererDiagnostics {
    const average = this.#drawSamples.length === 0 ? 0 : this.#drawSamples.reduce((sum, value) => sum + value, 0) / this.#drawSamples.length;
    const cinematicRequired = this.#profile.quality === 'high' && this.#puzzle ? this.#premiumSpritesForPuzzle(this.#puzzle) : [];
    const cinematicMissing = cinematicRequired.filter((key) => !this.#readySprites.has(key));
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
      staticCacheBuildMs: round(this.#staticBuildCost, 3),
      staticCacheDirty: this.#staticDirty,
      artMode: this.#canUseStaticCache() ? 'cinematic' : 'procedural',
      cinematicReady: [...this.#readySprites].filter((key) => CINEMATIC_SPRITES.has(key)).length,
      cinematicRequired: cinematicRequired.length,
      cinematicMissing,
    };
  }

  public hitTest(clientX: number, clientY: number): string | null {
    const rect = this.#canvas.getBoundingClientRect();
    const point = { x: clientX - rect.left, y: clientY - rect.top };
    for (let index = this.#projected.length - 1; index >= 0; index -= 1) {
      const projected = this.#projected[index] as ProjectedTile;
      if (pointInPolygon(point, projected.polygon)) return projected.tile.id;
    }
    return null;
  }

  #premiumSpritesForPuzzle(puzzle: PuzzleDefinition): PremiumSpriteKey[] {
    const keys = new Set<PremiumSpriteKey>(['coupler', 'leak', 'pipe']);
    for (const tile of puzzle.tiles) {
      keys.add(platformSpriteKey(tile));
      if (tile.kind === 'source') keys.add('source');
      if (tile.kind === 'pipe') keys.add(mechanismSpriteKey(tile));
      if (tile.fixed) keys.add('lock');
      if (tile.kind === 'plant' && tile.plantKind) {
        const [off, on] = PLANT_SPRITES[tile.plantKind];
        keys.add(off);
        keys.add(on);
      }
    }
    return [...keys];
  }

  #ensurePremiumSprites(keys: readonly PremiumSpriteKey[]): void {
    const missing = keys.filter((key) => !this.#sprites.has(key));
    if (missing.length === 0) return;

    // Loading and first-decoding illustrated WebP art can create one-time main-thread
    // spikes on mobile. Keep the adaptive governor in warm-up until the assets have
    // settled so a capable device is not permanently downgraded because of startup I/O.
    const now = performance.now();
    this.#assetWarmupUntil = Math.max(this.#assetWarmupUntil, now + 6_000);
    this.#loadSamples = [];

    for (const key of missing) {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.onload = (): void => {
        const settle = (): void => {
          this.#readySprites.add(key);
          this.#assetWarmupUntil = Math.max(this.#assetWarmupUntil, performance.now() + 1_500);
          this.#loadSamples = [];
          this.#staticDirty = true;
          this.#invalidate(520);
        };
        try {
          void image.decode().catch(() => undefined).finally(settle);
        } catch {
          settle();
        }
      };
      image.onerror = (): void => {
        // Procedural cached art remains the guaranteed fallback.
        this.#sprites.delete(key);
        this.#readySprites.delete(key);
        this.#assetWarmupUntil = Math.max(this.#assetWarmupUntil, performance.now() + 500);
        this.#loadSamples = [];
        this.#staticDirty = true;
        this.#invalidate();
      };
      image.src = CINEMATIC_SPRITES.has(key) ? `./assets/cinematic/${key}.webp` : `./assets/hd/${key}.webp`;
      this.#sprites.set(key, image);
    }
  }

  #premiumSprite(key: PremiumSpriteKey): HTMLImageElement | null {
    if (!this.#readySprites.has(key)) return null;
    const image = this.#sprites.get(key);
    return image?.complete && image.naturalWidth > 0 ? image : null;
  }

  #queueResize(): void {
    cancelAnimationFrame(this.#resizeFrame);
    this.#resizeFrame = requestAnimationFrame(() => {
      this.#resizeFrame = 0;
      this.resize();
    });
  }

  #canUseStaticCache(): boolean {
    if (this.#profile.quality !== 'high' || !this.#puzzle) return false;
    return this.#premiumSpritesForPuzzle(this.#puzzle).every((key) => this.#readySprites.has(key));
  }

  #invalidate(activeMs = 0): void {
    this.#dirty = true;
    this.#activeUntil = Math.max(this.#activeUntil, performance.now() + Math.max(0, activeMs));
    this.#scheduleFrame();
  }

  #scheduleFrame(delayMs = 0): void {
    if (!this.#running || this.#frameId || this.#frameTimer) return;
    if (delayMs > 1) {
      this.#frameTimer = window.setTimeout(() => {
        this.#frameTimer = 0;
        if (this.#running && !this.#frameId) this.#frameId = requestAnimationFrame((time) => this.#frame(time));
      }, delayMs);
    } else {
      this.#frameId = requestAnimationFrame((time) => this.#frame(time));
    }
  }

  #frame(time: number): void {
    this.#frameId = 0;
    if (!this.#running) return;
    const interval = this.#frameInterval(time);
    const sinceDraw = time - this.#lastDrawAt;
    if (!this.#dirty && Number.isFinite(interval) && sinceDraw + 0.5 < interval) {
      this.#skippedFrames += 1;
      this.#scheduleFrame(Math.max(0, interval - sinceDraw - 4));
      return;
    }
    if (!this.#dirty && !Number.isFinite(interval)) return;

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

  #frameInterval(time: number): number {
    if (!this.#puzzle) return this.#dirty ? 0 : Number.POSITIVE_INFINITY;
    const transient = this.#hasTransientMotion(time);
    if (this.#reducedMotion && !transient) return this.#dirty ? 0 : Number.POSITIVE_INFINITY;
    if (transient || time < this.#activeUntil) return 1_000 / this.#profile.activeFps;
    const recentlyInteractive = time < this.#activeUntil + 5_000;
    const fps = recentlyInteractive ? this.#profile.ambientFps : this.#profile.idleFps;
    return 1_000 / Math.max(1, fps);
  }

  #hasTransientMotion(time: number): boolean {
    if (Math.abs(this.#targetViewTurns - this.#viewTurns) > 0.0005) return true;
    if (Math.abs(this.#targetParallax.x - this.#parallax.x) > 0.002 || Math.abs(this.#targetParallax.y - this.#parallax.y) > 0.002) return true;
    if (this.#particles.length > 0 || this.#pendingBursts.length > 0 || this.#powerTransitions.size > 0 || this.#impacts.size > 0) return true;
    if (this.#progressFlashStart > 0 && time < this.#progressFlashEnd) return true;
    if (this.#victoryStart > 0 && time < this.#victoryEnd) return true;
    if (!this.#reducedMotion && this.#hintId && time < this.#hintUntil) return true;
    if (this.#puzzle) {
      for (const tile of this.#puzzle.tiles) {
        if (Math.abs((this.#displayTurns.get(tile.id) ?? tile.visualTurns) - tile.visualTurns) > 0.001) return true;
      }
    }
    return false;
  }

  #update(delta: number, time: number): void {
    const smoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-delta * 10.5);
    const oldView = this.#viewTurns;
    this.#viewTurns += (this.#targetViewTurns - this.#viewTurns) * smoothing;
    if (Math.abs(this.#targetViewTurns - this.#viewTurns) < 0.0005) this.#viewTurns = this.#targetViewTurns;
    const parallaxSmoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-delta * 6.5);
    this.#parallax.x += (this.#targetParallax.x - this.#parallax.x) * parallaxSmoothing;
    this.#parallax.y += (this.#targetParallax.y - this.#parallax.y) * parallaxSmoothing;
    if (Math.abs(this.#targetParallax.x - this.#parallax.x) < 0.001) this.#parallax.x = this.#targetParallax.x;
    if (Math.abs(this.#targetParallax.y - this.#parallax.y) < 0.001) this.#parallax.y = this.#targetParallax.y;
    if (oldView !== this.#viewTurns) this.#projectionDirty = true;

    if (this.#puzzle) {
      for (const tile of this.#puzzle.tiles) {
        if (this.#canUseStaticCache()) {
          this.#displayTurns.set(tile.id, tile.visualTurns);
          continue;
        }
        const current = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
        const next = current + (tile.visualTurns - current) * smoothing;
        const resolved = Math.abs(tile.visualTurns - next) < 0.001 ? tile.visualTurns : next;
        this.#displayTurns.set(tile.id, resolved);
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
        if (dust.y < -0.05) { dust.y = 1.05; dust.x = Math.random(); }
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
      if (time > impact.start + impact.duration) this.#impacts.delete(id);
    }
  }

  #recordDrawCost(cost: number, time: number, underLoad: boolean): void {
    if (this.#skipNextDrawSample) {
      this.#skipNextDrawSample = false;
      this.#lastDrawCost = 0;
      return;
    }
    this.#drawSamples.push(cost);
    if (this.#drawSamples.length > 240) this.#drawSamples.splice(0, this.#drawSamples.length - 240);
    const eligibleLoadSample = underLoad && time >= this.#assetWarmupUntil;
    if (eligibleLoadSample) {
      this.#loadSamples.push(cost);
      if (this.#loadSamples.length > 180) this.#loadSamples.splice(0, this.#loadSamples.length - 180);
    } else if (time < this.#assetWarmupUntil && this.#loadSamples.length > 0) {
      this.#loadSamples = [];
    }
    if (!eligibleLoadSample || !this.#profile.adaptive || this.#profile.quality !== 'high' || this.#adaptiveDowngraded || time - this.#profileAppliedAt < 4_500) return;
    if (!shouldAutoDowngrade(this.#loadSamples)) return;
    this.#adaptiveDowngraded = true;
    this.#profile = { ...resolveRenderProfile('balanced', detectDeviceSignals()), adaptive: true };
    this.#art.clear();
    this.#profileAppliedAt = time;
    this.#drawSamples = [];
    this.#loadSamples = [];
    this.#createDust();
    this.resize();
    this.#canvas.dispatchEvent(new CustomEvent('renderqualitychange', { detail: { quality: 'balanced', reason: 'sustained-load' } }));
  }

  #powerValue(id: string, time: number, fallback: number): number {
    const transition = this.#powerTransitions.get(id);
    if (!transition) return fallback;
    if (time <= transition.start) return transition.from;
    const progress = clamp((time - transition.start) / Math.max(1, transition.duration), 0, 1);
    if (progress >= 1) {
      this.#powerTransitions.delete(id);
      return transition.to;
    }
    const eased = transition.to > transition.from ? easeOutBack(progress, 0.45) : easeInOut(progress);
    return clamp(transition.from + (transition.to - transition.from) * eased, 0, 1.08);
  }

  #powerDepths(puzzle: PuzzleDefinition, analysis: BoardAnalysis): Map<string, number> {
    const depths = new Map<string, number>([[puzzle.sourceId, 0]]);
    const byPosition = new Map(puzzle.tiles.map((tile) => [`${tile.x},${tile.y}`, tile] as const));
    const byId = new Map(puzzle.tiles.map((tile) => [tile.id, tile] as const));
    const queue = [puzzle.sourceId];
    while (queue.length > 0) {
      const id = queue.shift();
      const tile = id ? byId.get(id) : undefined;
      if (!tile) continue;
      const depth = depths.get(tile.id) ?? 0;
      const mask = currentMask(tile);
      for (const direction of DIRECTIONS) {
        if ((mask & direction.bit) === 0) continue;
        const neighbor = byPosition.get(`${tile.x + direction.dx},${tile.y + direction.dy}`);
        if (!neighbor || !analysis.powered.has(neighbor.id) || depths.has(neighbor.id)) continue;
        if ((currentMask(neighbor) & direction.opposite) === 0) continue;
        depths.set(neighbor.id, depth + 1);
        queue.push(neighbor.id);
      }
    }
    return depths;
  }

  #draw(time: number): void {
    const context = this.#context;
    context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    context.clearRect(0, 0, this.#width, this.#height);
    this.#drawAtmosphere(time);
    const puzzle = this.#puzzle;
    if (!puzzle) return;
    const theme = THEMES[puzzle.theme % THEMES.length] as Theme;
    this.#drawProgressFlash(time, theme);
    if (this.#projectionDirty || this.#projected.length === 0) {
      this.#projected = this.#projectBoard(puzzle);
      this.#projectionDirty = false;
      this.#staticDirty = true;
    }
    if (this.#canUseStaticCache()) {
      if (this.#staticDirty) this.#rebuildStaticBoard(theme, time);
      context.drawImage(this.#staticCanvas, 0, 0, this.#width, this.#height);
      this.#drawLiveBoardEffects(theme, time);
    } else {
      this.#drawBoardShadow(theme);
      this.#drawConnectionBridges(theme, time);
      for (const projected of this.#projected) this.#drawTile(projected, theme, time);
    }
    this.#drawParticles(time, theme);
    this.#drawVictory(time, theme);
  }

  #rebuildStaticBoard(theme: Theme, time: number): void {
    const started = performance.now();
    const liveContext = this.#context;
    this.#context = this.#staticContext;
    this.#renderingStatic = true;
    try {
      this.#staticContext.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
      this.#staticContext.clearRect(0, 0, this.#width, this.#height);
      this.#drawBoardShadow(theme);
      this.#drawConnectionBridges(theme, time);
      for (const projected of this.#projected) this.#drawTile(projected, theme, time);
      this.#staticDirty = false;
      this.#drawSamples = [];
      this.#skipNextDrawSample = true;
    } finally {
      this.#renderingStatic = false;
      this.#context = liveContext;
      this.#context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
      this.#staticBuildCost = performance.now() - started;
    }
  }

  #drawLiveBoardEffects(theme: Theme, time: number): void {
    if (!this.#analysis || !this.#puzzle) return;
    const context = this.#context;
    const byPosition = new Map(this.#projected.map((projected) => [`${projected.tile.x},${projected.tile.y}`, projected] as const));

    // Animate only light, aether and feedback. Heavy illustrated shells remain in
    // the offscreen board cache and are rebuilt only after a real state change.
    for (const projected of this.#projected) {
      const tile = projected.tile;
      const power = this.#powerValue(tile.id, time, this.#analysis.powered.has(tile.id) ? 1 : 0);
      const normalizedPower = clamp(power, 0, 1);
      const turns = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
      if (normalizedPower > 0.018) {
        const pulse = this.#reducedMotion ? 0.9 : 0.78 + Math.sin(time * 0.006 + tile.x * 1.31 + tile.y * 0.87) * 0.16;
        context.save();
        context.globalCompositeOperation = 'screen';
        context.lineCap = 'round';
        for (const direction of DIRECTIONS) {
          if ((tile.baseMask & direction.bit) === 0) continue;
          const vector = this.#directionVector(direction.bit, turns, projected.tileWidth, projected.tileHeight);
          const inner = { x: projected.center.x + vector.x * 0.23, y: projected.center.y + vector.y * 0.23 };
          const end = { x: projected.center.x + vector.x * 0.49, y: projected.center.y + vector.y * 0.49 };
          context.strokeStyle = withAlpha('#1ccfff', normalizedPower * pulse * 0.58);
          context.lineWidth = Math.max(3.0, projected.tileWidth * 0.032);
          context.beginPath();
          context.moveTo(inner.x, inner.y);
          context.lineTo(end.x, end.y);
          context.stroke();
          context.strokeStyle = withAlpha(theme.aqua, normalizedPower * pulse * 0.76);
          context.lineWidth = Math.max(1.85, projected.tileWidth * 0.018);
          context.stroke();
          context.strokeStyle = withAlpha('#f2ffff', normalizedPower * pulse * 0.70);
          context.lineWidth = Math.max(0.9, projected.tileWidth * 0.0065);
          context.stroke();
          context.fillStyle = withAlpha(theme.aqua, normalizedPower * 0.86);
          context.beginPath();
          context.ellipse(end.x, end.y, projected.tileWidth * 0.0125, projected.tileWidth * 0.008, Math.atan2(vector.y, vector.x), 0, Math.PI * 2);
          context.fill();
          if (!this.#reducedMotion) {
            const flow = (time * 0.00052 + tile.x * 0.173 + tile.y * 0.227 + direction.bit * 0.061) % 1;
            const t = 0.12 + flow * 0.78;
            context.fillStyle = withAlpha('#ffffff', normalizedPower * (0.52 + Math.sin(flow * Math.PI) * 0.38));
            context.beginPath();
            context.arc(inner.x + (end.x - inner.x) * t, inner.y + (end.y - inner.y) * t, Math.max(1.05, projected.tileWidth * 0.0075), 0, Math.PI * 2);
            context.fill();
          }
        }
        const coreRadius = projected.tileWidth * (tile.kind === 'source' ? 0.052 : tile.kind === 'plant' ? 0.026 : 0.020);
        const coreY = tile.kind === 'plant' ? projected.center.y - projected.tileHeight * 0.23 : projected.center.y;
        const core = context.createRadialGradient(projected.center.x, coreY, 0, projected.center.x, coreY, coreRadius * 2.8);
        core.addColorStop(0, withAlpha('#ffffff', normalizedPower * 0.58));
        core.addColorStop(0.24, withAlpha(theme.aqua, normalizedPower * 0.54));
        core.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = core;
        context.beginPath();
        context.arc(projected.center.x, coreY, coreRadius * 2.8, 0, Math.PI * 2);
        context.fill();

        // Lightweight live details preserve motion after the illustrated board shell
        // has been cached: a regulator dial, source orbit, or one drifting pollen mote.
        if (!this.#reducedMotion && tile.kind === 'pipe') {
          const dialRadius = projected.tileWidth * 0.052;
          context.save();
          context.translate(projected.center.x, projected.center.y);
          context.rotate(time * 0.00032 * ((tile.x + tile.y) % 2 ? -1 : 1));
          context.setLineDash([dialRadius * 0.34, dialRadius * 0.22]);
          context.strokeStyle = withAlpha(theme.brassLight, 0.30 + normalizedPower * 0.18);
          context.lineWidth = Math.max(0.8, projected.tileWidth * 0.0048);
          context.beginPath();
          context.arc(0, 0, dialRadius, 0, Math.PI * 2);
          context.stroke();
          context.setLineDash([]);
          context.fillStyle = withAlpha(theme.aqua, 0.62 * normalizedPower);
          context.beginPath();
          context.arc(dialRadius, 0, Math.max(0.9, projected.tileWidth * 0.0055), 0, Math.PI * 2);
          context.fill();
          context.restore();
        } else if (!this.#reducedMotion && tile.kind === 'source') {
          const orbitRadius = projected.tileWidth * 0.105;
          const phase = time * 0.00115;
          context.strokeStyle = withAlpha(theme.brassLight, 0.24);
          context.lineWidth = Math.max(0.8, projected.tileWidth * 0.004);
          context.beginPath();
          context.ellipse(projected.center.x, coreY, orbitRadius, orbitRadius * 0.42, -0.24, 0, Math.PI * 2);
          context.stroke();
          context.fillStyle = withAlpha('#ffffff', 0.78);
          context.beginPath();
          context.arc(
            projected.center.x + Math.cos(phase) * orbitRadius,
            coreY + Math.sin(phase) * orbitRadius * 0.42,
            Math.max(1.1, projected.tileWidth * 0.0065),
            0,
            Math.PI * 2,
          );
          context.fill();
        } else if (!this.#reducedMotion && tile.kind === 'plant') {
          const phase = (time * 0.00022 + tile.x * 0.31 + tile.y * 0.17) % 1;
          const pollenX = projected.center.x + Math.sin(time * 0.0014 + tile.x) * projected.tileWidth * 0.055;
          const pollenY = coreY - projected.tileHeight * (0.18 + phase * 0.44);
          context.fillStyle = withAlpha(theme.accent, normalizedPower * (0.22 + Math.sin(phase * Math.PI) * 0.35));
          context.beginPath();
          context.arc(pollenX, pollenY, Math.max(0.8, projected.tileWidth * 0.0048), 0, Math.PI * 2);
          context.fill();
        }
        context.restore();
      }

      const selected = tile.id === this.#selectedId;
      const hovered = tile.id === this.#hoveredId;
      const pressed = tile.id === this.#pressedId;
      const coached = tile.id === this.#coachId;
      const hinted = tile.id === this.#hintId;
      if (selected || hovered || pressed || coached || hinted) {
        this.#drawSelection(projected.polygon, projected.tileWidth, theme, time, coached || hinted, pressed);
      }
      this.#drawImpact(projected, projected.center, theme, time);
    }

    // Continue aether across the physical gaps between mutually aligned plates.
    context.save();
    context.globalCompositeOperation = 'screen';
    context.lineCap = 'round';
    for (const projected of this.#projected) {
      const mask = currentMask(projected.tile);
      if (!this.#analysis.powered.has(projected.tile.id)) continue;
      for (const direction of DIRECTIONS) {
        if ((mask & direction.bit) === 0) continue;
        const neighbor = byPosition.get(`${projected.tile.x + direction.dx},${projected.tile.y + direction.dy}`);
        if (!neighbor || projected.tile.id >= neighbor.tile.id || !this.#analysis.powered.has(neighbor.tile.id)) continue;
        if ((currentMask(neighbor.tile) & direction.opposite) === 0) continue;
        const dx = neighbor.center.x - projected.center.x;
        const dy = neighbor.center.y - projected.center.y;
        const start = { x: projected.center.x + dx * 0.43, y: projected.center.y + dy * 0.43 };
        const end = { x: projected.center.x + dx * 0.57, y: projected.center.y + dy * 0.57 };
        const pulse = this.#reducedMotion ? 0.8 : 0.72 + Math.sin(time * 0.006 + projected.tile.x + projected.tile.y) * 0.16;
        context.strokeStyle = withAlpha('#1ccfff', 0.58 * pulse);
        context.lineWidth = Math.max(2.7, projected.tileWidth * 0.029);
        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.stroke();
        context.strokeStyle = withAlpha(theme.aqua, 0.78 * pulse);
        context.lineWidth = Math.max(1.65, projected.tileWidth * 0.016);
        context.stroke();
        context.strokeStyle = withAlpha('#f0ffff', 0.68 * pulse);
        context.lineWidth = Math.max(0.85, projected.tileWidth * 0.006);
        context.stroke();
      }
    }
    context.restore();
  }

  #drawAtmosphere(time: number): void {
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

  #projectBoard(puzzle: PuzzleDefinition): ProjectedTile[] {
    const portrait = this.#height > this.#width * 1.14;
    // The full desktop cockpit deliberately reserves real layout space for both
    // objective rails. This keeps every interactive tile unobstructed rather than
    // merely drawing UI over the outer rows of the puzzle.
    const cockpit = !portrait && this.#width >= 1180 && this.#height >= 610;
    const topReserve = portrait
      ? Math.min(285, this.#height * 0.22)
      : cockpit
        ? Math.min(112, this.#height * 0.14)
        : Math.min(126, this.#height * 0.18);
    const bottomReserve = portrait
      ? Math.min(245, this.#height * 0.18)
      : cockpit
        ? Math.min(116, this.#height * 0.14)
        : Math.min(128, this.#height * 0.18);
    const sideLeft = cockpit ? Math.max(304, this.#width * 0.195) : this.#width * (portrait ? 0.035 : 0.055);
    const sideRight = cockpit ? Math.max(262, this.#width * 0.172) : this.#width * (portrait ? 0.035 : 0.055);
    const available = {
      left: sideLeft,
      right: this.#width - sideRight,
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
    // Cinematic platforms keep a small physical gap between neighbours. The old
    // edge-to-edge slab made the live board read as a flat spreadsheet instead of
    // a collection of crafted floating mechanisms.
    const tileWidth = scale * 0.98;
    const tileHeight = scale * (portrait ? 0.68 : 0.56);
    const boardW = (maxX - minX) * scale;
    const boardH = (maxY - minY) * scale;
    const originX = available.left + (availW - boardW) / 2 - minX * scale;
    const originY = available.top + (availH - boardH) / 2 - minY * scale + (portrait ? 2 : 10);
    const result = unitCenters.map(({ tile, x, y }) => {
      const center = { x: originX + x * scale, y: originY + y * scale };
      const polygon = diamond(center, tileWidth, tileHeight);
      return { tile, center, polygon, tileWidth, tileHeight, depth: center.y };
    });
    return result.sort((left, right) => left.depth - right.depth || left.center.x - right.center.x);
  }

  #drawBoardShadow(theme: Theme): void {
    if (this.#projected.length === 0) return;
    const context = this.#context;
    const minX = Math.min(...this.#projected.map((item) => item.center.x - item.tileWidth * 0.62));
    const maxX = Math.max(...this.#projected.map((item) => item.center.x + item.tileWidth * 0.62));
    const minY = Math.min(...this.#projected.map((item) => item.center.y - item.tileHeight * 0.52));
    const maxY = Math.max(...this.#projected.map((item) => item.center.y + item.tileHeight * 0.95));
    context.save();
    context.translate(0, (maxY - minY) * 0.08);
    if (this.#profile.useFilters && 'filter' in context) context.filter = 'blur(18px)';
    context.fillStyle = this.#profile.useFilters ? 'rgba(0, 0, 0, .48)' : 'rgba(0, 0, 0, .34)';
    context.beginPath();
    context.ellipse((minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.48, (maxY - minY) * 0.34, 0, 0, Math.PI * 2);
    context.fill();
    if ('filter' in context) context.filter = 'none';
    if (this.#profile.quality === 'high') {
      const aura = context.createRadialGradient((minX + maxX) / 2, (minY + maxY) / 2, 0, (minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.62);
      aura.addColorStop(0, `${theme.aquaSoft}20`);
      aura.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = aura;
      context.fillRect(minX - 50, minY - 50, maxX - minX + 100, maxY - minY + 100);
    }
    context.restore();
  }

  #drawConnectionBridges(theme: Theme, time: number): void {
    if (this.#profile.quality !== 'high' || !this.#puzzle || !this.#analysis) return;
    const pipe = this.#premiumSprite('pipe');
    if (!pipe) return;
    const byPosition = new Map(this.#projected.map((projected) => [`${projected.tile.x},${projected.tile.y}`, projected] as const));
    const context = this.#context;
    for (const projected of this.#projected) {
      const mask = currentMask(projected.tile);
      for (const direction of DIRECTIONS) {
        if ((mask & direction.bit) === 0) continue;
        const neighbor = byPosition.get(`${projected.tile.x + direction.dx},${projected.tile.y + direction.dy}`);
        if (!neighbor || projected.tile.id >= neighbor.tile.id) continue;
        if ((currentMask(neighbor.tile) & direction.opposite) === 0) continue;

        const dx = neighbor.center.x - projected.center.x;
        const dy = neighbor.center.y - projected.center.y;
        const length = Math.hypot(dx, dy);
        if (length < 2) continue;
        const angle = Math.atan2(dy, dx);
        const width = Math.max(3.4, Math.min(projected.tileWidth, neighbor.tileWidth) * 0.046);
        const pipeHeight = width * 2.75;
        const powered = this.#analysis.powered.has(projected.tile.id) && this.#analysis.powered.has(neighbor.tile.id);
        const pulse = this.#reducedMotion ? 0.9 : 0.82 + Math.sin(time * 0.006 + projected.tile.x * 0.7 + projected.tile.y) * 0.12;

        context.save();
        context.translate((projected.center.x + neighbor.center.x) / 2, (projected.center.y + neighbor.center.y) / 2);
        context.rotate(angle);
        if (this.#profile.useExpensiveShadows) {
          context.shadowColor = 'rgba(0,0,0,.62)';
          context.shadowBlur = width * 1.1;
          context.shadowOffsetY = width * 0.45;
        }
        context.drawImage(pipe, -length / 2, -pipeHeight / 2, length, pipeHeight);
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;
        if (this.#renderingStatic) {
          context.strokeStyle = 'rgba(42, 22, 9, .84)';
          context.lineWidth = Math.max(1.6, width * 0.70);
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(-length * 0.49, 0);
          context.lineTo(length * 0.49, 0);
          context.stroke();
          context.strokeStyle = withAlpha(theme.brassLight, 0.62);
          context.lineWidth = Math.max(0.95, width * 0.29);
          context.stroke();
        }
        if (powered && !this.#renderingStatic) {
          context.globalCompositeOperation = 'screen';
          context.strokeStyle = withAlpha(theme.aqua, 0.58 * pulse);
          context.lineWidth = width * 0.42;
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(-length * 0.49, 0);
          context.lineTo(length * 0.49, 0);
          context.stroke();
        }
        context.restore();
      }
    }
  }

  #drawTile(projected: ProjectedTile, theme: Theme, time: number): void {
    const { tile, center, polygon, tileWidth, tileHeight } = projected;
    const context = this.#context;
    const fallbackPower = this.#analysis?.powered.has(tile.id) ? 1 : 0;
    const power = this.#renderingStatic ? fallbackPower : this.#powerValue(tile.id, time, fallbackPower);
    const powered = power > 0.025;
    const selected = !this.#renderingStatic && tile.id === this.#selectedId;
    const hovered = !this.#renderingStatic && tile.id === this.#hoveredId;
    const pressed = !this.#renderingStatic && tile.id === this.#pressedId;
    const coached = !this.#renderingStatic && tile.id === this.#coachId;
    const hinted = !this.#renderingStatic && tile.id === this.#hintId;
    const baseLift = selected || hovered || coached || hinted ? Math.max(2, tileHeight * 0.045) : 0;
    const lift = pressed ? Math.max(0, baseLift - tileHeight * 0.035) : baseLift;
    const topPolygon = polygon.map((point) => ({ x: point.x, y: point.y - lift })) as [Point, Point, Point, Point];
    context.save();
    const themeIndex = this.#puzzle?.theme ?? 0;
    const artVariant = (tile.x * 3 + tile.y * 5 + tile.baseMask) & 3;
    const cinematicPlatform = this.#profile.quality === 'high' ? this.#premiumSprite(platformSpriteKey(tile)) : null;
    if (cinematicPlatform) {
      // The cinematic plate is authored around a 944×444 isometric top diamond
      // centred at (512, 276). Non-uniform fitting keeps that face aligned with
      // the real hit polygon while retaining the deeper hand-painted extrusion.
      const platformScaleX = tileWidth / 944;
      const platformScaleY = tileHeight / 444;
      context.drawImage(
        cinematicPlatform,
        center.x - 512 * platformScaleX,
        center.y - lift - 276 * platformScaleY,
        cinematicPlatform.naturalWidth * platformScaleX,
        cinematicPlatform.naturalHeight * platformScaleY,
      );
    } else {
      const platform = this.#art.platform(themeIndex, theme, this.#profile.quality, artVariant);
      const platformScaleX = tileWidth / 500;
      const platformScaleY = tileHeight / 250;
      context.drawImage(
        platform.image,
        center.x - platform.dimensions.anchorX * platformScaleX,
        center.y - lift - platform.dimensions.anchorY * platformScaleY,
        platform.dimensions.width * platformScaleX,
        platform.dimensions.height * platformScaleY,
      );
    }

    // A second hand-rendered plate is clipped to the interactive top surface. It
    // contributes micro-rivets, etched geometry and a different glass grain without
    // increasing per-frame vector work; the cached procedural extrusion remains the
    // authoritative geometry and hit shape.
    const premiumPlate = this.#profile.quality === 'high' && !cinematicPlatform ? this.#premiumSprite('tile-base') : null;
    if (premiumPlate) {
      const spriteScaleX = tileWidth / 452;
      const spriteScaleY = tileHeight / 265;
      context.save();
      pathPolygon(context, topPolygon);
      context.clip();
      context.globalAlpha = 0.26;
      context.globalCompositeOperation = 'soft-light';
      context.drawImage(
        premiumPlate,
        center.x - 256 * spriteScaleX,
        center.y - lift - 174 * spriteScaleY,
        512 * spriteScaleX,
        512 * spriteScaleY,
      );
      context.restore();
    }

    // Powered glass behaves like a real illuminated material rather than a flat
    // color swap. The cached art remains crisp while this lightweight overlay is
    // animated per tile.
    if (powered || this.#highContrast) {
      context.save();
      pathPolygon(context, topPolygon);
      context.clip();
      const normalizedPower = clamp(power, 0, 1);
      const glow = context.createRadialGradient(
        center.x - tileWidth * 0.14,
        center.y - lift - tileHeight * 0.20,
        0,
        center.x,
        center.y - lift,
        tileWidth * 0.55,
      );
      glow.addColorStop(0, withAlpha(theme.aqua, this.#highContrast ? 0.22 : 0.05 + normalizedPower * 0.18));
      glow.addColorStop(0.56, withAlpha(theme.aquaSoft, this.#highContrast ? 0.12 : normalizedPower * 0.08));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = glow;
      context.fillRect(center.x - tileWidth * 0.58, center.y - lift - tileHeight * 0.65, tileWidth * 1.16, tileHeight * 1.3);
      context.globalCompositeOperation = 'screen';
      context.strokeStyle = withAlpha(theme.aqua, this.#highContrast ? 0.72 : 0.16 + normalizedPower * 0.34);
      context.lineWidth = Math.max(1.2, tileWidth * 0.009);
      pathPolygon(context, insetDiamond({ x: center.x, y: center.y - lift }, tileWidth * 0.82, tileHeight * 0.70));
      context.stroke();
      context.restore();
    }

    // Tiny moving reflections make every plate feel individually polished.
    if (this.#profile.quality === 'high') {
      context.save();
      pathPolygon(context, topPolygon);
      context.clip();
      const shimmerOffset = this.#reducedMotion || this.#renderingStatic ? 0.32 + artVariant * 0.13 : (time * 0.000035 + artVariant * 0.19) % 1;
      const shimmerX = center.x - tileWidth * 0.62 + shimmerOffset * tileWidth * 1.24;
      const sheen = context.createLinearGradient(shimmerX - tileWidth * 0.18, center.y - tileHeight, shimmerX + tileWidth * 0.18, center.y + tileHeight);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.46, 'rgba(235,255,248,.015)');
      sheen.addColorStop(0.5, powered ? withAlpha(theme.aqua, 0.13) : 'rgba(255,255,255,.095)');
      sheen.addColorStop(0.54, 'rgba(235,255,248,.014)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = sheen;
      context.fillRect(center.x - tileWidth * 0.7, center.y - lift - tileHeight, tileWidth * 1.4, tileHeight * 2);
      context.restore();
    }

    this.#drawChannels(projected, { x: center.x, y: center.y - lift }, theme, power, time);

    if (tile.kind === 'source') this.#drawSource(projected, { x: center.x, y: center.y - lift }, theme, time);
    else if (tile.kind === 'plant') this.#drawPlant(projected, { x: center.x, y: center.y - lift }, theme, power, time);
    else this.#drawMechanism(projected, { x: center.x, y: center.y - lift }, theme, power, time);

    if (tile.fixed && tile.kind === 'pipe') this.#drawLock(center.x + tileWidth * 0.27, center.y - lift - tileHeight * 0.10, tileWidth * 0.08, theme);
    if (!this.#renderingStatic && (selected || hovered || coached || hinted || pressed)) this.#drawSelection(topPolygon, tileWidth, theme, time, coached || hinted, pressed);
    if (!this.#renderingStatic) this.#drawImpact(projected, { x: center.x, y: center.y - lift }, theme, time);
    context.restore();

    for (const direction of this.#leaksByTile.get(tile.id) ?? []) {
      this.#drawLeak(projected, { x: center.x, y: center.y - lift }, direction, theme, time);
    }
  }

  #drawCornerRivets(center: Point, tileWidth: number, tileHeight: number, theme: Theme): void {
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
      } else {
        context.fillStyle = theme.brass;
      }
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  #drawChannels(projected: ProjectedTile, center: Point, theme: Theme, power: number, time: number): void {
    const context = this.#context;
    const turns = this.#displayTurns.get(projected.tile.id) ?? projected.tile.visualTurns;
    const powered = power > 0.02;
    const normalizedPower = clamp(power, 0, 1);
    const pulse = this.#reducedMotion ? 0.82 : 0.72 + Math.sin(time * 0.006 + projected.tile.x * 1.7 + projected.tile.y) * 0.18;
    for (const direction of DIRECTIONS) {
      if ((projected.tile.baseMask & direction.bit) === 0) continue;
      const vector = this.#directionVector(direction.bit, turns, projected.tileWidth, projected.tileHeight);
      const end = { x: center.x + vector.x * 0.49, y: center.y + vector.y * 0.49 };
      const inner = { x: center.x + vector.x * 0.23, y: center.y + vector.y * 0.23 };
      const width = Math.max(3.8, projected.tileWidth * 0.056);
      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      const pipeAngle = Math.atan2(vector.y, vector.x);
      const cinematicPipe = this.#profile.quality === 'high' ? this.#premiumSprite('pipe') : null;
      if (cinematicPipe) {
        const length = Math.hypot(end.x - inner.x, end.y - inner.y) + width * 2.2;
        const pipeHeight = width * 3.0;
        const midpointX = (inner.x + end.x) / 2;
        const midpointY = (inner.y + end.y) / 2;
        context.save();
        context.translate(midpointX, midpointY);
        context.rotate(pipeAngle);
        if (this.#profile.useExpensiveShadows) {
          context.shadowColor = 'rgba(0,0,0,.42)';
          context.shadowBlur = width * 0.9;
          context.shadowOffsetY = width * 0.38;
        }
        context.drawImage(cinematicPipe, -length / 2, -pipeHeight / 2, length, pipeHeight);
        context.restore();
        if (this.#renderingStatic) {
          context.strokeStyle = 'rgba(42, 22, 9, .84)';
          context.lineWidth = Math.max(1.7, width * 0.72);
          context.lineCap = 'round';
          context.beginPath();
          context.moveTo(inner.x, inner.y);
          context.lineTo(end.x, end.y);
          context.stroke();
          context.strokeStyle = withAlpha(theme.brassLight, 0.68);
          context.lineWidth = Math.max(1.0, width * 0.31);
          context.stroke();
        }
      } else {
        context.strokeStyle = '#4b2f1a';
        context.lineWidth = width * 1.72;
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
        } else {
          context.strokeStyle = theme.brass;
        }
        context.lineWidth = width * 1.08;
        context.stroke();
        context.strokeStyle = 'rgba(255, 238, 175, .45)';
        context.lineWidth = width * 0.15;
        context.stroke();

        // A recessed glass core and engraved compression collars prevent the
        // channels from reading as flat brown lines at gameplay scale.
        context.strokeStyle = powered ? withAlpha(theme.aquaSoft, 0.30 + normalizedPower * 0.20) : 'rgba(5, 34, 35, .86)';
        context.lineWidth = width * 0.36;
        context.stroke();
        for (const collarT of (this.#profile.quality === 'high' ? [0.46, 0.76] : [0.66])) {
          const collarX = inner.x + (end.x - inner.x) * collarT;
          const collarY = inner.y + (end.y - inner.y) * collarT;
          context.save();
          context.translate(collarX, collarY);
          context.rotate(pipeAngle);
          const collar = context.createLinearGradient(0, -width, 0, width);
          collar.addColorStop(0, '#fff0ae');
          collar.addColorStop(0.22, theme.brassLight);
          collar.addColorStop(0.53, theme.brass);
          collar.addColorStop(0.82, '#5b351b');
          collar.addColorStop(1, '#dba956');
          context.fillStyle = collar;
          context.strokeStyle = 'rgba(255,238,185,.52)';
          context.lineWidth = Math.max(.65, width * .10);
          roundedRect(context, -width * .24, -width * .70, width * .48, width * 1.40, width * .13);
          context.fill();
          context.stroke();
          context.restore();
        }
      }

      // The animated aether core remains vector so it can react instantly to live
      // network state even when the brass shell comes from a pre-rendered sprite.
      context.beginPath();
      context.moveTo(inner.x, inner.y);
      context.lineTo(end.x, end.y);
      if (powered && !this.#renderingStatic) {
        if (this.#profile.useExpensiveShadows) {
          context.shadowColor = theme.aqua;
          context.shadowBlur = width * 2.5 * normalizedPower;
        }
        context.strokeStyle = withAlpha(theme.aquaSoft, normalizedPower * pulse * 0.72);
        context.lineWidth = width * (0.42 + normalizedPower * 0.34);
        context.stroke();
        context.shadowBlur = 0;
        context.strokeStyle = withAlpha('#f4ffff', normalizedPower * (0.50 + pulse * 0.42));
        context.lineWidth = width * (0.12 + normalizedPower * 0.15);
        context.stroke();
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
      // End coupling. High-quality mode uses a pre-rendered brass jewel so the
      // tiny connector still has readable rivets and material depth on retina screens.
      context.shadowBlur = 0;
      const coupler = this.#profile.quality === 'high' ? this.#premiumSprite('coupler') : null;
      if (coupler) {
        const couplerSize = width * 3.15;
        context.save();
        context.globalAlpha = 0.88 + normalizedPower * 0.12;
        if (this.#profile.useExpensiveShadows) {
          context.shadowColor = theme.aqua;
          context.shadowBlur = width * 1.9;
        }
        context.drawImage(coupler, end.x - couplerSize / 2, end.y - couplerSize / 2, couplerSize, couplerSize);
        if (powered) {
          context.globalCompositeOperation = 'screen';
          context.fillStyle = withAlpha(theme.aqua, 0.46 + normalizedPower * 0.44);
          context.shadowColor = theme.aqua;
          context.shadowBlur = width * 1.55 * normalizedPower;
          context.beginPath();
          context.ellipse(
            end.x,
            end.y,
            width * (0.28 + normalizedPower * 0.16),
            width * (0.18 + normalizedPower * 0.10),
            Math.atan2(vector.y, vector.x),
            0,
            Math.PI * 2,
          );
          context.fill();
        }
        context.restore();
      } else {
        context.fillStyle = '#271a12';
        context.strokeStyle = theme.brass;
        context.lineWidth = Math.max(1.1, width * 0.22);
        context.beginPath();
        context.ellipse(end.x, end.y, width * 0.62, width * 0.39, Math.atan2(vector.y, vector.x), 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (powered) {
          context.fillStyle = withAlpha(theme.aqua, 0.35 + normalizedPower * 0.65);
          if (this.#profile.useExpensiveShadows) {
            context.shadowColor = theme.aqua;
            context.shadowBlur = width * 1.8;
          }
          context.beginPath();
          context.ellipse(end.x, end.y, width * (0.17 + normalizedPower * 0.15), width * (0.08 + normalizedPower * 0.075), Math.atan2(vector.y, vector.x), 0, Math.PI * 2);
          context.fill();
        }
      }
      context.restore();
    }
  }

  #drawMechanism(projected: ProjectedTile, center: Point, theme: Theme, power: number, time: number): void {
    const context = this.#context;
    const normalizedPower = clamp(power, 0, 1);
    const themeIndex = this.#puzzle?.theme ?? 0;
    // The physical assembly reflects the topology it controls: terminal,
    // straight regulator, elbow escapement, or multi-way distributor.
    const variant = mechanismVariant(projected.tile);
    const spin = this.#reducedMotion ? 0 : time * 0.00018 * (0.34 + normalizedPower * 0.9) * (variant % 2 ? -1 : 1);
    const premiumMechanism = this.#profile.quality === 'high' ? this.#premiumSprite(mechanismSpriteKey(projected.tile)) : null;

    if (premiumMechanism) {
      // Cinematic mode treats the high-resolution sprite as the authoritative shell.
      // The old cached vector assembly is deliberately not drawn underneath: stacking
      // both was the main reason the live board looked flatter and noisier than the art.
      const spriteSize = projected.tileWidth * 0.60;
      context.save();
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = normalizedPower > 0.08 ? withAlpha(theme.aquaSoft, 0.30) : 'rgba(0,0,0,.58)';
        context.shadowBlur = projected.tileWidth * (0.045 + normalizedPower * 0.035);
        context.shadowOffsetY = projected.tileHeight * 0.035;
      }
      context.globalAlpha = 0.99;
      context.drawImage(
        premiumMechanism,
        center.x - spriteSize / 2,
        center.y - spriteSize * 0.515,
        spriteSize,
        spriteSize,
      );
      context.restore();
    } else {
      const art = this.#art.mechanism(themeIndex, theme, this.#profile.quality, variant);
      const targetOuter = projected.tileWidth * 0.148;
      const scale = targetOuter / 112;
      context.save();
      context.translate(center.x, center.y);
      context.rotate(spin);
      context.drawImage(
        art.image,
        -art.dimensions.anchorX * scale,
        -art.dimensions.anchorY * scale,
        art.dimensions.width * scale,
        art.dimensions.height * scale,
      );
      context.restore();
    }

    if (this.#renderingStatic && premiumMechanism) return;

    // Independent counter-rotating dial and jeweled aether core remain live so the
    // detailed shell reacts immediately to power without swapping a static screenshot.
    const radius = projected.tileWidth * (premiumMechanism ? 0.071 : 0.104);
    context.save();
    context.translate(center.x, center.y);
    context.rotate(-spin * 1.7);
    context.strokeStyle = withAlpha(theme.brassLight, premiumMechanism ? 0.42 : 0.78);
    context.lineWidth = Math.max(1.05, radius * (premiumMechanism ? 0.052 : 0.075));
    context.setLineDash(this.#profile.quality === 'high' ? [radius * 0.18, radius * 0.13] : []);
    context.beginPath();
    context.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();

    const pulse = this.#reducedMotion ? 1 : 0.92 + Math.sin(time * 0.0055 + variant) * 0.08;
    const core = context.createRadialGradient(
      center.x - radius * 0.25,
      center.y - radius * 0.32,
      0,
      center.x,
      center.y,
      radius * 0.65,
    );
    core.addColorStop(0, normalizedPower > 0.02 ? '#ffffff' : '#8bb2a7');
    core.addColorStop(0.16, normalizedPower > 0.02 ? theme.aqua : theme.glassLight);
    core.addColorStop(0.48, normalizedPower > 0.02 ? withAlpha(theme.aquaSoft, 0.95) : theme.ink);
    core.addColorStop(0.76, '#041315');
    core.addColorStop(1, theme.brassLight);
    context.save();
    if (normalizedPower > 0.02 && this.#profile.useExpensiveShadows) {
      context.shadowColor = theme.aqua;
      context.shadowBlur = radius * (1.2 + normalizedPower * 2.2);
    }
    context.fillStyle = core;
    context.beginPath();
    context.arc(center.x, center.y, radius * (0.47 + normalizedPower * 0.08) * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,245,208,.72)';
    context.lineWidth = Math.max(1, radius * 0.07);
    context.stroke();
    context.restore();

    if (!this.#reducedMotion && normalizedPower > 0.18) {
      const satelliteCount = this.#profile.quality === 'high' ? 4 : 2;
      context.save();
      context.fillStyle = '#fffdf0';
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = theme.aqua;
        context.shadowBlur = radius * 0.8;
      }
      for (let index = 0; index < satelliteCount; index += 1) {
        const angle = time * 0.0012 * (index % 2 ? -1 : 1) + index * Math.PI * 2 / satelliteCount;
        const orbit = radius * (0.58 + (index % 2) * 0.16);
        context.globalAlpha = 0.42 + normalizedPower * 0.55;
        context.beginPath();
        context.arc(center.x + Math.cos(angle) * orbit, center.y + Math.sin(angle) * orbit * 0.55, Math.max(1.1, radius * 0.045), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  #drawSource(projected: ProjectedTile, center: Point, theme: Theme, time: number): void {
    const context = this.#context;
    const themeIndex = this.#puzzle?.theme ?? 0;
    const art = this.#art.source(themeIndex, theme, this.#profile.quality);
    const targetOuter = projected.tileWidth * 0.19;
    const scale = targetOuter / 112;
    const baseY = center.y + projected.tileHeight * 0.018;
    const premiumSource = this.#profile.quality === 'high' ? this.#premiumSprite('source') : null;
    let premiumSize = 0;

    context.save();
    if (premiumSource) {
      premiumSize = projected.tileWidth * 0.72;
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = 'rgba(0,0,0,.62)';
        context.shadowBlur = projected.tileWidth * 0.06;
        context.shadowOffsetY = projected.tileHeight * 0.06;
      }
      context.drawImage(
        premiumSource,
        center.x - premiumSize / 2,
        baseY - premiumSize * 0.92,
        premiumSize,
        premiumSize,
      );
    } else {
      context.drawImage(
        art.image,
        center.x - art.dimensions.anchorX * scale,
        baseY - art.dimensions.anchorY * scale,
        art.dimensions.width * scale,
        art.dimensions.height * scale,
      );
    }
    context.restore();

    if (this.#renderingStatic && premiumSource) return;

    const radius = projected.tileWidth * (premiumSource ? 0.098 : 0.112);
    const orbY = baseY - (premiumSource ? premiumSize * 0.53 : projected.tileHeight * 0.20);
    const pulse = this.#reducedMotion ? 1 : 0.9 + Math.sin(time * 0.0046) * 0.1;
    const orb = context.createRadialGradient(
      center.x - radius * 0.32,
      orbY - radius * 0.38,
      0,
      center.x,
      orbY,
      radius * 0.92,
    );
    orb.addColorStop(0, '#ffffff');
    orb.addColorStop(0.13, '#dffffc');
    orb.addColorStop(0.28, theme.aqua);
    orb.addColorStop(0.58, theme.aquaSoft);
    orb.addColorStop(0.82, '#0b5570');
    orb.addColorStop(1, '#04141a');
    context.save();
    if (this.#profile.useExpensiveShadows) {
      context.shadowColor = theme.aqua;
      context.shadowBlur = radius * 2.8;
    }
    context.fillStyle = orb;
    context.beginPath();
    context.arc(center.x, orbY, radius * 0.64 * pulse, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,.76)';
    context.lineWidth = Math.max(1.4, radius * 0.085);
    context.stroke();
    context.restore();

    // Glass sphere highlight and refraction.
    context.save();
    context.globalAlpha = 0.76;
    context.strokeStyle = 'rgba(226,255,250,.72)';
    context.lineWidth = Math.max(1, radius * 0.055);
    context.beginPath();
    context.arc(center.x - radius * 0.13, orbY - radius * 0.08, radius * 0.48, Math.PI * 1.06, Math.PI * 1.68);
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,.86)';
    context.beginPath();
    context.ellipse(center.x - radius * 0.22, orbY - radius * 0.30, radius * 0.12, radius * 0.06, -0.55, 0, Math.PI * 2);
    context.fill();
    context.restore();

    // Counter-rotating orbital rings and cardinal runes.
    const orbit = radius * 1.42;
    context.save();
    context.translate(center.x, orbY);
    context.rotate(this.#reducedMotion ? -0.2 : time * 0.00036);
    context.scale(1, 0.46);
    context.strokeStyle = withAlpha(theme.aqua, 0.78);
    context.lineWidth = Math.max(1.4, radius * 0.075);
    if (this.#profile.useExpensiveShadows) {
      context.shadowColor = theme.aqua;
      context.shadowBlur = radius * 0.9;
    }
    context.beginPath();
    context.arc(0, 0, orbit, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.save();
    context.translate(center.x, orbY);
    context.rotate(this.#reducedMotion ? 0.34 : -time * 0.00052);
    context.strokeStyle = withAlpha(theme.brassLight, 0.68);
    context.lineWidth = Math.max(1, radius * 0.055);
    context.beginPath();
    context.arc(0, 0, orbit * 0.82, Math.PI * 0.08, Math.PI * 0.92);
    context.arc(0, 0, orbit * 0.82, Math.PI * 1.08, Math.PI * 1.92);
    context.stroke();
    for (let index = 0; index < 4; index += 1) {
      const angle = index * Math.PI / 2;
      context.fillStyle = index % 2 ? theme.accent : theme.aqua;
      drawStar(context, Math.cos(angle) * orbit * 0.82, Math.sin(angle) * orbit * 0.42, radius * 0.14, radius * 0.05, 4, angle + time * 0.0002);
      context.fill();
    }
    context.restore();

    // Rising aether motes make the source feel alive without forcing the full
    // renderer to stay at 60fps on idle mobile devices.
    if (!this.#reducedMotion && this.#profile.quality === 'high') {
      context.save();
      context.fillStyle = '#ffffff';
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = theme.aqua;
        context.shadowBlur = radius * 0.72;
      }
      for (let index = 0; index < 5; index += 1) {
        const phase = (time * 0.00032 + index * 0.19) % 1;
        const x = center.x + Math.sin(index * 2.3 + time * 0.001) * radius * (0.18 + phase * 0.36);
        const y = orbY - radius * (0.2 + phase * 2.2);
        context.globalAlpha = Math.sin(phase * Math.PI) * 0.78;
        context.beginPath();
        context.arc(x, y, Math.max(1.1, radius * (0.025 + (1 - phase) * 0.025)), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  #drawPlant(projected: ProjectedTile, center: Point, theme: Theme, power: number, time: number): void {
    const context = this.#context;
    const normalizedPower = clamp(power, 0, 1);
    const kind = projected.tile.plantKind ?? 'lumen-orchid';
    const palette = PLANT_PALETTES[kind];
    const themeIndex = this.#puzzle?.theme ?? 0;
    const art = this.#art.planter(themeIndex, theme, this.#profile.quality, kind);
    const targetPotWidth = projected.tileWidth * 0.255;
    const scale = targetPotWidth / 114;
    const potBaseY = center.y + projected.tileHeight * 0.235;
    const variant = (projected.tile.x * 5 + projected.tile.y * 9) % 4;
    const sway = this.#reducedMotion || this.#renderingStatic ? 0 : Math.sin(time * 0.0017 + projected.tile.x * 0.81 + projected.tile.y * 0.43) * (0.015 + normalizedPower * 0.035);
    const hasCloche = this.#profile.quality === 'high' && (variant === 0 || kind === 'mist-lily');
    const useCinematicPlant = this.#profile.quality === 'high';

    // Selected specimens use a hand-rendered transparent cloche sprite with
    // separate dormant and illuminated states. Cross-fading the pair preserves
    // the real gameplay bloom transition instead of swapping a static picture.
    if (useCinematicPlant) {
      const [offKey, onKey] = PLANT_SPRITES[kind];
      const offSprite = this.#premiumSprite(offKey);
      const onSprite = this.#premiumSprite(onKey);
      if (offSprite && onSprite) {
        const spriteWidth = projected.tileWidth * 0.54;
        const spriteScale = spriteWidth / Math.max(1, offSprite.naturalWidth);
        const spriteHeight = offSprite.naturalHeight * spriteScale;
        const spriteX = center.x - spriteWidth / 2;
        const spriteY = potBaseY - spriteHeight * 0.87;
        context.save();
        context.translate(center.x, potBaseY);
        context.rotate(sway * 0.14);
        context.translate(-center.x, -potBaseY);
        if (this.#profile.useExpensiveShadows) {
          context.shadowColor = normalizedPower > 0.18 ? palette[2] : 'rgba(0,0,0,.58)';
          context.shadowBlur = projected.tileWidth * (0.028 + normalizedPower * 0.035);
          context.shadowOffsetY = projected.tileHeight * 0.025;
        }
        context.globalAlpha = 1;
        context.drawImage(offSprite, spriteX, spriteY, spriteWidth, spriteHeight);
        const bloom = normalizedPower * normalizedPower * (3 - 2 * normalizedPower);
        context.globalAlpha = bloom;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(onSprite, spriteX, spriteY, spriteWidth, spriteHeight);
        if (bloom > 0.12) {
          context.globalAlpha = bloom * 0.09;
          context.globalCompositeOperation = 'screen';
          context.drawImage(onSprite, spriteX, spriteY, spriteWidth, spriteHeight);
        }
        context.restore();

        if (this.#renderingStatic) return;

        if (!this.#reducedMotion && normalizedPower > 0.35) {
          context.save();
          context.fillStyle = '#fffbe7';
          if (this.#profile.useExpensiveShadows) {
            context.shadowColor = palette[2];
            context.shadowBlur = projected.tileWidth * 0.04;
          }
          for (let index = 0; index < 6; index += 1) {
            const phase = (time * 0.00028 + index / 6 + variant * 0.07) % 1;
            const angle = index * 2.17 + time * 0.0006;
            context.globalAlpha = Math.sin(phase * Math.PI) * normalizedPower * 0.85;
            context.beginPath();
            context.arc(
              center.x + Math.cos(angle) * projected.tileWidth * (0.035 + phase * 0.08),
              potBaseY - projected.tileHeight * (0.25 + phase * 0.52) + Math.sin(angle) * projected.tileHeight * 0.035,
              Math.max(0.8, projected.tileWidth * 0.006),
              0,
              Math.PI * 2,
            );
            context.fill();
          }
          context.restore();
        }
        return;
      }
    }

    // Some rare specimens are protected by a glass cloche. It is rendered behind
    // the plant so the crop stays crisp and readable at gameplay scale.
    if (hasCloche) {
      const domeRadius = projected.tileWidth * 0.13;
      const domeTop = potBaseY - projected.tileHeight * 0.47;
      context.save();
      const glass = context.createLinearGradient(center.x - domeRadius, domeTop, center.x + domeRadius, potBaseY);
      glass.addColorStop(0, 'rgba(245,255,255,.22)');
      glass.addColorStop(0.34, 'rgba(185,244,236,.04)');
      glass.addColorStop(0.72, 'rgba(96,199,185,.06)');
      glass.addColorStop(1, 'rgba(255,255,255,.15)');
      context.fillStyle = glass;
      context.strokeStyle = 'rgba(226,255,249,.42)';
      context.lineWidth = Math.max(1.2, projected.tileWidth * 0.008);
      if (normalizedPower > 0.35 && this.#profile.useExpensiveShadows) {
        context.shadowColor = palette[2];
        context.shadowBlur = domeRadius * 0.42 * normalizedPower;
      }
      context.beginPath();
      context.moveTo(center.x - domeRadius, potBaseY - 4);
      context.bezierCurveTo(center.x - domeRadius * 0.96, domeTop + domeRadius * 0.15, center.x - domeRadius * 0.55, domeTop, center.x, domeTop);
      context.bezierCurveTo(center.x + domeRadius * 0.55, domeTop, center.x + domeRadius * 0.96, domeTop + domeRadius * 0.15, center.x + domeRadius, potBaseY - 4);
      context.closePath();
      context.fill();
      context.stroke();
      context.strokeStyle = 'rgba(255,255,255,.48)';
      context.lineWidth = Math.max(1, projected.tileWidth * 0.0045);
      context.beginPath();
      context.moveTo(center.x - domeRadius * 0.56, potBaseY - 12);
      context.bezierCurveTo(center.x - domeRadius * 0.72, domeTop + domeRadius * 0.28, center.x - domeRadius * 0.35, domeTop + 7, center.x - domeRadius * 0.12, domeTop + 4);
      context.stroke();
      context.restore();
    }

    context.save();
    context.translate(center.x, potBaseY);
    context.rotate(sway * 0.22);
    context.drawImage(
      art.image,
      -art.dimensions.anchorX * scale,
      -art.dimensions.anchorY * scale,
      art.dimensions.width * scale,
      art.dimensions.height * scale,
    );
    context.restore();

    const blossomCenterY = potBaseY - projected.tileHeight * (0.32 + normalizedPower * 0.035);
    const bloom = 0.54 + normalizedPower * 0.46;
    const blossomCount = kind === 'sun-dahlia' || kind === 'ember-bloom' ? 5 : kind === 'mist-lily' ? 4 : 6;
    const layout: readonly [number, number, number][] = [
      [0, -0.12, 1.10], [-0.64, 0.18, 0.78], [0.62, 0.12, 0.82], [-0.34, -0.42, 0.68], [0.36, -0.46, 0.72], [0.02, 0.42, 0.64],
    ];
    for (let index = 0; index < blossomCount; index += 1) {
      const [ox, oy, size] = layout[index] as [number, number, number];
      const localSway = this.#reducedMotion ? 0 : Math.sin(time * 0.002 + index * 1.7 + variant) * (0.9 + normalizedPower * 1.4);
      const x = center.x + ox * projected.tileWidth * 0.115 + localSway;
      const y = blossomCenterY + oy * projected.tileHeight * 0.26;
      this.#drawDetailedBloom(x, y, projected.tileWidth * 0.064 * size, kind, bloom, time + index * 173, normalizedPower);
    }

    // Living pollen points create depth around the bloom rather than a flat glow.
    if (!this.#reducedMotion && normalizedPower > 0.42) {
      const moteCount = this.#profile.quality === 'high' ? 7 : 3;
      context.save();
      context.fillStyle = '#fffbe0';
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = palette[2];
        context.shadowBlur = projected.tileWidth * 0.035;
      }
      for (let index = 0; index < moteCount; index += 1) {
        const phase = (time * 0.00024 + index / moteCount + variant * 0.09) % 1;
        const angle = index * 2.31 + time * 0.0007;
        const x = center.x + Math.cos(angle) * projected.tileWidth * (0.05 + phase * 0.08);
        const y = blossomCenterY - projected.tileHeight * phase * 0.34 + Math.sin(angle) * projected.tileHeight * 0.04;
        context.globalAlpha = Math.sin(phase * Math.PI) * normalizedPower * 0.85;
        context.beginPath();
        context.arc(x, y, Math.max(0.9, projected.tileWidth * 0.007 * (1 - phase * 0.4)), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  #drawDetailedBloom(x: number, y: number, radius: number, kind: PlantKind, bloom: number, time: number, power: number): void {
    const context = this.#context;
    const palette = PLANT_PALETTES[kind];
    const petals = kind === 'sun-dahlia' || kind === 'ember-bloom' ? 12 : kind === 'mist-lily' ? 6 : 8;
    const rotation = this.#reducedMotion ? 0 : Math.sin(time * 0.0009) * 0.08;
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    if (power > 0.05 && this.#profile.useExpensiveShadows) {
      context.shadowColor = palette[2];
      context.shadowBlur = radius * (0.8 + power * 1.7);
    }

    // Back petal ring.
    for (let index = 0; index < petals; index += 1) {
      const angle = index * Math.PI * 2 / petals;
      context.save();
      context.rotate(angle);
      const gradient = context.createLinearGradient(0, -radius * 1.45, 0, radius * 0.25);
      const petalColor = palette[index % 2 === 0 ? 0 : 1];
      gradient.addColorStop(0, petalColor);
      gradient.addColorStop(0.54, mixHex(petalColor, '#ffffff', 0.18 + power * 0.18));
      gradient.addColorStop(1, mixHex(petalColor, '#27152d', 0.42));
      context.fillStyle = gradient;
      context.globalAlpha = 0.70 + power * 0.30;
      context.beginPath();
      context.moveTo(0, 0);
      context.bezierCurveTo(-radius * 0.55 * bloom, -radius * 0.28, -radius * 0.48 * bloom, -radius * 1.18 * bloom, 0, -radius * 1.46 * bloom);
      context.bezierCurveTo(radius * 0.48 * bloom, -radius * 1.18 * bloom, radius * 0.55 * bloom, -radius * 0.28, 0, 0);
      context.fill();
      context.strokeStyle = 'rgba(255,255,255,.18)';
      context.lineWidth = Math.max(0.6, radius * 0.055);
      context.stroke();
      context.restore();
    }

    // Inner curled petals add the density missing from simple vector flowers.
    const innerCount = Math.max(4, Math.floor(petals * 0.58));
    for (let index = 0; index < innerCount; index += 1) {
      const angle = index * Math.PI * 2 / innerCount + 0.35;
      context.save();
      context.rotate(angle);
      context.fillStyle = index % 2 ? palette[1] : palette[0];
      context.globalAlpha = 0.72 + power * 0.28;
      context.beginPath();
      context.ellipse(0, -radius * 0.58 * bloom, radius * 0.22 * bloom, radius * 0.58 * bloom, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    const core = context.createRadialGradient(-radius * 0.12, -radius * 0.16, 0, 0, 0, radius * 0.5);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.22, palette[2]);
    core.addColorStop(0.62, mixHex(palette[2], '#f5c857', 0.38));
    core.addColorStop(1, '#6d3b1a');
    context.globalAlpha = 0.58 + power * 0.42;
    context.fillStyle = core;
    context.beginPath();
    context.arc(0, 0, radius * (0.34 + power * 0.08), 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawLeaf(x: number, y: number, angle: number, size: number, power: number): void {
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

  #drawLock(x: number, y: number, radius: number, theme: Theme): void {
    const context = this.#context;
    const sprite = this.#premiumSprite('lock');
    if (sprite) {
      const size = radius * 3.7;
      context.save();
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = 'rgba(0,0,0,.58)';
        context.shadowBlur = radius * .8;
        context.shadowOffsetY = radius * .32;
      }
      context.drawImage(sprite, x - size / 2, y - size / 2, size, size);
      context.restore();
      return;
    }
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

  #drawSelection(polygon: readonly Point[], tileWidth: number, theme: Theme, time: number, strong: boolean, pressed: boolean): void {
    const context = this.#context;
    const pulse = this.#reducedMotion ? 1 : 0.78 + Math.sin(time * 0.006) * 0.22;
    context.save();
    context.globalAlpha = pressed ? 0.72 : 1;
    context.strokeStyle = strong ? theme.accent : theme.brassLight;
    if (this.#profile.useExpensiveShadows) {
      context.shadowColor = strong ? theme.accent : theme.brassLight;
      context.shadowBlur = tileWidth * (strong ? 0.105 : 0.065) * pulse;
    }
    context.lineWidth = Math.max(1.5, tileWidth * (strong ? 0.017 : 0.012));
    pathPolygon(context, polygon);
    context.stroke();
    if (strong) {
      const top = polygon[0] as Point;
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

  #drawImpact(projected: ProjectedTile, center: Point, theme: Theme, time: number): void {
    const impact = this.#impacts.get(projected.tile.id);
    if (!impact || time < impact.start) return;
    const progress = clamp((time - impact.start) / Math.max(1, impact.duration), 0, 1);
    if (progress >= 1) return;
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

  #drawLeak(projected: ProjectedTile, center: Point, direction: DirectionBit, theme: Theme, time: number): void {
    const context = this.#context;
    const vector = this.#directionVector(direction, Math.round(projected.tile.visualTurns), projected.tileWidth, projected.tileHeight);
    const x = center.x + vector.x * 0.48;
    const y = center.y + vector.y * 0.48;
    const scale = projected.tileWidth / 150;
    const sprite = this.#premiumSprite('leak');
    if (sprite) {
      const size = projected.tileWidth * .43;
      const pulse = this.#reducedMotion ? 1 : .97 + Math.sin(time * .009 + projected.tile.x) * .035;
      context.save();
      context.translate(x, y);
      context.scale(pulse, 1);
      if (this.#profile.useExpensiveShadows) {
        context.shadowColor = theme.aqua;
        context.shadowBlur = projected.tileWidth * .09;
      }
      context.drawImage(sprite, -size / 2, -size * .70, size, size);
      context.shadowBlur = 0;
      const badgeX = size * .29;
      const badgeY = -size * .44;
      context.fillStyle = '#d64f4f';
      context.strokeStyle = '#fff1d2';
      context.lineWidth = Math.max(1.4, scale * 1.8);
      context.beginPath();
      context.arc(badgeX, badgeY, Math.max(7, size * .075), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#fff';
      context.font = `900 ${Math.max(10, size * .1)}px system-ui`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('!', badgeX, badgeY + 1);
      context.restore();
      return;
    }
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

  #directionVector(bit: DirectionBit, turns: number, tileWidth: number, tileHeight: number): Point {
    const base = bit === NORTH ? { x: 0, y: -1 } : bit === EAST ? { x: 1, y: 0 } : bit === SOUTH ? { x: 0, y: 1 } : { x: -1, y: 0 };
    const angle = (turns + this.#viewTurns) * Math.PI * 0.5;
    const rx = base.x * Math.cos(angle) - base.y * Math.sin(angle);
    const ry = base.x * Math.sin(angle) + base.y * Math.cos(angle);
    return { x: (rx - ry) * tileWidth * 0.5, y: (rx + ry) * tileHeight * 0.5 };
  }

  #emitPendingBursts(time: number): void {
    if (this.#pendingBursts.length === 0) return;
    const remaining: PendingBurst[] = [];
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

  #spawnTileBurst(projected: ProjectedTile, kind: 'bloom' | 'seal'): void {
    if (this.#reducedMotion) return;
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
      const particleKind: Particle['kind'] = kind === 'bloom'
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

  #bloomBurst(): void {
    if (this.#reducedMotion) return;
    for (const projected of this.#projected) {
      if (projected.tile.kind !== 'plant') continue;
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

  #trimParticles(): void {
    const maximum = this.#profile.quality === 'high' ? 180 : 84;
    if (this.#particles.length > maximum) this.#particles.splice(0, this.#particles.length - maximum);
  }

  #drawParticles(_time: number, theme: Theme): void {
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
      } else if (particle.kind === 'droplet') {
        context.beginPath();
        context.moveTo(0, -particle.size * 1.5);
        context.quadraticCurveTo(particle.size, -particle.size * 0.2, 0, particle.size * 1.25);
        context.quadraticCurveTo(-particle.size, -particle.size * 0.2, 0, -particle.size * 1.5);
        context.fill();
      } else {
        context.rotate(Math.PI / 4);
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      }
      context.restore();
    }
  }

  #drawProgressFlash(time: number, theme: Theme): void {
    if (this.#progressFlashStart <= 0 || time >= this.#progressFlashEnd) return;
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
    } else {
      context.fillStyle = withAlpha(theme.aqua, alpha * 0.38);
    }
    context.fillRect(0, 0, this.#width, this.#height);
    context.restore();
  }

  #drawVictory(time: number, theme: Theme): void {
    if (this.#victoryEnd <= time || this.#victoryStart <= 0) return;
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

  #createDust(): void {
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

function diamond(center: Point, width: number, height: number): [Point, Point, Point, Point] {
  return [
    { x: center.x, y: center.y - height / 2 },
    { x: center.x + width / 2, y: center.y },
    { x: center.x, y: center.y + height / 2 },
    { x: center.x - width / 2, y: center.y },
  ];
}
function insetDiamond(center: Point, width: number, height: number): [Point, Point, Point, Point] { return diamond(center, width, height); }
function pathPolygon(context: CanvasRenderingContext2D, points: readonly Point[]): void {
  context.beginPath();
  const first = points[0];
  if (!first) return;
  context.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index] as Point;
    context.lineTo(point.x, point.y);
  }
  context.closePath();
}
function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index] as Point;
    const previousPoint = polygon[previous] as Point;
    const intersects = currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 1e-9) + currentPoint.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
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
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
function easeInOut(value: number): number {
  const t = clamp(value, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
function easeOutBack(value: number, overshoot = 0.6): number {
  const t = clamp(value, 0, 1) - 1;
  return 1 + (overshoot + 1) * t ** 3 + overshoot * t ** 2;
}
function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(255,255,255,${clamp(alpha, 0, 1)})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${clamp(alpha, 0, 1)})`;
}
function mixHex(from: string, to: string, amount: number): string {
  const first = parseHex(from);
  const second = parseHex(to);
  const t = clamp(amount, 0, 1);
  const red = Math.round(first[0] + (second[0] - first[0]) * t);
  const green = Math.round(first[1] + (second[1] - first[1]) * t);
  const blue = Math.round(first[2] + (second[2] - first[2]) * t);
  return `rgb(${red}, ${green}, ${blue})`;
}
function parseHex(value: string): readonly [number, number, number] {
  const normalized = value.replace('#', '');
  if (normalized.length !== 6) return [255, 255, 255];
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
function drawStar(context: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points: number, rotation: number): void {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const angle = rotation - Math.PI / 2 + (Math.PI * index) / points;
    const radius = index % 2 === 0 ? outer : inner;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (index === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
}
