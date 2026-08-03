import type { PersistedProgress } from '../core/types.js';

const SDK_URL = 'https://developers.arkadium.com/cdn/sdk/v2/sdk.js';

type UnknownRecord = Record<string, unknown>;
type PauseHandler = () => void;

interface ArkadiumSdkLoader {
  getInstance(): Promise<unknown>;
}

declare global {
  interface Window {
    ArkadiumGameSDK?: ArkadiumSdkLoader;
  }
}

export type BridgeStatus = 'connecting' | 'connected' | 'standalone';

export class ArkadiumBridge extends EventTarget {
  readonly #debug: boolean;
  #sdk: UnknownRecord | null = null;
  #status: BridgeStatus = 'connecting';
  #readyToShow = false;
  #readySent = false;
  #gameStarted = false;
  #gameEnded = false;
  #pauseHandler: PauseHandler = () => undefined;
  #resumeHandler: PauseHandler = () => undefined;
  #initialization: Promise<void> | null = null;
  #lateConnectStarted = false;

  public constructor(private readonly version: string) {
    super();
    const params = new URLSearchParams(location.search);
    this.#debug = params.get('debug') === '1' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  public get status(): BridgeStatus {
    return this.#status;
  }

  public get connected(): boolean {
    return this.#status === 'connected';
  }

  public initialize(): Promise<void> {
    this.#initialization ??= this.#initializeInternal();
    return this.#initialization;
  }

  public bindPauseHandlers(onPause: PauseHandler, onResume: PauseHandler): void {
    this.#pauseHandler = onPause;
    this.#resumeHandler = onResume;
    if (this.#sdk) {
      this.#registerLifecycleCallbacks();
    }
  }

  public async markReady(): Promise<void> {
    this.#readyToShow = true;
    if (this.#sdk && !this.#readySent) {
      this.#readySent = true;
      await this.#invoke('lifecycle', 'onTestReady');
    }
  }

  public async gameStart(): Promise<void> {
    if (this.#gameStarted) {
      return;
    }
    this.#gameStarted = true;
    await this.#invoke('lifecycle', 'onGameStart');
    await this.#analytics('sendStartButtonClickedEvent', 'New');
    await this.#analytics('sendGameScreenPageView');
    await this.#analytics('sendGameplayReadyEvent');
  }

  public async gameEnd(): Promise<void> {
    if (this.#gameEnded || !this.#gameStarted) {
      return;
    }
    this.#gameEnded = true;
    await this.#invoke('lifecycle', 'onGameEnd');
  }

  public async levelStart(level: number): Promise<void> {
    await this.#invoke('lifecycle', 'onLevelStart', level);
    await this.#analytics('sendRoundEvent', { round: level });
  }

  public async levelEnd(level: number, score: number): Promise<void> {
    await this.#invoke('lifecycle', 'onLevelEnd', level);
    await this.#invoke('lifecycle', 'onChangeScore', score);
    await this.#analytics('sendRoundEndEvent', 'Finished', { round: level, reason: 'No_Moves' });
  }

  public async gameWon(score: number, elapsedSeconds: number): Promise<void> {
    await this.#analytics('sendGameEndEvent', 'Win');
    await this.#analytics('sendGameOverPageView', { score, timespent: Math.round(elapsedSeconds) });
  }

  public async scoreChanged(score: number): Promise<void> {
    await this.#invoke('lifecycle', 'onChangeScore', score);
  }

  public async firstMove(): Promise<void> {
    await this.#analytics('sendFirstMoveEvent');
  }

  public async appStarted(): Promise<void> {
    await this.#analytics('sendAppStartedEvent');
    await this.#analytics('sendIntroScreenPageView');
  }

  public async mainScreenReady(): Promise<void> {
    await this.#analytics('sendMainScreenReadyEvent');
  }

  public async menuAction(action: 'Sound_On' | 'Sound_Off' | 'Music_On' | 'Music_Off'): Promise<void> {
    await this.#analytics('sendMenuActionsEvent', action);
  }

  public async helpOpened(): Promise<void> {
    await this.#analytics('sendHelpEvent');
  }

  public async customEvent(category: string, action: string, dimensions: Record<string, string | number | boolean>): Promise<void> {
    await this.#analytics('sendEvent', category, action, dimensions);
  }

