export type GameMode = 'campaign' | 'daily' | 'zen';
export type Screen = 'loading' | 'menu' | 'map' | 'playing' | 'complete';
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it' | 'ru';
export type QualityLevel = 'auto' | 'high' | 'balanced';
export type PlantKind = 'lumen-orchid' | 'moonbell' | 'sun-dahlia' | 'mist-lily' | 'ember-bloom';

export const NORTH = 1 as const;
export const EAST = 2 as const;
export const SOUTH = 4 as const;
export const WEST = 8 as const;
export type DirectionBit = typeof NORTH | typeof EAST | typeof SOUTH | typeof WEST;

export const DIRECTIONS: readonly {
  readonly bit: DirectionBit;
  readonly opposite: DirectionBit;
  readonly dx: number;
  readonly dy: number;
}[] = [
  { bit: NORTH, opposite: SOUTH, dx: 0, dy: -1 },
  { bit: EAST, opposite: WEST, dx: 1, dy: 0 },
  { bit: SOUTH, opposite: NORTH, dx: 0, dy: 1 },
  { bit: WEST, opposite: EAST, dx: -1, dy: 0 },
] as const;

export interface TileState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly baseMask: number;
  readonly kind: 'source' | 'plant' | 'pipe';
  readonly fixed: boolean;
  readonly plantKind?: PlantKind;
  readonly solutionRotation: number;
  rotation: number;
  visualTurns: number;
}

export interface TutorialDefinition {
  readonly title: string;
  readonly body: string;
  readonly targetId: string;
  readonly step: number;
}

export interface PuzzleDefinition {
  readonly seed: string;
  readonly mode: GameMode;
  readonly level: number;
  readonly width: number;
  readonly height: number;
  readonly sourceId: string;
  readonly tiles: TileState[];
  readonly idealMoves: number;
  readonly theme: number;
  readonly tutorial?: TutorialDefinition;
}

export interface LeakPoint {
  readonly tileId: string;
  readonly direction: DirectionBit;
  readonly powered: boolean;
}

export interface BoardAnalysis {
  readonly powered: ReadonlySet<string>;
  readonly leaks: readonly LeakPoint[];
  readonly poweredPlants: number;
  readonly totalPlants: number;
  readonly solved: boolean;
  readonly progress: number;
}

export interface HintSuggestion {
  readonly tileId: string;
  readonly rotations: 1 | 2 | 3;
}

export interface CompletionStats {
  readonly score: number;
  readonly stars: 1 | 2 | 3;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly efficiency: number;
}

export interface GameSettings {
  language: SupportedLanguage;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  quality: QualityLevel;
}

export interface ActiveRunSnapshot {
  seed: string;
  mode: GameMode;
  level: number;
  rotations: number[];
  moves: number;
  hintsUsed: number;
  elapsedMs: number;
}

export interface PersistedProgress {
  schema: 4;
  campaignLevel: number;
  totalScore: number;
  totalStars: number;
  bestScore: number;
  streak: number;
  lastDailyDate?: string;
  dailyBest: Record<string, number>;
  specimens: PlantKind[];
  settings: GameSettings;
  activeRun?: ActiveRunSnapshot;
}
