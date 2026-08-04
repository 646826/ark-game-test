export const NORTH = 1 as const;
export const EAST = 2 as const;
export const SOUTH = 4 as const;
export const WEST = 8 as const;
export type DirectionBit = typeof NORTH | typeof EAST | typeof SOUTH | typeof WEST;
export const DIRECTIONS = [NORTH, EAST, SOUTH, WEST] as const;

export type GameMode = 'campaign' | 'daily' | 'zen';
export type TileKind = 'source' | 'gear' | 'plant';
export type PlantKind = 'lumen' | 'orchid' | 'starbell' | 'ember' | 'moonfern';
export type QualityMode = 'auto' | 'high' | 'balanced' | 'low';
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it';

export interface DifficultyConfig {
  readonly width: number;
  readonly height: number;
  readonly holes: number;
  readonly fixedRatio: number;
  readonly tier: 'Seedling' | 'Gardener' | 'Botanist' | 'Conservator';
}

export interface TileState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly baseMask: number;
  readonly kind: TileKind;
  readonly plantKind?: PlantKind;
  readonly fixed: boolean;
  rotation: number;
  visualTurns: number;
}

export interface PuzzleDefinition {
  readonly seed: string;
  readonly mode: GameMode;
  readonly level: number;
  readonly width: number;
  readonly height: number;
  readonly tiles: TileState[];
  readonly sourceId: string;
  readonly config: DifficultyConfig;
  readonly parMoves: number;
  readonly tutorial?: 1 | 2 | 3;
}

export interface Leak {
  readonly tileId: string;
  readonly direction: DirectionBit;
}

export interface BoardAnalysis {
  readonly powered: ReadonlySet<string>;
  readonly poweredPlants: number;
  readonly totalPlants: number;
  readonly leaks: readonly Leak[];
  readonly solved: boolean;
}

export interface HintSuggestion {
  readonly tileId: string;
  readonly rotations: number;
  readonly reason: 'Reconnect' | 'Seal_Leak' | 'Bloom_Path';
}

export interface CompletionStats {
  readonly score: number;
  readonly stars: 1 | 2 | 3;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly parMoves: number;
}

export interface GameSettings {
  language: SupportedLanguage;
  sound: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  quality: QualityMode;
  tutorialHints: boolean;
}

export interface ActiveRunSnapshot {
  readonly seed: string;
  readonly mode: GameMode;
  readonly level: number;
  readonly rotations: number[];
  readonly moves: number;
  readonly elapsedMs: number;
}

export interface PersistedProgress {
  version: 3;
  campaignLevel: number;
  totalScore: number;
  totalStars: number;
  completedLevels: number;
  streak: number;
  lastDailyDate?: string;
  bestDaily: Record<string, number>;
  unlockedSpecimens: PlantKind[];
  settings: GameSettings;
  activeRun?: ActiveRunSnapshot;
}