  public async reportError(error: unknown): Promise<void> {
    const normalized = error instanceof Error ? error : new Error(String(error));
    await this.#analytics('sendErrorEvent', { reason: normalized.message.slice(0, 500) });
    await this.#analytics('trackException', normalized);
    if (this.#debug) {
      console.error('[Clockwork Conservatory]', normalized);
    }
  }

  public async loadProgress(key: string): Promise<unknown | null> {
    await this.#waitForInitialConnection();
    if (this.#sdk) {
      try {
        if (await this.#isAuthorized()) {
          const remote = await this.#invoke('persistence', 'getRemoteStorageItem', key);
          if (remote !== null && remote !== undefined) {
            return remote;
          }
        }
        const local = await this.#invoke('persistence', 'getLocalStorageItem', key);
        return local ?? null;
      } catch (error) {
        await this.reportError(error);
      }
    }
    return this.#standaloneLoad(key);
  }

  public async saveProgress(key: string, progress: PersistedProgress): Promise<void> {
    if (this.#sdk) {
      try {
        await this.#invoke('persistence', 'setLocalStorageItem', key, progress);
        if (await this.#isAuthorized()) {
          await this.#invoke('persistence', 'setRemoteStorageItem', key, progress);
        }
        return;
      } catch (error) {
        await this.reportError(error);
      }
    }
    this.#standaloneSave(key, progress);
  }

  public async showInterstitial(): Promise<void> {
    if (!this.#sdk || !this.#hasMethod('ads', 'showInterstitialAd')) {
      return;
    }
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
    if (!this.#sdk || !this.#hasMethod('ads', 'showRewardAd')) {
      return true;
    }
    this.#pauseHandler();
    try {
      const response = await this.#invoke('ads', 'showRewardAd');
      return isRecord(response) && typeof response.value === 'number' ? response.value > 0 : false;
    } catch (error) {
      await this.reportError(error);
      return false;
    } finally {
      this.#resumeHandler();
    }
  }

