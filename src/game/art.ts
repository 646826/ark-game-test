import type { PlantKind } from '../core/types.js';

export interface ArtPalette {
  readonly glass: string;
  readonly glassLight: string;
  readonly edge: string;
  readonly side: string;
  readonly brass: string;
  readonly brassLight: string;
  readonly aqua: string;
  readonly aquaSoft: string;
  readonly ink: string;
  readonly accent: string;
}

type ArtQuality = 'high' | 'balanced';

interface ArtDimensions {
  readonly width: number;
  readonly height: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export interface CachedArt {
  readonly image: HTMLCanvasElement;
  readonly dimensions: ArtDimensions;
}

const PLANT_ART: Record<PlantKind, readonly [string, string, string, string]> = {
  'lumen-orchid': ['#6bbcff', '#d9f6ff', '#70fff0', '#406bff'],
  moonbell: ['#a58cff', '#f1e9ff', '#7ecfff', '#7358d7'],
  'sun-dahlia': ['#ff7f98', '#ffd07a', '#fff4bd', '#e45c72'],
  'mist-lily': ['#f7ffff', '#b8eeff', '#86ffd1', '#83b6ca'],
  'ember-bloom': ['#ff8f48', '#ffd15a', '#ff6575', '#b94432'],
};

/**
 * Draw-once cache for the expensive ornamental pieces used by every tile.
 * Dynamic flow, power, selection and motion remain in the renderer; the dense
 * brass/glass illustration is rasterized once per theme and size-independent.
 */
export class ConservatoryArtCache {
  readonly #cache = new Map<string, CachedArt>();

  public clear(): void {
    this.#cache.clear();
  }

  public platform(themeIndex: number, palette: ArtPalette, quality: ArtQuality, variant: number): CachedArt {
    const key = `platform:${themeIndex}:${quality}:${variant & 3}`;
    return this.#get(key, () => drawPlatform(palette, quality, variant & 3));
  }

  public mechanism(themeIndex: number, palette: ArtPalette, quality: ArtQuality, variant: number): CachedArt {
    const key = `mechanism:${themeIndex}:${quality}:${variant & 3}`;
    return this.#get(key, () => drawMechanism(palette, quality, variant & 3));
  }

  public source(themeIndex: number, palette: ArtPalette, quality: ArtQuality): CachedArt {
    const key = `source:${themeIndex}:${quality}`;
    return this.#get(key, () => drawSourceBase(palette, quality));
  }

  public planter(themeIndex: number, palette: ArtPalette, quality: ArtQuality, kind: PlantKind): CachedArt {
    const key = `planter:${themeIndex}:${quality}:${kind}`;
    return this.#get(key, () => drawPlanter(palette, quality, kind));
  }

  #get(key: string, create: () => CachedArt): CachedArt {
    const existing = this.#cache.get(key);
    if (existing) return existing;
    const created = create();
    this.#cache.set(key, created);
    return created;
  }
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d', { alpha: true });
  if (!context) throw new Error('Canvas 2D is unavailable for art cache.');
  context.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
  return [element, context];
}

