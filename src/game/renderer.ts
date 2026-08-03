import { currentMask } from '../core/board.js';
import { hashSeed } from '../core/random.js';
import { DIRECTIONS, Direction, type BoardAnalysis, type DirectionBit, type PuzzleDefinition, type TileState } from '../core/types.js';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface ProjectedTile {
  readonly tile: TileState;
  readonly center: Point;
  readonly polygon: readonly Point[];
  readonly depth: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
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
}

interface Pollen {
  x: number;
  y: number;
  speed: number;
  phase: number;
  size: number;
}

interface Theme {
  readonly skyTop: string;
  readonly skyBottom: string;
  readonly haze: string;
  readonly floor: string;
  readonly tile: string;
  readonly tilePowered: string;
  readonly metal: string;
  readonly glow: string;
  readonly accent: string;
}

const THEMES: readonly Theme[] = [
  {
    skyTop: '#092d33',
    skyBottom: '#145d52',
    haze: 'rgba(132, 238, 194, 0.22)',
    floor: '#0c3835',
    tile: '#264f48',
    tilePowered: '#357568',
    metal: '#c89b55',
    glow: '#8ffff0',
    accent: '#ffd98c',
  },
  {
    skyTop: '#102d25',
    skyBottom: '#3b6a3e',
    haze: 'rgba(202, 255, 154, 0.2)',
    floor: '#173c2c',
    tile: '#345640',
    tilePowered: '#567d4c',
    metal: '#d1a85f',
    glow: '#d7ff8a',
    accent: '#ffe3a0',
  },
  {
    skyTop: '#171c3d',
    skyBottom: '#5b3b68',
    haze: 'rgba(184, 160, 255, 0.19)',
    floor: '#252447',
    tile: '#3e405f',
    tilePowered: '#5a5885',
    metal: '#d3a967',
    glow: '#bfe8ff',
    accent: '#ffc8e7',
  },
  {
    skyTop: '#08253f',
    skyBottom: '#31536c',
    haze: 'rgba(126, 248, 237, 0.2)',
    floor: '#123349',
    tile: '#334f62',
    tilePowered: '#48798a',
    metal: '#e0b970',
    glow: '#94fff5',
    accent: '#f4d4ff',
  },
] as const;

export class ConservatoryRenderer {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  readonly #resizeObserver: ResizeObserver;
  #puzzle: PuzzleDefinition | null = null;
  #analysis: BoardAnalysis | null = null;
  #selectedId: string | null = null;
  #hintId: string | null = null;
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
  #particles: Particle[] = [];
  #pollen: Pollen[] = [];
  #themeIndex = 0;

