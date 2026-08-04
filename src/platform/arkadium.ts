const SDK_URL = 'https://developers.arkadium.com/cdn/sdk/v2/sdk.js';
const MAX_OUTBOX = 80;

type UnknownRecord = Record<string, unknown>;
type PauseHandler = () => void;

interface LifecycleEntry {
  readonly method: string;
  readonly args: unknown[];
}

export class ArkadiumBridge extends EventTarget {
  readonly #version: string;
  #sdk: UnknownRecord | null = null;
  #connected = false;
  #standalone = false;
  #initializing: Promise<void> | null = null;
  #outbox: LifecycleEntry[] = [];
  #gameStarted = false;
  #gameEnded = false;
  #pauseHandler: PauseHandler = () => undefined;
  #resumeHandler: PauseHandler = () => undefined;

  public constructor(version: string) {
    super();
    this.#version = version;
  }

  public get connected(): boolean { return this.#connected; }
  public get rewardedAvailable(): boolean {
    return Boolean(this.#findFunction(['ads.showRewardedAd', 'ads.showRewarded', 'advertisement.showRewardedAd']));
  }

  public initialize(): Promise<void> {
    if (this.#initializing) return this.#initializing;
    this.#initializing = this.#initialize();
    return this.#initializing;
  }

  public bindPauseHandlers(onPause: PauseHandler, onResume: PauseHandler): void {
    this.#pauseHandler = onPause;
    this.#resumeHandler = onResume;
    this.#bindHostEvents();
  }

  public async markReady(): Promise<void> { await this.#lifecycle('onTestReady'); }
  public async appStarted(): Promise<void> { await this.#analytics('App', 'Started', { version: this.#version }); }
  public async mainScreenReady(): Promise<void> { await this.#analytics('Page', 'Main_Screen_Ready'); }

  public async gameStart(): Promise<void> {
    if (this.#gameStarted) return;
    this.#gameStarted = true;
    await this.#lifecycle('onGameStart');
  }

  public async gameEnd(): Promise<void> {
    if (!this.#gameStarted || this.#gameEnded) return;
    this.#gameEnded = true;
    await this.#lifecycle('onGameEnd');
  }

  public async levelStart(level: number): Promise<void> { await this.#lifecycle('onLevelStart', level); }
  public async levelEnd(level: number, score: number): Promise<void> {
    await this.#lifecycle('onLevelEnd', level);
    await this.#lifecycle('onChangeScore', score);
  }

  public async firstMove(): Promise<void> { await this.#analytics('Puzzle', 'First_Move'); }
  public async gameWon(score: number, seconds: number): Promise<void> {
    await this.#analytics('Game', 'Won', { score, seconds, reason: 'Completed' });
  }
  public async helpOpened(): Promise<void> { await this.#analytics('Menu', 'Help_Opened'); }
  public async menuAction(action: string): Promise<void> { await this.#analytics('Menu', action); }
  public async customEvent(category: string, action: string, dimensions: UnknownRecord = {}): Promise<void> {
    await this.#analytics(category, action, dimensions);
  }

  public async loadProgress(key: string): Promise<unknown> {
    // Give the host a bounded opportunity to connect before deciding whether
    // authenticated remote progress is available. Standalone mode resolves immediately.
    await this.initialize();
    let local: unknown = null;
    try {
      const raw = localStorage.getItem(key);
      local = raw ? JSON.parse(raw) : null;
    } catch {
      local = null;
    }
    if (!this.#connected) return local;
    try {
      const remote = await this.#invokeFirst(
        ['storage.getValue', 'gameStorage.getValue', 'playerStorage.getValue'],
        [key],
      );
      if (typeof remote === 'string') return JSON.parse(remote);
      return remote ?? local;
    } catch {
      return local;
    }
  }

  public async saveProgress(key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value);
    try { localStorage.setItem(key, serialized); } catch { /* storage can be unavailable in privacy modes */ }
    if (!this.#connected) return;
    try {
      await this.#invokeFirst(['storage.setValue', 'gameStorage.setValue', 'playerStorage.setValue'], [key, serialized]);
    } catch (error) {
      await this.reportError(error);
    }
  }

  public async showInterstitial(): Promise<void> {
    if (!this.#connected) return;
    try {
      await this.#invokeFirst(['ads.showInterstitialAd', 'ads.showInterstitial', 'advertisement.showInterstitialAd'], []);
    } catch (error) {
      await this.reportError(error);
    }
  }

  public async showRewarded(): Promise<boolean> {
    const params = new URLSearchParams(location.search);
    if (!this.#connected) {
      return params.get('debug') === '1' && params.get('devReward') === '1';
    }
    const found = this.#findFunction(['ads.showRewardedAd', 'ads.showRewarded', 'advertisement.showRewardedAd']);
    if (!found) return false;
    try {
      const result = await found.fn.apply(found.owner, []);
      if (typeof result === 'boolean') return result;
      if (isRecord(result)) {
        const status = String(result.status ?? result.result ?? '').toLowerCase();
        return Boolean(result.rewarded ?? result.completed ?? (status === 'completed' || status === 'rewarded'));
      }
      return false;
    } catch (error) {
      await this.reportError(error);
      return false;
    }
  }

  public async postDailyScore(score: number): Promise<boolean> {
    if (!this.#connected) return false;
    try {
      const result = await this.#invokeFirst(['leaderboard.postScore', 'leaderboards.postScore'], [score]);
      return result !== undefined;
    } catch {
      return false;
    }
  }

  public async reportError(error: unknown): Promise<void> {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('[Clockwork Conservatory]', error);
    if (!this.#connected) return;
    try {
      await this.#invokeFirst(['analytics.error', 'analytics.trackError', 'telemetry.trackException'], [message]);
    } catch {
      // Error reporting must never interrupt gameplay.
    }
  }

  async #initialize(): Promise<void> {
    const params = new URLSearchParams(location.search);
    if (params.get('standalone') === '1') {
      this.#setStandalone();
      return;
    }

    const existing = this.#resolveSdk();
    if (existing) {
      this.#connect(existing);
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.addEventListener('load', () => {
      const sdk = this.#resolveSdk();
      if (sdk) this.#connect(sdk);
    });
    script.addEventListener('error', () => this.#setStandalone(), { once: true });
    document.head.append(script);

    await new Promise<void>((resolve) => window.setTimeout(resolve, 1_800));
    if (!this.#connected) this.#setStandalone();
  }

  #resolveSdk(): UnknownRecord | null {
    const scope = window as unknown as UnknownRecord;
    const candidates = [scope.arkadiumGameSDK, scope.ArkadiumGameSDK, scope.GameSDK, scope.arkadiumSDK];
    for (const candidate of candidates) {
      if (isRecord(candidate)) {
        const getInstance = candidate.getInstance;
        if (typeof getInstance === 'function') {
          try {
            const instance = getInstance.call(candidate);
            if (isRecord(instance)) return instance;
          } catch {
            // Try the object itself below.
          }
        }
        return candidate;
      }
    }
    return null;
  }

  #connect(sdk: UnknownRecord): void {
    this.#sdk = sdk;
    this.#connected = true;
    this.#standalone = false;
    this.#bindHostEvents();
    void this.#flushOutbox();
    this.dispatchEvent(new Event('connected'));
  }

  #setStandalone(): void {
    if (this.#connected || this.#standalone) return;
    this.#standalone = true;
    this.dispatchEvent(new Event('standalone'));
  }

  #bindHostEvents(): void {
    if (!this.#sdk) return;
    const subscribe = this.#findFunction(['events.on', 'eventBus.on', 'on']);
    if (!subscribe) return;
    try {
      subscribe.fn.call(subscribe.owner, 'GAME_PAUSE', this.#pauseHandler);
      subscribe.fn.call(subscribe.owner, 'GAME_RESUME', this.#resumeHandler);
    } catch {
      // Host versions differ; visibility handling remains available.
    }
  }

  async #lifecycle(method: string, ...args: unknown[]): Promise<void> {
    if (!this.#connected) {
      this.#outbox.push({ method, args });
      if (this.#outbox.length > MAX_OUTBOX) this.#outbox.shift();
      return;
    }
    try {
      await this.#invokeFirst([`lifecycle.${method}`, method], args);
    } catch (error) {
      await this.reportError(error);
    }
  }

  async #flushOutbox(): Promise<void> {
    const entries = this.#outbox.splice(0, this.#outbox.length);
    for (const entry of entries) {
      await this.#lifecycle(entry.method, ...entry.args);
    }
  }

  async #analytics(category: string, action: string, dimensions: UnknownRecord = {}): Promise<void> {
    if (!this.#connected) return;
    try {
      await this.#invokeFirst(
        ['analytics.trackEvent', 'analytics.event', 'telemetry.trackEvent'],
        [{ category, action, ...dimensions }],
      );
    } catch {
      // Analytics is non-critical.
    }
  }

  async #invokeFirst(paths: readonly string[], args: unknown[]): Promise<unknown> {
    const found = this.#findFunction(paths);
    if (!found) return undefined;
    return await found.fn.apply(found.owner, args);
  }

  #findFunction(paths: readonly string[]): { fn: (...args: unknown[]) => unknown; owner: UnknownRecord } | null {
    if (!this.#sdk) return null;
    for (const path of paths) {
      const segments = path.split('.');
      let owner: UnknownRecord = this.#sdk;
      for (let index = 0; index < segments.length - 1; index += 1) {
        const next = owner[segments[index] as string];
        if (!isRecord(next)) {
          owner = {};
          break;
        }
        owner = next;
      }
      const fn = owner[segments[segments.length - 1] as string];
      if (typeof fn === 'function') return { fn: fn as (...args: unknown[]) => unknown, owner };
    }
    return null;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
