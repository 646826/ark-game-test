import { currentMask } from '../core/board.js';
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
  type QualityLevel,
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
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; kind: 'spark' | 'petal';
}
interface Dust { x: number; y: number; phase: number; speed: number; size: number }
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

export class ConservatoryRenderer {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #observer: ResizeObserver;
  #puzzle: PuzzleDefinition | null = null;
  #analysis: BoardAnalysis | null = null;
  #selectedId: string | null = null;
  #hoveredId: string | null = null;
  #coachId: string | null = null;
  #hintId: string | null = null;
  #hintUntil = 0;
  #displayTurns = new Map<string, number>();
  #projected: ProjectedTile[] = [];
  #width = 1;
  #height = 1;
  #dpr = 1;
  #running = true;
  #frameId = 0;
  #lastTime = 0;
  #viewTurns = 0;
  #targetViewTurns = 0;
  #reducedMotion = false;
  #highContrast = false;
  #quality: Exclude<QualityLevel, 'auto'> = 'high';
  #particles: Particle[] = [];
  #dust: Dust[] = [];
  #victoryStart = 0;
  #victoryEnd = 0;

  public constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) throw new Error('Canvas 2D is unavailable.');
    this.#context = context;
    this.#observer = new ResizeObserver(() => this.resize());
    this.#observer.observe(canvas);
    this.#createDust();
    this.resize();
    this.#frameId = requestAnimationFrame((time) => this.#frame(time));
  }

  public destroy(): void {
    this.#running = false;
    cancelAnimationFrame(this.#frameId);
    this.#observer.disconnect();
  }

  public clearPuzzle(): void {
    this.#puzzle = null;
    this.#analysis = null;
    this.#projected = [];
    this.#particles = [];
  }

  public setPuzzle(puzzle: PuzzleDefinition): void {
    this.#puzzle = puzzle;
    this.#displayTurns.clear();
    for (const tile of puzzle.tiles) this.#displayTurns.set(tile.id, tile.visualTurns);
    this.#selectedId = puzzle.sourceId;
    this.#hoveredId = null;
    this.#coachId = puzzle.tutorial?.targetId ?? null;
    this.#hintId = null;
    this.#particles = [];
    this.#victoryStart = 0;
    this.#victoryEnd = 0;
  }

  public setAnalysis(analysis: BoardAnalysis): void { this.#analysis = analysis; }
  public setSelected(id: string | null): void { this.#selectedId = id; }
  public setHovered(id: string | null): void { this.#hoveredId = id; }
  public setCoach(id: string | null): void { this.#coachId = id; }
  public setHint(id: string, durationMs = 5_000): void { this.#hintId = id; this.#hintUntil = performance.now() + durationMs; }
  public clearHint(): void { this.#hintId = null; }
  public setReducedMotion(enabled: boolean): void { this.#reducedMotion = enabled; }
  public setHighContrast(enabled: boolean): void { this.#highContrast = enabled; }
  public setQuality(quality: Exclude<QualityLevel, 'auto'>): void { this.#quality = quality; this.#createDust(); }
  public rotateView(delta: -1 | 1): void { this.#targetViewTurns += delta; if (this.#reducedMotion) this.#viewTurns = this.#targetViewTurns; }
  public syncTile(tile: TileState): void { if (!this.#displayTurns.has(tile.id)) this.#displayTurns.set(tile.id, tile.visualTurns); }

  public startVictorySequence(durationMs = 1_850): void {
    const now = performance.now();
    this.#victoryStart = now;
    this.#victoryEnd = now + Math.max(320, durationMs);
    this.#selectedId = null;
    this.#hoveredId = null;
    this.#coachId = null;
    this.#hintId = null;
    this.#bloomBurst();
  }

  public pause(): void {
    this.#running = false;
    cancelAnimationFrame(this.#frameId);
  }

  public resume(): void {
    if (this.#running) return;
    this.#running = true;
    this.#lastTime = performance.now();
    this.#frameId = requestAnimationFrame((time) => this.#frame(time));
  }

  public resize(): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#width = Math.max(1, rect.width);
    this.#height = Math.max(1, rect.height);
    const cap = this.#quality === 'balanced' ? 1.5 : 2;
    this.#dpr = Math.min(cap, Math.max(1, window.devicePixelRatio || 1));
    const width = Math.round(this.#width * this.#dpr);
    const height = Math.round(this.#height * this.#dpr);
    if (this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#canvas.width = width;
      this.#canvas.height = height;
    }
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

  #frame(time: number): void {
    if (!this.#running) return;
    const delta = Math.min(0.05, Math.max(0, (time - this.#lastTime) / 1_000 || 0));
    this.#lastTime = time;
    this.#update(delta, time);
    this.#draw(time);
    this.#frameId = requestAnimationFrame((next) => this.#frame(next));
  }

  #update(delta: number, time: number): void {
    const smoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-delta * 10.5);
    this.#viewTurns += (this.#targetViewTurns - this.#viewTurns) * smoothing;
    if (Math.abs(this.#targetViewTurns - this.#viewTurns) < 0.0005) this.#viewTurns = this.#targetViewTurns;
    if (this.#puzzle) {
      for (const tile of this.#puzzle.tiles) {
        const current = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
        const next = current + (tile.visualTurns - current) * smoothing;
        this.#displayTurns.set(tile.id, Math.abs(tile.visualTurns - next) < 0.001 ? tile.visualTurns : next);
      }
    }
    if (this.#hintId && time > this.#hintUntil) this.#hintId = null;
    if (!this.#reducedMotion) {
      for (const dust of this.#dust) {
        dust.y -= dust.speed * delta;
        dust.x += Math.sin(time * 0.00045 + dust.phase) * delta * 0.006;
        if (dust.y < -0.05) { dust.y = 1.05; dust.x = Math.random(); }
      }
      for (const particle of this.#particles) {
        particle.life -= delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += particle.kind === 'petal' ? 22 * delta : 45 * delta;
        particle.vx *= Math.pow(0.975, delta * 60);
      }
      this.#particles = this.#particles.filter((particle) => particle.life > 0);
    }
  }

  #draw(time: number): void {
    const context = this.#context;
    context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    context.clearRect(0, 0, this.#width, this.#height);
    this.#drawAtmosphere(time);
    const puzzle = this.#puzzle;
    if (!puzzle) return;
    const theme = THEMES[puzzle.theme % THEMES.length] as Theme;
    this.#projected = this.#projectBoard(puzzle);
    this.#drawBoardShadow(theme);
    for (const projected of this.#projected) this.#drawTile(projected, theme, time);
    this.#drawParticles(time, theme);
    this.#drawVictory(time, theme);
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
      context.shadowColor = 'rgba(255, 220, 126, .65)';
      context.shadowBlur = dust.size * 4;
      context.beginPath();
      context.arc(dust.x * this.#width, dust.y * this.#height, dust.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  #projectBoard(puzzle: PuzzleDefinition): ProjectedTile[] {
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
    const unitCenters = puzzle.tiles.map((tile) => {
      const dx = tile.x - centerX;
      const dy = tile.y - centerY;
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
      return { tile, x: (rx - ry) * 0.5, y: (rx + ry) * 0.285 };
    });
    const minX = Math.min(...unitCenters.map((item) => item.x - 0.54));
    const maxX = Math.max(...unitCenters.map((item) => item.x + 0.54));
    const minY = Math.min(...unitCenters.map((item) => item.y - 0.31));
    const maxY = Math.max(...unitCenters.map((item) => item.y + 0.43));
    const availW = available.right - available.left;
    const availH = available.bottom - available.top;
    const scale = Math.max(54, Math.min(availW / Math.max(1, maxX - minX), availH / Math.max(0.7, maxY - minY), portrait ? 215 : 300));
    const tileWidth = scale;
    const tileHeight = scale * 0.57;
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
    context.filter = this.#quality === 'high' ? 'blur(18px)' : 'blur(10px)';
    context.fillStyle = 'rgba(0, 0, 0, .48)';
    context.beginPath();
    context.ellipse((minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.48, (maxY - minY) * 0.34, 0, 0, Math.PI * 2);
    context.fill();
    context.filter = 'none';
    const aura = context.createRadialGradient((minX + maxX) / 2, (minY + maxY) / 2, 0, (minX + maxX) / 2, (minY + maxY) / 2, (maxX - minX) * 0.62);
    aura.addColorStop(0, `${theme.aquaSoft}20`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = aura;
    context.fillRect(minX - 50, minY - 50, maxX - minX + 100, maxY - minY + 100);
    context.restore();
  }

  #drawTile(projected: ProjectedTile, theme: Theme, time: number): void {
    const { tile, center, polygon, tileWidth, tileHeight } = projected;
    const context = this.#context;
    const powered = this.#analysis?.powered.has(tile.id) ?? false;
    const selected = tile.id === this.#selectedId;
    const hovered = tile.id === this.#hoveredId;
    const coached = tile.id === this.#coachId;
    const hinted = tile.id === this.#hintId;
    const lift = selected || hovered || coached || hinted ? Math.max(2, tileHeight * 0.045) : 0;
    const topPolygon = polygon.map((point) => ({ x: point.x, y: point.y - lift })) as [Point, Point, Point, Point];
    const extrusion = tileHeight * 0.26;

    context.save();
    context.shadowColor = 'rgba(0,0,0,.5)';
    context.shadowBlur = tileHeight * 0.24;
    context.shadowOffsetY = tileHeight * 0.22;
    pathPolygon(context, [topPolygon[3], topPolygon[2], { x: topPolygon[2].x, y: topPolygon[2].y + extrusion }, { x: topPolygon[3].x, y: topPolygon[3].y + extrusion }]);
    context.fillStyle = theme.side;
    context.fill();
    pathPolygon(context, [topPolygon[1], topPolygon[2], { x: topPolygon[2].x, y: topPolygon[2].y + extrusion }, { x: topPolygon[1].x, y: topPolygon[1].y + extrusion }]);
    const sideGradient = context.createLinearGradient(topPolygon[1].x, topPolygon[1].y, topPolygon[2].x, topPolygon[2].y + extrusion);
    sideGradient.addColorStop(0, '#173837');
    sideGradient.addColorStop(1, '#061a1d');
    context.fillStyle = sideGradient;
    context.fill();
    context.shadowColor = 'transparent';

    const topGradient = context.createLinearGradient(center.x, topPolygon[0].y, center.x, topPolygon[2].y);
    topGradient.addColorStop(0, powered ? theme.glassLight : theme.glass);
    topGradient.addColorStop(1, powered ? theme.glass : theme.ink);
    pathPolygon(context, topPolygon);
    context.fillStyle = topGradient;
    context.fill();
    context.strokeStyle = this.#highContrast ? '#f8fff4' : powered ? `${theme.aqua}99` : `${theme.edge}88`;
    context.lineWidth = Math.max(1.1, tileWidth * 0.009);
    context.stroke();

    // Inner glass plate and engraved filigree.
    const inset = insetDiamond({ x: center.x, y: center.y - lift }, tileWidth * 0.84, tileHeight * 0.80);
    pathPolygon(context, inset);
    context.fillStyle = powered ? `${theme.aquaSoft}12` : 'rgba(255,255,255,.025)';
    context.fill();
    context.strokeStyle = powered ? `${theme.aqua}3f` : 'rgba(231, 255, 244, .10)';
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
    this.#drawChannels(projected, { x: center.x, y: center.y - lift }, theme, powered, time);

    if (tile.kind === 'source') this.#drawSource(projected, { x: center.x, y: center.y - lift }, theme, time);
    else if (tile.kind === 'plant') this.#drawPlant(projected, { x: center.x, y: center.y - lift }, theme, powered, time);
    else this.#drawMechanism(projected, { x: center.x, y: center.y - lift }, theme, powered, time);

    if (tile.fixed && tile.kind === 'pipe') this.#drawLock(center.x + tileWidth * 0.27, center.y - lift - tileHeight * 0.10, tileWidth * 0.08, theme);
    if (selected || hovered || coached || hinted) this.#drawSelection(topPolygon, tileWidth, theme, time, coached || hinted);
    context.restore();

    if (this.#analysis) {
      for (const leak of this.#analysis.leaks) {
        if (leak.tileId === tile.id) this.#drawLeak(projected, { x: center.x, y: center.y - lift }, leak.direction, theme, time);
      }
    }
  }

  #drawCornerRivets(center: Point, tileWidth: number, tileHeight: number, theme: Theme): void {
    const context = this.#context;
    const points = diamond(center, tileWidth * 0.81, tileHeight * 0.75);
    const radius = Math.max(1.7, tileWidth * 0.018);
    for (const point of points) {
      const gradient = context.createRadialGradient(point.x - radius * 0.35, point.y - radius * 0.35, 0, point.x, point.y, radius * 1.25);
      gradient.addColorStop(0, theme.brassLight);
      gradient.addColorStop(0.45, theme.brass);
      gradient.addColorStop(1, '#51301a');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  #drawChannels(projected: ProjectedTile, center: Point, theme: Theme, powered: boolean, time: number): void {
    const context = this.#context;
    const turns = this.#displayTurns.get(projected.tile.id) ?? projected.tile.visualTurns;
    const pulse = this.#reducedMotion ? 0.8 : 0.68 + Math.sin(time * 0.006 + projected.tile.x * 1.7 + projected.tile.y) * 0.18;
    for (const direction of DIRECTIONS) {
      if ((projected.tile.baseMask & direction.bit) === 0) continue;
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
      const brass = context.createLinearGradient(inner.x, inner.y - width, end.x, end.y + width);
      brass.addColorStop(0, theme.brassLight);
      brass.addColorStop(0.35, theme.brass);
      brass.addColorStop(0.72, '#755027');
      brass.addColorStop(1, theme.brassLight);
      context.strokeStyle = brass;
      context.lineWidth = width * 1.25;
      context.stroke();
      context.strokeStyle = 'rgba(255, 238, 175, .45)';
      context.lineWidth = width * 0.18;
      context.stroke();
      if (powered) {
        context.shadowColor = theme.aqua;
        context.shadowBlur = width * 2.5;
        context.strokeStyle = `${theme.aqua}${Math.round(pulse * 255).toString(16).padStart(2, '0')}`;
        context.lineWidth = width * 0.58;
        context.stroke();
        context.shadowBlur = 0;
        if (!this.#reducedMotion && this.#quality === 'high') {
          const flow = (time * 0.00035 + projected.tile.x * 0.13 + projected.tile.y * 0.19) % 1;
          const fx = inner.x + (end.x - inner.x) * flow;
          const fy = inner.y + (end.y - inner.y) * flow;
          context.fillStyle = '#ffffff';
          context.shadowColor = theme.aqua;
          context.shadowBlur = 9;
          context.beginPath();
          context.arc(fx, fy, Math.max(1.2, width * 0.18), 0, Math.PI * 2);
          context.fill();
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
        context.fillStyle = theme.aqua;
        context.shadowColor = theme.aqua;
        context.shadowBlur = width * 1.8;
        context.beginPath();
        context.ellipse(end.x, end.y, width * 0.37, width * 0.18, Math.atan2(vector.y, vector.x), 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }

  #drawMechanism(projected: ProjectedTile, center: Point, theme: Theme, powered: boolean, time: number): void {
    const context = this.#context;
    const radius = projected.tileWidth * 0.105;
    context.save();
    context.translate(center.x, center.y);
    const spin = this.#reducedMotion ? 0 : time * 0.00018 * (powered ? 1 : 0.35);
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
    const ring = context.createRadialGradient(-radius * 0.25, -radius * 0.35, 0, 0, 0, radius);
    ring.addColorStop(0, theme.brassLight);
    ring.addColorStop(0.48, theme.brass);
    ring.addColorStop(0.72, '#3b2618');
    ring.addColorStop(1, theme.brassLight);
    context.fillStyle = ring;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = powered ? theme.aqua : '#071e21';
    context.shadowColor = powered ? theme.aqua : 'transparent';
    context.shadowBlur = powered ? radius : 0;
    context.beginPath();
    context.arc(0, 0, radius * 0.47, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,.28)';
    context.lineWidth = Math.max(1, radius * 0.08);
    context.stroke();
    context.restore();
  }

  #drawSource(projected: ProjectedTile, center: Point, theme: Theme, time: number): void {
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
    const bowl = context.createRadialGradient(-radius * 0.35, -radius * 0.5, 0, 0, 0, radius * 1.2);
    bowl.addColorStop(0, theme.brassLight);
    bowl.addColorStop(0.42, theme.brass);
    bowl.addColorStop(0.8, '#4a311a');
    bowl.addColorStop(1, theme.brassLight);
    context.fillStyle = bowl;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = theme.aqua;
    context.shadowColor = theme.aqua;
    context.shadowBlur = radius * 2.2;
    context.beginPath();
    context.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    context.fill();
    context.restore();

    const pulse = this.#reducedMotion ? 1 : 0.92 + Math.sin(time * 0.0045) * 0.08;
    const starY = baseY - radius * 1.08;
    context.save();
    context.strokeStyle = theme.aqua;
    context.shadowColor = theme.aqua;
    context.shadowBlur = radius * 1.1;
    context.lineWidth = Math.max(1.6, radius * 0.09);
    context.beginPath();
    context.arc(center.x, baseY, radius * 1.22, Math.PI * 1.08, Math.PI * 1.92);
    context.stroke();
    drawStar(context, center.x, starY, radius * 0.36 * pulse, radius * 0.11 * pulse, 4, time * 0.0005);
    context.fillStyle = '#ffffff';
    context.fill();
    context.restore();
  }

  #drawPlant(projected: ProjectedTile, center: Point, theme: Theme, powered: boolean, time: number): void {
    const context = this.#context;
    const scale = projected.tileWidth / 150;
    const potY = center.y + projected.tileHeight * 0.03;
    const potW = 30 * scale;
    const potH = 23 * scale;
    context.save();
    context.shadowColor = 'rgba(0,0,0,.42)';
    context.shadowBlur = 9 * scale;
    context.shadowOffsetY = 6 * scale;
    const pot = context.createLinearGradient(center.x - potW / 2, potY, center.x + potW / 2, potY + potH);
    pot.addColorStop(0, '#f0c176');
    pot.addColorStop(0.32, '#8e4f2c');
    pot.addColorStop(0.72, '#bd7740');
    pot.addColorStop(1, '#49271c');
    context.fillStyle = pot;
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

    const stemTop = potY - 31 * scale;
    context.strokeStyle = powered ? '#61c276' : '#3e704c';
    context.lineWidth = Math.max(2, 3.2 * scale);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(center.x, potY);
    context.quadraticCurveTo(center.x - 2 * scale, potY - 15 * scale, center.x, stemTop);
    context.stroke();
    this.#drawLeaf(center.x - 5 * scale, potY - 14 * scale, -0.55, 10 * scale, powered);
    this.#drawLeaf(center.x + 5 * scale, potY - 19 * scale, Math.PI + 0.45, 10 * scale, powered);

    const kind = projected.tile.plantKind ?? 'lumen-orchid';
    const palette = PLANT_PALETTES[kind];
    const bloom = powered ? 1 : 0.42;
    if (powered) {
      context.shadowColor = palette[2];
      context.shadowBlur = 18 * scale;
    }
    const sway = this.#reducedMotion ? 0 : Math.sin(time * 0.0018 + projected.tile.x * 0.8) * 0.07;
    const petals = kind === 'sun-dahlia' || kind === 'ember-bloom' ? 10 : kind === 'mist-lily' ? 6 : 7;
    context.save();
    context.translate(center.x, stemTop);
    context.rotate(sway);
    for (let index = 0; index < petals; index += 1) {
      context.save();
      context.rotate((Math.PI * 2 * index) / petals);
      context.fillStyle = index % 2 === 0 ? palette[0] : palette[1];
      context.globalAlpha = bloom;
      context.beginPath();
      context.ellipse(0, -9 * scale * bloom, 4.2 * scale * bloom, 10 * scale * bloom, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
    context.globalAlpha = powered ? 1 : 0.5;
    context.fillStyle = palette[2];
    context.beginPath();
    context.arc(0, 0, 4.8 * scale, 0, Math.PI * 2);
    context.fill();
    context.restore();
    context.restore();
  }

  #drawLeaf(x: number, y: number, angle: number, size: number, powered: boolean): void {
    const context = this.#context;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = powered ? '#5eae65' : '#385f43';
    context.beginPath();
    context.ellipse(0, 0, size, size * 0.42, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawLock(x: number, y: number, radius: number, theme: Theme): void {
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

  #drawSelection(polygon: readonly Point[], tileWidth: number, theme: Theme, time: number, strong: boolean): void {
    const context = this.#context;
    const pulse = this.#reducedMotion ? 1 : 0.75 + Math.sin(time * 0.006) * 0.25;
    context.save();
    context.strokeStyle = strong ? theme.accent : theme.brassLight;
    context.shadowColor = strong ? theme.accent : theme.brassLight;
    context.shadowBlur = tileWidth * (strong ? 0.16 : 0.09) * pulse;
    context.lineWidth = Math.max(2, tileWidth * (strong ? 0.026 : 0.018));
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

  #drawLeak(projected: ProjectedTile, center: Point, direction: DirectionBit, theme: Theme, time: number): void {
    const context = this.#context;
    const vector = this.#directionVector(direction, Math.round(projected.tile.visualTurns), projected.tileWidth, projected.tileHeight);
    const x = center.x + vector.x * 0.48;
    const y = center.y + vector.y * 0.48;
    const scale = projected.tileWidth / 150;
    context.save();
    context.strokeStyle = theme.aqua;
    context.shadowColor = theme.aqua;
    context.shadowBlur = 15 * scale;
    context.lineCap = 'round';
    for (let index = 0; index < 4; index += 1) {
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

  #bloomBurst(): void {
    if (this.#reducedMotion) return;
    for (const projected of this.#projected) {
      if (projected.tile.kind !== 'plant') continue;
      for (let index = 0; index < (this.#quality === 'high' ? 18 : 9); index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 22 + Math.random() * 66;
        this.#particles.push({
          x: projected.center.x,
          y: projected.center.y - projected.tileHeight * 0.48,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 32,
          life: 0.9 + Math.random() * 0.9,
          maxLife: 1.8,
          size: 1.8 + Math.random() * 3.5,
          kind: Math.random() > 0.45 ? 'petal' : 'spark',
        });
      }
    }
  }

  #drawParticles(time: number, theme: Theme): void {
    const context = this.#context;
    context.save();
    for (const particle of this.#particles) {
      const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      context.globalAlpha = alpha;
      context.translate(particle.x, particle.y);
      context.rotate(time * 0.003 + particle.x);
      context.fillStyle = particle.kind === 'petal' ? theme.accent : '#ffffff';
      context.shadowColor = particle.kind === 'petal' ? theme.accent : theme.aqua;
      context.shadowBlur = particle.size * 3;
      if (particle.kind === 'petal') {
        context.beginPath();
        context.ellipse(0, 0, particle.size * 1.5, particle.size * 0.65, 0, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      }
      context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    }
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
      for (let index = 0; index < 16; index += 1) {
        context.rotate(Math.PI / 8);
        context.beginPath();
        context.moveTo(80, 0);
        context.lineTo(100 + progress * this.#width * 0.28, 0);
        context.stroke();
      }
    }
    context.restore();
  }

  #createDust(): void {
    const count = this.#quality === 'high' ? 42 : 20;
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
  context.roundRect(x, y, width, height, radius);
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
