var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ArkadiumBridge_instances, _ArkadiumBridge_debug, _ArkadiumBridge_devReward, _ArkadiumBridge_version, _ArkadiumBridge_sdk, _ArkadiumBridge_status, _ArkadiumBridge_initialization, _ArkadiumBridge_lateConnectStarted, _ArkadiumBridge_readySent, _ArkadiumBridge_gameStarted, _ArkadiumBridge_gameEnded, _ArkadiumBridge_pauseHandler, _ArkadiumBridge_resumeHandler, _ArkadiumBridge_outbox, _ArkadiumBridge_flushing, _ArkadiumBridge_initializeInternal, _ArkadiumBridge_connectWithTimeout, _ArkadiumBridge_ensureSdkScript, _ArkadiumBridge_startLateConnection, _ArkadiumBridge_connectFromLoader, _ArkadiumBridge_configureAnalytics, _ArkadiumBridge_registerLifecycleCallbacks, _ArkadiumBridge_lifecycle, _ArkadiumBridge_flushLifecycleOutbox, _ArkadiumBridge_waitForInitialConnection, _ArkadiumBridge_isAuthorized, _ArkadiumBridge_analytics, _ArkadiumBridge_invoke, _ArkadiumBridge_module, _ArkadiumBridge_hasMethod, _ArkadiumBridge_setStatus, _ArkadiumBridge_standaloneLoad, _ArkadiumBridge_standaloneSave;
const SDK_URL = 'https://developers.arkadium.com/cdn/sdk/v2/sdk.js';
const OUTBOX_LIMIT = 96;
export class ArkadiumBridge extends EventTarget {
    constructor(version) {
        super();
        _ArkadiumBridge_instances.add(this);
        _ArkadiumBridge_debug.set(this, void 0);
        _ArkadiumBridge_devReward.set(this, void 0);
        _ArkadiumBridge_version.set(this, void 0);
        _ArkadiumBridge_sdk.set(this, null);
        _ArkadiumBridge_status.set(this, 'connecting');
        _ArkadiumBridge_initialization.set(this, null);
        _ArkadiumBridge_lateConnectStarted.set(this, false);
        _ArkadiumBridge_readySent.set(this, false);
        _ArkadiumBridge_gameStarted.set(this, false);
        _ArkadiumBridge_gameEnded.set(this, false);
        _ArkadiumBridge_pauseHandler.set(this, () => undefined);
        _ArkadiumBridge_resumeHandler.set(this, () => undefined);
        _ArkadiumBridge_outbox.set(this, []);
        _ArkadiumBridge_flushing.set(this, false);
        __classPrivateFieldSet(this, _ArkadiumBridge_version, version, "f");
        const params = new URLSearchParams(location.search);
        __classPrivateFieldSet(this, _ArkadiumBridge_debug, params.get('debug') === '1' || location.hostname === 'localhost' || location.hostname === '127.0.0.1', "f");
        __classPrivateFieldSet(this, _ArkadiumBridge_devReward, __classPrivateFieldGet(this, _ArkadiumBridge_debug, "f") && params.get('devReward') === '1', "f");
    }
    get version() { return __classPrivateFieldGet(this, _ArkadiumBridge_version, "f"); }
    get status() { return __classPrivateFieldGet(this, _ArkadiumBridge_status, "f"); }
    get connected() { return __classPrivateFieldGet(this, _ArkadiumBridge_status, "f") === 'connected'; }
    get rewardedAvailable() { return __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'ads', 'showRewardAd') || __classPrivateFieldGet(this, _ArkadiumBridge_devReward, "f"); }
    initialize() {
        __classPrivateFieldSet(this, _ArkadiumBridge_initialization, __classPrivateFieldGet(this, _ArkadiumBridge_initialization, "f") ?? __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_initializeInternal).call(this), "f");
        return __classPrivateFieldGet(this, _ArkadiumBridge_initialization, "f");
    }
    bindPauseHandlers(onPause, onResume) {
        __classPrivateFieldSet(this, _ArkadiumBridge_pauseHandler, onPause, "f");
        __classPrivateFieldSet(this, _ArkadiumBridge_resumeHandler, onResume, "f");
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_registerLifecycleCallbacks).call(this);
    }
    async markReady() {
        if (!__classPrivateFieldGet(this, _ArkadiumBridge_readySent, "f")) {
            __classPrivateFieldSet(this, _ArkadiumBridge_readySent, true, "f");
            await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onTestReady');
        }
    }
    async gameStart() {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_gameStarted, "f"))
            return;
        __classPrivateFieldSet(this, _ArkadiumBridge_gameStarted, true, "f");
        __classPrivateFieldSet(this, _ArkadiumBridge_gameEnded, false, "f");
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onGameStart');
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendStartButtonClickedEvent', 'New');
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendGameScreenPageView');
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendGameplayReadyEvent');
    }
    async gameEnd() {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_gameEnded, "f") || !__classPrivateFieldGet(this, _ArkadiumBridge_gameStarted, "f"))
            return;
        __classPrivateFieldSet(this, _ArkadiumBridge_gameEnded, true, "f");
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onGameEnd');
    }
    async levelStart(level) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onLevelStart', level);
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendRoundEvent', { round: level });
    }
    async levelEnd(level, score) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onLevelEnd', level);
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onChangeScore', score);
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendRoundEndEvent', 'Finished', { round: level, reason: 'Completed' });
    }
    async scoreChanged(score) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_lifecycle).call(this, 'onChangeScore', score);
    }
    async gameWon(score, elapsedSeconds) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendGameEndEvent', 'Win');
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendGameOverPageView', { score, timespent: Math.round(elapsedSeconds) });
    }
    async firstMove() { await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendFirstMoveEvent'); }
    async appStarted() {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendAppStartedEvent');
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendIntroScreenPageView');
    }
    async mainScreenReady() { await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendMainScreenReadyEvent'); }
    async menuAction(action) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendMenuActionsEvent', action);
    }
    async helpOpened() { await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendHelpEvent'); }
    async customEvent(category, action, dimensions) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendEvent', category, action, dimensions);
    }
    async reportError(error) {
        const normalized = error instanceof Error ? error : new Error(String(error));
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'sendErrorEvent', { reason: normalized.message.slice(0, 500) });
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_analytics).call(this, 'trackException', normalized);
        if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f"))
            console.error('[Clockwork Conservatory]', normalized);
    }
    async loadProgress(key) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_waitForInitialConnection).call(this);
        if (__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f")) {
            try {
                if (await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_isAuthorized).call(this)) {
                    const remote = await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'persistence', 'getRemoteStorageItem', key);
                    if (remote !== null && remote !== undefined)
                        return remote;
                }
                const local = await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'persistence', 'getLocalStorageItem', key);
                if (local !== null && local !== undefined)
                    return local;
            }
            catch (error) {
                await this.reportError(error);
            }
        }
        return __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_standaloneLoad).call(this, key);
    }
    async saveProgress(key, progress) {
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_standaloneSave).call(this, key, progress);
        if (!__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f"))
            return;
        try {
            await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'persistence', 'setLocalStorageItem', key, progress);
            if (await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_isAuthorized).call(this))
                await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'persistence', 'setRemoteStorageItem', key, progress);
        }
        catch (error) {
            await this.reportError(error);
        }
    }
    async showInterstitial() {
        if (!__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f") || !__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'ads', 'showInterstitialAd'))
            return;
        __classPrivateFieldGet(this, _ArkadiumBridge_pauseHandler, "f").call(this);
        try {
            await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'ads', 'showInterstitialAd');
        }
        catch (error) {
            await this.reportError(error);
        }
        finally {
            __classPrivateFieldGet(this, _ArkadiumBridge_resumeHandler, "f").call(this);
        }
    }
    async showRewarded() {
        if (!__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f") || !__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'ads', 'showRewardAd'))
            return __classPrivateFieldGet(this, _ArkadiumBridge_devReward, "f");
        __classPrivateFieldGet(this, _ArkadiumBridge_pauseHandler, "f").call(this);
        try {
            const response = await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'ads', 'showRewardAd');
            return isRecord(response) && typeof response.value === 'number' ? response.value > 0 : response === true;
        }
        catch (error) {
            await this.reportError(error);
            return false;
        }
        finally {
            __classPrivateFieldGet(this, _ArkadiumBridge_resumeHandler, "f").call(this);
        }
    }
    async postDailyScore(score) {
        if (!__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f") || !__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'leaderboard', 'postScore'))
            return false;
        try {
            if (__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'leaderboard', 'isSupported')) {
                const supported = await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'leaderboard', 'isSupported');
                if (supported === false)
                    return false;
            }
            await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'leaderboard', 'postScore', Math.round(score));
            return true;
        }
        catch (error) {
            await this.reportError(error);
            return false;
        }
    }
}
_ArkadiumBridge_debug = new WeakMap(), _ArkadiumBridge_devReward = new WeakMap(), _ArkadiumBridge_version = new WeakMap(), _ArkadiumBridge_sdk = new WeakMap(), _ArkadiumBridge_status = new WeakMap(), _ArkadiumBridge_initialization = new WeakMap(), _ArkadiumBridge_lateConnectStarted = new WeakMap(), _ArkadiumBridge_readySent = new WeakMap(), _ArkadiumBridge_gameStarted = new WeakMap(), _ArkadiumBridge_gameEnded = new WeakMap(), _ArkadiumBridge_pauseHandler = new WeakMap(), _ArkadiumBridge_resumeHandler = new WeakMap(), _ArkadiumBridge_outbox = new WeakMap(), _ArkadiumBridge_flushing = new WeakMap(), _ArkadiumBridge_instances = new WeakSet(), _ArkadiumBridge_initializeInternal = async function _ArkadiumBridge_initializeInternal() {
    const params = new URLSearchParams(location.search);
    const opaquePreview = location.protocol === 'file:' || location.protocol === 'data:' || location.protocol === 'about:';
    if (params.get('standalone') === '1' || (opaquePreview && !window.ArkadiumGameSDK)) {
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_setStatus).call(this, 'standalone');
        return;
    }
    const connected = await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_connectWithTimeout).call(this, 1800);
    if (!connected) {
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_setStatus).call(this, 'standalone');
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_startLateConnection).call(this);
    }
}, _ArkadiumBridge_connectWithTimeout = async function _ArkadiumBridge_connectWithTimeout(timeoutMs) {
    if (window.ArkadiumGameSDK)
        return __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_connectFromLoader).call(this, window.ArkadiumGameSDK);
    const script = __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_ensureSdkScript).call(this);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled)
                return;
            settled = true;
            window.clearTimeout(timeout);
            resolve(value);
        };
        const timeout = window.setTimeout(() => finish(false), timeoutMs);
        script.addEventListener('load', () => void __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_connectFromLoader).call(this, window.ArkadiumGameSDK).then(finish), { once: true });
        script.addEventListener('error', () => finish(false), { once: true });
    });
}, _ArkadiumBridge_ensureSdkScript = function _ArkadiumBridge_ensureSdkScript() {
    const existing = document.querySelector('script[data-arkadium-game-sdk]');
    if (existing)
        return existing;
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.arkadiumGameSdk = 'true';
    document.head.append(script);
    return script;
}, _ArkadiumBridge_startLateConnection = function _ArkadiumBridge_startLateConnection() {
    if (__classPrivateFieldGet(this, _ArkadiumBridge_lateConnectStarted, "f"))
        return;
    __classPrivateFieldSet(this, _ArkadiumBridge_lateConnectStarted, true, "f");
    const script = __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_ensureSdkScript).call(this);
    script.addEventListener('load', () => void __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_connectFromLoader).call(this, window.ArkadiumGameSDK), { once: true });
}, _ArkadiumBridge_connectFromLoader = async function _ArkadiumBridge_connectFromLoader(loader) {
    if (!loader)
        return false;
    try {
        const instance = await loader.getInstance();
        if (!isRecord(instance))
            return false;
        __classPrivateFieldSet(this, _ArkadiumBridge_sdk, instance, "f");
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_setStatus).call(this, 'connected');
        __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_registerLifecycleCallbacks).call(this);
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_configureAnalytics).call(this);
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_flushLifecycleOutbox).call(this);
        this.dispatchEvent(new Event('connected'));
        return true;
    }
    catch (error) {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f"))
            console.warn('[Arkadium bridge] SDK unavailable; continuing standalone.', error);
        return false;
    }
}, _ArkadiumBridge_configureAnalytics = async function _ArkadiumBridge_configureAnalytics() {
    if (!__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f"))
        return;
    const analytics = __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_module).call(this, 'analytics');
    if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f") && __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'analytics', 'configureProvider') && analytics?.CONSOLE !== undefined) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'analytics', 'configureProvider', { provider: analytics.CONSOLE, appId: 'clockwork-preview' });
    }
    const productionAppId = document.querySelector('meta[name="arkadium-app-insights-id"]')?.content.trim() ?? '';
    if (productionAppId && analytics?.APP_INSIGHTS !== undefined && __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'analytics', 'configureProvider')) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'analytics', 'configureProvider', { provider: analytics.APP_INSIGHTS, appId: productionAppId });
    }
    if (__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'analytics', 'setDimensions')) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'analytics', 'setDimensions', {
            gameVersion: __classPrivateFieldGet(this, _ArkadiumBridge_version, "f"),
            renderer: 'canvas2d-premium',
            aiMode: 'local-deterministic',
            artTier: 'premium-2.5d',
        });
    }
}, _ArkadiumBridge_registerLifecycleCallbacks = function _ArkadiumBridge_registerLifecycleCallbacks() {
    const lifecycle = __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_module).call(this, 'lifecycle');
    if (!lifecycle || typeof lifecycle.registerEventCallback !== 'function' || !isRecord(lifecycle.LifecycleEvent))
        return;
    try {
        const pauseEvent = lifecycle.LifecycleEvent.GAME_PAUSE;
        const resumeEvent = lifecycle.LifecycleEvent.GAME_RESUME;
        if (pauseEvent !== undefined)
            Reflect.apply(lifecycle.registerEventCallback, lifecycle, [pauseEvent, __classPrivateFieldGet(this, _ArkadiumBridge_pauseHandler, "f")]);
        if (resumeEvent !== undefined)
            Reflect.apply(lifecycle.registerEventCallback, lifecycle, [resumeEvent, __classPrivateFieldGet(this, _ArkadiumBridge_resumeHandler, "f")]);
    }
    catch (error) {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f"))
            console.warn('[Arkadium bridge] Lifecycle callback registration failed.', error);
    }
}, _ArkadiumBridge_lifecycle = async function _ArkadiumBridge_lifecycle(method, ...args) {
    window.__clockworkLifecycleLog ?? (window.__clockworkLifecycleLog = []);
    window.__clockworkLifecycleLog.push({ method, args: [...args] });
    if (__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f") && __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'lifecycle', method)) {
        await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'lifecycle', method, ...args);
        return;
    }
    __classPrivateFieldGet(this, _ArkadiumBridge_outbox, "f").push({ module: 'lifecycle', method, args });
    if (__classPrivateFieldGet(this, _ArkadiumBridge_outbox, "f").length > OUTBOX_LIMIT)
        __classPrivateFieldGet(this, _ArkadiumBridge_outbox, "f").splice(0, __classPrivateFieldGet(this, _ArkadiumBridge_outbox, "f").length - OUTBOX_LIMIT);
}, _ArkadiumBridge_flushLifecycleOutbox = async function _ArkadiumBridge_flushLifecycleOutbox() {
    if (__classPrivateFieldGet(this, _ArkadiumBridge_flushing, "f") || !__classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f"))
        return;
    __classPrivateFieldSet(this, _ArkadiumBridge_flushing, true, "f");
    try {
        while (__classPrivateFieldGet(this, _ArkadiumBridge_outbox, "f").length > 0) {
            const message = __classPrivateFieldGet(this, _ArkadiumBridge_outbox, "f").shift();
            if (__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, message.module, message.method))
                await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, message.module, message.method, ...message.args);
        }
    }
    finally {
        __classPrivateFieldSet(this, _ArkadiumBridge_flushing, false, "f");
    }
}, _ArkadiumBridge_waitForInitialConnection = async function _ArkadiumBridge_waitForInitialConnection() {
    await Promise.race([this.initialize(), delay(1900)]);
}, _ArkadiumBridge_isAuthorized = async function _ArkadiumBridge_isAuthorized() {
    if (!__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'auth', 'isUserAuthorized'))
        return false;
    return (await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'auth', 'isUserAuthorized')) === true;
}, _ArkadiumBridge_analytics = async function _ArkadiumBridge_analytics(method, ...args) {
    if (!__classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_hasMethod).call(this, 'analytics', method)) {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f"))
            console.info(`[Analytics preview] ${method}`, ...args);
        return;
    }
    await __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_invoke).call(this, 'analytics', method, ...args);
}, _ArkadiumBridge_invoke = async function _ArkadiumBridge_invoke(moduleName, method, ...args) {
    const module = __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_module).call(this, moduleName);
    const callable = module?.[method];
    if (typeof callable !== 'function')
        return undefined;
    try {
        return await Reflect.apply(callable, module, args);
    }
    catch (error) {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f"))
            console.warn(`[Arkadium bridge] ${moduleName}.${method} failed.`, error);
        return undefined;
    }
}, _ArkadiumBridge_module = function _ArkadiumBridge_module(name) {
    const value = __classPrivateFieldGet(this, _ArkadiumBridge_sdk, "f")?.[name];
    return isRecord(value) ? value : null;
}, _ArkadiumBridge_hasMethod = function _ArkadiumBridge_hasMethod(moduleName, method) {
    return typeof __classPrivateFieldGet(this, _ArkadiumBridge_instances, "m", _ArkadiumBridge_module).call(this, moduleName)?.[method] === 'function';
}, _ArkadiumBridge_setStatus = function _ArkadiumBridge_setStatus(status) {
    __classPrivateFieldSet(this, _ArkadiumBridge_status, status, "f");
    this.dispatchEvent(new CustomEvent('status', { detail: status }));
}, _ArkadiumBridge_standaloneLoad = function _ArkadiumBridge_standaloneLoad(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}, _ArkadiumBridge_standaloneSave = function _ArkadiumBridge_standaloneSave(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch (error) {
        if (__classPrivateFieldGet(this, _ArkadiumBridge_debug, "f"))
            console.warn('[Clockwork Conservatory] Local save failed.', error);
    }
};
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
//# sourceMappingURL=arkadium.js.map