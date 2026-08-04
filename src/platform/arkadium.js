const SDK_URL = 'https://developers.arkadium.com/cdn/sdk/v2/sdk.js';
export class ArkadiumBridge extends EventTarget {
    version;
    #debug;
    #previewRewards;
    #sdk = null;
    #status = 'connecting';
    #readyToShow = false;
    #readySent = false;
    #gameStarted = false;
    #gameEnded = false;
    #pauseHandler = () => undefined;
    #resumeHandler = () => undefined;
    #initialization = null;
    #lateConnectStarted = false;
    #lifecycleCallbacksRegistered = false;
    #lifecycleQueue = [];
    constructor(version) {
        super();
        this.version = version;
        const params = new URLSearchParams(location.search);
        this.#debug = params.get('debug') === '1' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
        this.#previewRewards = this.#debug && params.get('devReward') === '1';
    }
    get status() {
        return this.#status;
    }
    get connected() {
        return this.#status === 'connected';
    }
    get rewardedAvailable() {
        return this.#hasMethod('ads', 'showRewardAd') || this.#previewRewards;
    }
    initialize() {
        this.#initialization ??= this.#initializeInternal();
        return this.#initialization;
    }
    bindPauseHandlers(onPause, onResume) {
        this.#pauseHandler = onPause;
        this.#resumeHandler = onResume;
        if (this.#sdk) {
            this.#registerLifecycleCallbacks();
        }
    }
    async markReady() {
        this.#readyToShow = true;
        if (this.#readySent) {
            return;
        }
        this.#readySent = true;
        await this.#sendOrQueueLifecycle('onTestReady');
    }
    async gameStart() {
        if (this.#gameStarted) {
            return;
        }
        this.#gameStarted = true;
        await this.#sendOrQueueLifecycle('onGameStart');
        await this.#analytics('sendStartButtonClickedEvent', 'New');
        await this.#analytics('sendGameScreenPageView');
        await this.#analytics('sendGameplayReadyEvent');
    }
    async gameEnd() {
        if (this.#gameEnded || !this.#gameStarted) {
            return;
        }
        this.#gameEnded = true;
        await this.#sendOrQueueLifecycle('onGameEnd');
    }
    async levelStart(level) {
        await this.#sendOrQueueLifecycle('onLevelStart', level);
        await this.#analytics('sendRoundEvent', { round: level });
    }
    async levelEnd(level, score) {
        await this.#sendOrQueueLifecycle('onLevelEnd', level);
        await this.#sendOrQueueLifecycle('onChangeScore', score);
        await this.#analytics('sendRoundEndEvent', 'Finished', { round: level, reason: 'Completed' });
    }
    async gameWon(score, elapsedSeconds) {
        await this.#analytics('sendGameEndEvent', 'Win');
        await this.#analytics('sendGameOverPageView', { score, timespent: Math.round(elapsedSeconds) });
    }
    async scoreChanged(score) {
        await this.#sendOrQueueLifecycle('onChangeScore', score);
    }
    async firstMove() {
        await this.#analytics('sendFirstMoveEvent');
    }
    async appStarted() {
        await this.#analytics('sendAppStartedEvent');
        await this.#analytics('sendIntroScreenPageView');
    }
    async mainScreenReady() {
        await this.#analytics('sendMainScreenReadyEvent');
    }
    async menuAction(action) {
        await this.#analytics('sendMenuActionsEvent', action);
    }
    async helpOpened() {
        await this.#analytics('sendHelpEvent');
    }
    async customEvent(category, action, dimensions) {
        await this.#analytics('sendEvent', category, action, dimensions);
    }
    async reportError(error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        await this.#analytics('sendErrorEvent', { reason: normalized.message.slice(0, 500) });
        await this.#analytics('trackException', normalized);
        if (this.#debug) {
            console.error('[Clockwork Conservatory]', normalized);
        }
    }
    async loadProgress(key) {
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
            }
            catch (error) {
                await this.reportError(error);
            }
        }
        return this.#standaloneLoad(key);
    }
    async saveProgress(key, progress) {
        if (this.#sdk) {
            try {
                await this.#invoke('persistence', 'setLocalStorageItem', key, progress);
                if (await this.#isAuthorized()) {
                    await this.#invoke('persistence', 'setRemoteStorageItem', key, progress);
                }
                return;
            }
            catch (error) {
                await this.reportError(error);
            }
        }
        this.#standaloneSave(key, progress);
    }
    async showInterstitial() {
        if (!this.#sdk || !this.#hasMethod('ads', 'showInterstitialAd')) {
            return;
        }
        this.#pauseHandler();
        try {
            await this.#invoke('ads', 'showInterstitialAd');
        }
        catch (error) {
            await this.reportError(error);
        }
        finally {
            this.#resumeHandler();
        }
    }
    async showRewarded() {
        if (!this.#sdk || !this.#hasMethod('ads', 'showRewardAd')) {
            if (this.#previewRewards) {
                console.info('[Arkadium bridge] Explicit devReward preview granted.');
            }
            return this.#previewRewards;
        }
        this.#pauseHandler();
        try {
            const response = await this.#invoke('ads', 'showRewardAd');
            return isRecord(response) && typeof response.value === 'number' ? response.value > 0 : false;
        }
        catch (error) {
            await this.reportError(error);
            return false;
        }
        finally {
            this.#resumeHandler();
        }
    }
    async postDailyScore(score) {
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
        }
        catch (error) {
            await this.reportError(error);
            return false;
        }
    }
    async #initializeInternal() {
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
    async #connectWithTimeout(timeoutMs) {
        const loader = window.ArkadiumGameSDK;
        if (loader) {
            return this.#connectFromLoader(loader);
        }
        const script = this.#ensureSdkScript();
        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };
            const timeout = window.setTimeout(() => finish(false), timeoutMs);
            script.addEventListener('load', () => {
                window.clearTimeout(timeout);
                void this.#connectFromLoader(window.ArkadiumGameSDK).then(finish);
            }, { once: true });
            script.addEventListener('error', () => {
                window.clearTimeout(timeout);
                finish(false);
            }, { once: true });
        });
    }
    #ensureSdkScript() {
        const existing = document.querySelector('script[data-arkadium-game-sdk]');
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
    #startLateConnection() {
        if (this.#lateConnectStarted) {
            return;
        }
        this.#lateConnectStarted = true;
        const script = this.#ensureSdkScript();
        script.addEventListener('load', () => {
            void this.#connectFromLoader(window.ArkadiumGameSDK);
        }, { once: true });
    }
    async #connectFromLoader(loader) {
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
            await this.#flushLifecycleQueue();
            if (this.#readyToShow && !this.#readySent) {
                this.#readySent = true;
                await this.#sendOrQueueLifecycle('onTestReady');
            }
            this.dispatchEvent(new Event('connected'));
            return true;
        }
        catch (error) {
            if (this.#debug) {
                console.warn('[Arkadium bridge] SDK unavailable; continuing standalone.', error);
            }
            return false;
        }
    }
    async #configureAnalytics() {
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
        const productionAppId = document.querySelector('meta[name="arkadium-app-insights-id"]')?.content.trim() ?? '';
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
    #registerLifecycleCallbacks() {
        if (this.#lifecycleCallbacksRegistered) {
            return;
        }
        const lifecycle = this.#module('lifecycle');
        if (!lifecycle || typeof lifecycle.registerEventCallback !== 'function' || !isRecord(lifecycle.LifecycleEvent)) {
            return;
        }
        const pauseEvent = lifecycle.LifecycleEvent.GAME_PAUSE;
        const resumeEvent = lifecycle.LifecycleEvent.GAME_RESUME;
        try {
            if (pauseEvent !== undefined) {
                Reflect.apply(lifecycle.registerEventCallback, lifecycle, [
                    pauseEvent,
                    this.#pauseHandler,
                ]);
            }
            if (resumeEvent !== undefined) {
                Reflect.apply(lifecycle.registerEventCallback, lifecycle, [
                    resumeEvent,
                    this.#resumeHandler,
                ]);
            }
            this.#lifecycleCallbacksRegistered = true;
        }
        catch (error) {
            if (this.#debug) {
                console.warn('[Arkadium bridge] Unable to register lifecycle callbacks.', error);
            }
        }
    }
    async #sendOrQueueLifecycle(method, ...args) {
        if (this.#sdk && this.#hasMethod('lifecycle', method)) {
            await this.#invoke('lifecycle', method, ...args);
            return;
        }
        this.#lifecycleQueue.push({ method, args });
        if (this.#lifecycleQueue.length > 64) {
            this.#lifecycleQueue.splice(0, this.#lifecycleQueue.length - 64);
        }
        if (this.#debug) {
            console.info(`[Arkadium lifecycle queued] ${method}`, ...args);
        }
    }
    async #flushLifecycleQueue() {
        if (!this.#sdk || this.#lifecycleQueue.length === 0) {
            return;
        }
        const pending = this.#lifecycleQueue.splice(0);
        for (const call of pending) {
            await this.#invoke('lifecycle', call.method, ...call.args);
        }
    }
    async #waitForInitialConnection() {
        const initialization = this.initialize();
        await Promise.race([initialization, delay(1_900)]);
    }
    async #isAuthorized() {
        if (!this.#hasMethod('auth', 'isUserAuthorized')) {
            return false;
        }
        return (await this.#invoke('auth', 'isUserAuthorized')) === true;
    }
    async #analytics(method, ...args) {
        if (!this.#hasMethod('analytics', method)) {
            if (this.#debug) {
                console.info(`[Analytics preview] ${method}`, ...args);
            }
            return;
        }
        await this.#invoke('analytics', method, ...args);
    }
    async #invoke(moduleName, method, ...args) {
        const module = this.#module(moduleName);
        const callable = module?.[method];
        if (typeof callable !== 'function') {
            return undefined;
        }
        try {
            return await Reflect.apply(callable, module, args);
        }
        catch (error) {
            if (this.#debug) {
                console.warn(`[Arkadium bridge] ${moduleName}.${method} failed.`, error);
            }
            return undefined;
        }
    }
    #module(name) {
        const value = this.#sdk?.[name];
        return isRecord(value) ? value : null;
    }
    #hasMethod(moduleName, method) {
        return typeof this.#module(moduleName)?.[method] === 'function';
    }
    #setStandalone() {
        this.#status = 'standalone';
        this.dispatchEvent(new Event('standalone'));
    }
    #standaloneLoad(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }
    #standaloneSave(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch (error) {
            if (this.#debug) {
                console.warn('[Clockwork Conservatory] Local preview save failed.', error);
            }
        }
    }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
//# sourceMappingURL=arkadium.js.map