import { hashSeed } from '../core/random.js';
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
  type QualityMode,
  type TileState,
} from '../core/types.js';

interface Point { x: number; y: number }
interface ProjectedTile {
  readonly tile: TileState;
  readonly center: Point;
  readonly polygon: readonly [Point, Point, Point, Point];
  readonly depth: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly unit: number;
  readonly cameraAngle: number;
  readonly verticalScale: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  hue: number;
  spin: number;
}
interface Mote {
  x: number;
  y: number;
  speed: number;
  drift: number;
  phase: number;
  size: number;
}
interface RenderProfile {
  readonly dprCap: number;
  readonly motes: number;
  readonly pipeGlow: number;
  readonly shadows: boolean;
  readonly texture: boolean;
}
type Scene = 'menu' | 'game' | 'map' | 'victory';
type AssetKey = 'atrium' | 'garden' | 'portrait' | 'map' | 'victory';

declare global {
  interface Window {
    __clockworkAssetUrls?: Partial<Record<'atrium' | 'garden' | 'portrait' | 'map' | 'victory', string>>;
  }
}

const PROFILES: Record<Exclude<QualityMode, 'auto'>, RenderProfile> = {
  high: { dprCap: 2, motes: 72, pipeGlow: 22, shadows: true, texture: true },
  balanced: { dprCap: 1.65, motes: 40, pipeGlow: 14, shadows: true, texture: true },
  low: { dprCap: 1.2, motes: 16, pipeGlow: 7, shadows: false, texture: false },
};

const PLANT_COLORS: Record<PlantKind, readonly [string, string, string]> = {
  lumen: ['#d7fff5', '#73eaff', '#2a86c7'],
  orchid: ['#ffe0ff', '#c176ff', '#6e43c5'],
  starbell: ['#fffbd9', '#fff2a4', '#7adcc8'],
  ember: ['#fff0aa', '#ff8d58', '#c93655'],
  moonfern: ['#c8ffdc', '#54d7ad', '#237c7f'],
};

const DIRECTION_VECTOR: Record<DirectionBit, readonly [number, number]> = {
  [NORTH]: [0, -1],
  [EAST]: [1, 0],
  [SOUTH]: [0, 1],
  [WEST]: [-1, 0],
};

export class ConservatoryRenderer {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #resizeObserver: ResizeObserver;
  readonly #assets = new Map<string, HTMLImageElement>();
  #puzzle: PuzzleDefinition | null = null;
  #analysis: BoardAnalysis | null = null;
  #selectedId: string | null = null;
  #hoveredId: string | null = null;
  #hintId: string | null = null;
  #coachId: string | null = null;
  #hintUntil = 0;
  #displayTurns = new Map<string, number>();
  #projectedTiles: ProjectedTile[] = [];
  #viewTurns = 0;
  #targetViewTurns = 0;
  #width = 1;
  #height = 1;
  #dpr = 1;
  #lastTimestamp = 0;
  #animationFrame = 0;
  #running = true;
  #reducedMotion = false;
  #highContrast = false;
  #quality: QualityMode = 'auto';
  #profile: RenderProfile = PROFILES.balanced;
  #particles: Particle[] = [];
  #motes: Mote[] = [];
  #scene: Scene = 'menu';
  #victoryStartedAt = 0;
  #victoryEndsAt = 0;
  #boardPulse = 0;
  #assetsReady = false;