function drawPlatform(palette: ArtPalette, quality: ArtQuality, variant: number): CachedArt {
  const dimensions: ArtDimensions = { width: 620, height: 440, anchorX: 310, anchorY: 178 };
  const [image, context] = canvas(dimensions.width, dimensions.height);
  const center = { x: dimensions.anchorX, y: dimensions.anchorY };
  const width = 500;
  const height = 250;
  const extrusion = 92;
  const diamond = points(center.x, center.y, width, height);
  const leftSide = [diamond[3], diamond[2], { x: diamond[2].x, y: diamond[2].y + extrusion }, { x: diamond[3].x, y: diamond[3].y + extrusion }];
  const rightSide = [diamond[1], diamond[2], { x: diamond[2].x, y: diamond[2].y + extrusion }, { x: diamond[1].x, y: diamond[1].y + extrusion }];

  context.save();
  context.shadowColor = 'rgba(0,0,0,.72)';
  context.shadowBlur = quality === 'high' ? 32 : 18;
  context.shadowOffsetY = 24;
  polygon(context, leftSide);
  context.fillStyle = '#031214';
  context.fill();
  polygon(context, rightSide);
  context.fill();
  context.restore();

  const leftGradient = context.createLinearGradient(diamond[3].x, diamond[3].y, diamond[2].x, diamond[2].y + extrusion);
  leftGradient.addColorStop(0, mix(palette.side, '#183f3a', 0.36));
  leftGradient.addColorStop(0.42, palette.side);
  leftGradient.addColorStop(1, '#020d10');
  polygon(context, leftSide);
  context.fillStyle = leftGradient;
  context.fill();

  const rightGradient = context.createLinearGradient(diamond[1].x, diamond[1].y, diamond[2].x, diamond[2].y + extrusion);
  rightGradient.addColorStop(0, mix(palette.side, '#28544c', 0.42));
  rightGradient.addColorStop(0.55, palette.side);
  rightGradient.addColorStop(1, '#020b0d');
  polygon(context, rightSide);
  context.fillStyle = rightGradient;
  context.fill();

  // Side brass rails and inset panels.
  context.lineJoin = 'round';
  for (const side of [leftSide, rightSide]) {
    polygon(context, side);
    context.strokeStyle = 'rgba(250,213,126,.26)';
    context.lineWidth = 4;
    context.stroke();
  }
  const rail = context.createLinearGradient(0, 0, dimensions.width, dimensions.height);
  rail.addColorStop(0, '#4c2b15');
  rail.addColorStop(0.2, palette.brassLight);
  rail.addColorStop(0.48, palette.brass);
  rail.addColorStop(0.78, '#6b421f');
  rail.addColorStop(1, palette.brassLight);
  context.strokeStyle = rail;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(diamond[3].x + 8, diamond[3].y + 24);
  context.lineTo(diamond[2].x, diamond[2].y + extrusion - 13);
  context.lineTo(diamond[1].x - 8, diamond[1].y + 24);
  context.stroke();

  // Top glass plate.
  const top = context.createLinearGradient(center.x - 180, center.y - 130, center.x + 190, center.y + 145);
  top.addColorStop(0, mix(palette.glassLight, '#75b7a7', 0.24));
  top.addColorStop(0.22, palette.glassLight);
  top.addColorStop(0.52, palette.glass);
  top.addColorStop(0.78, mix(palette.glass, palette.ink, 0.58));
  top.addColorStop(1, palette.ink);
  polygon(context, diamond);
  context.fillStyle = top;
  context.fill();

  // Double brass bevel.
  polygon(context, diamond);
  context.strokeStyle = '#2e190e';
  context.lineWidth = 13;
  context.stroke();
  polygon(context, diamond);
  context.strokeStyle = rail;
  context.lineWidth = 7;
  context.stroke();
  polygon(context, insetPoints(center.x, center.y, width * 0.92, height * 0.88));
  context.strokeStyle = 'rgba(255,232,165,.62)';
  context.lineWidth = 2.4;
  context.stroke();
  polygon(context, insetPoints(center.x, center.y, width * 0.82, height * 0.72));
  context.strokeStyle = 'rgba(5,22,22,.72)';
  context.lineWidth = 9;
  context.stroke();
  polygon(context, insetPoints(center.x, center.y, width * 0.81, height * 0.70));
  context.strokeStyle = 'rgba(230,255,247,.16)';
  context.lineWidth = 2;
  context.stroke();

  context.save();
  polygon(context, insetPoints(center.x, center.y, width * 0.80, height * 0.69));
  context.clip();

  // Botanical etched pattern. Dense enough to read as crafted material, subtle enough
  // not to compete with the playable network.
  context.lineWidth = quality === 'high' ? 1.25 : 1;
  context.strokeStyle = 'rgba(190,255,232,.10)';
  const phase = variant * 0.7;
  for (let index = -5; index <= 5; index += 1) {
    const y = center.y + index * 16;
    context.beginPath();
    context.moveTo(center.x - 210, y + Math.sin(index + phase) * 6);
    context.bezierCurveTo(center.x - 75, y - 28, center.x + 72, y + 26, center.x + 210, y - Math.cos(index + phase) * 6);
    context.stroke();
  }
  context.strokeStyle = 'rgba(242,207,118,.105)';
  for (let index = 0; index < (quality === 'high' ? 18 : 10); index += 1) {
    const angle = (index / 18) * Math.PI * 2 + phase;
    const radius = 24 + (index % 4) * 18;
    context.beginPath();
    context.ellipse(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius * 0.48, 8 + index % 3 * 3, 4 + index % 2 * 2, angle, 0, Math.PI * 2);
    context.stroke();
  }

  // Hairline scratches and mineral specks create a painted, not vector-flat, surface.
  let seed = 971 + variant * 137;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  const specks = quality === 'high' ? 150 : 64;
  for (let index = 0; index < specks; index += 1) {
    const x = 70 + random() * 480;
    const y = 72 + random() * 220;
    context.fillStyle = random() > 0.82 ? 'rgba(255,220,130,.16)' : 'rgba(200,255,241,.07)';
    context.fillRect(x, y, random() * 2.2 + 0.4, random() * 1.4 + 0.3);
  }
  context.restore();

  // Directional glass sheen.
  context.save();
  polygon(context, diamond);
  context.clip();
  const sheen = context.createLinearGradient(110, 72, 510, 286);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.43, 'rgba(232,255,248,.03)');
  sheen.addColorStop(0.51, 'rgba(255,255,255,.21)');
  sheen.addColorStop(0.59, 'rgba(232,255,248,.025)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = sheen;
  context.fillRect(60, 40, 520, 310);
  context.restore();

  // Ornate corner plates and screws.
  for (const point of insetPoints(center.x, center.y, width * 0.78, height * 0.64)) {
    drawCornerPlate(context, point.x, point.y, palette, quality);
  }

  // Side panel fasteners.
  const sideDots = [
    [diamond[3].x + 52, diamond[3].y + 42], [diamond[2].x - 52, diamond[2].y + extrusion - 24],
    [diamond[1].x - 52, diamond[1].y + 42], [diamond[2].x + 52, diamond[2].y + extrusion - 24],
  ] as const;
  for (const [x, y] of sideDots) drawScrew(context, x, y, 8, palette.brassLight, palette.brass);

  return { image, dimensions };
}

