import { analyzeBoard, rotationPeriod } from '../core/board.js';
import { dailySeed, generatePuzzle } from '../core/generator.js';
import { detectDeviceSignals, resolveRenderProfile } from '../core/performance.js';
import { createDefaultProgress, sanitizeProgress, SAVE_KEY, specimenForLevel } from '../core/progress.js';
import { calculateCompletion } from '../core/scoring.js';
import { tutorialForLevel } from '../core/tutorial.js';
import { detectLanguage, I18n } from '../ui/i18n.js';
import { AudioEngine } from './audio.js';
import { ConservatoryRenderer } from './renderer.js';
const FREE_HINTS = 3;
const COMPLETION_DELAY_MS = 1_850;
const BLOCKING_ACTIONS = new Set(['continue-run', 'continue-restoration', 'current-chamber', 'daily', 'daily-map', 'zen', 'next', 'replay', 'confirm-restart']);
const CHAMBERS = [
    { name: 'Sun Atrium', start: 1 },
    { name: 'Orchid Atrium', start: 4 },
    { name: 'Mist Gallery', start: 8 },
    { name: 'Moon Fern Hall', start: 12 },
    { name: 'Aurora Dome', start: 16 },
];
export class ClockworkGame {
    #app;
    #canvas;
    #renderer;
    #audio = new AudioEngine();
    #bridge;
    #version;
    #i18n;
    #menuScreen;
    #mapScreen;
    #gameHud;
    #toolbar;
    #objective;
    #coach;
    #completeScreen;
    #pauseOverlay;
    #loadingOverlay;
    #modal;
    #modalContent;
    #toast;
    #feedback;
    #liveRegion;
    #progress;
    #screen = 'loading';
    #modalKind = null;
    #puzzle = null;
    #analysis = null;
    #selectedId = null;
    #moves = 0;
    #hintsUsed = 0;
    #initialLeaks = 0;
    #history = [];
    #elapsedBaseMs = 0;
    #startedAt = 0;
    #timing = false;
    #completionPending = false;
    #hintBusy = false;
    #firstMoveSent = false;
    #pauseReasons = new Set();
    #saveTimer = 0;
    #toastTimer = 0;
    #feedbackTimer = 0;
    #qualityTimer = 0;
    #hoverFrame = 0;
    #completionFrame = 0;
    #pendingHover = null;
    #pointerDown = null;
    #navigationBusy = false;
    #runToken = 0;
    #saveQueue = Promise.resolve();
    #destroyed = false;
    constructor(app, bridge, version) {
        this.#app = app;
        this.#bridge = bridge;
        this.#version = version;
        this.#i18n = new I18n(detectLanguage());
        this.#progress = createDefaultProgress(this.#i18n.language);
        app.innerHTML = shellTemplate(version);
        this.#canvas = must(app, '#game-canvas');
        this.#menuScreen = must(app, '#menu-screen');
        this.#mapScreen = must(app, '#map-screen');
        this.#gameHud = must(app, '#game-hud');
        this.#toolbar = must(app, '#game-toolbar');
        this.#objective = must(app, '#objective-banner');
        this.#coach = must(app, '#coach-overlay');
        this.#completeScreen = must(app, '#complete-screen');
        this.#pauseOverlay = must(app, '#pause-overlay');
        this.#loadingOverlay = must(app, '#loading-overlay');
        this.#modal = must(app, '#game-modal');
        this.#modalContent = must(app, '#modal-content');
        this.#toast = must(app, '#toast');
        this.#feedback = must(app, '#board-feedback');
        this.#liveRegion = must(app, '#live-region');
        this.#renderer = new ConservatoryRenderer(this.#canvas);
        this.#bindEvents();
        this.#bridge.bindPauseHandlers(() => this.pause('host'), () => this.resume('host'));
        this.#bridge.addEventListener('connected', () => this.#renderSdkStatus());
        this.#bridge.addEventListener('standalone', () => this.#renderSdkStatus());
        this.#canvas.addEventListener('renderqualitychange', (event) => {
            const quality = event instanceof CustomEvent && event.detail && typeof event.detail.quality === 'string' ? event.detail.quality : 'balanced';
            this.#app.dataset.quality = quality;
            this.#showToast(this.#i18n.t('qualityAdjusted'), 2_200);
        });
        const debug = new URLSearchParams(location.search).get('debug') === '1';
        if (debug) {
            window.__clockworkDiagnostics = () => ({
                version: this.#version,
                screen: this.#screen,
                quality: this.#app.dataset.quality,
                puzzle: this.#puzzle ? { mode: this.#puzzle.mode, level: this.#puzzle.level, tiles: this.#puzzle.tiles.length } : null,
                renderer: this.#renderer.getDiagnostics(),
            });
        }
    }
    async initialize() {
        this.#applyTranslations();
        this.#loadingOverlay.hidden = false;
        void this.#bridge.initialize();
        try {
            const saved = await this.#bridge.loadProgress(SAVE_KEY);
            this.#progress = sanitizeProgress(saved, this.#i18n.language);
            this.#i18n.language = this.#progress.settings.language;
        }
        catch (error) {
            this.#progress = createDefaultProgress(this.#i18n.language);
            await this.#bridge.reportError(error);
        }
        this.#applySettings();
        this.#applyTranslations();
        this.#renderMenu();
        this.#showScreen('menu');
        this.#loadingOverlay.hidden = true;
        this.#app.dataset.loaded = 'true';
        this.#app.dataset.version = this.#version;
        await this.#bridge.markReady();
        await this.#bridge.appStarted();
        await this.#bridge.mainScreenReady();
        this.#announce(this.#i18n.t('tagline'));
        const params = new URLSearchParams(location.search);
        const autostart = params.get('autostart');
        if (autostart === 'campaign' || autostart === 'daily' || autostart === 'zen') {
            await this.#startMode(autostart, false);
        }
        else if (autostart === 'map') {
            this.#showMap();
        }
    }
    destroy() {
        this.#destroyed = true;
        this.#runToken += 1;
        window.clearTimeout(this.#saveTimer);
        window.clearTimeout(this.#toastTimer);
        window.clearTimeout(this.#feedbackTimer);
        window.clearTimeout(this.#qualityTimer);
        cancelAnimationFrame(this.#hoverFrame);
        cancelAnimationFrame(this.#completionFrame);
        this.#renderer.destroy();
        this.#audio.destroy();
    }
    pause(reason) {
        const wasPaused = this.#pauseReasons.size > 0;
        this.#pauseReasons.add(reason);
        if (!wasPaused && this.#screen === 'playing') {
            this.#pauseTimer();
            this.#renderer.pause();
            void this.#audio.suspend();
        }
        if ((reason === 'host' || reason === 'manual') && this.#screen === 'playing') {
            this.#pauseOverlay.hidden = false;
        }
    }
    resume(reason) {
        this.#pauseReasons.delete(reason);
        if (this.#pauseReasons.size > 0 || this.#screen !== 'playing')
            return;
        this.#pauseOverlay.hidden = true;
        this.#renderer.resume();
        this.#startTimer();
        void this.#audio.resume();
        this.#canvas.focus({ preventScroll: true });
    }
    #bindEvents() {
        this.#app.addEventListener('pointerdown', () => void this.#audio.unlock(), { passive: true });
        this.#app.addEventListener('click', (event) => {
            const element = event.target instanceof Element ? event.target.closest('[data-action]') : null;
            if (!element || element.hasAttribute('disabled'))
                return;
            const action = element.dataset.action;
            if (action)
                void this.#handleAction(action);
        });
        this.#canvas.addEventListener('pointerdown', (event) => this.#handleCanvasPointerDown(event));
        this.#canvas.addEventListener('pointermove', (event) => this.#handleCanvasPointerMove(event));
        this.#canvas.addEventListener('pointerup', (event) => this.#handleCanvasPointerEnd(event, false));
        this.#canvas.addEventListener('pointercancel', (event) => this.#handleCanvasPointerEnd(event, true));
        this.#canvas.addEventListener('lostpointercapture', () => {
            this.#pointerDown = null;
            this.#renderer.setPressed(null);
        });
        this.#canvas.addEventListener('pointerleave', () => {
            if (!this.#pointerDown)
                this.#renderer.resetPointer();
            this.#pendingHover = null;
            this.#renderer.setHovered(null);
        });
        this.#canvas.addEventListener('keydown', (event) => this.#handleKey(event));
        this.#app.addEventListener('change', (event) => this.#handleSettingChange(event));
        this.#modal.addEventListener('close', () => {
            if (this.#modalKind) {
                this.#modalKind = null;
                this.resume('modal');
            }
        });
        this.#modal.addEventListener('cancel', () => {
            this.#modalKind = null;
            this.resume('modal');
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.pause('visibility');
                this.#scheduleSave(0);
            }
            else {
                this.resume('visibility');
            }
        });
        // Chromium may freeze a background page without another visibility transition.
        // Listening to Page Lifecycle events keeps timers, audio, rendering and saves safe
        // during tab discards and BFCache round-trips while remaining a no-op elsewhere.
        document.addEventListener('freeze', () => {
            this.pause('visibility');
            this.#scheduleSave(0);
        });
        document.addEventListener('resume', () => {
            if (document.visibilityState === 'visible')
                this.resume('visibility');
        });
        window.addEventListener('resize', () => this.#scheduleAutoQuality(), { passive: true });
        const connection = navigator.connection;
        connection?.addEventListener?.('change', () => this.#scheduleAutoQuality());
        window.addEventListener('blur', () => this.pause('visibility'));
        window.addEventListener('focus', () => {
            if (document.visibilityState === 'visible')
                this.resume('visibility');
        });
        window.addEventListener('pageshow', (event) => {
            if (event.persisted && document.visibilityState === 'visible')
                this.resume('visibility');
        });
        window.addEventListener('pagehide', (event) => {
            this.#pauseTimer();
            void this.#saveNow();
            if (!event.persisted)
                void this.#bridge.gameEnd();
            void this.#audio.suspend();
        });
        window.addEventListener('error', (event) => void this.#bridge.reportError(event.error ?? event.message));
        window.addEventListener('unhandledrejection', (event) => void this.#bridge.reportError(event.reason));
    }
    #handleCanvasPointerDown(event) {
        if (!this.#canInteract())
            return;
        event.preventDefault();
        const tileId = this.#renderer.hitTest(event.clientX, event.clientY);
        if (!tileId)
            return;
        try {
            this.#canvas.setPointerCapture(event.pointerId);
        }
        catch { /* optional browser capability */ }
        this.#pointerDown = { id: tileId, x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
        this.#selectedId = tileId;
        this.#renderer.setSelected(tileId);
        this.#renderer.setPressed(tileId);
        if (event.pointerType !== 'touch')
            this.#renderer.setPointer(event.clientX, event.clientY);
    }
    #handleCanvasPointerMove(event) {
        const pointer = this.#pointerDown;
        if (pointer && pointer.pointerId === event.pointerId) {
            const moved = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12;
            if (moved && !pointer.moved) {
                pointer.moved = true;
                this.#renderer.setPressed(null);
            }
        }
        if (event.pointerType === 'touch')
            return;
        this.#renderer.setPointer(event.clientX, event.clientY);
        this.#pendingHover = { x: event.clientX, y: event.clientY };
        if (this.#hoverFrame)
            return;
        this.#hoverFrame = requestAnimationFrame(() => {
            this.#hoverFrame = 0;
            const pending = this.#pendingHover;
            this.#pendingHover = null;
            this.#renderer.setHovered(pending && this.#canInteract() ? this.#renderer.hitTest(pending.x, pending.y) : null);
        });
    }
    #handleCanvasPointerEnd(event, cancelled) {
        const pointer = this.#pointerDown;
        if (!pointer || pointer.pointerId !== event.pointerId)
            return;
        this.#pointerDown = null;
        this.#renderer.setPressed(null);
        try {
            this.#canvas.releasePointerCapture(event.pointerId);
        }
        catch { /* optional browser capability */ }
        if (cancelled || pointer.moved || !this.#canInteract())
            return;
        const tileId = this.#renderer.hitTest(event.clientX, event.clientY);
        if (!tileId || tileId !== pointer.id)
            return;
        this.#selectedId = tileId;
        this.#renderer.setSelected(tileId);
        this.#rotateTile(tileId);
    }
    #scheduleAutoQuality() {
        if (this.#progress.settings.quality !== 'auto')
            return;
        window.clearTimeout(this.#qualityTimer);
        this.#qualityTimer = window.setTimeout(() => {
            if (this.#destroyed)
                return;
            this.#applySettings();
        }, 240);
    }
    async #handleAction(action) {
        const blocking = BLOCKING_ACTIONS.has(action);
        if (blocking && this.#navigationBusy)
            return;
        if (blocking) {
            this.#navigationBusy = true;
            this.#app.dataset.busy = 'true';
            this.#app.setAttribute('aria-busy', 'true');
        }
        try {
            switch (action) {
                case 'continue-run':
                    if (this.#progress.activeRun)
                        await this.#startMode(this.#progress.activeRun.mode, true);
                    else
                        await this.#startMode('campaign', false);
                    break;
                case 'campaign':
                case 'open-map':
                    this.#showMap();
                    break;
                case 'continue-restoration':
                case 'current-chamber':
                    await this.#startMode('campaign', false);
                    break;
                case 'daily':
                case 'daily-map':
                    await this.#startMode('daily', false);
                    break;
                case 'zen':
                    await this.#startMode('zen', false);
                    break;
                case 'help':
                    await this.#bridge.helpOpened();
                    this.#openHelp();
                    break;
                case 'settings':
                    this.#openSettings();
                    break;
                case 'close-modal':
                    this.#closeModal();
                    break;
                case 'pause':
                    this.pause('manual');
                    break;
                case 'resume':
                    this.resume('manual');
                    break;
                case 'rotate-left':
                    this.#renderer.rotateView(-1);
                    this.#haptic(5);
                    break;
                case 'rotate-right':
                    this.#renderer.rotateView(1);
                    this.#haptic(5);
                    break;
                case 'undo':
                    this.#undo();
                    break;
                case 'hint':
                    await this.#useHint();
                    break;
                case 'restart':
                    this.#openRestartConfirmation();
                    break;
                case 'confirm-restart':
                    this.#closeModal();
                    await this.#restartPuzzle();
                    break;
                case 'menu':
                case 'return-menu':
                    this.#showMenu();
                    break;
                case 'next':
                    await this.#nextPuzzle();
                    break;
                case 'replay':
                    await this.#replayPuzzle();
                    break;
                case 'dismiss-coach':
                    this.#coach.hidden = true;
                    this.#haptic(5);
                    this.#canvas.focus({ preventScroll: true });
                    break;
                default:
                    break;
            }
        }
        catch (error) {
            await this.#bridge.reportError(error);
            this.#showToast('The conservatory paused for a moment. Please try again.');
        }
        finally {
            if (blocking) {
                this.#navigationBusy = false;
                delete this.#app.dataset.busy;
                this.#app.removeAttribute('aria-busy');
            }
        }
    }
    async #startMode(mode, resumePreferred) {
        const token = ++this.#runToken;
        const snapshot = this.#progress.activeRun;
        const today = dailySeed();
        const canResume = Boolean(resumePreferred && snapshot && (snapshot.mode !== 'daily' || snapshot.seed === today));
        let puzzle;
        if (canResume && snapshot) {
            puzzle = this.#restoreSnapshot(snapshot);
            this.#moves = snapshot.moves;
            this.#hintsUsed = snapshot.hintsUsed;
            this.#elapsedBaseMs = snapshot.elapsedMs;
            this.#showToast('Progress restored');
        }
        else {
            const level = mode === 'campaign' ? this.#progress.campaignLevel : mode === 'daily' ? Math.max(4, this.#progress.campaignLevel) : Math.max(6, this.#progress.campaignLevel);
            const tutorial = mode === 'campaign' ? tutorialForLevel(level) : null;
            const seed = mode === 'daily' ? today : mode === 'campaign' ? `campaign:${level}:premium-v1` : `zen:${Date.now()}:${Math.round(Math.random() * 1_000_000)}`;
            puzzle = tutorial ?? generatePuzzle({ seed, mode, level });
            this.#moves = 0;
            this.#hintsUsed = 0;
            this.#elapsedBaseMs = 0;
        }
        this.#puzzle = puzzle;
        this.#analysis = analyzeBoard(puzzle);
        this.#initialLeaks = Math.max(1, this.#analysis.leaks.length);
        this.#history = [];
        this.#completionPending = false;
        this.#hintBusy = false;
        this.#firstMoveSent = false;
        this.#selectedId = initialSelection(puzzle);
        this.#renderer.setPuzzle(puzzle);
        this.#renderer.setAnalysis(this.#analysis);
        this.#renderer.setSelected(this.#selectedId);
        this.#renderer.setCoach(puzzle.tutorial?.targetId ?? null);
        this.#pauseReasons.clear();
        this.#showScreen('playing');
        this.#toolbar.hidden = false;
        this.#gameHud.hidden = false;
        this.#objective.hidden = false;
        this.#pauseOverlay.hidden = true;
        this.#canvas.tabIndex = 0;
        this.#renderCoach();
        this.#renderHud();
        this.#renderObjective();
        this.#renderer.resume();
        this.#startTimer();
        this.#scheduleSave(0);
        await this.#bridge.gameStart();
        if (!this.#isCurrentRun(token, puzzle))
            return;
        await this.#bridge.levelStart(puzzle.level);
        if (!this.#isCurrentRun(token, puzzle))
            return;
        await this.#bridge.customEvent('Puzzle', 'Level_Start', {
            mode: puzzle.mode,
            level: puzzle.level,
            tiles: puzzle.tiles.length,
            plants: this.#analysis?.totalPlants ?? 0,
        });
        if (!this.#isCurrentRun(token, puzzle))
            return;
        if (this.#analysis?.solved && !this.#completionPending) {
            this.#completionPending = true;
            window.setTimeout(() => {
                if (this.#isCurrentRun(token, puzzle))
                    void this.#completePuzzle();
            }, 100);
        }
        requestAnimationFrame(() => {
            if (this.#isCurrentRun(token, puzzle))
                this.#canvas.focus({ preventScroll: true });
        });
    }
    #restoreSnapshot(snapshot) {
        const tutorial = snapshot.mode === 'campaign' ? tutorialForLevel(snapshot.level) : null;
        const puzzle = tutorial ?? generatePuzzle({ seed: snapshot.seed, mode: snapshot.mode, level: snapshot.level });
        if (snapshot.rotations.length === puzzle.tiles.length) {
            puzzle.tiles.forEach((tile, index) => {
                const period = rotationPeriod(tile.baseMask);
                const rotation = Math.max(0, Math.floor(snapshot.rotations[index] ?? 0)) % period;
                tile.rotation = rotation;
                tile.visualTurns = rotation;
            });
        }
        return puzzle;
    }
    #rotateTile(tileId) {
        const puzzle = this.#puzzle;
        const previous = this.#analysis;
        if (!puzzle || !previous)
            return;
        const tile = puzzle.tiles.find((candidate) => candidate.id === tileId);
        if (!tile)
            return;
        if (puzzle.tutorial && tile.id !== puzzle.tutorial.targetId) {
            this.#audio.denied();
            this.#haptic([8, 24, 8]);
            this.#selectedId = puzzle.tutorial.targetId;
            this.#renderer.setSelected(this.#selectedId);
            this.#renderer.setCoach(this.#selectedId);
            this.#renderer.pulseTile(this.#selectedId, 1.15);
            this.#showToast('Rotate the glowing mechanism');
            return;
        }
        const period = rotationPeriod(tile.baseMask);
        if (tile.fixed || period === 1) {
            this.#audio.denied();
            this.#haptic(9);
            this.#renderer.pulseTile(tile.id, 0.55);
            this.#showToast(this.#i18n.t('fixed'));
            this.#announce(this.#i18n.t('fixed'));
            return;
        }
        this.#history.push({ tileId, rotation: tile.rotation, visualTurns: tile.visualTurns });
        tile.rotation = (tile.rotation + 1) % period;
        tile.visualTurns += 1;
        this.#moves += 1;
        this.#renderer.syncTile(tile);
        this.#analysis = analyzeBoard(puzzle);
        this.#renderer.setAnalysis(this.#analysis);
        this.#renderer.clearHint();
        if (!this.#firstMoveSent) {
            this.#firstMoveSent = true;
            void this.#bridge.firstMove();
        }
        const bloomDelta = this.#analysis.poweredPlants - previous.poweredPlants;
        const leakDelta = previous.leaks.length - this.#analysis.leaks.length;
        const progressDelta = this.#analysis.progress - previous.progress;
        const improved = bloomDelta > 0 || leakDelta > 0 || progressDelta > 0.04;
        this.#renderer.pulseTile(tile.id, improved ? 1.22 : 0.72);
        if (bloomDelta > 0 || leakDelta > 0) {
            this.#audio.connect(Math.max(1, bloomDelta + leakDelta));
            this.#haptic(bloomDelta > 0 && leakDelta > 0 ? [12, 20, 18] : [10, 16, 13]);
            const messages = [];
            if (bloomDelta > 0)
                messages.push(`${this.#i18n.t('bloomAwakened')} +${bloomDelta}`);
            if (leakDelta > 0)
                messages.push(`${this.#i18n.t('leakSealed')} +${leakDelta}`);
            this.#showFeedback(messages.join(' · '), bloomDelta > 0 ? 'bloom' : 'leak');
        }
        else {
            this.#audio.turn(this.#analysis.progress);
            this.#haptic(5);
        }
        this.#renderHud();
        this.#renderObjective();
        this.#pulseHud('[data-stat="moves"]');
        if (bloomDelta !== 0)
            this.#pulseHud('[data-stat="blooms"]');
        if (leakDelta !== 0)
            this.#pulseHud('[data-stat="leaks"]');
        if (Math.abs(progressDelta) > 0.01)
            this.#pulseHud('[data-flow-meter]');
        this.#scheduleSave();
        this.#announce(`${this.#analysis.poweredPlants} of ${this.#analysis.totalPlants} blooms powered.`);
        if (this.#analysis.solved && !this.#completionPending) {
            const token = this.#runToken;
            this.#completionPending = true;
            this.#coach.hidden = true;
            this.#renderer.setCoach(null);
            this.#haptic([20, 28, 34]);
            window.setTimeout(() => {
                if (this.#isCurrentRun(token, puzzle))
                    void this.#completePuzzle();
            }, this.#progress.settings.reducedMotion ? 70 : 520);
        }
    }
    #undo() {
        const puzzle = this.#puzzle;
        const record = this.#history.pop();
        if (!puzzle || !record || this.#completionPending) {
            this.#audio.denied();
            this.#haptic(8);
            this.#showToast(this.#i18n.t('undoEmpty'));
            return;
        }
        const tile = puzzle.tiles.find((candidate) => candidate.id === record.tileId);
        if (!tile)
            return;
        tile.rotation = record.rotation;
        tile.visualTurns = record.visualTurns;
        this.#moves += 1;
        this.#selectedId = tile.id;
        this.#analysis = analyzeBoard(puzzle);
        this.#renderer.setSelected(tile.id);
        this.#renderer.setAnalysis(this.#analysis);
        this.#renderer.syncTile(tile);
        this.#renderer.pulseTile(tile.id, 0.82);
        this.#audio.undo();
        this.#haptic(7);
        this.#renderHud();
        this.#renderObjective();
        this.#pulseHud('[data-stat="moves"]');
        this.#scheduleSave();
    }
    async #useHint() {
        const puzzle = this.#puzzle;
        const token = this.#runToken;
        if (!puzzle || !this.#analysis || this.#hintBusy || this.#completionPending)
            return;
        this.#hintBusy = true;
        this.#renderHud();
        this.#showToast(this.#i18n.t('hintThinking'), 1_800);
        try {
            if (this.#hintsUsed >= FREE_HINTS) {
                const rewarded = await this.#bridge.showRewarded();
                if (!this.#isCurrentRun(token, puzzle))
                    return;
                if (!rewarded) {
                    this.#showToast(this.#i18n.t('adUnavailable'));
                    return;
                }
            }
            await delay(this.#progress.settings.reducedMotion ? 25 : 260);
            if (!this.#isCurrentRun(token, puzzle))
                return;
            const { suggestHint } = await import('../core/board.js');
            if (!this.#isCurrentRun(token, puzzle))
                return;
            const suggestion = suggestHint(puzzle);
            if (!suggestion) {
                this.#showToast(this.#i18n.t('noHint'));
                return;
            }
            const tile = puzzle.tiles.find((candidate) => candidate.id === suggestion.tileId);
            if (!tile)
                return;
            this.#hintsUsed += 1;
            this.#selectedId = tile.id;
            this.#renderer.setSelected(tile.id);
            this.#renderer.setHint(tile.id);
            this.#renderer.pulseTile(tile.id, 1.28);
            this.#audio.hint();
            this.#haptic([8, 20, 12]);
            const turns = suggestion.rotations === 1 ? this.#i18n.t('once') : suggestion.rotations === 2 ? this.#i18n.t('twice') : this.#i18n.t('threeTimes');
            const message = this.#i18n.t('hintInstruction', { row: tile.y + 1, column: tile.x + 1, turns });
            this.#showToast(message, 4_800);
            this.#announce(message);
            this.#renderHud();
            this.#scheduleSave();
            await this.#bridge.customEvent('Garden_Hint', 'Shown', { mode: puzzle.mode, level: puzzle.level, rotations: suggestion.rotations });
        }
        catch (error) {
            await this.#bridge.reportError(error);
            if (this.#isCurrentRun(token, puzzle))
                this.#showToast(this.#i18n.t('noHint'));
        }
        finally {
            if (this.#isCurrentRun(token, puzzle)) {
                this.#hintBusy = false;
                this.#renderHud();
            }
        }
    }
    async #completePuzzle() {
        const token = this.#runToken;
        const puzzle = this.#puzzle;
        const analysis = this.#analysis;
        if (!puzzle || !analysis || !analysis.solved) {
            this.#completionPending = false;
            return;
        }
        this.#pauseTimer();
        const elapsedMs = this.#elapsedBaseMs;
        const stats = calculateCompletion(puzzle, this.#moves, this.#hintsUsed, elapsedMs);
        this.#progress.totalScore += stats.score;
        this.#progress.totalStars += stats.stars;
        this.#progress.bestScore = Math.max(this.#progress.bestScore, stats.score);
        let unlocked = null;
        let dailyRecord = false;
        if (puzzle.mode === 'campaign') {
            this.#progress.campaignLevel = Math.max(this.#progress.campaignLevel, puzzle.level + 1);
            unlocked = specimenForLevel(puzzle.level);
            if (unlocked && !this.#progress.specimens.includes(unlocked))
                this.#progress.specimens.push(unlocked);
        }
        else if (puzzle.mode === 'daily') {
            const date = puzzle.seed.replace('daily:', '');
            const previous = this.#progress.dailyBest[date] ?? 0;
            dailyRecord = stats.score > previous;
            this.#progress.dailyBest[date] = Math.max(previous, stats.score);
            this.#updateStreak(date);
        }
        window.clearTimeout(this.#saveTimer);
        delete this.#progress.activeRun;
        this.#toolbar.hidden = true;
        this.#objective.hidden = true;
        this.#coach.hidden = true;
        this.#app.dataset.state = 'celebrating';
        this.#audio.bloom();
        this.#haptic([24, 32, 42, 30, 56]);
        const duration = this.#progress.settings.reducedMotion ? 320 : COMPLETION_DELAY_MS;
        this.#renderer.startVictorySequence(duration);
        const platformWork = (async () => {
            await this.#saveNow(false);
            await this.#bridge.levelEnd(puzzle.level, stats.score);
            await this.#bridge.gameWon(stats.score, elapsedMs / 1_000);
            return puzzle.mode === 'daily' ? this.#bridge.postDailyScore(stats.score) : false;
        })();
        const [, leaderboard] = await Promise.all([delay(duration), withTimeout(platformWork, 2_600, false)]);
        if (!this.#isCurrentRun(token, puzzle))
            return;
        this.#renderCompletion(stats, unlocked, dailyRecord, leaderboard);
        this.#showScreen('complete');
        this.#animateCompletion(stats);
        this.#gameHud.hidden = true;
        this.#canvas.tabIndex = -1;
        this.#completionPending = false;
        delete this.#app.dataset.state;
    }
    #animateCompletion(stats) {
        cancelAnimationFrame(this.#completionFrame);
        const score = this.#completeScreen.querySelector('[data-final-score]');
        const card = this.#completeScreen.querySelector('.completion-card');
        if (!score || this.#progress.settings.reducedMotion)
            return;
        score.textContent = this.#i18n.number(0);
        card?.classList.remove('completion-live');
        void card?.offsetWidth;
        card?.classList.add('completion-live');
        const started = performance.now();
        const duration = 920;
        const frame = (time) => {
            if (this.#screen !== 'complete')
                return;
            const progress = Math.max(0, Math.min(1, (time - started) / duration));
            const eased = 1 - Math.pow(1 - progress, 3);
            score.textContent = this.#i18n.number(Math.round(stats.score * eased));
            if (progress < 1)
                this.#completionFrame = requestAnimationFrame(frame);
            else
                this.#completionFrame = 0;
        };
        this.#completionFrame = requestAnimationFrame(frame);
    }
    #updateStreak(date) {
        const previousDate = this.#progress.lastDailyDate;
        if (previousDate === date)
            return;
        const current = new Date(`${date}T00:00:00Z`).getTime();
        const previous = previousDate ? new Date(`${previousDate}T00:00:00Z`).getTime() : 0;
        this.#progress.streak = previous > 0 && Math.round((current - previous) / 86_400_000) === 1 ? this.#progress.streak + 1 : 1;
        this.#progress.lastDailyDate = date;
    }
    async #nextPuzzle() {
        const puzzle = this.#puzzle;
        if (!puzzle)
            return;
        if (puzzle.mode === 'campaign' && puzzle.level % 3 === 0)
            await this.#bridge.showInterstitial();
        await this.#startMode(puzzle.mode, false);
    }
    async #replayPuzzle() {
        const puzzle = this.#puzzle;
        if (!puzzle)
            return;
        const fresh = this.#freshPuzzle(puzzle);
        await this.#loadFreshPuzzle(fresh);
    }
    async #restartPuzzle() {
        const puzzle = this.#puzzle;
        if (!puzzle)
            return;
        await this.#loadFreshPuzzle(this.#freshPuzzle(puzzle));
    }
    #freshPuzzle(puzzle) {
        const tutorial = puzzle.mode === 'campaign' ? tutorialForLevel(puzzle.level) : null;
        return tutorial ?? generatePuzzle({ seed: puzzle.seed, mode: puzzle.mode, level: puzzle.level });
    }
    async #loadFreshPuzzle(fresh) {
        const token = ++this.#runToken;
        this.#puzzle = fresh;
        this.#analysis = analyzeBoard(fresh);
        this.#initialLeaks = Math.max(1, this.#analysis.leaks.length);
        this.#moves = 0;
        this.#hintsUsed = 0;
        this.#elapsedBaseMs = 0;
        this.#history = [];
        this.#completionPending = false;
        this.#selectedId = initialSelection(fresh);
        this.#renderer.setPuzzle(fresh);
        this.#renderer.setAnalysis(this.#analysis);
        this.#renderer.setSelected(this.#selectedId);
        this.#renderer.setCoach(fresh.tutorial?.targetId ?? null);
        this.#showScreen('playing');
        this.#toolbar.hidden = false;
        this.#gameHud.hidden = false;
        this.#objective.hidden = false;
        this.#renderCoach();
        this.#renderHud();
        this.#renderObjective();
        this.#canvas.tabIndex = 0;
        this.#renderer.resume();
        this.#startTimer();
        this.#scheduleSave(0);
        await this.#bridge.levelStart(fresh.level);
        if (this.#isCurrentRun(token, fresh))
            this.#canvas.focus({ preventScroll: true });
    }
    #showMenu() {
        if (this.#screen === 'playing') {
            this.#pauseTimer();
            void this.#saveNow(true);
        }
        this.#runToken += 1;
        this.#hintBusy = false;
        this.#pointerDown = null;
        this.#pauseReasons.clear();
        this.#renderer.setPressed(null);
        this.#renderer.resetPointer();
        this.#renderer.clearPuzzle();
        this.#puzzle = null;
        this.#analysis = null;
        this.#renderMenu();
        this.#showScreen('menu');
        this.#gameHud.hidden = true;
        this.#toolbar.hidden = true;
        this.#objective.hidden = true;
        this.#coach.hidden = true;
        this.#pauseOverlay.hidden = true;
        this.#canvas.tabIndex = -1;
    }
    #showMap() {
        if (this.#screen === 'playing') {
            this.#pauseTimer();
            void this.#saveNow(true);
        }
        this.#runToken += 1;
        this.#hintBusy = false;
        this.#pointerDown = null;
        this.#pauseReasons.clear();
        this.#renderer.setPressed(null);
        this.#renderer.resetPointer();
        this.#renderer.clearPuzzle();
        this.#puzzle = null;
        this.#analysis = null;
        this.#renderMap();
        this.#showScreen('map');
        this.#gameHud.hidden = true;
        this.#toolbar.hidden = true;
        this.#objective.hidden = true;
        this.#coach.hidden = true;
        this.#pauseOverlay.hidden = true;
        this.#canvas.tabIndex = -1;
        void this.#bridge.menuAction('Restoration_Map');
    }
    #showScreen(screen) {
        if (screen !== 'complete') {
            cancelAnimationFrame(this.#completionFrame);
            this.#completionFrame = 0;
        }
        this.#screen = screen;
        this.#app.dataset.screen = screen;
        this.#menuScreen.hidden = screen !== 'menu';
        this.#mapScreen.hidden = screen !== 'map';
        this.#completeScreen.hidden = screen !== 'complete';
        this.#loadingOverlay.hidden = screen !== 'loading';
    }
    #renderMenu() {
        const progressPercent = this.#restorationPercent();
        setText(this.#menuScreen, '[data-menu-level]', this.#i18n.number(Math.max(1, this.#progress.campaignLevel)));
        setText(this.#menuScreen, '[data-progress-percent]', `${progressPercent}%`);
        setText(this.#menuScreen, '[data-best-score]', this.#i18n.number(this.#progress.bestScore));
        setText(this.#menuScreen, '[data-streak]', this.#i18n.number(this.#progress.streak));
        setText(this.#menuScreen, '[data-chamber-progress]', `${Math.min(60, Math.max(0, this.#progress.campaignLevel - 1))} / 60`);
        const progressBar = this.#menuScreen.querySelector('[data-progress-bar]');
        if (progressBar)
            progressBar.style.setProperty('--progress', `${progressPercent}%`);
        const continueButton = this.#menuScreen.querySelector('[data-action="continue-run"]');
        if (continueButton) {
            continueButton.hidden = !this.#progress.activeRun;
            const detail = continueButton.querySelector('[data-continue-detail]');
            if (detail)
                detail.textContent = this.#progress.activeRun ? `${capitalize(this.#progress.activeRun.mode)} · ${this.#i18n.t('level')} ${this.#progress.activeRun.level}` : '';
        }
        this.#renderSpecimens(this.#menuScreen);
        this.#renderSdkStatus();
    }
    #renderMap() {
        const currentLevel = this.#progress.campaignLevel;
        const currentIndex = Math.max(0, CHAMBERS.findLastIndex((chamber) => currentLevel >= chamber.start));
        const nodes = this.#mapScreen.querySelectorAll('[data-chamber-index]');
        nodes.forEach((node) => {
            const index = Number(node.dataset.chamberIndex ?? 0);
            const state = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'locked';
            node.dataset.state = state;
            const status = node.querySelector('[data-chamber-status]');
            if (status)
                status.textContent = this.#i18n.t(state);
            if (node instanceof HTMLButtonElement) {
                node.disabled = state === 'locked';
                node.dataset.action = state === 'current' ? 'current-chamber' : '';
            }
        });
        const percent = this.#restorationPercent();
        setText(this.#mapScreen, '[data-map-progress]', `${percent}%`);
        setText(this.#mapScreen, '[data-map-streak]', this.#i18n.number(this.#progress.streak));
        const progressBar = this.#mapScreen.querySelector('[data-map-progress-bar]');
        if (progressBar)
            progressBar.style.setProperty('--progress', `${percent}%`);
        this.#renderSpecimens(this.#mapScreen);
    }
    #renderSpecimens(scope) {
        const cards = scope.querySelectorAll('[data-specimen]');
        cards.forEach((card) => {
            const kind = card.dataset.specimen;
            const unlocked = this.#progress.specimens.includes(kind);
            card.dataset.unlocked = String(unlocked);
            const label = card.querySelector('[data-specimen-label]');
            if (label)
                label.textContent = unlocked ? specimenName(kind) : 'Locked specimen';
        });
    }
    #renderHud() {
        const puzzle = this.#puzzle;
        const analysis = this.#analysis;
        if (!puzzle || !analysis || this.#screen !== 'playing')
            return;
        setText(this.#gameHud, '[data-hud-level]', this.#i18n.number(puzzle.level));
        setText(this.#gameHud, '[data-hud-score]', this.#i18n.number(this.#progress.totalScore));
        setText(this.#gameHud, '[data-hud-moves]', this.#i18n.number(this.#moves));
        setText(this.#gameHud, '[data-hud-blooms]', `${analysis.poweredPlants} / ${analysis.totalPlants}`);
        const sealed = Math.max(0, this.#initialLeaks - analysis.leaks.length);
        setText(this.#gameHud, '[data-hud-leaks]', `${sealed} / ${this.#initialLeaks}`);
        const flow = this.#gameHud.querySelector('[data-flow-meter]');
        if (flow) {
            const percent = Math.round(analysis.progress * 100);
            flow.style.setProperty('--flow', `${percent}%`);
            flow.setAttribute('aria-valuenow', String(percent));
            flow.dataset.complete = String(analysis.solved);
        }
        this.#app.dataset.flow = String(Math.round(analysis.progress * 100));
        this.#app.style.setProperty('--flow-level', analysis.progress.toFixed(3));
        const hintButton = this.#toolbar.querySelector('[data-action="hint"]');
        if (hintButton) {
            hintButton.disabled = this.#hintBusy;
            const badge = hintButton.querySelector('[data-hint-count]');
            if (badge)
                badge.textContent = this.#hintsUsed < FREE_HINTS ? String(FREE_HINTS - this.#hintsUsed) : 'Ad';
        }
        const undoButton = this.#toolbar.querySelector('[data-action="undo"]');
        if (undoButton)
            undoButton.disabled = this.#history.length === 0;
    }
    #renderObjective() {
        const analysis = this.#analysis;
        if (!analysis)
            return;
        const key = analysis.leaks.length > 0 ? 'objectiveLeak' : 'objectiveClear';
        const message = this.#i18n.t(key, {
            blooms: `${analysis.poweredPlants}/${analysis.totalPlants}`,
            leaks: analysis.leaks.length,
            leakWord: analysis.leaks.length === 1 ? 'leak' : 'leaks',
        });
        setText(this.#objective, '[data-objective-text]', message);
        this.#objective.dataset.clear = String(analysis.leaks.length === 0);
        this.#objective.dataset.progress = analysis.progress > 0.82 ? 'near' : analysis.progress > 0.45 ? 'mid' : 'early';
        this.#objective.style.setProperty('--objective-progress', `${Math.round(analysis.progress * 100)}%`);
    }
    #renderCoach() {
        const tutorial = this.#puzzle?.tutorial;
        this.#coach.hidden = !tutorial;
        if (!tutorial)
            return;
        setText(this.#coach, '[data-coach-title]', tutorial.title);
        setText(this.#coach, '[data-coach-body]', tutorial.body);
        setText(this.#coach, '[data-coach-step]', `${tutorial.step} / 3`);
    }
    #renderCompletion(stats, unlocked, dailyRecord, leaderboard) {
        setText(this.#completeScreen, '[data-final-score]', this.#i18n.number(stats.score));
        const stars = this.#completeScreen.querySelector('[data-final-stars]');
        if (stars) {
            const nodes = Array.from({ length: 3 }, (_, index) => {
                const star = document.createElement('span');
                star.textContent = index < stats.stars ? '★' : '☆';
                star.style.setProperty('--star-index', String(index));
                star.dataset.filled = String(index < stats.stars);
                return star;
            });
            stars.replaceChildren(...nodes);
        }
        setText(this.#completeScreen, '[data-final-moves]', this.#i18n.number(stats.moves));
        setText(this.#completeScreen, '[data-final-time]', this.#i18n.time(stats.elapsedMs));
        setText(this.#completeScreen, '[data-final-best]', this.#i18n.number(this.#progress.bestScore));
        setText(this.#completeScreen, '[data-final-grade]', stats.stars === 3 ? this.#i18n.t('masterwork') : this.#i18n.t('glasshouseRestored'));
        const unlock = this.#completeScreen.querySelector('[data-unlock]');
        if (unlock) {
            unlock.hidden = !unlocked;
            if (unlocked) {
                setText(unlock, '[data-unlock-name]', specimenName(unlocked));
                const image = unlock.querySelector('img');
                if (image)
                    image.src = specimenImage(unlocked);
            }
        }
        const status = dailyRecord ? this.#i18n.t('newRecord') : leaderboard ? this.#i18n.t('leaderboardUpdated') : '';
        setText(this.#completeScreen, '[data-completion-status]', status);
        const primary = this.#completeScreen.querySelector('[data-completion-primary]');
        if (primary && this.#puzzle) {
            primary.dataset.action = this.#puzzle.mode === 'daily' ? 'replay' : 'next';
            primary.textContent = this.#puzzle.mode === 'daily' ? this.#i18n.t('replay') : this.#i18n.t('nextLevel');
        }
    }
    #openHelp() {
        this.#modalKind = 'help';
        this.pause('modal');
        this.#modalContent.innerHTML = `
      <header class="modal-heading"><span class="modal-kicker">Bloom Circuit</span><h2>${escapeHtml(this.#i18n.t('howTitle'))}</h2><p>${escapeHtml(this.#i18n.t('howBody'))}</p></header>
      <div class="help-grid">
        <article><span>↻</span><h3>Rotate</h3><p>${escapeHtml(this.#i18n.t('howOne'))}</p></article>
        <article><span>✦</span><h3>Aetherlight</h3><p>${escapeHtml(this.#i18n.t('howTwo'))}</p></article>
        <article><span>!</span><h3>Seal leaks</h3><p>${escapeHtml(this.#i18n.t('howThree'))}</p></article>
      </div>
      <button class="button primary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>`;
        this.#showModal();
    }
    #openSettings(refresh = false) {
        this.#modalKind = 'settings';
        if (!refresh)
            this.pause('modal');
        const settings = this.#progress.settings;
        this.#modalContent.innerHTML = `
      <header class="modal-heading compact"><span class="modal-kicker">Clockwork Conservatory</span><h2>${escapeHtml(this.#i18n.t('settings'))}</h2></header>
      <div class="settings-list">
        ${settingToggle('setting-sound', this.#i18n.t('sound'), settings.sound)}
        ${settingToggle('setting-music', this.#i18n.t('music'), settings.music)}
        ${settingToggle('setting-haptics', this.#i18n.t('haptics'), settings.haptics)}
        ${settingToggle('setting-motion', this.#i18n.t('reducedMotion'), settings.reducedMotion)}
        ${settingToggle('setting-contrast', this.#i18n.t('highContrast'), settings.highContrast)}
        <label class="setting-row"><span>${escapeHtml(this.#i18n.t('quality'))}</span><select id="setting-quality">
          ${option('auto', 'Auto', settings.quality)}${option('high', 'High', settings.quality)}${option('balanced', 'Balanced', settings.quality)}
        </select></label>
        <label class="setting-row"><span>${escapeHtml(this.#i18n.t('language'))}</span><select id="language-select">
          ${languageOptions(settings.language)}
        </select></label>
      </div>
      <button class="button primary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>`;
        if (!refresh)
            this.#showModal();
    }
    #openRestartConfirmation() {
        this.#modalKind = 'restart';
        this.pause('modal');
        this.#modalContent.innerHTML = `
      <header class="modal-heading compact"><span class="modal-kicker">Bloom Circuit</span><h2>${escapeHtml(this.#i18n.t('restart'))}?</h2><p>Your current rotations will be reset.</p></header>
      <div class="modal-actions"><button class="button secondary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button><button class="button danger" data-action="confirm-restart">${escapeHtml(this.#i18n.t('restart'))}</button></div>`;
        this.#showModal();
    }
    #showModal() {
        if (typeof this.#modal.showModal === 'function') {
            if (!this.#modal.open)
                this.#modal.showModal();
        }
        else {
            this.#modal.setAttribute('open', '');
        }
    }
    #closeModal() {
        if (this.#modal.open && typeof this.#modal.close === 'function')
            this.#modal.close();
        else {
            this.#modal.removeAttribute('open');
            this.#modalKind = null;
            this.resume('modal');
        }
    }
    #handleSettingChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement))
            return;
        if (target.id === 'language-select' && isLanguage(target.value)) {
            this.#progress.settings.language = target.value;
            this.#i18n.language = target.value;
            this.#applyTranslations();
            this.#renderMenu();
            this.#renderMap();
            this.#renderHud();
            this.#renderObjective();
            this.#openSettings(true);
        }
        else if (target.id === 'setting-sound' && target instanceof HTMLInputElement) {
            this.#progress.settings.sound = target.checked;
            this.#audio.setEnabled(target.checked);
            void this.#bridge.menuAction(target.checked ? 'Sound_On' : 'Sound_Off');
        }
        else if (target.id === 'setting-music' && target instanceof HTMLInputElement) {
            this.#progress.settings.music = target.checked;
            this.#audio.setMusicEnabled(target.checked);
        }
        else if (target.id === 'setting-haptics' && target instanceof HTMLInputElement) {
            this.#progress.settings.haptics = target.checked;
            if (target.checked)
                this.#haptic(8);
        }
        else if (target.id === 'setting-motion' && target instanceof HTMLInputElement) {
            this.#progress.settings.reducedMotion = target.checked;
            this.#applySettings();
        }
        else if (target.id === 'setting-contrast' && target instanceof HTMLInputElement) {
            this.#progress.settings.highContrast = target.checked;
            this.#applySettings();
        }
        else if (target.id === 'setting-quality' && isQuality(target.value)) {
            this.#progress.settings.quality = target.value;
            this.#applySettings();
        }
        this.#scheduleSave(0);
    }
    #applySettings() {
        const settings = this.#progress.settings;
        const profile = resolveRenderProfile(settings.quality, detectDeviceSignals());
        this.#audio.setEnabled(settings.sound);
        this.#audio.setMusicEnabled(settings.music);
        this.#renderer.setReducedMotion(settings.reducedMotion);
        this.#renderer.setHighContrast(settings.highContrast);
        this.#renderer.setRenderProfile(profile);
        this.#app.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
        this.#app.dataset.contrast = settings.highContrast ? 'high' : 'normal';
        this.#app.dataset.quality = profile.quality;
        this.#app.dataset.qualityMode = settings.quality;
    }
    #applyTranslations() {
        document.documentElement.lang = this.#i18n.language;
        this.#app.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.dataset.i18n;
            if (key)
                element.textContent = this.#i18n.t(key);
        });
    }
    #handleKey(event) {
        if (!this.#canInteract())
            return;
        const key = event.key.toLowerCase();
        if (key.startsWith('arrow')) {
            event.preventDefault();
            this.#moveSelection(key);
        }
        else if (key === 'enter' || key === ' ') {
            event.preventDefault();
            if (this.#selectedId)
                this.#rotateTile(this.#selectedId);
        }
        else if (key === 'z') {
            event.preventDefault();
            this.#undo();
        }
        else if (key === 'h') {
            event.preventDefault();
            void this.#useHint();
        }
        else if (key === 'q') {
            event.preventDefault();
            this.#renderer.rotateView(-1);
        }
        else if (key === 'e') {
            event.preventDefault();
            this.#renderer.rotateView(1);
        }
        else if (key === 'r') {
            event.preventDefault();
            this.#openRestartConfirmation();
        }
        else if (key === 'escape') {
            event.preventDefault();
            this.pause('manual');
        }
    }
    #moveSelection(key) {
        const puzzle = this.#puzzle;
        if (!puzzle)
            return;
        const current = puzzle.tiles.find((tile) => tile.id === this.#selectedId) ?? puzzle.tiles[0];
        if (!current)
            return;
        const desired = key === 'arrowup' ? { x: 0, y: -1 } : key === 'arrowdown' ? { x: 0, y: 1 } : key === 'arrowleft' ? { x: -1, y: 0 } : { x: 1, y: 0 };
        const next = puzzle.tiles
            .filter((tile) => tile.id !== current.id)
            .map((tile) => ({ tile, forward: (tile.x - current.x) * desired.x + (tile.y - current.y) * desired.y, distance: Math.hypot(tile.x - current.x, tile.y - current.y) }))
            .filter((item) => item.forward > 0)
            .sort((left, right) => right.forward / left.distance - left.forward / right.distance || left.distance - right.distance)[0]?.tile;
        if (next) {
            this.#selectedId = next.id;
            this.#renderer.setSelected(next.id);
            this.#announce(`Row ${next.y + 1}, column ${next.x + 1}`);
        }
    }
    #canInteract() {
        return this.#screen === 'playing' && this.#pauseReasons.size === 0 && !this.#completionPending;
    }
    #startTimer() {
        if (this.#timing || this.#screen !== 'playing')
            return;
        this.#startedAt = performance.now();
        this.#timing = true;
    }
    #pauseTimer() {
        if (!this.#timing)
            return;
        this.#elapsedBaseMs += performance.now() - this.#startedAt;
        this.#timing = false;
    }
    #elapsedMs() {
        return this.#elapsedBaseMs + (this.#timing ? performance.now() - this.#startedAt : 0);
    }
    #scheduleSave(delayMs = 300) {
        window.clearTimeout(this.#saveTimer);
        this.#saveTimer = window.setTimeout(() => void this.#saveNow(), delayMs);
    }
    async #saveNow(includeRun = true) {
        const puzzle = this.#puzzle;
        if (includeRun && puzzle && this.#screen === 'playing') {
            this.#progress.activeRun = {
                seed: puzzle.seed,
                mode: puzzle.mode,
                level: puzzle.level,
                rotations: puzzle.tiles.map((tile) => tile.rotation),
                moves: this.#moves,
                hintsUsed: this.#hintsUsed,
                elapsedMs: this.#elapsedMs(),
            };
        }
        const payload = cloneProgress(this.#progress);
        const task = this.#saveQueue.then(() => this.#bridge.saveProgress(SAVE_KEY, payload));
        this.#saveQueue = task.catch(async (error) => {
            await this.#bridge.reportError(error);
        });
        await this.#saveQueue;
    }
    #isCurrentRun(token, puzzle) {
        return !this.#destroyed && token === this.#runToken && (!puzzle || this.#puzzle === puzzle);
    }
    #haptic(pattern) {
        if (!this.#progress.settings.haptics || document.visibilityState !== 'visible' || typeof navigator.vibrate !== 'function')
            return;
        try {
            navigator.vibrate(pattern);
        }
        catch { /* Haptics are optional. */ }
    }
    #showFeedback(message, kind) {
        window.clearTimeout(this.#feedbackTimer);
        this.#feedback.textContent = message;
        this.#feedback.dataset.kind = kind;
        this.#feedback.hidden = false;
        this.#feedback.classList.remove('feedback-enter');
        void this.#feedback.offsetWidth;
        this.#feedback.classList.add('feedback-enter');
        this.#feedbackTimer = window.setTimeout(() => { this.#feedback.hidden = true; }, this.#progress.settings.reducedMotion ? 850 : 1_450);
    }
    #pulseHud(selector) {
        const element = this.#gameHud.querySelector(selector);
        if (!element || this.#progress.settings.reducedMotion)
            return;
        element.classList.remove('hud-pulse');
        void element.offsetWidth;
        element.classList.add('hud-pulse');
        window.setTimeout(() => element.classList.remove('hud-pulse'), 520);
    }
    #showToast(message, durationMs = 2_500) {
        window.clearTimeout(this.#toastTimer);
        this.#toast.textContent = message;
        this.#toast.hidden = false;
        this.#toast.classList.remove('toast-enter');
        void this.#toast.offsetWidth;
        this.#toast.classList.add('toast-enter');
        this.#toastTimer = window.setTimeout(() => { this.#toast.hidden = true; }, durationMs);
    }
    #announce(message) {
        this.#liveRegion.textContent = '';
        requestAnimationFrame(() => { this.#liveRegion.textContent = message; });
    }
    #renderSdkStatus() {
        this.#app.querySelectorAll('[data-sdk-status]').forEach((element) => {
            element.dataset.connected = String(this.#bridge.connected);
            element.textContent = this.#bridge.connected ? 'Arkadium connected' : 'Standalone preview';
        });
    }
    #restorationPercent() {
        return Math.min(100, Math.round(((Math.max(1, this.#progress.campaignLevel) - 1) / 60) * 100));
    }
}
function shellTemplate(version) {
    const specimenCards = (compact = false) => ['lumen-orchid', 'moonbell', 'sun-dahlia', 'mist-lily', 'ember-bloom']
        .map((kind, index) => `<article class="specimen-card${compact ? ' compact' : ''}" data-specimen="${kind}"><img src="${specimenImage(kind)}" alt=""><span data-specimen-label>${specimenName(kind)}</span><small>${'★'.repeat(Math.min(3, index + 1))}</small></article>`).join('');
    return `
    <div class="scene-background" aria-hidden="true"></div>
    <canvas id="game-canvas" aria-label="Clockwork Conservatory puzzle board"></canvas>

    <section id="menu-screen" class="screen menu-screen" hidden>
      <header class="utility-bar">
        <div class="keeper-badge"><span class="level-medallion" data-menu-level>1</span><div><strong>Verdant Keeper</strong><small>Conservatory restorer</small></div></div>
        <nav class="utility-actions"><button class="round-button" data-action="help" aria-label="How to play">?</button><button class="round-button" data-action="settings" aria-label="Settings">⚙</button></nav>
      </header>
      <div class="menu-card ornate-panel">
        <div class="brand-lockup"><span class="brand-emblem">✤</span><p class="eyebrow">Bloom Circuit</p><h1>Clockwork<br>Conservatory</h1><p class="tagline" data-i18n="tagline">Reconnect the aetherlight. Awaken every bloom.</p></div>
        <button class="mode-card continue-card" data-action="continue-run" hidden><span class="mode-icon">↻</span><strong data-i18n="continue">Continue</strong><small data-continue-detail></small></button>
        <div class="mode-grid">
          <button class="mode-card featured" data-action="campaign"><span class="mode-icon">✤</span><strong data-i18n="campaign">Campaign</strong><small data-i18n="campaignSub">Restore chambers and unlock rare blooms.</small></button>
          <button class="mode-card" data-action="daily"><span class="mode-icon luminous">✦</span><strong data-i18n="daily">Daily Bloom</strong><small data-i18n="dailySub">One daily seed shared by every player.</small></button>
          <button class="mode-card" data-action="zen"><span class="mode-icon">❉</span><strong data-i18n="zen">Zen Garden</strong><small data-i18n="zenSub">Relax in an untimed endless garden.</small></button>
        </div>
        <div class="menu-meta">
          <section class="restoration-card"><div class="section-heading"><span data-i18n="restoration">Restoration progress</span><b data-progress-percent>0%</b></div><div class="progress-track"><i data-progress-bar></i></div><p>Restore chambers to reveal new botanical wonders.</p></section>
          <section class="collection-preview"><div class="section-heading"><span data-i18n="specimens">Specimen collection</span><button class="mini-link" data-action="open-map">View map</button></div><div class="specimen-row">${specimenCards(true)}</div></section>
        </div>
        <footer class="menu-stats"><div><span>♜</span><small data-i18n="bestScore">Best score</small><strong data-best-score>0</strong></div><div><span>✤</span><small data-i18n="streak">Current streak</small><strong><b data-streak>0</b> days</strong></div><div><span>⚙</span><small data-i18n="chamberProgress">Chamber progress</small><strong data-chamber-progress>0 / 60</strong></div></footer>
        <div class="build-line"><span data-sdk-status>Standalone preview</span><span>v${escapeHtml(version)}</span></div>
      </div>
    </section>

    <section id="map-screen" class="screen map-screen" hidden>
      <header class="map-header"><button class="icon-text-button" data-action="return-menu">← <span data-i18n="menu">Menu</span></button><div class="map-brand"><span>✤</span><strong>Clockwork Conservatory</strong><small>Bloom Circuit</small></div><button class="round-button" data-action="settings" aria-label="Settings">⚙</button></header>
      <div class="map-layout">
        <main class="restoration-map ornate-panel">
          <header><p class="eyebrow">Bloom Circuit</p><h2 data-i18n="mapTitle">Restoration Map</h2><p data-i18n="mapBody">Reconnect every chamber and return the living glasshouse to splendour.</p></header>
          <div class="chamber-map">
            <svg class="map-paths" viewBox="0 0 900 430" aria-hidden="true"><path d="M150 110 C260 80 320 190 430 205 S600 85 720 120"/><path d="M150 320 C270 320 300 230 430 205 S600 310 730 320"/></svg>
            ${CHAMBERS.map((chamber, index) => `<button class="chamber-node node-${index + 1}" data-chamber-index="${index}" data-state="locked"><span class="dome-icon">⌂</span><strong>${chamber.name}</strong><small data-chamber-status>Locked</small><b>${index < 2 ? '★★★' : index === 2 ? '★☆☆' : '☆☆☆'}</b></button>`).join('')}
          </div>
          <div class="map-lower"><section class="map-progress"><div class="progress-orb"><strong data-map-progress>0%</strong><span>restored</span></div><div><h3 data-i18n="restoration">Restoration progress</h3><div class="progress-track"><i data-map-progress-bar></i></div><p>Keep restoring to unlock new blooms and areas.</p></div></section><section class="map-collection"><h3 data-i18n="specimens">Specimen collection</h3><div class="specimen-row">${specimenCards(true)}</div></section></div>
        </main>
        <aside class="map-sidebar"><section class="daily-panel ornate-panel"><p class="eyebrow" data-i18n="daily">Daily Bloom</p><img src="./assets/specimen-1.webp" alt="Blue luminous flower"><strong data-i18n="dailyReady">New puzzle available</strong><button class="button primary" data-action="daily-map" data-i18n="playNow">Play now</button></section><section class="streak-panel ornate-panel"><p class="eyebrow" data-i18n="streak">Current streak</p><strong data-map-streak>0</strong><span data-i18n="dayStreak">days in a row</span><div class="streak-dots">✓ ✓ ✓ ✓ ✓ ✓ ✓</div></section></aside>
      </div>
      <button class="continue-restoration button primary" data-action="continue-restoration" data-i18n="continueRestoration">Continue restoration</button>
    </section>

    <header id="game-hud" class="game-hud" hidden>
      <div class="hud-brand"><span class="brand-glyph">✤</span><div><strong>Clockwork Conservatory</strong><small>Bloom Circuit</small></div></div>
      <div class="hud-stats"><div data-stat="level"><span data-i18n="level">Level</span><strong data-hud-level>1</strong></div><div data-stat="score"><span data-i18n="score">Score</span><strong data-hud-score>0</strong></div><div class="moves-stat" data-stat="moves"><span data-i18n="moves">Moves</span><strong data-hud-moves>0</strong></div><div data-stat="blooms"><span data-i18n="blooms">Blooms</span><strong data-hud-blooms>0 / 0</strong></div><div data-stat="leaks"><span data-i18n="leaks">Leaks sealed</span><strong data-hud-leaks>0 / 0</strong></div><div class="flow-meter" data-flow-meter role="progressbar" aria-label="Bloom current" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div>
      <button class="round-button hud-settings" data-action="pause" aria-label="Pause">Ⅱ</button>
    </header>

    <aside id="objective-banner" class="objective-banner" hidden><span>✤</span><strong data-objective-text></strong></aside>
    <div id="board-feedback" class="board-feedback" role="status" hidden></div>
    <aside id="coach-overlay" class="coach-overlay ornate-panel" hidden><div class="coach-step" data-coach-step>1 / 3</div><h2 data-coach-title></h2><p data-coach-body></p><button class="button primary compact" data-action="dismiss-coach">Try it</button></aside>

    <nav id="game-toolbar" class="game-toolbar ornate-panel" hidden>
      <button class="tool-button" data-action="undo"><span>↶</span><strong data-i18n="undo">Undo</strong><small>⌘Z</small></button>
      <button class="tool-button hint-button" data-action="hint"><span>✤</span><strong data-i18n="hint">Garden Hint</strong><small data-hint-count>3</small></button>
      <button class="tool-button view-button" data-action="rotate-left" aria-label="Rotate view left"><span>◇</span><strong data-i18n="rotateView">Rotate view</strong></button>
      <button class="tool-button" data-action="restart"><span>↻</span><strong data-i18n="restart">Restart</strong></button>
      <button class="tool-button" data-action="menu"><span>☰</span><strong data-i18n="menu">Menu</strong></button>
    </nav>

    <section id="complete-screen" class="screen complete-screen" hidden>
      <div class="completion-card ornate-panel">
        <span class="completion-emblem">✤</span><p class="eyebrow">Bloom Circuit</p><h2 data-i18n="glasshouseRestored">Glasshouse Restored</h2><p class="completion-grade" data-final-grade></p><div class="stars" data-final-stars>★★★</div><div class="final-score"><span data-i18n="score">Score</span><strong data-final-score>0</strong></div>
        <div class="completion-stats"><div><span data-i18n="moves">Moves</span><strong data-final-moves>0</strong></div><div><span>Time</span><strong data-final-time>00:00</strong></div><div><span data-i18n="bestScore">Best score</span><strong data-final-best>0</strong></div></div>
        <p class="completion-status" data-completion-status></p>
        <section class="unlock-card" data-unlock hidden><img src="./assets/specimen-1.webp" alt=""><div><span data-i18n="newSpecimen">New specimen unlocked</span><strong data-unlock-name></strong><small>A rare bloom restored to the conservatory.</small></div></section>
        <div class="completion-actions"><button class="button primary" data-completion-primary data-action="next" data-i18n="nextLevel">Next level</button><button class="button secondary" data-action="replay" data-i18n="replay">Replay</button><button class="text-button" data-action="return-menu" data-i18n="returnMenu">Return to menu</button></div>
      </div>
    </section>

    <section id="pause-overlay" class="pause-overlay" hidden><div class="pause-card ornate-panel"><span>Ⅱ</span><h2 data-i18n="pauseTitle">The glasshouse is paused</h2><button class="button primary" data-action="resume" data-i18n="resume">Resume</button><button class="button secondary" data-action="settings" data-i18n="settings">Settings</button><button class="text-button" data-action="return-menu" data-i18n="returnMenu">Return to menu</button></div></section>
    <section id="loading-overlay" class="loading-overlay"><div class="loading-emblem">✤</div><h2>Clockwork Conservatory</h2><p data-i18n="loading">Opening the conservatory…</p></section>
    <dialog id="game-modal" class="game-modal"><div id="modal-content"></div></dialog>
    <div id="toast" class="toast" role="status" hidden></div>
    <div id="live-region" class="sr-only" aria-live="polite"></div>`;
}
function must(scope, selector) {
    const element = scope.querySelector(selector);
    if (!element)
        throw new Error(`Required element not found: ${selector}`);
    return element;
}
function setText(scope, selector, text) {
    const element = scope.querySelector(selector);
    if (element)
        element.textContent = text;
}
function delay(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function settingToggle(id, label, checked) { return `<label class="setting-row"><span>${escapeHtml(label)}</span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i aria-hidden="true"></i></label>`; }
function option(value, label, selected) { return `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`; }
function languageOptions(selected) {
    const languages = [['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['ru', 'Русский']];
    return languages.map(([value, label]) => option(value, label, selected)).join('');
}
function isLanguage(value) { return value === 'en' || value === 'es' || value === 'fr' || value === 'de' || value === 'it' || value === 'ru'; }
function isQuality(value) { return value === 'auto' || value === 'high' || value === 'balanced'; }
function cloneProgress(progress) {
    if (typeof structuredClone === 'function')
        return structuredClone(progress);
    return JSON.parse(JSON.stringify(progress));
}
async function withTimeout(promise, milliseconds, fallback) {
    return Promise.race([promise, delay(milliseconds).then(() => fallback)]);
}
function initialSelection(puzzle) {
    if (puzzle.tutorial)
        return puzzle.tutorial.targetId;
    const source = puzzle.tiles.find((tile) => tile.id === puzzle.sourceId);
    const rotatable = puzzle.tiles
        .filter((tile) => !tile.fixed && rotationPeriod(tile.baseMask) > 1)
        .sort((left, right) => {
        if (!source)
            return left.y - right.y || left.x - right.x;
        const leftDistance = Math.abs(left.x - source.x) + Math.abs(left.y - source.y);
        const rightDistance = Math.abs(right.x - source.x) + Math.abs(right.y - source.y);
        return leftDistance - rightDistance || left.y - right.y || left.x - right.x;
    })[0];
    return rotatable?.id ?? puzzle.sourceId;
}
function specimenName(kind) {
    return ({ 'lumen-orchid': 'Lumen Orchid', moonbell: 'Moonbell', 'sun-dahlia': 'Sun Dahlia', 'mist-lily': 'Mist Lily', 'ember-bloom': 'Ember Bloom' })[kind];
}
function specimenImage(kind) {
    const index = ({ 'lumen-orchid': 1, moonbell: 2, 'sun-dahlia': 3, 'mist-lily': 4, 'ember-bloom': 5 })[kind];
    return `./assets/specimen-${index}.webp`;
}
//# sourceMappingURL=game.js.map