  public constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable.');
    this.#context = context;
    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(canvas);
    this.#resolveProfile();
    this.#createMotes();
    this.resize();
    this.#animationFrame = requestAnimationFrame((timestamp) => this.#frame(timestamp));
  }

  public async preload(): Promise<void> {
    // Only the title-scene art blocks first interaction. Gameplay, map and victory
    // backdrops are streamed when their scene is requested.
    await this.#ensureAsset('atrium');
    this.#assetsReady = true;
  }

  async #ensureAsset(key: AssetKey): Promise<void> {
    if (this.#assets.has(key)) return;
    const defaults: Record<AssetKey, string> = {
      atrium: './assets/atrium-desktop.webp',
      garden: './assets/garden-desktop.webp',
      portrait: './assets/garden-portrait.webp',
      map: './assets/map-desktop.webp',
      victory: './assets/victory-desktop.webp',
    };
    const source = window.__clockworkAssetUrls?.[key] ?? defaults[key];
    try {
      this.#assets.set(key, await loadImage(source));
    } catch {
      // The procedural fallback remains fully playable when an image is unavailable.
    }
  }

  public destroy(): void {
    this.#running = false;
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver.disconnect();
  }

  public setScene(scene: Scene): void {
    this.#scene = scene;
    if (scene === 'menu') void this.#ensureAsset('atrium');
    else if (scene === 'game') {
      void this.#ensureAsset('garden');
      void this.#ensureAsset('portrait');
    } else if (scene === 'map') void this.#ensureAsset('map');
    else void this.#ensureAsset('victory');
  }

  public setPuzzle(puzzle: PuzzleDefinition): void {
    this.#puzzle = puzzle;
    this.#displayTurns.clear();
    for (const tile of puzzle.tiles) this.#displayTurns.set(tile.id, tile.visualTurns);
    this.#selectedId = puzzle.sourceId;
    this.#hoveredId = null;
    this.#hintId = null;
    this.#coachId = null;
    this.#particles = [];
    this.#victoryStartedAt = 0;
    this.#victoryEndsAt = 0;
    this.#boardPulse = 0;
  }

  public setAnalysis(analysis: BoardAnalysis): void { this.#analysis = analysis; }
  public setSelected(tileId: string | null): void { this.#selectedId = tileId; }
  public setHovered(tileId: string | null): void { this.#hoveredId = tileId; }
  public setCoach(tileId: string | null): void { this.#coachId = tileId; }

  public setHint(tileId: string, durationMs = 5_000): void {
    this.#hintId = tileId;
    this.#hintUntil = performance.now() + durationMs;
  }

  public clearHint(): void { this.#hintId = null; }

  public setReducedMotion(enabled: boolean): void {
    this.#reducedMotion = enabled;
    if (enabled) {
      this.#viewTurns = this.#targetViewTurns;
      if (this.#puzzle) {
        for (const tile of this.#puzzle.tiles) this.#displayTurns.set(tile.id, tile.visualTurns);
      }
    }
  }

  public setHighContrast(enabled: boolean): void { this.#highContrast = enabled; }

  public setQuality(quality: QualityMode): void {
    this.#quality = quality;
    this.#resolveProfile();
    this.#createMotes();
    this.resize();
  }

  public rotateView(delta: -1 | 1): void {
    this.#targetViewTurns += delta;
    if (this.#reducedMotion) this.#viewTurns = this.#targetViewTurns;
  }

  public syncTile(tile: TileState): void {
    if (!this.#displayTurns.has(tile.id)) this.#displayTurns.set(tile.id, tile.visualTurns);
    this.#boardPulse = 1;
  }

  public hitTest(clientX: number, clientY: number): string | null {
    const rect = this.#canvas.getBoundingClientRect();
    const point = { x: clientX - rect.left, y: clientY - rect.top };
    for (let index = this.#projectedTiles.length - 1; index >= 0; index -= 1) {
      const projected = this.#projectedTiles[index];
      if (projected && pointInPolygon(point, projected.polygon)) return projected.tile.id;
    }
    return null;
  }

  public startVictorySequence(durationMs = 2_150): void {
    const now = performance.now();
    this.#victoryStartedAt = now;
    this.#victoryEndsAt = now + Math.max(400, durationMs);
    this.#selectedId = null;
    this.#hoveredId = null;
    this.#hintId = null;
    this.#coachId = null;
    this.#spawnBloomParticles();
  }

  public pause(): void {
    this.#running = false;
    cancelAnimationFrame(this.#animationFrame);
  }

  public resume(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTimestamp = performance.now();
    this.#animationFrame = requestAnimationFrame((timestamp) => this.#frame(timestamp));
  }

  public resize(): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#width = Math.max(1, rect.width);
    this.#height = Math.max(1, rect.height);
    this.#dpr = Math.min(this.#profile.dprCap, Math.max(1, window.devicePixelRatio || 1));
    const physicalWidth = Math.round(this.#width * this.#dpr);
    const physicalHeight = Math.round(this.#height * this.#dpr);
    if (this.#canvas.width !== physicalWidth || this.#canvas.height !== physicalHeight) {
      this.#canvas.width = physicalWidth;
      this.#canvas.height = physicalHeight;
    }
    this.#context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
  }

  #resolveProfile(): void {
    if (this.#quality !== 'auto') {
      this.#profile = PROFILES[this.#quality];
      return;
    }
    const memory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4);
    const cores = navigator.hardwareConcurrency || 4;
    this.#profile = memory <= 2 || cores <= 2 ? PROFILES.low : memory <= 4 || cores <= 4 ? PROFILES.balanced : PROFILES.high;
  }

  #createMotes(): void {
    const count = this.#profile.motes;
    this.#motes = Array.from({ length: count }, (_, index): Mote => ({
      x: ((hashSeed(`mote-x-${index}`) % 10_000) / 10_000),
      y: ((hashSeed(`mote-y-${index}`) % 10_000) / 10_000),
      speed: 0.012 + ((hashSeed(`mote-speed-${index}`) % 1000) / 1000) * 0.026,
      drift: 0.8 + ((hashSeed(`mote-drift-${index}`) % 1000) / 1000) * 2.6,
      phase: ((hashSeed(`mote-phase-${index}`) % 6283) / 1000),
      size: 0.7 + ((hashSeed(`mote-size-${index}`) % 1000) / 1000) * 2.1,
    }));
  }

  #frame(timestamp: number): void {
    if (!this.#running) return;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - this.#lastTimestamp) / 1000 || 0));
    this.#lastTimestamp = timestamp;
    this.#update(deltaSeconds, timestamp);
    this.#draw(timestamp);
    this.#animationFrame = requestAnimationFrame((next) => this.#frame(next));
  }

  #update(deltaSeconds: number, timestamp: number): void {
    const smoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 9.8);
    this.#viewTurns += (this.#targetViewTurns - this.#viewTurns) * smoothing;
    if (Math.abs(this.#targetViewTurns - this.#viewTurns) < 0.0005) this.#viewTurns = this.#targetViewTurns;

    if (this.#puzzle) {
      for (const tile of this.#puzzle.tiles) {
        const current = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
        const next = current + (tile.visualTurns - current) * smoothing;
        this.#displayTurns.set(tile.id, Math.abs(tile.visualTurns - next) < 0.001 ? tile.visualTurns : next);
      }
    }

    this.#boardPulse = Math.max(0, this.#boardPulse - deltaSeconds * 2.4);
    if (this.#hintId && timestamp > this.#hintUntil) this.#hintId = null;

    if (!this.#reducedMotion) {
      for (const mote of this.#motes) {
        mote.y -= mote.speed * deltaSeconds;
        mote.x += Math.sin(timestamp * 0.00035 + mote.phase) * deltaSeconds * 0.004 * mote.drift;
        if (mote.y < -0.03) { mote.y = 1.03; mote.x = (mote.x + 0.37) % 1; }
        if (mote.x < -0.04) mote.x = 1.04;
        if (mote.x > 1.04) mote.x = -0.04;
      }
      for (const particle of this.#particles) {
        particle.life -= deltaSeconds;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vy += 31 * deltaSeconds;
        particle.vx *= Math.pow(0.965, deltaSeconds * 60);
        particle.spin += deltaSeconds * 3;
      }
      this.#particles = this.#particles.filter((particle) => particle.life > 0);
    }
  }

  #draw(timestamp: number): void {
    const context = this.#context;
    context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    this.#drawBackground(timestamp);
    if (!this.#puzzle || this.#scene === 'menu' || this.#scene === 'map') {
      this.#projectedTiles = [];
      this.#drawAmbientForeground(timestamp);
      return;
    }

    this.#projectedTiles = this.#projectBoard(this.#puzzle, timestamp);
    this.#drawBoardShadow();
    for (const projected of this.#projectedTiles) this.#drawTile(projected, timestamp);
    this.#drawParticles();
    this.#drawCelebration(timestamp);
    this.#drawAmbientForeground(timestamp);
  }

  #drawBackground(timestamp: number): void {
    const context = this.#context;
    const portrait = this.#height > this.#width * 1.18;
    const key = this.#scene === 'menu' ? 'atrium' : this.#scene === 'map' ? 'map' : this.#scene === 'victory' ? 'victory' : portrait ? 'portrait' : 'garden';
    const image = this.#assets.get(key) ?? this.#assets.get('garden');

    if (image?.complete && image.naturalWidth > 0) {
      const parallax = this.#reducedMotion ? 0 : Math.sin(timestamp * 0.00007) * Math.min(12, this.#width * 0.008);
      drawImageCover(context, image, -parallax, 0, this.#width + Math.abs(parallax) * 2, this.#height);
    } else {
      const gradient = context.createLinearGradient(0, 0, 0, this.#height);
      gradient.addColorStop(0, '#071f24');
      gradient.addColorStop(0.52, '#0d4a42');
      gradient.addColorStop(1, '#061d1b');
      context.fillStyle = gradient;
      context.fillRect(0, 0, this.#width, this.#height);
    }

    const overlay = context.createLinearGradient(0, 0, 0, this.#height);
    overlay.addColorStop(0, this.#scene === 'menu' ? 'rgba(2,15,15,.18)' : 'rgba(2,15,15,.28)');
    overlay.addColorStop(0.45, 'rgba(3,24,22,.16)');
    overlay.addColorStop(1, this.#scene === 'menu' ? 'rgba(1,13,13,.24)' : 'rgba(1,13,13,.52)');
    context.fillStyle = overlay;
    context.fillRect(0, 0, this.#width, this.#height);

    const centerGlow = context.createRadialGradient(this.#width * 0.5, this.#height * 0.47, 0, this.#width * 0.5, this.#height * 0.47, Math.max(this.#width, this.#height) * 0.56);
    centerGlow.addColorStop(0, 'rgba(39,153,127,.14)');
    centerGlow.addColorStop(0.48, 'rgba(9,50,46,.05)');
    centerGlow.addColorStop(1, this.#scene === 'menu' ? 'rgba(0,0,0,.16)' : 'rgba(0,0,0,.34)');
    context.fillStyle = centerGlow;
    context.fillRect(0, 0, this.#width, this.#height);

    if (this.#assetsReady) {
      context.save();
      context.globalCompositeOperation = 'screen';
      for (const mote of this.#motes) {
        const alpha = this.#reducedMotion ? 0.08 : 0.055 + Math.sin(timestamp * 0.0012 + mote.phase) * 0.035;
        context.fillStyle = `rgba(235, 225, 151, ${Math.max(0.02, alpha)})`;
        context.beginPath();
        context.arc(mote.x * this.#width, mote.y * this.#height, mote.size, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  #projectBoard(puzzle: PuzzleDefinition, timestamp: number): ProjectedTile[] {
    const densePortrait = this.#width < 680 && this.#height > this.#width * 1.15 && puzzle.tiles.length > 12;
    const cameraAngle = (densePortrait ? 0 : Math.PI / 4) + this.#viewTurns * Math.PI / 2;
    const verticalScale = densePortrait ? 0.72 : 0.52;
    const viewTop = this.#width < 680 ? Math.max(150, this.#height * 0.16) : Math.max(98, this.#height * 0.105);
    const viewBottom = this.#width < 680 ? Math.max(128, this.#height * 0.125) : Math.max(98, this.#height * 0.11);
    const side = this.#width < 680 ? 18 : 38;
    const worldCenterX = (puzzle.width - 1) / 2;
    const worldCenterY = (puzzle.height - 1) / 2;
    const sample: Point[] = [];
    for (const tile of puzzle.tiles) {
      for (const [ox, oy] of [[-0.52,-0.52],[0.52,-0.52],[0.52,0.52],[-0.52,0.52]] as const) {
        sample.push(projectUnit(tile.x + ox - worldCenterX, tile.y + oy - worldCenterY, cameraAngle, verticalScale));
      }
    }
    const minX = Math.min(...sample.map((point) => point.x));
    const maxX = Math.max(...sample.map((point) => point.x));
    const minY = Math.min(...sample.map((point) => point.y));
    const maxY = Math.max(...sample.map((point) => point.y));
    const rawWidth = Math.max(0.1, maxX - minX);
    const rawHeight = Math.max(0.1, maxY - minY);
    const availableWidth = Math.max(120, this.#width - side * 2);
    const availableHeight = Math.max(120, this.#height - viewTop - viewBottom);
    const victoryProgress = this.#victoryStartedAt > 0 ? clamp((timestamp - this.#victoryStartedAt) / 600, 0, 1) : 0;
    const pulse = 1 + this.#boardPulse * 0.008 + easeOutBack(victoryProgress) * 0.028;
    let unit = Math.min(availableWidth / rawWidth, availableHeight / rawHeight) * 0.93 * pulse;
    const maxUnit = this.#width < 680 ? Math.min(this.#width * 0.36, 180) : Math.min(this.#width * 0.21, 235);
    unit = Math.min(unit, maxUnit);
    const boardHeight = rawHeight * unit;
    const centerX = this.#width * 0.5 - ((minX + maxX) * 0.5) * unit;
    const centerY = viewTop + (availableHeight - boardHeight) * 0.48 - minY * unit;

    const projected = puzzle.tiles.map((tile): ProjectedTile => {
      const corners = [
        this.#projectPoint(tile.x - 0.48 - worldCenterX, tile.y - 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
        this.#projectPoint(tile.x + 0.48 - worldCenterX, tile.y - 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
        this.#projectPoint(tile.x + 0.48 - worldCenterX, tile.y + 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
        this.#projectPoint(tile.x - 0.48 - worldCenterX, tile.y + 0.48 - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY),
      ] as [Point, Point, Point, Point];
      const center = this.#projectPoint(tile.x - worldCenterX, tile.y - worldCenterY, cameraAngle, verticalScale, unit, centerX, centerY);
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
  }

  #projectPoint(wx: number, wy: number, angle: number, verticalScale: number, unit: number, centerX: number, centerY: number): Point {
    const point = projectUnit(wx, wy, angle, verticalScale);
    return { x: centerX + point.x * unit, y: centerY + point.y * unit };
  }

  #drawBoardShadow(): void {
    if (this.#projectedTiles.length === 0) return;
    const context = this.#context;
    const xs = this.#projectedTiles.flatMap((tile) => tile.polygon.map((point) => point.x));
    const ys = this.#projectedTiles.flatMap((tile) => tile.polygon.map((point) => point.y));
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const top = Math.min(...ys);
    const bottom = Math.max(...ys);
    context.save();
    if (this.#profile.shadows) context.filter = 'blur(18px)';
    context.fillStyle = 'rgba(0, 7, 7, .56)';
    context.beginPath();
    context.ellipse((left + right) / 2, bottom + (bottom - top) * 0.12, (right - left) * 0.52, Math.max(18, (bottom - top) * 0.17), 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawTile(projected: ProjectedTile, timestamp: number): void {
    const context = this.#context;
    const { tile, polygon, center, tileWidth, tileHeight } = projected;
    const powered = this.#analysis?.powered.has(tile.id) ?? false;
    const selected = tile.id === this.#selectedId;
    const hovered = tile.id === this.#hoveredId;
    const hinted = tile.id === this.#hintId;
    const coached = tile.id === this.#coachId;
    const thickness = Math.max(8, tileHeight * 0.29);

    context.save();
    if (this.#profile.shadows) {
      context.shadowColor = 'rgba(0, 0, 0, .4)';
      context.shadowBlur = Math.max(8, tileWidth * 0.08);
      context.shadowOffsetY = Math.max(6, tileHeight * 0.16);
    }
    for (let index = 0; index < 4; index += 1) {
      const a = polygon[index] as Point;
      const b = polygon[(index + 1) % 4] as Point;
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
      topGradient.addColorStop(0, this.#highContrast ? '#2b7665' : '#23635a');
      topGradient.addColorStop(0.52, this.#highContrast ? '#1f675d' : '#194e47');
      topGradient.addColorStop(1, '#123c38');
    } else {
      topGradient.addColorStop(0, this.#highContrast ? '#31554d' : '#244a43');
      topGradient.addColorStop(0.52, this.#highContrast ? '#26483f' : '#183b37');
      topGradient.addColorStop(1, '#102f2d');
    }
    context.fillStyle = topGradient;
    tracePolygon(context, polygon);
    context.fill();

    if (this.#profile.texture) this.#drawTileTexture(projected, timestamp, powered);

    const borderGradient = context.createLinearGradient(polygon[0].x, polygon[0].y, polygon[2].x, polygon[2].y);
    borderGradient.addColorStop(0, selected || hinted || coached ? '#fff0a7' : '#e7be72');
    borderGradient.addColorStop(0.5, selected || hinted || coached ? '#ffd15d' : '#8f6d3d');
    borderGradient.addColorStop(1, selected || hinted || coached ? '#fff4be' : '#d7a95d');
    context.strokeStyle = borderGradient;
    context.lineWidth = selected || hinted || coached ? Math.max(2.5, tileWidth * 0.022) : Math.max(1.1, tileWidth * 0.009);
    if (selected || hinted || coached) {
      context.shadowColor = hinted ? '#8bfff0' : '#ffd96e';
      context.shadowBlur = this.#profile.pipeGlow;
    }
    tracePolygon(context, polygon);
    context.stroke();

    context.strokeStyle = powered ? 'rgba(120, 255, 230, .35)' : 'rgba(255, 248, 207, .12)';
    context.lineWidth = Math.max(0.8, tileWidth * 0.005);
    tracePolygon(context, polygon.map((point) => lerpPoint(point, center, 0.07)) as [Point, Point, Point, Point]);
    context.stroke();
    context.restore();

    this.#drawRivets(projected, powered);
    this.#drawMechanism(projected, timestamp, powered);

    if (tile.fixed) this.#drawAnchor(projected);
    if (hovered && !selected) this.#drawHover(projected);
    if (coached) this.#drawCoach(projected, timestamp);
    if (hinted) this.#drawHint(projected, timestamp);
    this.#drawTileLeaks(projected, timestamp);
  }

  #drawTileTexture(projected: ProjectedTile, timestamp: number, powered: boolean): void {
    const context = this.#context;
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
      context.ellipse(
        center.x + Math.sin(seed + index) * tileWidth * 0.12,
        center.y + Math.cos(seed * 0.01 + index) * tileHeight * 0.16,
        radius,
        radius * 0.34,
        (index + phase) * 0.7,
        Math.PI * 0.2,
        Math.PI * 1.5,
      );
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
    if (powered && !this.#reducedMotion) {
      const sweep = ((timestamp * 0.00009 + (seed % 100) / 100) % 1) * tileWidth * 1.2 - tileWidth * 0.6;
      const sheen = context.createLinearGradient(center.x + sweep - tileWidth * 0.12, center.y, center.x + sweep + tileWidth * 0.12, center.y);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(167,255,236,.22)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = sheen;
      context.fillRect(center.x - tileWidth, center.y - tileHeight, tileWidth * 2, tileHeight * 2);
    }
    context.restore();
  }

  #drawRivets(projected: ProjectedTile, powered: boolean): void {
    const context = this.#context;
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
  }

  #drawMechanism(projected: ProjectedTile, timestamp: number, powered: boolean): void {
    const { tile } = projected;
    const displayTurns = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
    const armPoints: Point[] = [];
    const rotation = displayTurns * Math.PI / 2;
    for (const direction of DIRECTIONS) {
      if ((tile.baseMask & direction) === 0) continue;
      const [baseX, baseY] = DIRECTION_VECTOR[direction];
      const dx = baseX * Math.cos(rotation) - baseY * Math.sin(rotation);
      const dy = baseX * Math.sin(rotation) + baseY * Math.cos(rotation);
      armPoints.push(this.#offsetPoint(projected, dx * 0.43, dy * 0.43));
    }

    for (const endpoint of armPoints) this.#drawPipe(projected.center, endpoint, projected.tileWidth, timestamp, powered, tile.id);

    if (tile.kind === 'source') this.#drawSunwell(projected, timestamp, powered);
    else this.#drawGear(projected, displayTurns, powered);
    if (tile.kind === 'plant') this.#drawPlant(projected, timestamp, powered, tile.plantKind ?? 'lumen');
  }

  #drawPipe(start: Point, end: Point, tileWidth: number, timestamp: number, powered: boolean, id: string): void {
    const context = this.#context;
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
      context.shadowBlur = this.#profile.pipeGlow;
      context.strokeStyle = 'rgba(72,255,235,.54)';
      context.lineWidth = bodyWidth * 0.72;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
      context.shadowBlur = Math.max(4, this.#profile.pipeGlow * 0.45);
      context.strokeStyle = '#bafff5';
      context.lineWidth = Math.max(1.7, bodyWidth * 0.2);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();

      if (!this.#reducedMotion) {
        const phase = (timestamp * 0.00055 + (hashSeed(id) % 1000) / 1000) % 1;
        const pulse = lerpPoint(start, end, phase);
        context.fillStyle = '#ffffff';
        context.shadowColor = '#8ffff2';
        context.shadowBlur = this.#profile.pipeGlow;
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
  }

  #drawGear(projected: ProjectedTile, turns: number, powered: boolean): void {
    const context = this.#context;
    const radius = Math.max(11, projected.tileWidth * 0.115);
    const teeth = 12;
    context.save();
    context.translate(projected.center.x, projected.center.y);
    context.scale(1, 0.72);
    context.rotate(turns * Math.PI / 2 + this.#viewTurns * Math.PI * 0.04);
    const gearGradient = context.createRadialGradient(-radius * 0.25, -radius * 0.32, 0, 0, 0, radius * 1.28);
    gearGradient.addColorStop(0, '#fff1ae');
    gearGradient.addColorStop(0.32, '#d7a653');
    gearGradient.addColorStop(0.68, '#8b5e2f');
    gearGradient.addColorStop(1, '#392619');
    context.fillStyle = gearGradient;
    context.shadowColor = powered ? '#6dffea' : 'rgba(0,0,0,.5)';
    context.shadowBlur = powered ? this.#profile.pipeGlow * 0.55 : 5;
    context.beginPath();
    for (let index = 0; index < teeth * 2; index += 1) {
      const angle = index * Math.PI / teeth;
      const distanceValue = index % 2 === 0 ? radius * 1.22 : radius * 0.94;
      const x = Math.cos(angle) * distanceValue;
      const y = Math.sin(angle) * distanceValue;
      if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
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
    context.shadowBlur = powered ? this.#profile.pipeGlow : 0;
    context.beginPath();
    context.arc(0, 0, radius * 0.23, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawSunwell(projected: ProjectedTile, timestamp: number, powered: boolean): void {
    const context = this.#context;
    const center = projected.center;
    const radius = Math.max(16, projected.tileWidth * 0.14);
    const pulse = this.#reducedMotion ? 1 : 1 + Math.sin(timestamp * 0.004) * 0.045;
    context.save();
    context.translate(center.x, center.y - radius * 0.1);
    context.scale(1, 0.72);
    context.shadowColor = '#72fff0';
    context.shadowBlur = this.#profile.pipeGlow * 1.4;
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
    context.shadowBlur = this.#profile.pipeGlow * 1.8;
    context.fillStyle = '#e9fffb';
    drawStar(context, 8, radius * 0.74, radius * 0.18);
    context.fill();
    context.restore();

    context.save();
    context.strokeStyle = powered ? '#bafff5' : '#6de9db';
    context.lineWidth = Math.max(1.6, radius * 0.09);
    context.shadowColor = '#6ffff0';
    context.shadowBlur = this.#profile.pipeGlow;
    context.beginPath();
    context.arc(center.x, center.y - radius * 0.24, radius * 1.16, Math.PI * 1.08, Math.PI * 1.92);
    context.stroke();
    context.restore();
  }

  #drawPlant(projected: ProjectedTile, timestamp: number, powered: boolean, plantKind: PlantKind): void {
    const context = this.#context;
    const center = projected.center;
    const scale = Math.max(0.75, projected.tileWidth / 120);
    const [light, mid, dark] = PLANT_COLORS[plantKind];
    const bloom = powered ? 1 : 0.63;
    const sway = this.#reducedMotion ? 0 : Math.sin(timestamp * 0.0016 + hashSeed(projected.tile.id) * 0.001) * 2.4 * scale;
    const potY = center.y - 2 * scale;

    context.save();
    if (powered) {
      context.shadowColor = mid;
      context.shadowBlur = this.#profile.pipeGlow * 0.9;
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
    context.shadowBlur = powered ? this.#profile.pipeGlow * 0.55 : 0;
    context.beginPath();
    context.arc(0, 0, 4.8 * scale * bloom, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawAnchor(projected: ProjectedTile): void {
    const context = this.#context;
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
  }

  #drawHover(projected: ProjectedTile): void {
    const context = this.#context;
    context.save();
    context.strokeStyle = 'rgba(192, 255, 239, .62)';
    context.lineWidth = Math.max(1.6, projected.tileWidth * 0.013);
    context.shadowColor = '#88fce7';
    context.shadowBlur = Math.max(6, this.#profile.pipeGlow * 0.55);
    tracePolygon(context, projected.polygon.map((point) => lerpPoint(point, projected.center, -0.025)) as [Point, Point, Point, Point]);
    context.stroke();
    context.restore();
  }

  #drawCoach(projected: ProjectedTile, timestamp: number): void {
    const context = this.#context;
    const pulse = this.#reducedMotion ? 0 : Math.sin(timestamp * 0.006) * projected.tileWidth * 0.018;
    const radius = projected.tileWidth * 0.31 + pulse;
    context.save();
    context.strokeStyle = '#ffe27f';
    context.lineWidth = Math.max(2, projected.tileWidth * 0.02);
    context.setLineDash([Math.max(5, projected.tileWidth * 0.05), Math.max(4, projected.tileWidth * 0.035)]);
    context.lineDashOffset = this.#reducedMotion ? 0 : -timestamp * 0.025;
    context.shadowColor = '#ffd75b';
    context.shadowBlur = this.#profile.pipeGlow * 1.2;
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
  }

  #drawHint(projected: ProjectedTile, timestamp: number): void {
    const context = this.#context;
    const pulse = this.#reducedMotion ? 1 : 1 + Math.sin(timestamp * 0.009) * 0.08;
    const radius = projected.tileWidth * 0.24 * pulse;
    context.save();
    context.globalCompositeOperation = 'screen';
    context.strokeStyle = '#91fff0';
    context.lineWidth = Math.max(2, projected.tileWidth * 0.017);
    context.shadowColor = '#6dffee';
    context.shadowBlur = this.#profile.pipeGlow * 1.5;
    context.beginPath();
    context.ellipse(projected.center.x, projected.center.y, radius, radius * 0.55, 0, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  #drawTileLeaks(projected: ProjectedTile, timestamp: number): void {
    if (!this.#analysis) return;
    const leaks = this.#analysis.leaks.filter((leak) => leak.tileId === projected.tile.id);
    if (leaks.length === 0) return;
    for (const leak of leaks) {
      const [dx, dy] = DIRECTION_VECTOR[leak.direction];
      const endpoint = this.#offsetPoint(projected, dx * 0.44, dy * 0.44);
      this.#drawLeak(endpoint, projected.tileWidth, timestamp, hashSeed(`${projected.tile.id}:${leak.direction}`));
    }
  }

  #drawLeak(endpoint: Point, tileWidth: number, timestamp: number, seed: number): void {
    const context = this.#context;
    const scale = Math.max(0.65, tileWidth / 130);
    context.save();
    context.globalCompositeOperation = 'screen';
    context.strokeStyle = 'rgba(84, 239, 255, .75)';
    context.lineWidth = 2.5 * scale;
    context.shadowColor = '#55eaff';
    context.shadowBlur = this.#profile.pipeGlow;
    const phase = this.#reducedMotion ? 0 : Math.sin(timestamp * 0.007 + seed) * 3 * scale;
    for (let index = 0; index < 3; index += 1) {
      context.beginPath();
      context.moveTo(endpoint.x + (index - 1) * 3 * scale, endpoint.y);
      context.quadraticCurveTo(
        endpoint.x + (index - 1) * 8 * scale + phase,
        endpoint.y - (13 + index * 5) * scale,
        endpoint.x + (index - 1) * 5 * scale - phase * 0.4,
        endpoint.y - (25 + index * 7) * scale,
      );
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
  }

  #offsetPoint(projected: ProjectedTile, dx: number, dy: number): Point {
    const offset = projectUnit(dx, dy, projected.cameraAngle, projected.verticalScale);
    return { x: projected.center.x + offset.x * projected.unit, y: projected.center.y + offset.y * projected.unit };
  }

  #spawnBloomParticles(): void {
    if (this.#reducedMotion) return;
    for (const projected of this.#projectedTiles) {
      if (projected.tile.kind !== 'plant') continue;
      const [,, dark] = PLANT_COLORS[projected.tile.plantKind ?? 'lumen'];
      const hue = colorHue(dark);
      for (let index = 0; index < (this.#profile === PROFILES.low ? 8 : 20); index += 1) {
        const angle = (Math.PI * 2 * index) / 20 + Math.random() * 0.45;
        const speed = 30 + Math.random() * 78;
        this.#particles.push({
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
  }

  #drawParticles(): void {
    const context = this.#context;
    context.save();
    context.globalCompositeOperation = 'screen';
    for (const particle of this.#particles) {
      const alpha = clamp(particle.life / Math.max(0.001, particle.maxLife), 0, 1);
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.spin);
      context.fillStyle = `hsla(${particle.hue}, 86%, 72%, ${alpha})`;
      context.shadowColor = `hsla(${particle.hue}, 95%, 68%, ${alpha})`;
      context.shadowBlur = this.#profile.pipeGlow * 0.55;
      context.beginPath();
      context.ellipse(0, 0, particle.size * 1.8, particle.size * 0.65, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.restore();
  }

  #drawCelebration(timestamp: number): void {
    if (this.#victoryStartedAt <= 0 || timestamp > this.#victoryEndsAt) return;
    const context = this.#context;
    const duration = Math.max(1, this.#victoryEndsAt - this.#victoryStartedAt);
    const progress = clamp((timestamp - this.#victoryStartedAt) / duration, 0, 1);
    const envelope = Math.sin(progress * Math.PI);
    const center = this.#projectedTiles.length > 0
      ? this.#projectedTiles.reduce((sum, tile) => ({ x: sum.x + tile.center.x / this.#projectedTiles.length, y: sum.y + tile.center.y / this.#projectedTiles.length }), { x: 0, y: 0 })
      : { x: this.#width / 2, y: this.#height / 2 };

    context.save();
    context.globalCompositeOperation = 'screen';
    const glow = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, Math.max(this.#width, this.#height) * 0.48);
    glow.addColorStop(0, `rgba(190, 255, 234, ${0.24 * envelope})`);
    glow.addColorStop(0.28, `rgba(89, 246, 213, ${0.12 * envelope})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, this.#width, this.#height);

    if (!this.#reducedMotion) {
      context.strokeStyle = `rgba(255, 226, 130, ${0.1 * envelope})`;
      context.lineWidth = 2;
      for (let index = 0; index < 18; index += 1) {
        const angle = index * Math.PI * 2 / 18 + timestamp * 0.00008;
        context.beginPath();
        context.moveTo(center.x + Math.cos(angle) * 50, center.y + Math.sin(angle) * 28);
        context.lineTo(center.x + Math.cos(angle) * this.#width * 0.7, center.y + Math.sin(angle) * this.#height * 0.7);
        context.stroke();
      }
    }
    context.restore();
  }

  #drawAmbientForeground(timestamp: number): void {
    if (this.#profile === PROFILES.low) return;
    const context = this.#context;
    context.save();
    const bottomMist = context.createLinearGradient(0, this.#height * 0.7, 0, this.#height);
    bottomMist.addColorStop(0, 'rgba(5, 49, 42, 0)');
    bottomMist.addColorStop(1, 'rgba(8, 64, 54, .18)');
    context.fillStyle = bottomMist;
    context.fillRect(0, this.#height * 0.65, this.#width, this.#height * 0.35);
    if (!this.#reducedMotion) {
      context.globalAlpha = 0.035;
      context.fillStyle = '#8effdd';
      const drift = Math.sin(timestamp * 0.00012) * this.#width * 0.05;
      context.beginPath();
      context.ellipse(this.#width * 0.38 + drift, this.#height * 0.82, this.#width * 0.38, this.#height * 0.08, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function projectUnit(wx: number, wy: number, angle: number, verticalScale = 0.52): Point {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: wx * cosine - wy * sine,
    y: (wx * sine + wy * cosine) * verticalScale,
  };
}

function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index] as Point;
    const b = polygon[previous] as Point;
    const intersect = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function tracePolygon(context: CanvasRenderingContext2D, points: readonly Point[]): void {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y);
  });
  context.closePath();
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (imageRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${source}`));
    image.src = source;
  });
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function lerpPoint(from: Point, to: Point, amount: number): Point {
  return { x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function easeOutBack(value: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
}

function drawStar(context: CanvasRenderingContext2D, points: number, outerRadius: number, innerRadius: number): void {
  context.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = index * Math.PI / points - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.closePath();
}

function colorHue(color: string): number {
  const red = Number.parseInt(color.slice(1, 3), 16) / 255;
  const green = Number.parseInt(color.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(color.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  if (delta === 0) return 45;
  let hue = maximum === red ? ((green - blue) / delta) % 6 : maximum === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  hue = Math.round(hue * 60);
  return hue < 0 ? hue + 360 : hue;
}
