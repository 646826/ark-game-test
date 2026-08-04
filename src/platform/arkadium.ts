import type { PersistedProgress } from '../core/types.js';

const SDK_URL = 'https://developers.arkadium.com/cdn/sdk/v2/sdk.js';
const OUTBOX_LIMIT = 96;

type UnknownRecord = Record<string, unknown>;
type PauseHandler = () => void;
export type BridgeStatus = 'connecting' | 'connected' | 'standalone';

interface ArkadiumSdkLoader {
  getInstance(): Promise<unknown>;
}

interface LifecycleMessage {
  readonly module: 'lifecycle';
  readonly method: string;
  readonly args: readonly unknown[];
}

declare global {
  interface Window {
    ArkadiumGameSDK?: ArkadiumSdkLoader;
    __clockworkLifecycleLog?: Array<{ method: string; args: unknown[] }>;
  }
}

export class ArkadiumBridge extends EventTarget {
  readonly #debug: boolean;
  readonly #devReward: boolean;
  readonly #version: string;
  #sdk: UnknownRecord | null = null;
  #status: BridgeStatus = 'connecting';
  #initialization: Promise<void> | null = null;
  #lateConnectStarted = false;
  #readySent = false;
  #gameStarted = false;
  #gameEnded = false;
  #pauseHandler: PauseHandler = () => undefined;
  #resumeHandler: PauseHandler = () => undefined;
  #outbox: LifecycleMessage[] = [];
  #flushing = false;

  public constructor(version: string) {
    super();
    this.#version = version;
    const params = new URLSearchParams(location.search);
    this.#debug = params.get('debug') === '1' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    this.#devReward = this.#debug && params.get('devReward') === '1';
  }

