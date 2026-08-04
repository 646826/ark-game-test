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
var _ClockworkGame_instances, _ClockworkGame_app, _ClockworkGame_canvas, _ClockworkGame_menuOverlay, _ClockworkGame_hud, _ClockworkGame_toolbar, _ClockworkGame_coach, _ClockworkGame_completion, _ClockworkGame_pauseOverlay, _ClockworkGame_loading, _ClockworkGame_toast, _ClockworkGame_live, _ClockworkGame_modal, _ClockworkGame_modalContent, _ClockworkGame_renderer, _ClockworkGame_audio, _ClockworkGame_bridge, _ClockworkGame_i18n, _ClockworkGame_version, _ClockworkGame_progress, _ClockworkGame_puzzle, _ClockworkGame_analysis, _ClockworkGame_screen, _ClockworkGame_modalKind, _ClockworkGame_selectedId, _ClockworkGame_tutorialTarget, _ClockworkGame_history, _ClockworkGame_moves, _ClockworkGame_hintsUsed, _ClockworkGame_elapsedBase, _ClockworkGame_runStartedAt, _ClockworkGame_timing, _ClockworkGame_completionPending, _ClockworkGame_hintBusy, _ClockworkGame_firstMoveSent, _ClockworkGame_pauseReasons, _ClockworkGame_saveTimer, _ClockworkGame_toastTimer, _ClockworkGame_hudTimer, _ClockworkGame_bindEvents, _ClockworkGame_handleAction, _ClockworkGame_startMode, _ClockworkGame_activatePuzzle, _ClockworkGame_restoreSnapshot, _ClockworkGame_handleKey, _ClockworkGame_handleControlChange, _ClockworkGame_rotateTile, _ClockworkGame_undo, _ClockworkGame_useHint, _ClockworkGame_completePuzzle, _ClockworkGame_renderCompletion, _ClockworkGame_nextPuzzle, _ClockworkGame_replayPuzzle, _ClockworkGame_restartPuzzle, _ClockworkGame_showMenu, _ClockworkGame_renderMenu, _ClockworkGame_renderHud, _ClockworkGame_renderTutorial, _ClockworkGame_findTutorialTarget, _ClockworkGame_moveSelection, _ClockworkGame_renderCanvasLabel, _ClockworkGame_applySettings, _ClockworkGame_applyTranslations, _ClockworkGame_renderSdkStatus, _ClockworkGame_openHelp, _ClockworkGame_openSettings, _ClockworkGame_openRestart, _ClockworkGame_openMap, _ClockworkGame_showModal, _ClockworkGame_closeModal, _ClockworkGame_resumeTiming, _ClockworkGame_pauseTiming, _ClockworkGame_currentElapsed, _ClockworkGame_captureActiveRun, _ClockworkGame_scheduleSave, _ClockworkGame_saveNow, _ClockworkGame_updateDailyStreak, _ClockworkGame_showToast, _ClockworkGame_announce;
import { analyzeBoard, rotationPeriod } from '../core/board.js';
import { dailySeed, generatePuzzle } from '../core/generator.js';
import { hashSeed } from '../core/random.js';
import { suggestHint } from '../core/hints.js';
import { createDefaultProgress, sanitizeProgress, SAVE_KEY, specimenForLevel } from '../core/progress.js';
import { calculateCompletion } from '../core/scoring.js';
import { detectLanguage, I18n, isLanguage } from '../ui/i18n.js';
import { shellTemplate } from '../ui/shell.js';
import { AudioEngine } from './audio.js';
import { ConservatoryRenderer } from './renderer.js';
const FREE_HINTS = 3;
const CHAMBER_SIZE = 6;
export class ClockworkGame {
    constructor(app, bridge, version) {
        _ClockworkGame_instances.add(this);
        _ClockworkGame_app.set(this, void 0);
        _ClockworkGame_canvas.set(this, void 0);
        _ClockworkGame_menuOverlay.set(this, void 0);
        _ClockworkGame_hud.set(this, void 0);
        _ClockworkGame_toolbar.set(this, void 0);
        _ClockworkGame_coach.set(this, void 0);
        _ClockworkGame_completion.set(this, void 0);
        _ClockworkGame_pauseOverlay.set(this, void 0);
        _ClockworkGame_loading.set(this, void 0);
        _ClockworkGame_toast.set(this, void 0);
        _ClockworkGame_live.set(this, void 0);
        _ClockworkGame_modal.set(this, void 0);
        _ClockworkGame_modalContent.set(this, void 0);
        _ClockworkGame_renderer.set(this, void 0);
        _ClockworkGame_audio.set(this, new AudioEngine());
        _ClockworkGame_bridge.set(this, void 0);
        _ClockworkGame_i18n.set(this, void 0);
        _ClockworkGame_version.set(this, void 0);
        _ClockworkGame_progress.set(this, void 0);
        _ClockworkGame_puzzle.set(this, null);
        _ClockworkGame_analysis.set(this, null);
        _ClockworkGame_screen.set(this, 'loading');
        _ClockworkGame_modalKind.set(this, null);
        _ClockworkGame_selectedId.set(this, null);
        _ClockworkGame_tutorialTarget.set(this, null);
        _ClockworkGame_history.set(this, []);
        _ClockworkGame_moves.set(this, 0);
        _ClockworkGame_hintsUsed.set(this, 0);
        _ClockworkGame_elapsedBase.set(this, 0);
        _ClockworkGame_runStartedAt.set(this, 0);
        _ClockworkGame_timing.set(this, false);
        _ClockworkGame_completionPending.set(this, false);
        _ClockworkGame_hintBusy.set(this, false);
        _ClockworkGame_firstMoveSent.set(this, false);
        _ClockworkGame_pauseReasons.set(this, new Set());
        _ClockworkGame_saveTimer.set(this, 0);
        _ClockworkGame_toastTimer.set(this, 0);
        _ClockworkGame_hudTimer.set(this, 0);
        __classPrivateFieldSet(this, _ClockworkGame_app, app, "f");
        __classPrivateFieldSet(this, _ClockworkGame_bridge, bridge, "f");
        __classPrivateFieldSet(this, _ClockworkGame_version, version, "f");
        __classPrivateFieldSet(this, _ClockworkGame_i18n, new I18n(detectLanguage()), "f");
        __classPrivateFieldSet(this, _ClockworkGame_progress, createDefaultProgress(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").language), "f");
        app.innerHTML = shellTemplate();
        __classPrivateFieldSet(this, _ClockworkGame_canvas, must(app, '#game-canvas'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_menuOverlay, must(app, '#menu-overlay'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_hud, must(app, '#game-hud'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_toolbar, must(app, '#game-toolbar'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_coach, must(app, '#coach-overlay'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_completion, must(app, '#completion-overlay'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_pauseOverlay, must(app, '#pause-overlay'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_loading, must(app, '#loading-overlay'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_toast, must(app, '#toast'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_live, must(app, '#live-region'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_modal, must(app, '#game-modal'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_modalContent, must(app, '#modal-content'), "f");
        __classPrivateFieldSet(this, _ClockworkGame_renderer, new ConservatoryRenderer(__classPrivateFieldGet(this, _ClockworkGame_canvas, "f")), "f");
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_bindEvents).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").bindPauseHandlers(() => this.pause('host'), () => this.resume('host'));
        __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").addEventListener('status', () => __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderSdkStatus).call(this));
        __classPrivateFieldSet(this, _ClockworkGame_hudTimer, window.setInterval(() => __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this), 200), "f");
    }
    async initialize() {
        __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.loaded = 'false';
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_applyTranslations).call(this);
        void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").initialize();
        const [raw] = await Promise.all([
            __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").loadProgress(SAVE_KEY).catch((error) => {
                void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").reportError(error);
                return null;
            }),
            __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").preload(),
            delay(420),
        ]);
        __classPrivateFieldSet(this, _ClockworkGame_progress, sanitizeProgress(raw, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").language), "f");
        __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").language = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.language;
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_applySettings).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_applyTranslations).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showMenu).call(this, false);
        __classPrivateFieldGet(this, _ClockworkGame_loading, "f").hidden = true;
        __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.loaded = 'true';
        __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.version = __classPrivateFieldGet(this, _ClockworkGame_version, "f");
        await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").markReady();
        await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").appStarted();
        await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").mainScreenReady();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_announce).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('title'));
        const autostart = new URLSearchParams(location.search).get('autostart');
        if (autostart === 'campaign' || autostart === 'daily' || autostart === 'zen') {
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_startMode).call(this, autostart, false);
        }
    }
    destroy() {
        window.clearInterval(__classPrivateFieldGet(this, _ClockworkGame_hudTimer, "f"));
        window.clearTimeout(__classPrivateFieldGet(this, _ClockworkGame_saveTimer, "f"));
        window.clearTimeout(__classPrivateFieldGet(this, _ClockworkGame_toastTimer, "f"));
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").destroy();
    }
    pause(reason) {
        const alreadyPaused = __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").size > 0;
        __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").add(reason);
        if (!alreadyPaused && __classPrivateFieldGet(this, _ClockworkGame_screen, "f") === 'playing') {
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_pauseTiming).call(this);
            __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").pause();
            void __classPrivateFieldGet(this, _ClockworkGame_audio, "f").suspend();
        }
        if ((reason === 'host' || reason === 'manual') && __classPrivateFieldGet(this, _ClockworkGame_screen, "f") === 'playing') {
            __classPrivateFieldGet(this, _ClockworkGame_pauseOverlay, "f").hidden = false;
        }
    }
    resume(reason) {
        __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").delete(reason);
        if (__classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").size > 0 || __classPrivateFieldGet(this, _ClockworkGame_screen, "f") !== 'playing')
            return;
        __classPrivateFieldGet(this, _ClockworkGame_pauseOverlay, "f").hidden = true;
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").resume();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_resumeTiming).call(this);
        void __classPrivateFieldGet(this, _ClockworkGame_audio, "f").resume();
        requestAnimationFrame(() => __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").focus({ preventScroll: true }));
    }
}
_ClockworkGame_app = new WeakMap(), _ClockworkGame_canvas = new WeakMap(), _ClockworkGame_menuOverlay = new WeakMap(), _ClockworkGame_hud = new WeakMap(), _ClockworkGame_toolbar = new WeakMap(), _ClockworkGame_coach = new WeakMap(), _ClockworkGame_completion = new WeakMap(), _ClockworkGame_pauseOverlay = new WeakMap(), _ClockworkGame_loading = new WeakMap(), _ClockworkGame_toast = new WeakMap(), _ClockworkGame_live = new WeakMap(), _ClockworkGame_modal = new WeakMap(), _ClockworkGame_modalContent = new WeakMap(), _ClockworkGame_renderer = new WeakMap(), _ClockworkGame_audio = new WeakMap(), _ClockworkGame_bridge = new WeakMap(), _ClockworkGame_i18n = new WeakMap(), _ClockworkGame_version = new WeakMap(), _ClockworkGame_progress = new WeakMap(), _ClockworkGame_puzzle = new WeakMap(), _ClockworkGame_analysis = new WeakMap(), _ClockworkGame_screen = new WeakMap(), _ClockworkGame_modalKind = new WeakMap(), _ClockworkGame_selectedId = new WeakMap(), _ClockworkGame_tutorialTarget = new WeakMap(), _ClockworkGame_history = new WeakMap(), _ClockworkGame_moves = new WeakMap(), _ClockworkGame_hintsUsed = new WeakMap(), _ClockworkGame_elapsedBase = new WeakMap(), _ClockworkGame_runStartedAt = new WeakMap(), _ClockworkGame_timing = new WeakMap(), _ClockworkGame_completionPending = new WeakMap(), _ClockworkGame_hintBusy = new WeakMap(), _ClockworkGame_firstMoveSent = new WeakMap(), _ClockworkGame_pauseReasons = new WeakMap(), _ClockworkGame_saveTimer = new WeakMap(), _ClockworkGame_toastTimer = new WeakMap(), _ClockworkGame_hudTimer = new WeakMap(), _ClockworkGame_instances = new WeakSet(), _ClockworkGame_bindEvents = function _ClockworkGame_bindEvents() {
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").addEventListener('pointerdown', () => void __classPrivateFieldGet(this, _ClockworkGame_audio, "f").unlock(), { passive: true });
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").addEventListener('click', (event) => {
        const element = event.target instanceof Element ? event.target.closest('[data-action]') : null;
        if (!element || element.hasAttribute('disabled'))
            return;
        const action = element.dataset.action;
        if (!action)
            return;
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").click();
        void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_handleAction).call(this, action);
    });
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").addEventListener('change', (event) => __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_handleControlChange).call(this, event));
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").addEventListener('pointerup', (event) => {
        if (__classPrivateFieldGet(this, _ClockworkGame_screen, "f") !== 'playing' || __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").size > 0 || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f"))
            return;
        const id = __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").hitTest(event.clientX, event.clientY);
        if (!id)
            return;
        __classPrivateFieldSet(this, _ClockworkGame_selectedId, id, "f");
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(id);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_rotateTile).call(this, id);
    });
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").addEventListener('pointermove', (event) => {
        if (__classPrivateFieldGet(this, _ClockworkGame_screen, "f") !== 'playing' || __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").size > 0 || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f")) {
            __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setHovered(null);
            return;
        }
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setHovered(__classPrivateFieldGet(this, _ClockworkGame_renderer, "f").hitTest(event.clientX, event.clientY));
    });
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").addEventListener('pointerleave', () => __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setHovered(null));
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").addEventListener('keydown', (event) => __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_handleKey).call(this, event));
    __classPrivateFieldGet(this, _ClockworkGame_modal, "f").addEventListener('close', () => {
        __classPrivateFieldSet(this, _ClockworkGame_modalKind, null, "f");
        this.resume('modal');
    });
    __classPrivateFieldGet(this, _ClockworkGame_modal, "f").addEventListener('cancel', () => {
        __classPrivateFieldSet(this, _ClockworkGame_modalKind, null, "f");
        this.resume('modal');
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            this.pause('visibility');
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
        }
        else {
            this.resume('visibility');
        }
    });
    window.addEventListener('blur', () => this.pause('visibility'));
    window.addEventListener('focus', () => {
        if (!document.hidden)
            this.resume('visibility');
    });
    window.addEventListener('pagehide', () => {
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_pauseTiming).call(this);
        void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_saveNow).call(this);
        void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").gameEnd();
        void __classPrivateFieldGet(this, _ClockworkGame_audio, "f").suspend();
    });
    window.addEventListener('error', (event) => void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").reportError(event.error ?? event.message));
    window.addEventListener('unhandledrejection', (event) => void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").reportError(event.reason));
}, _ClockworkGame_handleAction = async function _ClockworkGame_handleAction(action) {
    switch (action) {
        case 'continue':
            if (__classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun)
                await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_startMode).call(this, __classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun.mode, true);
            break;
        case 'campaign':
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_startMode).call(this, 'campaign', false);
            break;
        case 'daily':
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_startMode).call(this, 'daily', false);
            break;
        case 'zen':
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_startMode).call(this, 'zen', false);
            break;
        case 'map':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_openMap).call(this);
            break;
        case 'help':
            await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").helpOpened();
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_openHelp).call(this);
            break;
        case 'settings':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_openSettings).call(this);
            break;
        case 'close-modal':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_closeModal).call(this);
            break;
        case 'rotate-left':
            __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").rotateView(-1);
            break;
        case 'rotate-right':
            __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").rotateView(1);
            break;
        case 'undo':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_undo).call(this);
            break;
        case 'hint':
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_useHint).call(this);
            break;
        case 'toggle-sound':
            __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound = !__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound;
            __classPrivateFieldGet(this, _ClockworkGame_audio, "f").setEnabled(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound);
            await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").menuAction(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound ? 'Sound_On' : 'Sound_Off');
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
            break;
        case 'restart':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_openRestart).call(this);
            break;
        case 'confirm-restart':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_closeModal).call(this);
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_restartPuzzle).call(this);
            break;
        case 'coach-focus':
            if (__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f")) {
                __classPrivateFieldSet(this, _ClockworkGame_selectedId, __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"), "f");
                __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"));
                __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"));
                __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").focus({ preventScroll: true });
            }
            break;
        case 'pause':
            this.pause('manual');
            break;
        case 'resume':
            this.resume('manual');
            break;
        case 'menu':
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showMenu).call(this, true);
            break;
        case 'next':
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_nextPuzzle).call(this);
            break;
        case 'replay':
            await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_replayPuzzle).call(this);
            break;
        default:
            break;
    }
}, _ClockworkGame_startMode = async function _ClockworkGame_startMode(mode, resumePreferred) {
    const snapshot = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun;
    const todaySeed = dailySeed();
    const todayLevel = dailyDifficultyLevel(todaySeed);
    const canResume = resumePreferred && snapshot !== undefined && (snapshot.mode !== 'daily' || (snapshot.seed === todaySeed && snapshot.level === todayLevel));
    let puzzle;
    let moves = 0;
    let elapsed = 0;
    if (canResume && snapshot) {
        puzzle = __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_restoreSnapshot).call(this, snapshot);
        moves = snapshot.moves;
        elapsed = snapshot.elapsedMs;
    }
    else {
        const level = mode === 'campaign'
            ? __classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel
            : mode === 'daily'
                ? todayLevel
                : Math.max(4, __classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel);
        const seed = mode === 'daily'
            ? todaySeed
            : mode === 'campaign'
                ? `campaign:${level}:premium-v3`
                : `zen:${Date.now()}:${Math.floor(Math.random() * 1000000)}`;
        puzzle = generatePuzzle({ seed, mode, level });
    }
    await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_activatePuzzle).call(this, puzzle, moves, elapsed);
    if (canResume)
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('saveRestored'));
}, _ClockworkGame_activatePuzzle = async function _ClockworkGame_activatePuzzle(puzzle, moves = 0, elapsed = 0) {
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_pauseTiming).call(this);
    __classPrivateFieldSet(this, _ClockworkGame_moves, moves, "f");
    __classPrivateFieldSet(this, _ClockworkGame_elapsedBase, elapsed, "f");
    __classPrivateFieldSet(this, _ClockworkGame_puzzle, puzzle, "f");
    __classPrivateFieldSet(this, _ClockworkGame_analysis, analyzeBoard(puzzle), "f");
    __classPrivateFieldSet(this, _ClockworkGame_history, [], "f");
    __classPrivateFieldSet(this, _ClockworkGame_hintsUsed, 0, "f");
    __classPrivateFieldSet(this, _ClockworkGame_completionPending, false, "f");
    __classPrivateFieldSet(this, _ClockworkGame_hintBusy, false, "f");
    __classPrivateFieldSet(this, _ClockworkGame_firstMoveSent, false, "f");
    __classPrivateFieldSet(this, _ClockworkGame_selectedId, puzzle.sourceId, "f");
    __classPrivateFieldSet(this, _ClockworkGame_tutorialTarget, __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_findTutorialTarget).call(this, puzzle), "f");
    if (__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"))
        __classPrivateFieldSet(this, _ClockworkGame_selectedId, __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"), "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setPuzzle(puzzle);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setAnalysis(__classPrivateFieldGet(this, _ClockworkGame_analysis, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(__classPrivateFieldGet(this, _ClockworkGame_selectedId, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints ? __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") : null);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setScene('game');
    __classPrivateFieldSet(this, _ClockworkGame_screen, 'playing', "f");
    __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").clear();
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.screen = 'playing';
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.mode = puzzle.mode;
    __classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_completion, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_pauseOverlay, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_hud, "f").hidden = false;
    __classPrivateFieldGet(this, _ClockworkGame_toolbar, "f").hidden = false;
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").tabIndex = 0;
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").resume();
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_resumeTiming).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderTutorial).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").gameStart();
    await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").levelStart(puzzle.level);
    await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").customEvent('Puzzle', 'Level_Start', {
        mode: puzzle.mode,
        level: puzzle.level,
        tier: puzzle.config.tier,
        activeTiles: puzzle.tiles.length,
        plants: __classPrivateFieldGet(this, _ClockworkGame_analysis, "f").totalPlants,
        artTier: 'premium-2.5d',
    });
    if (__classPrivateFieldGet(this, _ClockworkGame_analysis, "f").solved && !__classPrivateFieldGet(this, _ClockworkGame_completionPending, "f")) {
        __classPrivateFieldSet(this, _ClockworkGame_completionPending, true, "f");
        window.setTimeout(() => void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_completePuzzle).call(this), __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion ? 40 : 180);
    }
    requestAnimationFrame(() => __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").focus({ preventScroll: true }));
}, _ClockworkGame_restoreSnapshot = function _ClockworkGame_restoreSnapshot(snapshot) {
    const puzzle = generatePuzzle({ seed: snapshot.seed, mode: snapshot.mode, level: snapshot.level });
    if (snapshot.rotations.length === puzzle.tiles.length) {
        puzzle.tiles.forEach((tile, index) => {
            const period = rotationPeriod(tile.baseMask);
            const observed = snapshot.rotations[index] ?? 0;
            const rotation = ((Math.floor(observed) % period) + period) % period;
            tile.rotation = rotation;
            tile.visualTurns = rotation;
        });
    }
    return puzzle;
}, _ClockworkGame_handleKey = function _ClockworkGame_handleKey(event) {
    if (__classPrivateFieldGet(this, _ClockworkGame_screen, "f") !== 'playing' || __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").size > 0 || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f"))
        return;
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
        event.preventDefault();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_moveSelection).call(this, key);
        return;
    }
    if (key === 'enter' || key === ' ') {
        event.preventDefault();
        if (__classPrivateFieldGet(this, _ClockworkGame_selectedId, "f"))
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_rotateTile).call(this, __classPrivateFieldGet(this, _ClockworkGame_selectedId, "f"));
        return;
    }
    if (key === 'z') {
        event.preventDefault();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_undo).call(this);
    }
    else if (key === 'h') {
        event.preventDefault();
        void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_useHint).call(this);
    }
    else if (key === 'q') {
        event.preventDefault();
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").rotateView(-1);
    }
    else if (key === 'e') {
        event.preventDefault();
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").rotateView(1);
    }
    else if (key === 'r') {
        event.preventDefault();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_openRestart).call(this);
    }
    else if (key === 'm') {
        event.preventDefault();
        void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_handleAction).call(this, 'toggle-sound');
    }
    else if (key === 'escape') {
        event.preventDefault();
        this.pause('manual');
    }
}, _ClockworkGame_handleControlChange = function _ClockworkGame_handleControlChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))
        return;
    if (target.id === 'language-select' && isLanguage(target.value)) {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.language = target.value;
        __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").language = target.value;
        document.documentElement.lang = target.value;
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_applyTranslations).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
        if (__classPrivateFieldGet(this, _ClockworkGame_modalKind, "f") === 'settings')
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_openSettings).call(this, true);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    }
    else if (target.id === 'setting-sound' && target instanceof HTMLInputElement) {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound = target.checked;
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").setEnabled(target.checked);
        void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").menuAction(target.checked ? 'Sound_On' : 'Sound_Off');
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    }
    else if (target.id === 'setting-motion' && target instanceof HTMLInputElement) {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion = target.checked;
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_applySettings).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    }
    else if (target.id === 'setting-contrast' && target instanceof HTMLInputElement) {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.highContrast = target.checked;
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_applySettings).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    }
    else if (target.id === 'setting-tutorial' && target instanceof HTMLInputElement) {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints = target.checked;
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(target.checked ? __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") : null);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderTutorial).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    }
    else if (target.id === 'quality-select' && isQuality(target.value)) {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.quality = target.value;
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setQuality(target.value);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this, 0);
    }
}, _ClockworkGame_rotateTile = function _ClockworkGame_rotateTile(tileId) {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    const previous = __classPrivateFieldGet(this, _ClockworkGame_analysis, "f");
    if (!puzzle || !previous)
        return;
    const tile = puzzle.tiles.find((candidate) => candidate.id === tileId);
    if (!tile)
        return;
    if (__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") && __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints && tileId !== __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f")) {
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").denied();
        __classPrivateFieldSet(this, _ClockworkGame_selectedId, __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"), "f");
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"));
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"));
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('wrongTutorial'));
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
        return;
    }
    const period = rotationPeriod(tile.baseMask);
    if (tile.fixed || period === 1) {
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").denied();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('fixed'));
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_announce).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('fixed'));
        return;
    }
    __classPrivateFieldGet(this, _ClockworkGame_history, "f").push({ tileId, rotation: tile.rotation, visualTurns: tile.visualTurns });
    tile.rotation = (tile.rotation + 1) % period;
    tile.visualTurns += 1;
    __classPrivateFieldSet(this, _ClockworkGame_moves, __classPrivateFieldGet(this, _ClockworkGame_moves, "f") + 1, "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").syncTile(tile);
    __classPrivateFieldSet(this, _ClockworkGame_analysis, analyzeBoard(puzzle), "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setAnalysis(__classPrivateFieldGet(this, _ClockworkGame_analysis, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").clearHint();
    if (!__classPrivateFieldGet(this, _ClockworkGame_firstMoveSent, "f")) {
        __classPrivateFieldSet(this, _ClockworkGame_firstMoveSent, true, "f");
        void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").firstMove();
    }
    if (__classPrivateFieldGet(this, _ClockworkGame_analysis, "f").poweredPlants > previous.poweredPlants || __classPrivateFieldGet(this, _ClockworkGame_analysis, "f").powered.size > previous.powered.size)
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").connect();
    else
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").turn();
    __classPrivateFieldSet(this, _ClockworkGame_tutorialTarget, __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_findTutorialTarget).call(this, puzzle), "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints ? __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") : null);
    __classPrivateFieldSet(this, _ClockworkGame_selectedId, __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") ?? tile.id, "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(__classPrivateFieldGet(this, _ClockworkGame_selectedId, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderTutorial).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this);
    if (__classPrivateFieldGet(this, _ClockworkGame_analysis, "f").solved && !__classPrivateFieldGet(this, _ClockworkGame_completionPending, "f")) {
        __classPrivateFieldSet(this, _ClockworkGame_completionPending, true, "f");
        __classPrivateFieldGet(this, _ClockworkGame_coach, "f").hidden = true;
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(null);
        window.setTimeout(() => void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_completePuzzle).call(this), __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion ? 90 : 620);
    }
}, _ClockworkGame_undo = function _ClockworkGame_undo() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    const record = __classPrivateFieldGet(this, _ClockworkGame_history, "f").pop();
    if (!puzzle || !record || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f")) {
        __classPrivateFieldGet(this, _ClockworkGame_audio, "f").denied();
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('undoEmpty'));
        return;
    }
    const tile = puzzle.tiles.find((candidate) => candidate.id === record.tileId);
    if (!tile)
        return;
    tile.rotation = record.rotation;
    tile.visualTurns = record.visualTurns;
    __classPrivateFieldSet(this, _ClockworkGame_moves, __classPrivateFieldGet(this, _ClockworkGame_moves, "f") + 1, "f");
    __classPrivateFieldSet(this, _ClockworkGame_analysis, analyzeBoard(puzzle), "f");
    __classPrivateFieldSet(this, _ClockworkGame_selectedId, tile.id, "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(tile.id);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setAnalysis(__classPrivateFieldGet(this, _ClockworkGame_analysis, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").syncTile(tile);
    __classPrivateFieldSet(this, _ClockworkGame_tutorialTarget, __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_findTutorialTarget).call(this, puzzle), "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints ? __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") : null);
    __classPrivateFieldGet(this, _ClockworkGame_audio, "f").undo();
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderTutorial).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this);
}, _ClockworkGame_useHint = async function _ClockworkGame_useHint() {
    if (!__classPrivateFieldGet(this, _ClockworkGame_puzzle, "f") || !__classPrivateFieldGet(this, _ClockworkGame_analysis, "f") || __classPrivateFieldGet(this, _ClockworkGame_hintBusy, "f") || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f"))
        return;
    __classPrivateFieldSet(this, _ClockworkGame_hintBusy, true, "f");
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('hintThinking'), 2000);
    if (__classPrivateFieldGet(this, _ClockworkGame_hintsUsed, "f") >= FREE_HINTS) {
        const rewarded = await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").showRewarded();
        if (!rewarded) {
            __classPrivateFieldSet(this, _ClockworkGame_hintBusy, false, "f");
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('adUnavailable'));
            __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
            return;
        }
    }
    await delay(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion ? 30 : 320);
    const suggestion = suggestHint(__classPrivateFieldGet(this, _ClockworkGame_puzzle, "f"));
    __classPrivateFieldSet(this, _ClockworkGame_hintBusy, false, "f");
    if (!suggestion) {
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('noHint'));
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
        return;
    }
    const tile = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").tiles.find((candidate) => candidate.id === suggestion.tileId);
    if (!tile)
        return;
    __classPrivateFieldSet(this, _ClockworkGame_hintsUsed, __classPrivateFieldGet(this, _ClockworkGame_hintsUsed, "f") + 1, "f");
    __classPrivateFieldSet(this, _ClockworkGame_selectedId, tile.id, "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(tile.id);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setHint(tile.id);
    __classPrivateFieldGet(this, _ClockworkGame_audio, "f").hint();
    const turns = suggestion.rotations === 1
        ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('once')
        : suggestion.rotations === 2
            ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('twice')
            : __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('threeTimes');
    const message = __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('hintInstruction', { row: tile.y + 1, column: tile.x + 1, turns });
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showToast).call(this, message, 5000);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_announce).call(this, message);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderHud).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_scheduleSave).call(this);
    await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").customEvent('Garden_Hint', suggestion.reason, {
        level: __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").level,
        mode: __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").mode,
        rotations: suggestion.rotations,
        hintsUsed: __classPrivateFieldGet(this, _ClockworkGame_hintsUsed, "f"),
    });
}, _ClockworkGame_completePuzzle = async function _ClockworkGame_completePuzzle() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    const analysis = __classPrivateFieldGet(this, _ClockworkGame_analysis, "f");
    if (!puzzle || !analysis || !analysis.solved) {
        __classPrivateFieldSet(this, _ClockworkGame_completionPending, false, "f");
        return;
    }
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_pauseTiming).call(this);
    const elapsedMs = __classPrivateFieldGet(this, _ClockworkGame_elapsedBase, "f");
    const stats = calculateCompletion(puzzle, __classPrivateFieldGet(this, _ClockworkGame_moves, "f"), __classPrivateFieldGet(this, _ClockworkGame_hintsUsed, "f"), elapsedMs);
    __classPrivateFieldGet(this, _ClockworkGame_progress, "f").totalScore += stats.score;
    __classPrivateFieldGet(this, _ClockworkGame_progress, "f").totalStars += stats.stars;
    __classPrivateFieldGet(this, _ClockworkGame_progress, "f").completedLevels += 1;
    let unlocked = null;
    if (puzzle.mode === 'campaign') {
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel = Math.max(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel, puzzle.level + 1);
        unlocked = specimenForLevel(puzzle.level);
        if (unlocked && !__classPrivateFieldGet(this, _ClockworkGame_progress, "f").unlockedSpecimens.includes(unlocked))
            __classPrivateFieldGet(this, _ClockworkGame_progress, "f").unlockedSpecimens.push(unlocked);
    }
    let dailyIsBest = false;
    if (puzzle.mode === 'daily') {
        const date = puzzle.seed.replace('daily:', '');
        const previousBest = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").bestDaily[date] ?? 0;
        if (stats.score > previousBest) {
            __classPrivateFieldGet(this, _ClockworkGame_progress, "f").bestDaily[date] = stats.score;
            dailyIsBest = true;
        }
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_updateDailyStreak).call(this, date);
    }
    delete __classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun;
    window.clearTimeout(__classPrivateFieldGet(this, _ClockworkGame_saveTimer, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_coach, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_toolbar, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.state = 'celebrating';
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setCoach(null);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setScene('victory');
    __classPrivateFieldGet(this, _ClockworkGame_audio, "f").bloom();
    const duration = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion ? 360 : 2150;
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").startVictorySequence(duration);
    const platformWork = (async () => {
        await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_saveNow).call(this, false);
        await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").levelEnd(puzzle.level, stats.score);
        await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").gameWon(stats.score, elapsedMs / 1000);
        return puzzle.mode === 'daily' ? __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").postDailyScore(stats.score) : false;
    })();
    const [, leaderboardPosted] = await Promise.all([delay(duration), platformWork]);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCompletion).call(this, stats, dailyIsBest, leaderboardPosted, unlocked);
    __classPrivateFieldSet(this, _ClockworkGame_screen, 'complete', "f");
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.screen = 'complete';
    delete __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.state;
    __classPrivateFieldGet(this, _ClockworkGame_hud, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_completion, "f").hidden = false;
    __classPrivateFieldGet(this, _ClockworkGame_completion, "f").classList.remove('enter');
    void __classPrivateFieldGet(this, _ClockworkGame_completion, "f").offsetWidth;
    __classPrivateFieldGet(this, _ClockworkGame_completion, "f").classList.add('enter');
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").tabIndex = -1;
    __classPrivateFieldSet(this, _ClockworkGame_completionPending, false, "f");
    __classPrivateFieldGet(this, _ClockworkGame_completion, "f").querySelector('[data-action="next"]')?.focus({ preventScroll: true });
}, _ClockworkGame_renderCompletion = function _ClockworkGame_renderCompletion(stats, dailyIsBest, leaderboardPosted, unlocked) {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    if (!puzzle)
        return;
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-completion-grade]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(stats.stars === 3 ? 'perfect' : stats.stars === 2 ? 'graceful' : 'complete'));
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-completion-title]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('restored'));
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-stars]', '★'.repeat(stats.stars) + '☆'.repeat(3 - stats.stars));
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-final-score]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(stats.score));
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-final-moves]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(stats.moves));
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-final-time]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").time(stats.elapsedMs));
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-record]', dailyIsBest ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('newRecord') : '');
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-unlock]', unlocked ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('specimenUnlocked', { name: __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(unlocked) }) : '');
    setText(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-leaderboard]', puzzle.mode === 'daily' ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(leaderboardPosted ? 'leaderboardPosted' : 'leaderboardOffline') : '');
    const next = must(__classPrivateFieldGet(this, _ClockworkGame_completion, "f"), '[data-action="next"]');
    next.textContent = puzzle.mode === 'campaign' ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('nextLevel') : puzzle.mode === 'daily' ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('replay') : __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('zen');
}, _ClockworkGame_nextPuzzle = async function _ClockworkGame_nextPuzzle() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    if (!puzzle)
        return;
    if (puzzle.mode === 'daily') {
        await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_replayPuzzle).call(this);
        return;
    }
    if (puzzle.mode === 'campaign' && puzzle.level % 3 === 0)
        await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").showInterstitial();
    await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_startMode).call(this, puzzle.mode, false);
}, _ClockworkGame_replayPuzzle = async function _ClockworkGame_replayPuzzle() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    if (!puzzle)
        return;
    const fresh = generatePuzzle({ seed: puzzle.seed, mode: puzzle.mode, level: puzzle.level });
    await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_activatePuzzle).call(this, fresh);
}, _ClockworkGame_restartPuzzle = async function _ClockworkGame_restartPuzzle() {
    await __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_replayPuzzle).call(this);
}, _ClockworkGame_showMenu = function _ClockworkGame_showMenu(captureActive) {
    if (captureActive && __classPrivateFieldGet(this, _ClockworkGame_screen, "f") === 'playing') {
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_pauseTiming).call(this);
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_captureActiveRun).call(this);
        void __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").saveProgress(SAVE_KEY, __classPrivateFieldGet(this, _ClockworkGame_progress, "f"));
    }
    else {
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_pauseTiming).call(this);
    }
    __classPrivateFieldGet(this, _ClockworkGame_pauseReasons, "f").clear();
    __classPrivateFieldSet(this, _ClockworkGame_screen, 'menu', "f");
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.screen = 'menu';
    delete __classPrivateFieldGet(this, _ClockworkGame_app, "f").dataset.state;
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setScene('menu');
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").resume();
    __classPrivateFieldGet(this, _ClockworkGame_hud, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_toolbar, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_coach, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_completion, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_pauseOverlay, "f").hidden = true;
    __classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f").hidden = false;
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").tabIndex = -1;
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderMenu).call(this);
}, _ClockworkGame_renderMenu = function _ClockworkGame_renderMenu() {
    const level = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel;
    const chamberProgress = (level - 1) % CHAMBER_SIZE;
    const percent = Math.round(chamberProgress / CHAMBER_SIZE * 100);
    const continueCard = __classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f").querySelector('[data-action="continue"]');
    if (continueCard) {
        continueCard.hidden = !__classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun;
        const detail = continueCard.querySelector('[data-continue-level]');
        if (detail && __classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun) {
            const active = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun;
            const mode = active.mode === 'daily' ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('daily') : active.mode === 'zen' ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('zen') : __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('campaign');
            detail.textContent = `${mode} · ${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('level')} ${active.level}`;
        }
    }
    setText(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-campaign-detail]', `${chamberName(level)} · ${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('level')} ${level}`);
    setText(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-progress-percent]', `${percent}%`);
    setText(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-chamber-progress]', `${chamberProgress}/${CHAMBER_SIZE}`);
    setText(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-best-score]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").totalScore));
    setText(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-streak]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").streak));
    setText(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-version]', `v${__classPrivateFieldGet(this, _ClockworkGame_version, "f")}`);
    const progressRing = __classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f").querySelector('.progress-ring');
    progressRing?.style.setProperty('--progress', `${percent}%`);
    const progressBar = __classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f").querySelector('[data-progress-bar]');
    progressBar?.style.setProperty('--progress', `${percent}%`);
    const specimens = must(__classPrivateFieldGet(this, _ClockworkGame_menuOverlay, "f"), '[data-specimens]');
    const plantKinds = ['lumen', 'orchid', 'starbell', 'ember', 'moonfern'];
    specimens.replaceChildren(...plantKinds.map((kind) => {
        const unlocked = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").unlockedSpecimens.includes(kind);
        const item = document.createElement('div');
        item.className = `specimen ${unlocked ? '' : 'locked'}`.trim();
        item.title = unlocked ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(kind) : 'Locked specimen';
        item.innerHTML = `<span class="specimen-art plant-${kind}" aria-hidden="true">${plantGlyph(kind)}</span><strong>${unlocked ? escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(kind)) : '••••'}</strong><span>${unlocked ? '★'.repeat(Math.min(3, 1 + (__classPrivateFieldGet(this, _ClockworkGame_progress, "f").completedLevels % 3))) : '🔒'}</span>`;
        return item;
    }));
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderSdkStatus).call(this);
}, _ClockworkGame_renderHud = function _ClockworkGame_renderHud() {
    if (__classPrivateFieldGet(this, _ClockworkGame_screen, "f") !== 'playing' || !__classPrivateFieldGet(this, _ClockworkGame_puzzle, "f") || !__classPrivateFieldGet(this, _ClockworkGame_analysis, "f"))
        return;
    setText(__classPrivateFieldGet(this, _ClockworkGame_hud, "f"), '[data-tier]', `${chamberName(__classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").level)} · ${__classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").config.tier}`);
    setText(__classPrivateFieldGet(this, _ClockworkGame_hud, "f"), '[data-level]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(__classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").level));
    const liveScore = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").totalScore + __classPrivateFieldGet(this, _ClockworkGame_analysis, "f").poweredPlants * 75 + Math.max(0, __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f").tiles.length - __classPrivateFieldGet(this, _ClockworkGame_analysis, "f").leaks.length) * 4;
    setText(__classPrivateFieldGet(this, _ClockworkGame_hud, "f"), '[data-score]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(liveScore));
    setText(__classPrivateFieldGet(this, _ClockworkGame_hud, "f"), '[data-moves]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(__classPrivateFieldGet(this, _ClockworkGame_moves, "f")));
    setText(__classPrivateFieldGet(this, _ClockworkGame_hud, "f"), '[data-blooms]', `${__classPrivateFieldGet(this, _ClockworkGame_analysis, "f").poweredPlants} / ${__classPrivateFieldGet(this, _ClockworkGame_analysis, "f").totalPlants}`);
    setText(__classPrivateFieldGet(this, _ClockworkGame_hud, "f"), '[data-leaks]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").number(__classPrivateFieldGet(this, _ClockworkGame_analysis, "f").leaks.length));
    const soundButton = __classPrivateFieldGet(this, _ClockworkGame_hud, "f").querySelector('[data-action="toggle-sound"]');
    if (soundButton) {
        soundButton.textContent = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound ? '♪' : '×';
        soundButton.setAttribute('aria-label', __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound ? 'Mute sound' : 'Enable sound');
    }
    const undo = __classPrivateFieldGet(this, _ClockworkGame_toolbar, "f").querySelector('[data-action="undo"]');
    if (undo)
        undo.disabled = __classPrivateFieldGet(this, _ClockworkGame_history, "f").length === 0 || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f");
    const hint = __classPrivateFieldGet(this, _ClockworkGame_toolbar, "f").querySelector('[data-action="hint"]');
    if (hint) {
        hint.disabled = __classPrivateFieldGet(this, _ClockworkGame_hintBusy, "f") || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f");
        const badge = hint.querySelector('[data-hint-count]');
        if (badge)
            badge.textContent = __classPrivateFieldGet(this, _ClockworkGame_hintsUsed, "f") < FREE_HINTS ? String(FREE_HINTS - __classPrivateFieldGet(this, _ClockworkGame_hintsUsed, "f")) : 'AD';
    }
}, _ClockworkGame_renderTutorial = function _ClockworkGame_renderTutorial() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    if (!puzzle?.tutorial || !__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") || !__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints) {
        __classPrivateFieldGet(this, _ClockworkGame_coach, "f").hidden = true;
        return;
    }
    __classPrivateFieldGet(this, _ClockworkGame_coach, "f").hidden = false;
    const step = puzzle.tutorial;
    setText(__classPrivateFieldGet(this, _ClockworkGame_coach, "f"), '[data-coach-title]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(`tutorial${step}Title`));
    setText(__classPrivateFieldGet(this, _ClockworkGame_coach, "f"), '[data-coach-body]', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(`tutorial${step}Body`));
}, _ClockworkGame_findTutorialTarget = function _ClockworkGame_findTutorialTarget(puzzle) {
    if (!puzzle.tutorial)
        return null;
    return puzzle.tiles.find((tile) => !tile.fixed && tile.rotation !== 0 && rotationPeriod(tile.baseMask) > 1)?.id ?? null;
}, _ClockworkGame_moveSelection = function _ClockworkGame_moveSelection(key) {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    if (!puzzle || puzzle.tiles.length === 0)
        return;
    if (__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f") && __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.tutorialHints) {
        __classPrivateFieldSet(this, _ClockworkGame_selectedId, __classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"), "f");
        __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(__classPrivateFieldGet(this, _ClockworkGame_tutorialTarget, "f"));
        return;
    }
    const current = puzzle.tiles.find((tile) => tile.id === __classPrivateFieldGet(this, _ClockworkGame_selectedId, "f")) ?? puzzle.tiles[0];
    if (!current)
        return;
    const [dx, dy] = key === 'arrowup' ? [0, -1] : key === 'arrowdown' ? [0, 1] : key === 'arrowleft' ? [-1, 0] : [1, 0];
    const candidates = puzzle.tiles
        .filter((tile) => (tile.x - current.x) * dx + (tile.y - current.y) * dy > 0)
        .map((tile) => ({
        tile,
        score: Math.abs(tile.x - current.x - dx) + Math.abs(tile.y - current.y - dy) + Math.abs((tile.x - current.x) * dy - (tile.y - current.y) * dx) * 2,
    }))
        .sort((left, right) => left.score - right.score);
    const next = candidates[0]?.tile;
    if (!next)
        return;
    __classPrivateFieldSet(this, _ClockworkGame_selectedId, next.id, "f");
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setSelected(next.id);
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderCanvasLabel).call(this);
}, _ClockworkGame_renderCanvasLabel = function _ClockworkGame_renderCanvasLabel() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    const analysis = __classPrivateFieldGet(this, _ClockworkGame_analysis, "f");
    if (!puzzle || !analysis) {
        __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").setAttribute('aria-label', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('title'));
        return;
    }
    const selected = puzzle.tiles.find((tile) => tile.id === __classPrivateFieldGet(this, _ClockworkGame_selectedId, "f"));
    const selectedText = selected ? ` Row ${selected.y + 1}, column ${selected.x + 1}.` : '';
    __classPrivateFieldGet(this, _ClockworkGame_canvas, "f").setAttribute('aria-label', `${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('level')} ${puzzle.level}. ${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('blooms')} ${analysis.poweredPlants} of ${analysis.totalPlants}. ${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('leaks')} ${analysis.leaks.length}.${selectedText}`);
}, _ClockworkGame_applySettings = function _ClockworkGame_applySettings() {
    __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").language = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.language;
    document.documentElement.lang = __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").language;
    __classPrivateFieldGet(this, _ClockworkGame_audio, "f").setEnabled(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.sound);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setReducedMotion(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setHighContrast(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.highContrast);
    __classPrivateFieldGet(this, _ClockworkGame_renderer, "f").setQuality(__classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.quality);
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").classList.toggle('reduced-motion', __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.reducedMotion);
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").classList.toggle('high-contrast', __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings.highContrast);
}, _ClockworkGame_applyTranslations = function _ClockworkGame_applyTranslations() {
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").querySelectorAll('[data-i18n]').forEach((element) => {
        const key = element.dataset.i18n;
        if (key)
            element.textContent = __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t(key);
    });
    document.title = `${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('title')} · ${__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('subtitle')}`;
    if (__classPrivateFieldGet(this, _ClockworkGame_screen, "f") === 'menu')
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_renderMenu).call(this);
}, _ClockworkGame_renderSdkStatus = function _ClockworkGame_renderSdkStatus() {
    __classPrivateFieldGet(this, _ClockworkGame_app, "f").querySelectorAll('[data-sdk-status]').forEach((element) => {
        element.textContent = __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").connected ? __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('connected') : __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('standalone');
        element.dataset.connected = String(__classPrivateFieldGet(this, _ClockworkGame_bridge, "f").connected);
    });
}, _ClockworkGame_openHelp = function _ClockworkGame_openHelp() {
    __classPrivateFieldSet(this, _ClockworkGame_modalKind, 'help', "f");
    this.pause('modal');
    __classPrivateFieldGet(this, _ClockworkGame_modalContent, "f").innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">✦</span><p class="eyebrow">Bloom Circuit</p><h2>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('helpTitle'))}</h2></div>
      <div class="help-grid">
        <article><span>1</span><p>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('help1'))}</p></article>
        <article><span>2</span><p>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('help2'))}</p></article>
        <article><span>3</span><p>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('help3'))}</p></article>
      </div>
      <button class="button primary" data-action="close-modal">${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('close'))}</button>`;
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showModal).call(this);
}, _ClockworkGame_openSettings = function _ClockworkGame_openSettings(refresh = false) {
    __classPrivateFieldSet(this, _ClockworkGame_modalKind, 'settings', "f");
    if (!refresh)
        this.pause('modal');
    const settings = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").settings;
    __classPrivateFieldGet(this, _ClockworkGame_modalContent, "f").innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">⚙</span><h2>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('settings'))}</h2><p>Readability, comfort and performance.</p></div>
      <div class="settings-list">
        ${toggleRow('setting-sound', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('sound'), settings.sound)}
        ${toggleRow('setting-motion', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('motion'), settings.reducedMotion)}
        ${toggleRow('setting-contrast', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('contrast'), settings.highContrast)}
        ${toggleRow('setting-tutorial', __classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('tutorialHints'), settings.tutorialHints)}
        <label class="setting-row"><span>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('quality'))}</span><select id="quality-select">${qualityOptions(settings.quality, __classPrivateFieldGet(this, _ClockworkGame_i18n, "f"))}</select></label>
        <label class="setting-row"><span>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('language'))}</span><select id="language-select">${languageOptions(settings.language)}</select></label>
      </div>
      <button class="button primary" data-action="close-modal">${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('close'))}</button>`;
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showModal).call(this, refresh);
}, _ClockworkGame_openRestart = function _ClockworkGame_openRestart() {
    __classPrivateFieldSet(this, _ClockworkGame_modalKind, 'restart', "f");
    this.pause('modal');
    __classPrivateFieldGet(this, _ClockworkGame_modalContent, "f").innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">↻</span><h2>${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('restart'))}?</h2><p>Your current moves on this circuit will be reset.</p></div>
      <div class="modal-actions"><button class="button secondary" data-action="close-modal">${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('close'))}</button><button class="button primary" data-action="confirm-restart">${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('restart'))}</button></div>`;
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showModal).call(this);
}, _ClockworkGame_openMap = function _ClockworkGame_openMap() {
    __classPrivateFieldSet(this, _ClockworkGame_modalKind, 'map', "f");
    this.pause('modal');
    const currentChamber = Math.floor((__classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel - 1) / CHAMBER_SIZE);
    const names = ['Dawn Atrium', 'Orchid Gallery', 'Mist Conservatory', 'Moon Fern Hall', 'Aurora Dome', 'Celestial Orangery'];
    const nodes = [];
    names.forEach((name, index) => {
        const state = index < currentChamber ? 'complete' : index === currentChamber ? 'current' : 'locked';
        nodes.push(`<article class="map-node ${state}"><span>${state === 'complete' ? '✓' : state === 'current' ? '✦' : '🔒'}</span><strong>${escapeHtml(name)}</strong><small>${state === 'complete' ? 'Restored' : state === 'current' ? `Level ${__classPrivateFieldGet(this, _ClockworkGame_progress, "f").campaignLevel}` : 'Locked'}</small></article>`);
        if (index < names.length - 1)
            nodes.push('<i class="map-link" aria-hidden="true"></i>');
    });
    __classPrivateFieldGet(this, _ClockworkGame_modalContent, "f").innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">❧</span><p class="eyebrow">Restoration Map</p><h2>The Conservatory</h2><p>Reconnect every chamber and awaken its botanical collection.</p></div>
      <div class="restoration-map">${nodes.join('')}</div>
      <button class="button primary" data-action="close-modal">${escapeHtml(__classPrivateFieldGet(this, _ClockworkGame_i18n, "f").t('close'))}</button>`;
    __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_showModal).call(this);
}, _ClockworkGame_showModal = function _ClockworkGame_showModal(refresh = false) {
    if (!__classPrivateFieldGet(this, _ClockworkGame_modal, "f").open)
        __classPrivateFieldGet(this, _ClockworkGame_modal, "f").showModal();
    if (!refresh)
        requestAnimationFrame(() => __classPrivateFieldGet(this, _ClockworkGame_modal, "f").querySelector('button, input, select')?.focus());
}, _ClockworkGame_closeModal = function _ClockworkGame_closeModal() {
    if (__classPrivateFieldGet(this, _ClockworkGame_modal, "f").open)
        __classPrivateFieldGet(this, _ClockworkGame_modal, "f").close();
}, _ClockworkGame_resumeTiming = function _ClockworkGame_resumeTiming() {
    if (__classPrivateFieldGet(this, _ClockworkGame_timing, "f") || __classPrivateFieldGet(this, _ClockworkGame_screen, "f") !== 'playing')
        return;
    __classPrivateFieldSet(this, _ClockworkGame_runStartedAt, performance.now(), "f");
    __classPrivateFieldSet(this, _ClockworkGame_timing, true, "f");
}, _ClockworkGame_pauseTiming = function _ClockworkGame_pauseTiming() {
    if (!__classPrivateFieldGet(this, _ClockworkGame_timing, "f"))
        return;
    __classPrivateFieldSet(this, _ClockworkGame_elapsedBase, __classPrivateFieldGet(this, _ClockworkGame_elapsedBase, "f") + (performance.now() - __classPrivateFieldGet(this, _ClockworkGame_runStartedAt, "f")), "f");
    __classPrivateFieldSet(this, _ClockworkGame_timing, false, "f");
}, _ClockworkGame_currentElapsed = function _ClockworkGame_currentElapsed() {
    return __classPrivateFieldGet(this, _ClockworkGame_elapsedBase, "f") + (__classPrivateFieldGet(this, _ClockworkGame_timing, "f") ? performance.now() - __classPrivateFieldGet(this, _ClockworkGame_runStartedAt, "f") : 0);
}, _ClockworkGame_captureActiveRun = function _ClockworkGame_captureActiveRun() {
    const puzzle = __classPrivateFieldGet(this, _ClockworkGame_puzzle, "f");
    if (!puzzle || __classPrivateFieldGet(this, _ClockworkGame_completionPending, "f"))
        return;
    __classPrivateFieldGet(this, _ClockworkGame_progress, "f").activeRun = {
        seed: puzzle.seed,
        mode: puzzle.mode,
        level: puzzle.level,
        rotations: puzzle.tiles.map((tile) => tile.rotation),
        moves: __classPrivateFieldGet(this, _ClockworkGame_moves, "f"),
        elapsedMs: Math.round(__classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_currentElapsed).call(this)),
    };
}, _ClockworkGame_scheduleSave = function _ClockworkGame_scheduleSave(wait = 450) {
    window.clearTimeout(__classPrivateFieldGet(this, _ClockworkGame_saveTimer, "f"));
    __classPrivateFieldSet(this, _ClockworkGame_saveTimer, window.setTimeout(() => void __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_saveNow).call(this), wait), "f");
}, _ClockworkGame_saveNow = async function _ClockworkGame_saveNow(includeActive = true) {
    if (includeActive && __classPrivateFieldGet(this, _ClockworkGame_screen, "f") === 'playing')
        __classPrivateFieldGet(this, _ClockworkGame_instances, "m", _ClockworkGame_captureActiveRun).call(this);
    await __classPrivateFieldGet(this, _ClockworkGame_bridge, "f").saveProgress(SAVE_KEY, __classPrivateFieldGet(this, _ClockworkGame_progress, "f"));
}, _ClockworkGame_updateDailyStreak = function _ClockworkGame_updateDailyStreak(date) {
    const previous = __classPrivateFieldGet(this, _ClockworkGame_progress, "f").lastDailyDate;
    if (previous === date)
        return;
    if (!previous)
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").streak = 1;
    else {
        const difference = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86400000);
        __classPrivateFieldGet(this, _ClockworkGame_progress, "f").streak = difference === 1 ? __classPrivateFieldGet(this, _ClockworkGame_progress, "f").streak + 1 : 1;
    }
    __classPrivateFieldGet(this, _ClockworkGame_progress, "f").lastDailyDate = date;
}, _ClockworkGame_showToast = function _ClockworkGame_showToast(message, duration = 2800) {
    window.clearTimeout(__classPrivateFieldGet(this, _ClockworkGame_toastTimer, "f"));
    __classPrivateFieldGet(this, _ClockworkGame_toast, "f").textContent = message;
    __classPrivateFieldGet(this, _ClockworkGame_toast, "f").hidden = false;
    __classPrivateFieldGet(this, _ClockworkGame_toast, "f").classList.remove('show');
    void __classPrivateFieldGet(this, _ClockworkGame_toast, "f").offsetWidth;
    __classPrivateFieldGet(this, _ClockworkGame_toast, "f").classList.add('show');
    __classPrivateFieldSet(this, _ClockworkGame_toastTimer, window.setTimeout(() => {
        __classPrivateFieldGet(this, _ClockworkGame_toast, "f").classList.remove('show');
        window.setTimeout(() => { __classPrivateFieldGet(this, _ClockworkGame_toast, "f").hidden = true; }, 220);
    }, duration), "f");
}, _ClockworkGame_announce = function _ClockworkGame_announce(message) {
    __classPrivateFieldGet(this, _ClockworkGame_live, "f").textContent = '';
    requestAnimationFrame(() => { __classPrivateFieldGet(this, _ClockworkGame_live, "f").textContent = message; });
};
function dailyDifficultyLevel(seed) {
    // Stable for every player on a given UTC date, so leaderboard entries always
    // refer to the same board size and difficulty rather than personal campaign progress.
    return 10 + (hashSeed(seed) % 10);
}
function must(root, selector) {
    const element = root.querySelector(selector);
    if (!element)
        throw new Error(`Missing required element: ${selector}`);
    return element;
}
function setText(root, selector, value) {
    const element = root.querySelector(selector);
    if (element)
        element.textContent = value;
}
function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
function isQuality(value) {
    return value === 'auto' || value === 'high' || value === 'balanced' || value === 'low';
}
function chamberName(level) {
    const names = ['Dawn Atrium', 'Orchid Gallery', 'Mist Conservatory', 'Moon Fern Hall', 'Aurora Dome', 'Celestial Orangery'];
    return names[Math.floor((Math.max(1, level) - 1) / CHAMBER_SIZE) % names.length] ?? 'Dawn Atrium';
}
function plantGlyph(kind) {
    return kind === 'lumen' ? '✿' : kind === 'orchid' ? '❀' : kind === 'starbell' ? '✦' : kind === 'ember' ? '✺' : '❧';
}
function toggleRow(id, label, checked) {
    return `<label class="setting-row"><span>${escapeHtml(label)}</span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i class="toggle" aria-hidden="true"></i></label>`;
}
function languageOptions(selected) {
    const options = [['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano']];
    return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}
function qualityOptions(selected, i18n) {
    return ['auto', 'high', 'balanced', 'low']
        .map((value) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHtml(i18n.t(value))}</option>`)
        .join('');
}
function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}
//# sourceMappingURL=game.js.map