  public async postDailyScore(score: number): Promise<boolean> {
    if (!this.#sdk || !this.#hasMethod('leaderboard', 'postScore')) {
      return false;
    }
    try {
      const supported = await this.#invoke('leaderboard', 'isSupported');
      if (supported === false) {
        return false;
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
    if (params.get('standalone') === '1' || location.protocol === 'file:') {
      this.#setStandalone();
      return;
    }

    const connected = await this.#connectWithTimeout(1_800);
    if (!connected) {
      this.#setStandalone();
      this.#startLateConnection();
    }
  }

  async #connectWithTimeout(timeoutMs: number): Promise<boolean> {
    const loader = window.ArkadiumGameSDK;
    if (loader) {
      return this.#connectFromLoader(loader);
    }

    const script = this.#ensureSdkScript();
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (value: boolean): void => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      const timeout = window.setTimeout(() => finish(false), timeoutMs);
      script.addEventListener(
        'load',
        () => {
          window.clearTimeout(timeout);
          void this.#connectFromLoader(window.ArkadiumGameSDK).then(finish);
        },
        { once: true },
      );
      script.addEventListener(
        'error',
        () => {
          window.clearTimeout(timeout);
          finish(false);
        },
        { once: true },
      );
    });
  }

  #ensureSdkScript(): HTMLScriptElement {
    const existing = document.querySelector<HTMLScriptElement>('script[data-arkadium-game-sdk]');
    if (existing) {
      return existing;
    }
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.dataset.arkadiumGameSdk = 'true';
    script.crossOrigin = 'anonymous';
    document.head.append(script);
    return script;
  }

  #startLateConnection(): void {
    if (this.#lateConnectStarted) {
      return;
    }
    this.#lateConnectStarted = true;
    const script = this.#ensureSdkScript();
    script.addEventListener(
      'load',
      () => {
        void this.#connectFromLoader(window.ArkadiumGameSDK);
      },
      { once: true },
    );
  }

  async #connectFromLoader(loader: ArkadiumSdkLoader | undefined): Promise<boolean> {
    if (!loader) {
      return false;
    }
    try {
      const instance = await loader.getInstance();
      if (!isRecord(instance)) {
        return false;
      }
      this.#sdk = instance;
      this.#status = 'connected';
      this.#registerLifecycleCallbacks();
      await this.#configureAnalytics();
      if (this.#readyToShow && !this.#readySent) {
        this.#readySent = true;
        await this.#invoke('lifecycle', 'onTestReady');
      }
      this.dispatchEvent(new Event('connected'));
      return true;
    } catch (error) {
      if (this.#debug) {
        console.warn('[Arkadium bridge] SDK unavailable; continuing standalone.', error);
      }
      return false;
    }
  }

  async #configureAnalytics(): Promise<void> {
    if (!this.#sdk) {
      return;
    }
    const analytics = this.#module('analytics');
    if (this.#debug && this.#hasMethod('analytics', 'configureProvider')) {
      const consoleProvider = analytics?.CONSOLE;
      if (consoleProvider !== undefined) {
        await this.#invoke('analytics', 'configureProvider', { provider: consoleProvider, appId: 'clockwork-preview' });
      }
    }

    const productionAppId =
      document.querySelector<HTMLMetaElement>('meta[name="arkadium-app-insights-id"]')?.content.trim() ?? '';
    const appInsightsProvider = analytics?.APP_INSIGHTS;
    if (productionAppId && appInsightsProvider !== undefined && this.#hasMethod('analytics', 'configureProvider')) {
      await this.#invoke('analytics', 'configureProvider', {
        provider: appInsightsProvider,
        appId: productionAppId,
      });
    }

    if (this.#hasMethod('analytics', 'setDimensions')) {
      await this.#invoke('analytics', 'setDimensions', {
        gameVersion: this.version,
        renderer: 'canvas2d',
        aiMode: 'local-adaptive',
      });
    }
  }

  #registerLifecycleCallbacks(): void {
    const lifecycle = this.#module('lifecycle');
    if (!lifecycle || typeof lifecycle.registerEventCallback !== 'function' || !isRecord(lifecycle.LifecycleEvent)) {
      return;
    }
    const pauseEvent = lifecycle.LifecycleEvent.GAME_PAUSE;
    const resumeEvent = lifecycle.LifecycleEvent.GAME_RESUME;
    try {
      if (pauseEvent !== undefined) {
        Reflect.apply(lifecycle.registerEventCallback as (...args: unknown[]) => unknown, lifecycle, [
          pauseEvent,
          this.#pauseHandler,
        ]);
      }
      if (resumeEvent !== undefined) {
        Reflect.apply(lifecycle.registerEventCallback as (...args: unknown[]) => unknown, lifecycle, [
          resumeEvent,
          this.#resumeHandler,
        ]);
      }
    } catch (error) {
      if (this.#debug) {
        console.warn('[Arkadium bridge] Unable to register lifecycle callbacks.', error);
      }
    }
  }

  async #waitForInitialConnection(): Promise<void> {
    const initialization = this.initialize();
    await Promise.race([initialization, delay(1_900)]);
  }

  async #isAuthorized(): Promise<boolean> {
    if (!this.#hasMethod('auth', 'isUserAuthorized')) {
      return false;
    }
    return (await this.#invoke('auth', 'isUserAuthorized')) === true;
  }

  async #analytics(method: string, ...args: unknown[]): Promise<void> {
    if (!this.#hasMethod('analytics', method)) {
      if (this.#debug) {
        console.info(`[Analytics preview] ${method}`, ...args);
      }
      return;
    }
    await this.#invoke('analytics', method, ...args);
  }

  async #invoke(moduleName: string, method: string, ...args: unknown[]): Promise<unknown> {
    const module = this.#module(moduleName);
    const callable = module?.[method];
    if (typeof callable !== 'function') {
      return undefined;
    }
    try {
      return await Reflect.apply(callable as (...parameters: unknown[]) => unknown, module, args);
    } catch (error) {
      if (this.#debug) {
        console.warn(`[Arkadium bridge] ${moduleName}.${method} failed.`, error);
      }
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

  #setStandalone(): void {
    this.#status = 'standalone';
    this.dispatchEvent(new Event('standalone'));
  }

  #standaloneLoad(key: string): unknown | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  #standaloneSave(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      if (this.#debug) {
        console.warn('[Clockwork Conservatory] Local preview save failed.', error);
      }
    }
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