  public get version(): string { return this.#version; }
  public get status(): BridgeStatus { return this.#status; }
  public get connected(): boolean { return this.#status === 'connected'; }
  public get rewardedAvailable(): boolean { return this.#hasMethod('ads', 'showRewardAd') || this.#devReward; }

  public initialize(): Promise<void> {
    this.#initialization ??= this.#initializeInternal();
    return this.#initialization;
  }

  public bindPauseHandlers(onPause: PauseHandler, onResume: PauseHandler): void {
    this.#pauseHandler = onPause;
    this.#resumeHandler = onResume;
    this.#registerLifecycleCallbacks();
  }

  public async markReady(): Promise<void> {
    if (!this.#readySent) {
      this.#readySent = true;
      await this.#lifecycle('onTestReady');
    }
  }

  public async gameStart(): Promise<void> {
    if (this.#gameStarted) return;
    this.#gameStarted = true;
    this.#gameEnded = false;
    await this.#lifecycle('onGameStart');
    await this.#analytics('sendStartButtonClickedEvent', 'New');
    await this.#analytics('sendGameScreenPageView');
    await this.#analytics('sendGameplayReadyEvent');
  }

  public async gameEnd(): Promise<void> {
    if (this.#gameEnded || !this.#gameStarted) return;
    this.#gameEnded = true;
    await this.#lifecycle('onGameEnd');
  }

  public async levelStart(level: number): Promise<void> {
    await this.#lifecycle('onLevelStart', level);
    await this.#analytics('sendRoundEvent', { round: level });
  }

  public async levelEnd(level: number, score: number): Promise<void> {
    await this.#lifecycle('onLevelEnd', level);
    await this.#lifecycle('onChangeScore', score);
    await this.#analytics('sendRoundEndEvent', 'Finished', { round: level, reason: 'Completed' });
  }

  public async scoreChanged(score: number): Promise<void> {
    await this.#lifecycle('onChangeScore', score);
  }

  public async gameWon(score: number, elapsedSeconds: number): Promise<void> {
    await this.#analytics('sendGameEndEvent', 'Win');
    await this.#analytics('sendGameOverPageView', { score, timespent: Math.round(elapsedSeconds) });
  }

  public async firstMove(): Promise<void> { await this.#analytics('sendFirstMoveEvent'); }
  public async appStarted(): Promise<void> {
    await this.#analytics('sendAppStartedEvent');
    await this.#analytics('sendIntroScreenPageView');
  }
  public async mainScreenReady(): Promise<void> { await this.#analytics('sendMainScreenReadyEvent'); }
  public async menuAction(action: 'Sound_On' | 'Sound_Off' | 'Music_On' | 'Music_Off'): Promise<void> {
    await this.#analytics('sendMenuActionsEvent', action);
  }
  public async helpOpened(): Promise<void> { await this.#analytics('sendHelpEvent'); }

  public async customEvent(category: string, action: string, dimensions: Record<string, string | number | boolean>): Promise<void> {
    await this.#analytics('sendEvent', category, action, dimensions);
  }

  public async reportError(error: unknown): Promise<void> {
    const normalized = error instanceof Error ? error : new Error(String(error));
    await this.#analytics('sendErrorEvent', { reason: normalized.message.slice(0, 500) });
    await this.#analytics('trackException', normalized);
    if (this.#debug) console.error('[Clockwork Conservatory]', normalized);
  }

  public async loadProgress(key: string): Promise<unknown | null> {
    await this.#waitForInitialConnection();
    if (this.#sdk) {
      try {
        if (await this.#isAuthorized()) {
          const remote = await this.#invoke('persistence', 'getRemoteStorageItem', key);
          if (remote !== null && remote !== undefined) return remote;
        }
        const local = await this.#invoke('persistence', 'getLocalStorageItem', key);
        if (local !== null && local !== undefined) return local;
      } catch (error) {
        await this.reportError(error);
      }
    }
    return this.#standaloneLoad(key);
  }

  public async saveProgress(key: string, progress: PersistedProgress): Promise<void> {
    this.#standaloneSave(key, progress);
    if (!this.#sdk) return;
    try {
      await this.#invoke('persistence', 'setLocalStorageItem', key, progress);
      if (await this.#isAuthorized()) await this.#invoke('persistence', 'setRemoteStorageItem', key, progress);
    } catch (error) {
      await this.reportError(error);
    }
  }

  public async showInterstitial(): Promise<void> {
    if (!this.#sdk || !this.#hasMethod('ads', 'showInterstitialAd')) return;
    this.#pauseHandler();
    try {
      await this.#invoke('ads', 'showInterstitialAd');
    } catch (error) {
      await this.reportError(error);
    } finally {
      this.#resumeHandler();
    }
  }

  public async showRewarded(): Promise<boolean> {
    if (!this.#sdk || !this.#hasMethod('ads', 'showRewardAd')) return this.#devReward;
    this.#pauseHandler();
    try {
      const response = await this.#invoke('ads', 'showRewardAd');
      return isRecord(response) && typeof response.value === 'number' ? response.value > 0 : response === true;
    } catch (error) {
      await this.reportError(error);
      return false;
    } finally {
      this.#resumeHandler();
    }
  }

  public async postDailyScore(score: number): Promise<boolean> {
    if (!this.#sdk || !this.#hasMethod('leaderboard', 'postScore')) return false;
    try {
      if (this.#hasMethod('leaderboard', 'isSupported')) {
        const supported = await this.#invoke('leaderboard', 'isSupported');
        if (supported === false) return false;
      }
      await this.#invoke('leaderboard', 'postScore', Math.round(score));
      return true;
    } catch (error) {
      await this.reportError(error);
      return false;
    }
  }

  async #initializeInternal(): Promise<void> {
    const params = new URLSearchParams(location.search);
    const opaquePreview = location.protocol === 'file:' || location.protocol === 'data:' || location.protocol === 'about:';
    if (params.get('standalone') === '1' || (opaquePreview && !window.ArkadiumGameSDK)) {
      this.#setStatus('standalone');
      return;
    }
    const connected = await this.#connectWithTimeout(1_800);
    if (!connected) {
      this.#setStatus('standalone');
      this.#startLateConnection();
    }
  }

  async #connectWithTimeout(timeoutMs: number): Promise<boolean> {
    if (window.ArkadiumGameSDK) return this.#connectFromLoader(window.ArkadiumGameSDK);
    const script = this.#ensureSdkScript();
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(value);
      };
      const timeout = window.setTimeout(() => finish(false), timeoutMs);
      script.addEventListener('load', () => void this.#connectFromLoader(window.ArkadiumGameSDK).then(finish), { once: true });
      script.addEventListener('error', () => finish(false), { once: true });
    });
  }

  #ensureSdkScript(): HTMLScriptElement {
    const existing = document.querySelector<HTMLScriptElement>('script[data-arkadium-game-sdk]');
    if (existing) return existing;
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.arkadiumGameSdk = 'true';
    document.head.append(script);
    return script;
  }

  #startLateConnection(): void {
    if (this.#lateConnectStarted) return;
    this.#lateConnectStarted = true;
    const script = this.#ensureSdkScript();
    script.addEventListener('load', () => void this.#connectFromLoader(window.ArkadiumGameSDK), { once: true });
  }

  async #connectFromLoader(loader: ArkadiumSdkLoader | undefined): Promise<boolean> {
    if (!loader) return false;
    try {
      const instance = await loader.getInstance();
      if (!isRecord(instance)) return false;
      this.#sdk = instance;
      this.#setStatus('connected');
      this.#registerLifecycleCallbacks();
      await this.#configureAnalytics();
      await this.#flushLifecycleOutbox();
      this.dispatchEvent(new Event('connected'));
      return true;
    } catch (error) {
      if (this.#debug) console.warn('[Arkadium bridge] SDK unavailable; continuing standalone.', error);
      return false;
    }
  }

  async #configureAnalytics(): Promise<void> {
    if (!this.#sdk) return;
    const analytics = this.#module('analytics');
    if (this.#debug && this.#hasMethod('analytics', 'configureProvider') && analytics?.CONSOLE !== undefined) {
      await this.#invoke('analytics', 'configureProvider', { provider: analytics.CONSOLE, appId: 'clockwork-preview' });
    }
    const productionAppId = document.querySelector<HTMLMetaElement>('meta[name="arkadium-app-insights-id"]')?.content.trim() ?? '';
    if (productionAppId && analytics?.APP_INSIGHTS !== undefined && this.#hasMethod('analytics', 'configureProvider')) {
      await this.#invoke('analytics', 'configureProvider', { provider: analytics.APP_INSIGHTS, appId: productionAppId });
    }
    if (this.#hasMethod('analytics', 'setDimensions')) {
      await this.#invoke('analytics', 'setDimensions', {
        gameVersion: this.#version,
        renderer: 'canvas2d-premium',
        aiMode: 'local-deterministic',
        artTier: 'premium-2.5d',
      });
    }
  }

  #registerLifecycleCallbacks(): void {
    const lifecycle = this.#module('lifecycle');
    if (!lifecycle || typeof lifecycle.registerEventCallback !== 'function' || !isRecord(lifecycle.LifecycleEvent)) return;
    try {
      const pauseEvent = lifecycle.LifecycleEvent.GAME_PAUSE;
      const resumeEvent = lifecycle.LifecycleEvent.GAME_RESUME;
      if (pauseEvent !== undefined) Reflect.apply(lifecycle.registerEventCallback as (...args: unknown[]) => unknown, lifecycle, [pauseEvent, this.#pauseHandler]);
      if (resumeEvent !== undefined) Reflect.apply(lifecycle.registerEventCallback as (...args: unknown[]) => unknown, lifecycle, [resumeEvent, this.#resumeHandler]);
    } catch (error) {
      if (this.#debug) console.warn('[Arkadium bridge] Lifecycle callback registration failed.', error);
    }
  }

  async #lifecycle(method: string, ...args: unknown[]): Promise<void> {
    window.__clockworkLifecycleLog ??= [];
    window.__clockworkLifecycleLog.push({ method, args: [...args] });
    if (this.#sdk && this.#hasMethod('lifecycle', method)) {
      await this.#invoke('lifecycle', method, ...args);
      return;
    }
    this.#outbox.push({ module: 'lifecycle', method, args });
    if (this.#outbox.length > OUTBOX_LIMIT) this.#outbox.splice(0, this.#outbox.length - OUTBOX_LIMIT);
  }

  async #flushLifecycleOutbox(): Promise<void> {
    if (this.#flushing || !this.#sdk) return;
    this.#flushing = true;
    try {
      while (this.#outbox.length > 0) {
        const message = this.#outbox.shift() as LifecycleMessage;
        if (this.#hasMethod(message.module, message.method)) await this.#invoke(message.module, message.method, ...message.args);
      }
    } finally {
      this.#flushing = false;
    }
  }

  async #waitForInitialConnection(): Promise<void> {
    await Promise.race([this.initialize(), delay(1_900)]);
  }

  async #isAuthorized(): Promise<boolean> {
    if (!this.#hasMethod('auth', 'isUserAuthorized')) return false;
    return (await this.#invoke('auth', 'isUserAuthorized')) === true;
  }

  async #analytics(method: string, ...args: unknown[]): Promise<void> {
    if (!this.#hasMethod('analytics', method)) {
      if (this.#debug) console.info(`[Analytics preview] ${method}`, ...args);
      return;
    }
    await this.#invoke('analytics', method, ...args);
  }

  async #invoke(moduleName: string, method: string, ...args: unknown[]): Promise<unknown> {
    const module = this.#module(moduleName);
    const callable = module?.[method];
    if (typeof callable !== 'function') return undefined;
    try {
      return await Reflect.apply(callable as (...parameters: unknown[]) => unknown, module, args);
    } catch (error) {
      if (this.#debug) console.warn(`[Arkadium bridge] ${moduleName}.${method} failed.`, error);
      return undefined;
    }
  }

  #module(name: string): UnknownRecord | null {
    const value = this.#sdk?.[name];
    return isRecord(value) ? value : null;
  }

  #hasMethod(moduleName: string, method: string): boolean {
    return typeof this.#module(moduleName)?.[method] === 'function';
  }

  #setStatus(status: BridgeStatus): void {
    this.#status = status;
    this.dispatchEvent(new CustomEvent<BridgeStatus>('status', { detail: status }));
  }

  #standaloneLoad(key: string): unknown | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as unknown : null;
    } catch {
      return null;
    }
  }

  #standaloneSave(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (this.#debug) console.warn('[Clockwork Conservatory] Local save failed.', error);
    }
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