function drawMechanism(palette: ArtPalette, quality: ArtQuality, variant: number): CachedArt {
  const dimensions: ArtDimensions = { width: 360, height: 360, anchorX: 180, anchorY: 186 };
  const [image, context] = canvas(dimensions.width, dimensions.height);
  const cx = dimensions.anchorX;
  const cy = dimensions.anchorY;
  const radius = 94;
  const type = variant & 3;

  context.save();
  context.shadowColor = 'rgba(0,0,0,.76)';
  context.shadowBlur = quality === 'high' ? 26 : 17;
  context.shadowOffsetY = 15;
  context.fillStyle = '#061617';
  context.beginPath();
  context.ellipse(cx, cy + 19, radius * 1.14, radius * 0.67, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Every regulator begins with the same weighted brass pedestal so its hit area
  // remains visually stable, while the upper mechanism varies by network role.
  const pedestal = context.createRadialGradient(cx - 31, cy - 34, 5, cx, cy, radius * 1.12);
  pedestal.addColorStop(0, '#fff0ad');
  pedestal.addColorStop(0.19, palette.brassLight);
  pedestal.addColorStop(0.43, palette.brass);
  pedestal.addColorStop(0.68, '#70431f');
  pedestal.addColorStop(0.86, '#24130b');
  pedestal.addColorStop(1, palette.brassLight);
  context.fillStyle = pedestal;
  context.beginPath();
  context.ellipse(cx, cy + 14, radius * 1.09, radius * 0.63, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,237,181,.77)';
  context.lineWidth = 4;
  context.stroke();

  const toothCounts = [18, 12, 10, 8] as const;
  const toothCount = toothCounts[type] as number;
  context.save();
  context.translate(cx, cy);
  context.rotate(type * Math.PI / 24);
  for (let index = 0; index < toothCount; index += 1) {
    context.save();
    context.rotate(index * Math.PI * 2 / toothCount);
    const alternating = index % 2 === 0;
    const tooth = context.createLinearGradient(radius * 0.70, -15, radius * 1.22, 15);
    tooth.addColorStop(0, '#452414');
    tooth.addColorStop(0.24, palette.brassLight);
    tooth.addColorStop(0.57, palette.brass);
    tooth.addColorStop(0.82, '#6a3b1c');
    tooth.addColorStop(1, '#2f190f');
    context.fillStyle = tooth;
    context.strokeStyle = 'rgba(255,238,186,.58)';
    context.lineWidth = 2;

    if (type === 0) {
      // Fine clock gear: many compact rectangular teeth.
      roundedRect(context, radius * 0.74, -10.5, radius * 0.49, 21, 5);
      context.fill();
      context.stroke();
    } else if (type === 1) {
      // Straight-flow governor: broad turbine paddles.
      context.beginPath();
      context.moveTo(radius * 0.70, -10);
      context.quadraticCurveTo(radius * 0.93, -21, radius * 1.16, -11);
      context.quadraticCurveTo(radius * 1.25, 0, radius * 1.16, 11);
      context.quadraticCurveTo(radius * 0.93, 21, radius * 0.70, 10);
      context.closePath();
      context.fill();
      context.stroke();
    } else if (type === 2) {
      // Elbow escapement: tapered jewel-like teeth.
      const outer = alternating ? radius * 1.24 : radius * 1.13;
      context.beginPath();
      context.moveTo(radius * 0.71, -11);
      context.lineTo(outer, -7);
      context.lineTo(outer + 7, 0);
      context.lineTo(outer, 7);
      context.lineTo(radius * 0.71, 11);
      context.closePath();
      context.fill();
      context.stroke();
    } else {
      // Multi-way distributor: substantial cardinal clamps.
      roundedRect(context, radius * 0.69, alternating ? -15 : -11, radius * (alternating ? 0.58 : 0.47), alternating ? 30 : 22, 6);
      context.fill();
      context.stroke();
      if (alternating) drawScrew(context, radius * 1.08, 0, 4.6, palette.brassLight, '#5a3218');
    }
    context.restore();
  }
  context.restore();

  const outer = type === 1 ? radius * 0.87 : type === 3 ? radius * 0.90 : radius * 0.84;
  const innerRadius = type === 2 ? radius * 0.57 : radius * 0.62;
  drawMetalRing(context, cx, cy, outer, innerRadius, palette, quality);

  // Role-specific crown structure. These silhouettes remain legible even when the
  // board is zoomed out on a phone, avoiding a field of identical gold gears.
  context.save();
  context.translate(cx, cy);
  context.rotate(-type * Math.PI / 20);
  context.lineCap = 'round';
  if (type === 0) {
    context.strokeStyle = palette.brassLight;
    context.lineWidth = 10;
    for (let index = 0; index < 8; index += 1) {
      context.rotate(Math.PI / 4);
      context.beginPath();
      context.moveTo(radius * 0.29, 0);
      context.lineTo(radius * 0.65, 0);
      context.stroke();
      drawScrew(context, radius * 0.58, 0, 5.2, palette.brassLight, palette.brass);
    }
  } else if (type === 1) {
    // Opposing rails make straight regulators read horizontally/vertically.
    context.strokeStyle = palette.brassLight;
    context.lineWidth = 13;
    for (const angle of [0, Math.PI]) {
      context.save();
      context.rotate(angle);
      context.beginPath();
      context.moveTo(radius * 0.24, 0);
      context.lineTo(radius * 0.72, 0);
      context.stroke();
      context.restore();
    }
    context.strokeStyle = 'rgba(255,239,188,.52)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, radius * 0.73, -Math.PI * 0.36, Math.PI * 0.36);
    context.arc(0, 0, radius * 0.73, Math.PI * 0.64, Math.PI * 1.36);
    context.stroke();
    for (const x of [-radius * 0.55, radius * 0.55]) drawScrew(context, x, 0, 6, palette.brassLight, palette.brass);
  } else if (type === 2) {
    context.strokeStyle = palette.brassLight;
    context.lineWidth = 11;
    for (let index = 0; index < 3; index += 1) {
      context.rotate(Math.PI * 2 / 3);
      context.beginPath();
      context.moveTo(radius * 0.25, 0);
      context.quadraticCurveTo(radius * 0.48, -radius * 0.17, radius * 0.69, 0);
      context.stroke();
      drawScrew(context, radius * 0.60, 0, 5.8, palette.brassLight, palette.brass);
    }
    context.strokeStyle = 'rgba(159,255,230,.25)';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(0, 0, radius * 0.71, 0, Math.PI * 1.48);
    context.stroke();
  } else {
    context.strokeStyle = palette.brassLight;
    context.lineWidth = 14;
    for (let index = 0; index < 4; index += 1) {
      context.rotate(Math.PI / 2);
      context.beginPath();
      context.moveTo(radius * 0.25, 0);
      context.lineTo(radius * 0.70, 0);
      context.stroke();
      context.fillStyle = '#1b4843';
      roundedRect(context, radius * 0.52, -10, radius * 0.25, 20, 4);
      context.fill();
      context.strokeStyle = 'rgba(255,237,180,.74)';
      context.lineWidth = 2;
      context.stroke();
      context.strokeStyle = palette.brassLight;
      context.lineWidth = 14;
    }
    context.strokeStyle = 'rgba(255,237,180,.46)';
    context.lineWidth = 3;
    context.setLineDash([7, 6]);
    context.beginPath();
    context.arc(0, 0, radius * 0.74, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }
  context.restore();

  const inner = context.createRadialGradient(cx - 18, cy - 22, 0, cx, cy, radius * 0.62);
  inner.addColorStop(0, '#a9d7c8');
  inner.addColorStop(0.17, palette.glassLight);
  inner.addColorStop(0.48, palette.ink);
  inner.addColorStop(0.82, '#030c0e');
  inner.addColorStop(1, palette.brassLight);
  context.fillStyle = inner;
  context.beginPath();
  context.arc(cx, cy, radius * (type === 3 ? 0.49 : 0.46), 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 4;
  context.stroke();

  // Individually engraved dial face.
  context.save();
  context.translate(cx, cy);
  context.strokeStyle = 'rgba(216,255,244,.24)';
  context.lineWidth = 2;
  const ticks = type === 0 ? 12 : type === 1 ? 8 : type === 2 ? 6 : 16;
  for (let index = 0; index < ticks; index += 1) {
    context.rotate(Math.PI * 2 / ticks);
    context.beginPath();
    context.moveTo(radius * 0.22, 0);
    context.lineTo(radius * (index % 2 === 0 ? 0.38 : 0.33), 0);
    context.stroke();
  }
  if (type === 2) {
    context.strokeStyle = 'rgba(248,207,111,.45)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-radius * 0.28, radius * 0.18);
    context.lineTo(0, -radius * 0.27);
    context.lineTo(radius * 0.30, radius * 0.16);
    context.stroke();
  }
  context.restore();
  drawScrew(context, cx, cy, type === 3 ? 12 : 10, palette.brassLight, '#5d351a');

  return { image, dimensions };
}

function drawSourceBase(palette: ArtPalette, quality: ArtQuality): CachedArt {
  const dimensions: ArtDimensions = { width: 420, height: 430, anchorX: 210, anchorY: 250 };
  const [image, context] = canvas(dimensions.width, dimensions.height);
  const cx = dimensions.anchorX;
  const cy = dimensions.anchorY;
  const radius = 88;

  context.save();
  context.shadowColor = 'rgba(0,0,0,.72)';
  context.shadowBlur = 24;
  context.shadowOffsetY = 18;
  context.fillStyle = '#07191a';
  context.beginPath();
  context.ellipse(cx, cy + 30, radius * 1.25, radius * 0.66, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  // Layered pedestal and rune plate.
  const base = context.createRadialGradient(cx - 34, cy - 20, 4, cx, cy, radius * 1.25);
  base.addColorStop(0, palette.brassLight);
  base.addColorStop(0.26, palette.brass);
  base.addColorStop(0.58, '#6c421e');
  base.addColorStop(0.84, '#24140c');
  base.addColorStop(1, palette.brassLight);
  context.fillStyle = base;
  context.beginPath();
  context.ellipse(cx, cy + 16, radius * 1.18, radius * 0.64, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,234,174,.72)';
  context.lineWidth = 5;
  context.stroke();
  drawMetalRing(context, cx, cy, radius * 0.88, radius * 0.62, palette, quality);

  // Cage supports.
  context.save();
  context.translate(cx, cy - 4);
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 8;
  context.lineCap = 'round';
  for (let index = 0; index < 4; index += 1) {
    context.rotate(Math.PI / 2);
    context.beginPath();
    context.moveTo(radius * 0.47, 0);
    context.quadraticCurveTo(radius * 0.88, -44, radius * 0.95, -88);
    context.stroke();
  }
  context.restore();

  // Fine filigree halo.
  context.strokeStyle = 'rgba(255,225,151,.52)';
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(cx, cy - 66, radius * 0.78, radius * 0.42, 0, 0, Math.PI * 2);
  context.stroke();
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    drawScrew(context, cx + Math.cos(angle) * radius * 0.82, cy + Math.sin(angle) * radius * 0.47, 5, palette.brassLight, palette.brass);
  }

  return { image, dimensions };
}

function drawPlanter(palette: ArtPalette, quality: ArtQuality, kind: PlantKind): CachedArt {
  const dimensions: ArtDimensions = { width: 340, height: 420, anchorX: 170, anchorY: 312 };
  const [image, context] = canvas(dimensions.width, dimensions.height);
  const [petal, petalLight, glow, petalDark] = PLANT_ART[kind];
  const cx = dimensions.anchorX;
  const potY = dimensions.anchorY - 28;
  const potW = 114;
  const potH = 92;

  // Ground shadow.
  context.save();
  context.fillStyle = 'rgba(0,0,0,.58)';
  if (quality === 'high' && 'filter' in context) context.filter = 'blur(10px)';
  context.beginPath();
  context.ellipse(cx, potY + potH * 0.75, potW * 0.68, potH * 0.34, 0, 0, Math.PI * 2);
  context.fill();
  if ('filter' in context) context.filter = 'none';
  context.restore();

  // Ceramic/brass pot.
  const pot = context.createLinearGradient(cx - potW / 2, potY, cx + potW / 2, potY + potH);
  pot.addColorStop(0, '#f3cf8a');
  pot.addColorStop(0.16, '#a36135');
  pot.addColorStop(0.38, '#6c361f');
  pot.addColorStop(0.62, '#bd7740');
  pot.addColorStop(0.84, '#4b2418');
  pot.addColorStop(1, '#e1ad64');
  context.fillStyle = pot;
  context.beginPath();
  context.moveTo(cx - potW * 0.48, potY);
  context.quadraticCurveTo(cx - potW * 0.42, potY + potH * 0.88, cx - potW * 0.28, potY + potH);
  context.quadraticCurveTo(cx, potY + potH * 1.12, cx + potW * 0.28, potY + potH);
  context.quadraticCurveTo(cx + potW * 0.42, potY + potH * 0.88, cx + potW * 0.48, potY);
  context.closePath();
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 5;
  context.stroke();

  // Rim and soil.
  const rim = context.createLinearGradient(cx - potW / 2, potY - 18, cx + potW / 2, potY + 18);
  rim.addColorStop(0, palette.brassLight);
  rim.addColorStop(0.4, palette.brass);
  rim.addColorStop(0.75, '#573018');
  rim.addColorStop(1, palette.brassLight);
  context.fillStyle = rim;
  context.beginPath();
  context.ellipse(cx, potY, potW * 0.54, 20, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,235,178,.74)';
  context.lineWidth = 3;
  context.stroke();
  context.fillStyle = '#22160f';
  context.beginPath();
  context.ellipse(cx, potY - 2, potW * 0.43, 12, 0, 0, Math.PI * 2);
  context.fill();

  // Ornamental band.
  context.strokeStyle = 'rgba(255,231,166,.72)';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(cx - potW * 0.38, potY + potH * 0.43);
  context.quadraticCurveTo(cx - potW * 0.18, potY + potH * 0.25, cx, potY + potH * 0.43);
  context.quadraticCurveTo(cx + potW * 0.18, potY + potH * 0.61, cx + potW * 0.38, potY + potH * 0.43);
  context.stroke();
  for (const offset of [-0.25, 0, 0.25]) drawScrew(context, cx + potW * offset, potY + potH * 0.43, 5, palette.brassLight, palette.brass);

  // Dense leaf crown. Flowers are added dynamically so they can bloom.
  const leafColors = ['#163d29', '#245d38', '#3e7f49', '#69a85c'];
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2 + (index % 3) * 0.16;
    const distance = 18 + (index % 5) * 6;
    const y = potY - 15 - (index % 4) * 9;
    context.save();
    context.translate(cx + Math.cos(angle) * distance * 0.58, y);
    context.rotate(angle - Math.PI / 2);
    const leaf = context.createLinearGradient(-18, 0, 18, 0);
    leaf.addColorStop(0, leafColors[index % leafColors.length] as string);
    leaf.addColorStop(0.52, leafColors[(index + 2) % leafColors.length] as string);
    leaf.addColorStop(1, '#112f21');
    context.fillStyle = leaf;
    context.beginPath();
    context.ellipse(0, 0, 22 + index % 3 * 4, 7 + index % 2 * 2, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(180,235,177,.18)';
    context.lineWidth = 1.2;
    context.stroke();
    context.restore();
  }

  // A few dormant buds give plants shape even before power arrives.
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 2 / 5 - Math.PI / 2;
    const x = cx + Math.cos(angle) * (18 + index % 2 * 9);
    const y = potY - 56 + Math.sin(angle) * 12;
    context.fillStyle = mix(petalDark, '#132d25', 0.58);
    context.beginPath();
    context.ellipse(x, y, 7, 12, angle, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = withAlpha(petalLight, 0.28);
    context.lineWidth = 1.5;
    context.stroke();
  }

  // Tiny enamel jewel.
  context.fillStyle = glow;
  context.beginPath();
  context.arc(cx, potY + potH * 0.68, 7, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = palette.brassLight;
  context.lineWidth = 3;
  context.stroke();

  return { image, dimensions };
}

function drawCornerPlate(context: CanvasRenderingContext2D, x: number, y: number, palette: ArtPalette, quality: ArtQuality): void {
  context.save();
  context.translate(x, y);
  context.rotate(Math.PI / 4);
  const plate = context.createLinearGradient(-18, -18, 18, 18);
  plate.addColorStop(0, palette.brassLight);
  plate.addColorStop(0.46, palette.brass);
  plate.addColorStop(0.75, '#5c3318');
  plate.addColorStop(1, palette.brassLight);
  context.fillStyle = plate;
  roundedRect(context, -17, -17, 34, 34, 7);
  context.fill();
  context.strokeStyle = quality === 'high' ? 'rgba(255,245,198,.75)' : 'rgba(255,238,175,.48)';
  context.lineWidth = 2;
  context.stroke();
  context.rotate(-Math.PI / 4);
  drawScrew(context, 0, 0, 5.2, palette.brassLight, '#4a2714');
  context.restore();
}

function drawMetalRing(context: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number, palette: ArtPalette, quality: ArtQuality): void {
  const ring = context.createRadialGradient(cx - outer * 0.34, cy - outer * 0.38, 0, cx, cy, outer);
  ring.addColorStop(0, '#fff0bd');
  ring.addColorStop(0.18, palette.brassLight);
  ring.addColorStop(0.42, palette.brass);
  ring.addColorStop(0.64, '#5b3519');
  ring.addColorStop(0.83, '#24140c');
  ring.addColorStop(1, palette.brassLight);
  context.fillStyle = ring;
  context.beginPath();
  context.arc(cx, cy, outer, 0, Math.PI * 2);
  context.arc(cx, cy, inner, 0, Math.PI * 2, true);
  context.fill('evenodd');
  context.strokeStyle = quality === 'high' ? 'rgba(255,239,184,.74)' : 'rgba(255,228,160,.48)';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(cx, cy, outer - 2, 0, Math.PI * 2);
  context.stroke();
}

function drawScrew(context: CanvasRenderingContext2D, x: number, y: number, radius: number, light: string, dark: string): void {
  const screw = context.createRadialGradient(x - radius * 0.35, y - radius * 0.4, 0, x, y, radius * 1.1);
  screw.addColorStop(0, '#fff3c6');
  screw.addColorStop(0.32, light);
  screw.addColorStop(0.72, dark);
  screw.addColorStop(1, '#1b0f09');
  context.fillStyle = screw;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(41,21,11,.72)';
  context.lineWidth = Math.max(1, radius * 0.22);
  context.beginPath();
  context.moveTo(x - radius * 0.52, y);
  context.lineTo(x + radius * 0.52, y);
  context.stroke();
}

function points(cx: number, cy: number, width: number, height: number): readonly [Point, Point, Point, Point] {
  return [
    { x: cx, y: cy - height / 2 },
    { x: cx + width / 2, y: cy },
    { x: cx, y: cy + height / 2 },
    { x: cx - width / 2, y: cy },
  ];
}

function insetPoints(cx: number, cy: number, width: number, height: number): readonly [Point, Point, Point, Point] {
  return points(cx, cy, width, height);
}

interface Point { readonly x: number; readonly y: number }

function polygon(context: CanvasRenderingContext2D, vertices: readonly Point[]): void {
  const first = vertices[0];
  if (!first) return;
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (let index = 1; index < vertices.length; index += 1) {
    const point = vertices[index] as Point;
    context.lineTo(point.x, point.y);
  }
  context.closePath();
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

function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const t = Math.max(0, Math.min(1, amount));
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

function withAlpha(hex: string, alpha: number): string {
  const [red, green, blue] = parseHex(hex);
  return `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, alpha))})`;
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
