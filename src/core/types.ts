export const Direction = {
  North: 1,
  East: 2,
  South: 4,
  West: 8,
} as const;

export type DirectionBit = (typeof Direction)[keyof typeof Direction];
export type GameMode = 'campaign' | 'daily' | 'zen';
export type TileKind = 'source' | 'path' | 'plant';
export type PlantKind = 'aster' | 'orchid' | 'lotus' | 'fern' | 'rose';

export interface DirectionDefinition {
  readonly bit: DirectionBit;
  readonly opposite: DirectionBit;
  readonly dx: number;
  readonly dy: number;
  readonly name: 'north' | 'east' | 'south' | 'west';
}

export const DIRECTIONS: readonly DirectionDefinition[] = [
  { bit: Direction.North, opposite: Direction.South, dx: 0, dy: -1, name: 'north' },
  { bit: Direction.East, opposite: Direction.West, dx: 1, dy: 0, name: 'east' },
  { bit: Direction.South, opposite: Direction.North, dx: 0, dy: 1, name: 'south' },
  { bit: Direction.West, opposite: Direction.East, dx: -1, dy: 0, name: 'west' },
] as const;

export interface DifficultyConfig {
  readonly tier: number;
  readonly cols: number;
  readonly rows: number;
  readonly activeCells: number;
  readonly minPlants: number;
  readonly maxPlants: number;
  readonly preSolvedChance: number;
  readonly fixedChance: number;
}

export interface TileState {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly kind: TileKind;
  readonly baseMask: number;
  readonly solutionMask: number;
  readonly targetRotation: number;
  readonly fixed: boolean;
  readonly plantKind?: PlantKind;
  rotation: number;
  visualTurns: number;
}

export interface PuzzleDefinition {
  readonly seed: string;
  readonly mode: GameMode;
  readonly level: number;
  readonly config: DifficultyConfig;
  readonly tiles: TileState[];
  readonly sourceId: string;
  readonly optimalMoves: number;
  readonly generatedAtVersion: number;
}

export interface BoardAnalysis {
  readonly powered: ReadonlySet<string>;
  readonly poweredPlants: number;
  readonly totalPlants: number;
  readonly leaks: readonly Leak[];
  readonly solved: boolean;
}

export interface Leak {
  readonly tileId: string;
  readonly direction: DirectionBit;
}

export interface HintSuggestion {
  readonly tileId: string;
  readonly rotations: number;
  readonly projectedScore: number;
  readonly reason: 'immediate-improvement' | 'frontier-correction' | 'solution-correction';
}

export interface SkillProfile {
  rating: number;
  emaEfficiency: number;
  emaSecondsPerTile: number;
  hintRate: number;
  streak: number;
  completed: number;
}

export interface GameSettings {
  sound: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  language: SupportedLanguage;
}

export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'it';

export interface ActiveRunSnapshot {
  readonly mode: GameMode;
  readonly level: number;
  readonly seed: string;
  readonly config: DifficultyConfig;
  readonly rotations: readonly number[];
  readonly moves: number;
  readonly hintsUsed: number;
  readonly elapsedMs: number;
  readonly score: number;
}

export interface PersistedProgress {
  readonly schemaVersion: 1;
  campaignLevel: number;
  totalScore: number;
  bestDaily: Record<string, number>;
  skill: SkillProfile;
  settings: GameSettings;
  activeRun?: ActiveRunSnapshot;
}

export interface CompletionStats {
  readonly moves: number;
  readonly optimalMoves: number;
  readonly hintsUsed: number;
  readonly elapsedMs: number;
  readonly score: number;
  readonly stars: 1 | 2 | 3;
}
