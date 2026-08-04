import type { QualityLevel } from './types.js';

export type ResolvedQuality = Exclude<QualityLevel, 'auto'>;

export interface DeviceSignals {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
  readonly deviceMemory: number;
  readonly hardwareConcurrency: number;
  readonly saveData: boolean;
  readonly effectiveType: string;
  readonly coarsePointer: boolean;
}

export interface RenderProfile {
  readonly quality: ResolvedQuality;
  readonly adaptive: boolean;
  readonly maxDpr: number;
  readonly maxCanvasPixels: number;
  readonly activeFps: number;
  readonly ambientFps: number;
  readonly idleFps: number;
  readonly dustCount: number;
  readonly particleScale: number;
  readonly useFilters: boolean;
  readonly useExpensiveShadows: boolean;
  readonly parallaxStrength: number;
}

const HIGH_PROFILE: Omit<RenderProfile, 'adaptive'> = {
  quality: 'high',
  maxDpr: 2,
  maxCanvasPixels: 2_800_000,
  activeFps: 60,
  ambientFps: 24,
  idleFps: 10,
  dustCount: 42,
  particleScale: 1,
  useFilters: true,
  useExpensiveShadows: true,
  parallaxStrength: 1,
};

const BALANCED_PROFILE: Omit<RenderProfile, 'adaptive'> = {
  quality: 'balanced',
  maxDpr: 1.5,
  maxCanvasPixels: 1_350_000,
  activeFps: 30,
  ambientFps: 12,
  idleFps: 6,
  dustCount: 18,
  particleScale: 0.55,
  useFilters: false,
  useExpensiveShadows: false,
  parallaxStrength: 0.4,
};

export function detectDeviceSignals(): DeviceSignals {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  return {
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
    devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
    deviceMemory: Math.max(0.5, (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8),
    hardwareConcurrency: Math.max(1, navigator.hardwareConcurrency || 8),
    saveData: Boolean(connection?.saveData),
    effectiveType: connection?.effectiveType ?? '4g',
    coarsePointer: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  };
}

export function resolveRenderProfile(requested: QualityLevel, signals: DeviceSignals): RenderProfile {
  const quality = requested === 'auto' ? resolveAutoQuality(signals) : requested;
  const base = quality === 'high' ? HIGH_PROFILE : BALANCED_PROFILE;
  return { ...base, adaptive: requested === 'auto' };
}

export function resolveAutoQuality(signals: DeviceSignals): ResolvedQuality {
  const cssPixels = Math.max(1, signals.width * signals.height);
  const physicalPixels = cssPixels * Math.min(3, signals.devicePixelRatio) ** 2;
  const constrainedNetwork = signals.saveData || signals.effectiveType === 'slow-2g' || signals.effectiveType === '2g';
  const constrainedHardware = signals.deviceMemory <= 4 || signals.hardwareConcurrency <= 4;
  const denseTouchDisplay = signals.coarsePointer && signals.devicePixelRatio >= 2.5 && physicalPixels > 2_300_000;
  const oversizedSurface = physicalPixels > 5_200_000;
  return constrainedNetwork || constrainedHardware || denseTouchDisplay || oversizedSurface ? 'balanced' : 'high';
}

export function fitDevicePixelRatio(
  width: number,
  height: number,
  devicePixelRatio: number,
  profile: Pick<RenderProfile, 'maxDpr' | 'maxCanvasPixels'>,
): number {
  const cssPixels = Math.max(1, width * height);
  const pixelBudgetDpr = Math.sqrt(profile.maxCanvasPixels / cssPixels);
  return clamp(Math.min(devicePixelRatio, profile.maxDpr, pixelBudgetDpr), 1, profile.maxDpr);
}

export function shouldAutoDowngrade(samples: readonly number[]): boolean {
  if (samples.length < 72) return false;
  const recent = samples.slice(-72);
  const sorted = [...recent].sort((left, right) => left - right);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0;
  const slowFrames = recent.filter((value) => value > 15).length;
  return average > 9.5 || p90 > 15.5 || slowFrames >= 18;
}

export function shouldAutoUpgrade(samples: readonly number[]): boolean {
  if (samples.length < 180) return false;
  const recent = samples.slice(-180);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const worst = Math.max(...recent);
  return average < 4.2 && worst < 10;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