  public constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!context) {
      throw new Error('Canvas 2D is unavailable.');
    }
    this.#context = context;
    this.#resizeObserver = new ResizeObserver(() => this.resize());
    this.#resizeObserver.observe(canvas);
    this.#createPollen();
    this.resize();
    this.#animationFrame = requestAnimationFrame((timestamp) => this.#frame(timestamp));
  }

  public destroy(): void {
    this.#running = false;
    cancelAnimationFrame(this.#animationFrame);
    this.#resizeObserver.disconnect();
  }

  public setPuzzle(puzzle: PuzzleDefinition): void {
    this.#puzzle = puzzle;
    this.#themeIndex = Math.floor((Math.max(1, puzzle.level) - 1) / 5) % THEMES.length;
    this.#displayTurns.clear();
    for (const tile of puzzle.tiles) {
      this.#displayTurns.set(tile.id, tile.visualTurns);
    }
    this.#selectedId = puzzle.sourceId;
    this.#hintId = null;
    this.#particles = [];
  }

  public setAnalysis(analysis: BoardAnalysis): void {
    this.#analysis = analysis;
  }

  public setSelected(tileId: string | null): void {
    this.#selectedId = tileId;
  }

  public setHint(tileId: string, durationMs = 5_000): void {
    this.#hintId = tileId;
    this.#hintUntil = performance.now() + durationMs;
  }

  public clearHint(): void {
    this.#hintId = null;
  }

  public setReducedMotion(enabled: boolean): void {
    this.#reducedMotion = enabled;
    if (enabled) {
      this.#viewTurns = this.#targetViewTurns;
      if (this.#puzzle) {
        for (const tile of this.#puzzle.tiles) {
          this.#displayTurns.set(tile.id, tile.visualTurns);
        }
      }
    }
  }

  public setHighContrast(enabled: boolean): void {
    this.#highContrast = enabled;
  }

  public rotateView(delta: -1 | 1): void {
    this.#targetViewTurns += delta;
    if (this.#reducedMotion) {
      this.#viewTurns = this.#targetViewTurns;
    }
  }

  public syncTile(tile: TileState): void {
    if (!this.#displayTurns.has(tile.id)) {
      this.#displayTurns.set(tile.id, tile.visualTurns);
    }
  }

  public hitTest(clientX: number, clientY: number): string | null {
    const rect = this.#canvas.getBoundingClientRect();
    const point = { x: clientX - rect.left, y: clientY - rect.top };
    for (let index = this.#projectedTiles.length - 1; index >= 0; index -= 1) {
      const projected = this.#projectedTiles[index] as ProjectedTile;
      if (pointInPolygon(point, projected.polygon)) {
        return projected.tile.id;
      }
    }
    return null;
  }

  public bloomBurst(): void {
    if (!this.#analysis || this.#reducedMotion) {
      return;
    }
    for (const projected of this.#projectedTiles) {
      if (projected.tile.kind !== 'plant') {
        continue;
      }
      for (let index = 0; index < 18; index += 1) {
        const angle = (Math.PI * 2 * index) / 18 + Math.random() * 0.3;
        const speed = 28 + Math.random() * 72;
        this.#particles.push({
          x: projected.center.x,
          y: projected.center.y - projected.tileHeight * 0.7,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 38,
          life: 1,
          maxLife: 0.9 + Math.random() * 0.8,
          size: 2 + Math.random() * 4,
          hue: 44 + Math.random() * 100,
        });
      }
    }
  }

  public pause(): void {
    this.#running = false;
    cancelAnimationFrame(this.#animationFrame);
  }

  public resume(): void {
    if (this.#running) {
      return;
    }
    this.#running = true;
    this.#lastTimestamp = performance.now();
    this.#animationFrame = requestAnimationFrame((timestamp) => this.#frame(timestamp));
  }

  public resize(): void {
    const rect = this.#canvas.getBoundingClientRect();
    this.#width = Math.max(1, rect.width);
    this.#height = Math.max(1, rect.height);
    this.#dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    const physicalWidth = Math.round(this.#width * this.#dpr);
    const physicalHeight = Math.round(this.#height * this.#dpr);
    if (this.#canvas.width !== physicalWidth || this.#canvas.height !== physicalHeight) {
      this.#canvas.width = physicalWidth;
      this.#canvas.height = physicalHeight;
    }
    this.#context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
  }

  #frame(timestamp: number): void {
    if (!this.#running) {
      return;
    }
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - this.#lastTimestamp) / 1_000 || 0));
    this.#lastTimestamp = timestamp;
    this.#update(deltaSeconds);
    this.#draw(timestamp);
    this.#animationFrame = requestAnimationFrame((next) => this.#frame(next));
  }

  #update(deltaSeconds: number): void {
    const smoothing = this.#reducedMotion ? 1 : 1 - Math.exp(-deltaSeconds * 9.5);
    this.#viewTurns += (this.#targetViewTurns - this.#viewTurns) * smoothing;
    if (Math.abs(this.#targetViewTurns - this.#viewTurns) < 0.0005) {
      this.#viewTurns = this.#targetViewTurns;
    }

    if (this.#puzzle) {
      for (const tile of this.#puzzle.tiles) {
        const current = this.#displayTurns.get(tile.id) ?? tile.visualTurns;
        const next = current + (tile.visualTurns - current) * smoothing;
        this.#displayTurns.set(tile.id, Math.abs(tile.visualTurns - next) < 0.001 ? tile.visualTurns : next);
      }
    }

    if (this.#hintId && performance.now() > this.#hintUntil) {
      this.#hintId = null;
    }

    if (!this.#reducedMotion) {
      for (const pollen of this.#pollen) {
        pollen.y -= pollen.speed * deltaSeconds;
        pollen.x += Math.sin(performance.now() * 0.0004 + pollen.phase) * deltaSeconds * 4;
        if (pollen.y < -0.04) {
          pollen.y = 1.04;
          pollen.x = Math.random();
        }
      }
      for (const particle of this.#particles) {
        particle.life -= deltaSeconds;
        particle.x += particle.vx * deltaSeconds;
        particle.y += particle.vy * deltaSeconds;
        particle.vy += 34 * deltaSeconds;
        particle.vx *= Math.pow(0.96, deltaSeconds * 60);
      }
      this.#particles = this.#particles.filter((particle) => particle.life > 0);
    }
  }

  #draw(timestamp: number): void {
    const context = this.#context;
    context.setTransform(this.#dpr, 0, 0, this.#dpr, 0, 0);
    const theme = THEMES[this.#themeIndex] as Theme;
    this.#drawBackground(theme, timestamp);
    this.#drawGlasshouse(theme, timestamp);

    if (!this.#puzzle) {
      return;
    }

    this.#projectedTiles = this.#projectBoard(this.#puzzle);
    this.#drawBoardShadow(theme);
    for (const projected of this.#projectedTiles) {
      this.#drawTile(projected, theme, timestamp);
    }
    this.#drawParticles();
  }

  #drawBackground(theme: Theme, timestamp: number): void {
    const context = this.#context;
    const gradient = context.createLinearGradient(0, 0, 0, this.#height);
    gradient.addColorStop(0, theme.skyTop);
    gradient.addColorStop(0.62, theme.skyBottom);
    gradient.addColorStop(1, theme.floor);
    context.fillStyle = gradient;
    context.fillRect(0, 0, this.#width, this.#height);

    const glowX = this.#width * (0.72 + Math.sin(timestamp * 0.00008) * 0.05);
    const glowY = this.#height * 0.18;
    const glow = context.createRadialGradient(glowX, glowY, 0, glowX, glowY, this.#width * 0.48);
    glow.addColorStop(0, theme.haze);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, this.#width, this.#height);

    context.save();
    for (const pollen of this.#pollen) {
      const alpha = this.#reducedMotion ? 0.16 : 0.1 + Math.sin(timestamp * 0.001 + pollen.phase) * 0.06;
      context.fillStyle = `rgba(238, 255, 208, ${Math.max(0.04, alpha)})`;
      context.beginPath();
      context.arc(pollen.x * this.#width, pollen.y * this.#height, pollen.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  #drawGlasshouse(theme: Theme, timestamp: number): void {
    const context = this.#context;
    const horizon = this.#height * 0.63;
    context.save();
    context.strokeStyle = this.#highContrast ? 'rgba(255,255,255,0.34)' : 'rgba(213, 255, 238, 0.13)';
    context.lineWidth = 1;

    for (let index = -2; index <= 2; index += 1) {
      const x = this.#width * (0.5 + index * 0.19);
      context.beginPath();
      context.moveTo(x, horizon + this.#height * 0.18);
      context.bezierCurveTo(
        x - index * this.#width * 0.08,
        this.#height * 0.25,
        this.#width * 0.5 + index * this.#width * 0.1,
        this.#height * 0.08,
        this.#width * 0.5,
        this.#height * 0.04,
      );
      context.stroke();
    }

    context.beginPath();
    context.ellipse(this.#width / 2, horizon, this.#width * 0.46, this.#height * 0.48, 0, Math.PI, Math.PI * 2);
    context.stroke();

    context.globalAlpha = 0.12;
    const shimmer = (timestamp * 0.025) % Math.max(1, this.#width);
    const beam = context.createLinearGradient(shimmer - 100, 0, shimmer + 100, 0);
    beam.addColorStop(0, 'rgba(255,255,255,0)');
    beam.addColorStop(0.5, theme.glow);
    beam.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = beam;
    context.fillRect(0, 0, this.#width, horizon);
    context.restore();
  }

  #projectBoard(puzzle: PuzzleDefinition): ProjectedTile[] {
    const angle = this.#viewTurns * (Math.PI / 2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centerX = (puzzle.config.cols - 1) / 2;
    const centerY = (puzzle.config.rows - 1) / 2;
    const topInset = Math.min(92, this.#height * 0.16);
    const bottomInset = Math.min(112, this.#height * 0.2);
    const availableWidth = Math.max(180, this.#width * 0.9);
    const availableHeight = Math.max(150, this.#height - topInset - bottomInset);

    const unitPoints: Point[] = [];
    for (const tile of puzzle.tiles) {
      for (const [offsetX, offsetY] of [[-0.48, -0.48], [0.48, -0.48], [0.48, 0.48], [-0.48, 0.48]] as const) {
        unitPoints.push(projectIso(tile.x - centerX + offsetX, tile.y - centerY + offsetY, cos, sin, 100, 54));
      }
    }
    const bounds = pointBounds(unitPoints);
    const scale = Math.min(
      availableWidth / Math.max(1, bounds.maxX - bounds.minX),
      (availableHeight * 0.82) / Math.max(1, bounds.maxY - bounds.minY),
    );
    const tileWidth = Math.max(31, Math.min(128, 100 * scale));
    const tileHeight = tileWidth * 0.54;

    const scaledPoints: Point[] = [];
    for (const tile of puzzle.tiles) {
      for (const [offsetX, offsetY] of [[-0.48, -0.48], [0.48, -0.48], [0.48, 0.48], [-0.48, 0.48]] as const) {
        scaledPoints.push(projectIso(tile.x - centerX + offsetX, tile.y - centerY + offsetY, cos, sin, tileWidth, tileHeight));
      }
    }
    const scaledBounds = pointBounds(scaledPoints);
    const originX = this.#width / 2 - (scaledBounds.minX + scaledBounds.maxX) / 2;
    const originY = topInset + availableHeight * 0.52 - (scaledBounds.minY + scaledBounds.maxY) / 2;

    return puzzle.tiles
      .map((tile) => {
        const localX = tile.x - centerX;
        const localY = tile.y - centerY;
        const center = addOrigin(projectIso(localX, localY, cos, sin, tileWidth, tileHeight), originX, originY);
        const polygon = [
          addOrigin(projectIso(localX - 0.45, localY - 0.45, cos, sin, tileWidth, tileHeight), originX, originY),
          addOrigin(projectIso(localX + 0.45, localY - 0.45, cos, sin, tileWidth, tileHeight), originX, originY),
          addOrigin(projectIso(localX + 0.45, localY + 0.45, cos, sin, tileWidth, tileHeight), originX, originY),
          addOrigin(projectIso(localX - 0.45, localY + 0.45, cos, sin, tileWidth, tileHeight), originX, originY),
        ];
        return {
          tile,
          center,
          polygon,
          depth: center.y + center.x * 0.0001,
          tileWidth,
          tileHeight,
        };
      })
      .sort((a, b) => a.depth - b.depth);
  }

  #drawBoardShadow(theme: Theme): void {
    if (this.#projectedTiles.length === 0) {
      return;
    }
    const context = this.#context;
    const centers = this.#projectedTiles.map((tile) => tile.center);
    const bounds = pointBounds(centers);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2 + 30;
    const radiusX = (bounds.maxX - bounds.minX) * 0.62 + 60;
    const radiusY = Math.max(30, (bounds.maxY - bounds.minY) * 0.45 + 28);
    const shadow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radiusX);
    shadow.addColorStop(0, 'rgba(0,0,0,0.42)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = shadow;
    context.beginPath();
    context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = theme.haze;
    context.lineWidth = 1;
    context.beginPath();
    context.ellipse(centerX, centerY - 8, radiusX * 0.92, radiusY * 0.86, 0, 0, Math.PI * 2);
    context.stroke();
  }

  #drawTile(projected: ProjectedTile, theme: Theme, timestamp: number): void {
    const { tile, polygon, center, tileWidth, tileHeight } = projected;
    const context = this.#context;
    const powered = this.#analysis?.powered.has(tile.id) ?? false;
    const selected = tile.id === this.#selectedId;
    const hinted = tile.id === this.#hintId;
    const extrusion = Math.max(6, tileHeight * 0.18);

    context.save();
    context.shadowColor = 'rgba(0, 0, 0, 0.34)';
    context.shadowBlur = tileWidth * 0.13;
    context.shadowOffsetY = extrusion * 0.8;
    fillPolygon(context, polygon, 'rgba(4, 17, 18, 0.72)');
    context.restore();

    const visibleEdges = polygon
      .map((point, index) => ({
        a: point,
        b: polygon[(index + 1) % polygon.length] as Point,
        midY: (point.y + (polygon[(index + 1) % polygon.length] as Point).y) / 2,
      }))
      .sort((a, b) => b.midY - a.midY)
      .slice(0, 2);
    visibleEdges.forEach((edge, index) => {
      fillPolygon(
        context,
        [edge.a, edge.b, { x: edge.b.x, y: edge.b.y + extrusion }, { x: edge.a.x, y: edge.a.y + extrusion }],
        index === 0 ? 'rgba(12, 31, 31, 0.96)' : 'rgba(18, 43, 40, 0.94)',
      );
    });

    const tileGradient = context.createLinearGradient(center.x - tileWidth * 0.5, center.y - tileHeight, center.x + tileWidth * 0.4, center.y + tileHeight);
    tileGradient.addColorStop(0, powered ? lighten(theme.tilePowered, 18) : lighten(theme.tile, 11));
    tileGradient.addColorStop(1, powered ? theme.tilePowered : theme.tile);
    fillPolygon(context, polygon, tileGradient);

    context.save();
    context.strokeStyle = this.#highContrast
      ? powered
        ? '#ffffff'
        : '#d6eadf'
      : powered
        ? withAlpha(theme.glow, 0.72)
        : 'rgba(222, 245, 229, 0.2)';
    context.lineWidth = selected || hinted ? Math.max(2.5, tileWidth * 0.04) : Math.max(1, tileWidth * 0.016);
    context.beginPath();
    polygon.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
    context.closePath();
    context.stroke();
    context.restore();

    this.#drawRivets(projected, theme);
    this.#drawChannels(projected, theme, timestamp, powered);
    this.#drawGear(projected, theme, powered, timestamp);

    if (tile.kind === 'source') {
      this.#drawSource(projected, theme, timestamp);
    } else if (tile.kind === 'plant') {
      this.#drawPlant(projected, theme, powered, timestamp);
    } else if ((tile.solutionMask & (tile.solutionMask - 1)) === 0) {
      this.#drawTerminalCap(projected, theme, powered);
    }

    if (tile.fixed && tile.kind !== 'source') {
      this.#drawAnchor(projected, theme);
    }
    if (selected) {
      this.#drawSelection(projected, theme, timestamp, false);
    }
    if (hinted) {
      this.#drawSelection(projected, theme, timestamp, true);
    }
    this.#drawLeaks(projected, theme, timestamp);
  }

  #drawRivets(projected: ProjectedTile, theme: Theme): void {
    const context = this.#context;
    context.fillStyle = withAlpha(theme.metal, 0.78);
    for (const point of projected.polygon) {
      const x = point.x + (projected.center.x - point.x) * 0.19;
      const y = point.y + (projected.center.y - point.y) * 0.19;
      context.beginPath();
      context.arc(x, y, Math.max(1.2, projected.tileWidth * 0.018), 0, Math.PI * 2);
      context.fill();
    }
  }

  #drawChannels(projected: ProjectedTile, theme: Theme, timestamp: number, powered: boolean): void {
    const context = this.#context;
    const displayTurns = this.#displayTurns.get(projected.tile.id) ?? projected.tile.visualTurns;
    const localRotation = displayTurns * (Math.PI / 2);
    const viewRotation = this.#viewTurns * (Math.PI / 2);
    const baseDirections = directionVectors(projected.tile.baseMask);
    const endpoints = baseDirections.map((vector) => {
      const local = rotateVector(vector.x, vector.y, localRotation);
      const screenVector = projectVector(local.x, local.y, viewRotation, projected.tileWidth, projected.tileHeight);
      return {
        x: projected.center.x + screenVector.x * 0.43,
        y: projected.center.y + screenVector.y * 0.43,
      };
    });

    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const endpoint of endpoints) {
      context.strokeStyle = 'rgba(4, 18, 18, 0.78)';
      context.lineWidth = Math.max(7, projected.tileWidth * 0.13);
      context.beginPath();
      context.moveTo(projected.center.x, projected.center.y);
      context.lineTo(endpoint.x, endpoint.y);
      context.stroke();

      context.strokeStyle = powered ? withAlpha(theme.glow, this.#highContrast ? 1 : 0.78) : withAlpha(theme.metal, 0.72);
      context.lineWidth = Math.max(2.5, projected.tileWidth * 0.052);
      context.beginPath();
      context.moveTo(projected.center.x, projected.center.y);
      context.lineTo(endpoint.x, endpoint.y);
      context.stroke();

      if (powered) {
        context.save();
        context.shadowColor = theme.glow;
        context.shadowBlur = projected.tileWidth * 0.18;
        context.strokeStyle = withAlpha(theme.glow, 0.34);
        context.lineWidth = Math.max(4, projected.tileWidth * 0.085);
        context.beginPath();
        context.moveTo(projected.center.x, projected.center.y);
        context.lineTo(endpoint.x, endpoint.y);
        context.stroke();
        context.restore();

        if (!this.#reducedMotion) {
          const phase = (timestamp * 0.0012 + hashSeed(`${projected.tile.id}:${endpoint.x}`) * 0.000001) % 1;
          const pulseX = projected.center.x + (endpoint.x - projected.center.x) * phase;
          const pulseY = projected.center.y + (endpoint.y - projected.center.y) * phase;
          context.fillStyle = '#ffffff';
          context.beginPath();
          context.arc(pulseX, pulseY, Math.max(1.5, projected.tileWidth * 0.025), 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  }

  #drawGear(projected: ProjectedTile, theme: Theme, powered: boolean, timestamp: number): void {
    const context = this.#context;
    const radius = Math.max(7, projected.tileWidth * 0.115);
    const rotation = (this.#displayTurns.get(projected.tile.id) ?? 0) * (Math.PI / 2) + (powered && !this.#reducedMotion ? timestamp * 0.00018 : 0);
    context.save();
    context.translate(projected.center.x, projected.center.y);
    context.rotate(rotation);
    context.strokeStyle = powered ? theme.glow : theme.metal;
    context.lineWidth = Math.max(2, projected.tileWidth * 0.025);
    for (let index = 0; index < 8; index += 1) {
      context.rotate(Math.PI / 4);
      context.beginPath();
      context.moveTo(radius * 0.88, 0);
      context.lineTo(radius * 1.28, 0);
      context.stroke();
    }
    context.fillStyle = powered ? withAlpha(theme.glow, 0.72) : withAlpha(theme.metal, 0.82);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(8, 25, 25, 0.88)';
    context.beginPath();
    context.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawSource(projected: ProjectedTile, theme: Theme, timestamp: number): void {
    const context = this.#context;
    const pulse = this.#reducedMotion ? 1 : 0.88 + Math.sin(timestamp * 0.003) * 0.12;
    const y = projected.center.y - projected.tileHeight * 0.55;
    const radius = projected.tileWidth * 0.17 * pulse;
    context.save();
    context.shadowColor = theme.glow;
    context.shadowBlur = projected.tileWidth * 0.42;
    const gradient = context.createRadialGradient(projected.center.x - radius * 0.3, y - radius * 0.35, 0, projected.center.x, y, radius);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.35, theme.glow);
    gradient.addColorStop(1, withAlpha(theme.glow, 0.08));
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(projected.center.x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();

    context.strokeStyle = withAlpha(theme.metal, 0.9);
    context.lineWidth = Math.max(2, projected.tileWidth * 0.025);
    context.beginPath();
    context.ellipse(projected.center.x, projected.center.y - projected.tileHeight * 0.2, radius * 1.28, radius * 0.5, 0, 0, Math.PI * 2);
    context.stroke();
  }

  #drawPlant(projected: ProjectedTile, theme: Theme, powered: boolean, timestamp: number): void {
    const context = this.#context;
    const sway = this.#reducedMotion ? 0 : Math.sin(timestamp * 0.0017 + hashSeed(projected.tile.id)) * projected.tileWidth * 0.018;
    const baseX = projected.center.x;
    const baseY = projected.center.y - projected.tileHeight * 0.12;
    const height = projected.tileWidth * (powered ? 0.42 : 0.31);
    const bloom = powered ? 1 : 0.45;

    context.fillStyle = '#6b4d35';
    context.beginPath();
    context.moveTo(baseX - projected.tileWidth * 0.11, baseY - projected.tileHeight * 0.05);
    context.lineTo(baseX + projected.tileWidth * 0.11, baseY - projected.tileHeight * 0.05);
    context.lineTo(baseX + projected.tileWidth * 0.075, baseY + projected.tileHeight * 0.22);
    context.lineTo(baseX - projected.tileWidth * 0.075, baseY + projected.tileHeight * 0.22);
    context.closePath();
    context.fill();
    context.strokeStyle = withAlpha(theme.metal, 0.82);
    context.lineWidth = Math.max(1, projected.tileWidth * 0.018);
    context.stroke();

    context.strokeStyle = powered ? '#89e17d' : '#5e8d66';
    context.lineWidth = Math.max(2, projected.tileWidth * 0.035);
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(baseX, baseY);
    context.quadraticCurveTo(baseX + sway * 0.25, baseY - height * 0.5, baseX + sway, baseY - height);
    context.stroke();

    this.#drawLeaf(baseX + sway * 0.35, baseY - height * 0.45, -0.62, projected.tileWidth * 0.12, powered);
    this.#drawLeaf(baseX + sway * 0.62, baseY - height * 0.67, 0.58, projected.tileWidth * 0.11, powered);

    const flowerX = baseX + sway;
    const flowerY = baseY - height;
    const petals = projected.tile.plantKind === 'lotus' ? 7 : projected.tile.plantKind === 'orchid' ? 5 : 6;
    const petalRadius = projected.tileWidth * 0.085 * bloom;
    context.save();
    context.translate(flowerX, flowerY);
    context.rotate(hashSeed(projected.tile.id) * 0.00001 + (powered && !this.#reducedMotion ? timestamp * 0.00008 : 0));
    for (let index = 0; index < petals; index += 1) {
      context.rotate((Math.PI * 2) / petals);
      context.fillStyle = plantColor(projected.tile.plantKind ?? 'aster', index, powered, theme);
      context.beginPath();
      context.ellipse(petalRadius * 0.75, 0, petalRadius, petalRadius * 0.5, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = powered ? theme.accent : '#a28863';
    context.beginPath();
    context.arc(0, 0, petalRadius * 0.45, 0, Math.PI * 2);
    context.fill();
    if (powered) {
      context.shadowColor = theme.glow;
      context.shadowBlur = projected.tileWidth * 0.22;
      context.strokeStyle = withAlpha(theme.glow, 0.7);
      context.lineWidth = 1;
      context.beginPath();
      context.arc(0, 0, petalRadius * 1.45, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  #drawLeaf(x: number, y: number, angle: number, size: number, powered: boolean): void {
    const context = this.#context;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = powered ? '#7ddf78' : '#50785b';
    context.beginPath();
    context.ellipse(size * 0.45, 0, size, size * 0.42, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  #drawTerminalCap(projected: ProjectedTile, theme: Theme, powered: boolean): void {
    const context = this.#context;
    const radius = projected.tileWidth * 0.055;
    context.fillStyle = powered ? theme.glow : theme.metal;
    context.beginPath();
    context.arc(projected.center.x, projected.center.y - radius * 0.15, radius, 0, Math.PI * 2);
    context.fill();
  }

  #drawAnchor(projected: ProjectedTile, theme: Theme): void {
    const context = this.#context;
    const x = projected.center.x + projected.tileWidth * 0.25;
    const y = projected.center.y - projected.tileHeight * 0.12;
    context.strokeStyle = withAlpha(theme.metal, 0.95);
    context.lineWidth = Math.max(1.5, projected.tileWidth * 0.022);
    context.beginPath();
    context.arc(x, y, projected.tileWidth * 0.045, Math.PI, 0);
    context.stroke();
    context.fillStyle = withAlpha(theme.metal, 0.9);
    context.fillRect(x - projected.tileWidth * 0.055, y, projected.tileWidth * 0.11, projected.tileWidth * 0.085);
  }

  #drawSelection(projected: ProjectedTile, theme: Theme, timestamp: number, hint: boolean): void {
    const context = this.#context;
    const pulse = this.#reducedMotion ? 1 : 1 + Math.sin(timestamp * 0.006) * 0.07;
    context.save();
    context.strokeStyle = hint ? theme.accent : '#ffffff';
    context.shadowColor = hint ? theme.accent : theme.glow;
    context.shadowBlur = projected.tileWidth * 0.22;
    context.lineWidth = Math.max(2, projected.tileWidth * (hint ? 0.038 : 0.027));
    context.beginPath();
    context.ellipse(
      projected.center.x,
      projected.center.y,
      projected.tileWidth * 0.46 * pulse,
      projected.tileHeight * 0.52 * pulse,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.restore();
  }

  #drawLeaks(projected: ProjectedTile, theme: Theme, timestamp: number): void {
    const leaks = this.#analysis?.leaks.filter((leak) => leak.tileId === projected.tile.id) ?? [];
    if (leaks.length === 0) {
      return;
    }
    const mask = currentMask(projected.tile);
    for (const leak of leaks) {
      if ((mask & leak.direction) === 0) {
        continue;
      }
      const worldVector = directionVector(leak.direction);
      const screenVector = projectVector(worldVector.x, worldVector.y, this.#viewTurns * (Math.PI / 2), projected.tileWidth, projected.tileHeight);
      const endpoint = {
        x: projected.center.x + screenVector.x * 0.42,
        y: projected.center.y + screenVector.y * 0.42,
      };
      const pulse = this.#reducedMotion ? 1 : 0.65 + Math.sin(timestamp * 0.009 + endpoint.x) * 0.35;
      this.#context.fillStyle = this.#highContrast ? '#ffeb3b' : withAlpha(theme.accent, 0.65 + pulse * 0.25);
      this.#context.beginPath();
      this.#context.arc(endpoint.x, endpoint.y, Math.max(1.3, projected.tileWidth * 0.025 * pulse), 0, Math.PI * 2);
      this.#context.fill();
    }
  }

  #drawParticles(): void {
    const context = this.#context;
    for (const particle of this.#particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = `hsla(${particle.hue}, 78%, 72%, ${alpha})`;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      context.fill();
    }
  }

  #createPollen(): void {
    const random = mulberry32(0x88ad13);
    this.#pollen = Array.from({ length: 48 }, () => ({
      x: random(),
      y: random(),
      speed: 0.006 + random() * 0.022,
      phase: random() * Math.PI * 2,
      size: 0.5 + random() * 1.6,
    }));
  }
}

function projectIso(x: number, y: number, cos: number, sin: number, tileWidth: number, tileHeight: number): Point {
  const rotatedX = x * cos - y * sin;
  const rotatedY = x * sin + y * cos;
  return {
    x: (rotatedX - rotatedY) * tileWidth * 0.5,
    y: (rotatedX + rotatedY) * tileHeight * 0.5,
  };
}

function projectVector(x: number, y: number, viewRotation: number, tileWidth: number, tileHeight: number): Point {
  return projectIso(x, y, Math.cos(viewRotation), Math.sin(viewRotation), tileWidth, tileHeight);
}

function addOrigin(point: Point, originX: number, originY: number): Point {
  return { x: point.x + originX, y: point.y + originY };
}

function pointBounds(points: readonly Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, maxX, minY, maxY };
}

function fillPolygon(context: CanvasRenderingContext2D, points: readonly Point[], fill: string | CanvasGradient): void {
  if (points.length === 0) {
    return;
  }
  context.fillStyle = fill;
  context.beginPath();
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)));
  context.closePath();
  context.fill();
}

function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index] as Point;
    const previousPoint = polygon[previous] as Point;
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y + Number.EPSILON) +
          currentPoint.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function directionVectors(mask: number): Point[] {
  const result: Point[] = [];
  for (const direction of DIRECTIONS) {
    if ((mask & direction.bit) !== 0) {
      result.push({ x: direction.dx, y: direction.dy });
    }
  }
  return result;
}

function directionVector(direction: DirectionBit): Point {
  switch (direction) {
    case Direction.North:
      return { x: 0, y: -1 };
    case Direction.East:
      return { x: 1, y: 0 };
    case Direction.South:
      return { x: 0, y: 1 };
    case Direction.West:
      return { x: -1, y: 0 };
  }
}

function rotateVector(x: number, y: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return hex;
  }
  const expanded = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  const red = Number.parseInt(expanded.slice(1, 3), 16);
  const green = Number.parseInt(expanded.slice(3, 5), 16);
  const blue = Number.parseInt(expanded.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function lighten(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) {
    return hex;
  }
  const parts = [1, 3, 5].map((start) => Math.min(255, Number.parseInt(hex.slice(start, start + 2), 16) + amount));
  return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
}

function plantColor(kind: string, index: number, powered: boolean, theme: Theme): string {
  if (!powered) {
    return index % 2 === 0 ? '#8b7b76' : '#716a6f';
  }
  const colors: Record<string, readonly string[]> = {
    aster: ['#f0d2ff', '#cba8f4'],
    orchid: ['#ffc4e5', '#e494c5'],
    lotus: ['#ffd0df', '#fff0f2'],
    fern: ['#b6f38f', '#72d67e'],
    rose: ['#ffafaa', '#ffcec0'],
  };
  const palette = colors[kind] ?? [theme.accent, theme.glow];
  return palette[index % palette.length] as string;
}

function mulberry32(initial: number): () => number {
  let state = initial >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
