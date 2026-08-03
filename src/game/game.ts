import { analyzeBoard, rotationPeriod } from '../core/board.js';
import { difficultyFor, updateSkillProfile } from '../core/difficulty.js';
import { dailySeed, generatePuzzle } from '../core/generator.js';
import { suggestHint } from '../core/hints.js';
import { createDefaultProgress, sanitizeProgress, SAVE_KEY, serializedSize } from '../core/progress.js';
import { calculateCompletion } from '../core/scoring.js';
import { isTutorialSeed, tutorialForLevel, type TutorialStep } from '../core/tutorial.js';
import type {
  ActiveRunSnapshot,
  BoardAnalysis,
  CompletionStats,
  GameMode,
  PlantKind,
  PersistedProgress,
  PuzzleDefinition,
  SupportedLanguage,
  TileState,
} from '../core/types.js';
import { ArkadiumBridge } from '../platform/arkadium.js';
import { I18n, detectLanguage, isSupportedLanguage, type TranslationKey } from '../ui/i18n.js';
import { AudioEngine } from './audio.js';
import { ConservatoryRenderer } from './renderer.js';

const FREE_HINTS = 3;

type Screen = 'loading' | 'menu' | 'playing' | 'complete';
type ModalKind = 'help' | 'settings' | 'restart' | null;
type PauseReason = 'host' | 'visibility' | 'manual' | 'modal';

interface MoveRecord {
  readonly tileId: string;
  readonly rotation: number;
  readonly visualTurns: number;
}

export class ClockworkGame {
  readonly #app: HTMLElement;
  readonly #canvas: HTMLCanvasElement;
  readonly #menuOverlay: HTMLElement;
  readonly #hud: HTMLElement;
  readonly #toolbar: HTMLElement;
  readonly #coachOverlay: HTMLElement;
  readonly #completionOverlay: HTMLElement;
  readonly #pauseOverlay: HTMLElement;
  readonly #loadingOverlay: HTMLElement;
  readonly #toast: HTMLElement;
  readonly #liveRegion: HTMLElement;
  readonly #modal: HTMLDialogElement;
  readonly #modalContent: HTMLElement;
  readonly #renderer: ConservatoryRenderer;
  readonly #audio = new AudioEngine();
  readonly #bridge: ArkadiumBridge;
  readonly #i18n: I18n;
  readonly #version: string;

  #progress: PersistedProgress;
  #puzzle: PuzzleDefinition | null = null;
  #analysis: BoardAnalysis | null = null;
  #screen: Screen = 'loading';
  #modalKind: ModalKind = null;
  #selectedId: string | null = null;
  #tutorialStep: TutorialStep | null = null;
  #tutorialTargetId: string | null = null;
  #moves = 0;
  #hintsUsed = 0;
  #history: MoveRecord[] = [];
  #elapsedBaseMs = 0;
  #runStartedAt = 0;
  #timingActive = false;
  #completionPending = false;
  #hintBusy = false;
  #firstMoveSent = false;
  #pauseReasons = new Set<PauseReason>();
  #saveTimer = 0;
  #toastTimer = 0;
  #hudTimer = 0;

  public constructor(app: HTMLElement, bridge: ArkadiumBridge, version: string) {
    this.#app = app;
    this.#bridge = bridge;
    this.#version = version;
    this.#i18n = new I18n(detectLanguage());
    this.#progress = createDefaultProgress(this.#i18n.language);

    app.innerHTML = shellTemplate();
    this.#canvas = mustElement<HTMLCanvasElement>(app, '#game-canvas');
    this.#menuOverlay = mustElement(app, '#menu-overlay');
    this.#hud = mustElement(app, '#game-hud');
    this.#toolbar = mustElement(app, '#game-toolbar');
    this.#coachOverlay = mustElement(app, '#coach-overlay');
    this.#completionOverlay = mustElement(app, '#completion-overlay');
    this.#pauseOverlay = mustElement(app, '#pause-overlay');
    this.#loadingOverlay = mustElement(app, '#loading-overlay');
    this.#toast = mustElement(app, '#toast');
    this.#liveRegion = mustElement(app, '#live-region');
    this.#modal = mustElement<HTMLDialogElement>(app, '#game-modal');
    this.#modalContent = mustElement(app, '#modal-content');
    this.#renderer = new ConservatoryRenderer(this.#canvas);

    this.#bindEvents();
    this.#bridge.bindPauseHandlers(
      () => this.pause('host'),
      () => this.resume('host'),
    );
    this.#hudTimer = window.setInterval(() => this.#renderHud(), 200);
  }

  public async initialize(): Promise<void> {
    this.#app.dataset.loaded = 'false';
    this.#applyTranslations();
    void this.#bridge.initialize();

    try {
      const raw = await this.#bridge.loadProgress(SAVE_KEY);
      this.#progress = sanitizeProgress(raw, this.#i18n.language);
      this.#i18n.language = this.#progress.settings.language;
    } catch (error) {
      this.#progress = createDefaultProgress(this.#i18n.language);
      await this.#bridge.reportError(error);
    }

    this.#applySettings();
    this.#applyTranslations();
    this.#showMenu();
    this.#loadingOverlay.hidden = true;
    this.#app.dataset.loaded = 'true';
    this.#app.dataset.version = this.#version;

    await this.#bridge.markReady();
    await this.#bridge.appStarted();
    await this.#bridge.mainScreenReady();
    this.#announce(this.#i18n.t('ready'));

    const params = new URLSearchParams(location.search);
    const autostart = params.get('autostart');
    if (autostart === 'daily' || autostart === 'zen' || autostart === 'campaign') {
      await this.#startMode(autostart, false);
    }
  }

  public destroy(): void {
    window.clearInterval(this.#hudTimer);
    window.clearTimeout(this.#saveTimer);
    window.clearTimeout(this.#toastTimer);
    this.#renderer.destroy();
  }

  public pause(reason: PauseReason): void {
    const wasPaused = this.#pauseReasons.size > 0;
    this.#pauseReasons.add(reason);
    if (!wasPaused && this.#screen === 'playing') {
      this.#pauseTiming();
      this.#renderer.pause();
      void this.#audio.suspend();
    }
    if ((reason === 'host' || reason === 'manual') && this.#screen === 'playing') {
      this.#pauseOverlay.hidden = false;
    }
  }

  public resume(reason: PauseReason): void {
    this.#pauseReasons.delete(reason);
    if (this.#pauseReasons.size > 0 || this.#screen !== 'playing') {
      return;
    }
    this.#pauseOverlay.hidden = true;
    this.#renderer.resume();
    this.#resumeTiming();
    void this.#audio.resume();
    this.#canvas.focus({ preventScroll: true });
  }

  async #startMode(mode: GameMode, resumePreferred: boolean): Promise<void> {
    const currentDailySeed = dailySeed();
    const snapshot = this.#progress.activeRun;
    const canResume =
      resumePreferred &&
      snapshot !== undefined &&
      (snapshot.mode !== 'daily' || snapshot.seed === currentDailySeed);

    let puzzle: PuzzleDefinition;
    if (canResume && snapshot) {
      puzzle = this.#restoreSnapshot(snapshot);
      this.#moves = snapshot.moves;
      this.#hintsUsed = snapshot.hintsUsed;
      this.#elapsedBaseMs = snapshot.elapsedMs;
      this.#showToast(this.#i18n.t('saveRestored'));
    } else {
      const level = mode === 'campaign' ? this.#progress.campaignLevel : 1;
      const tutorial = mode === 'campaign' ? tutorialForLevel(level) : null;
      if (tutorial) {
        puzzle = tutorial.puzzle;
      } else {
        const seed =
          mode === 'daily'
            ? currentDailySeed
            : mode === 'campaign'
              ? `campaign:${level}:clockwork-v2`
              : `zen:${Date.now()}:${Math.round(Math.random() * 1_000_000)}`;
        const config = difficultyFor(level, this.#progress.skill.rating, mode);
        puzzle = generatePuzzle({ seed, mode, level, config });
      }
      this.#moves = 0;
      this.#hintsUsed = 0;
      this.#elapsedBaseMs = 0;
    }

    this.#puzzle = puzzle;
    this.#analysis = analyzeBoard(puzzle);
    this.#history = [];
    this.#completionPending = false;
    this.#hintBusy = false;
    this.#selectedId = puzzle.sourceId;
    this.#renderer.setPuzzle(puzzle);
    this.#renderer.setAnalysis(this.#analysis);
    this.#renderer.setSelected(this.#selectedId);
    this.#screen = 'playing';
    this.#configureTutorial(puzzle);
    this.#pauseReasons.clear();
    this.#app.dataset.screen = 'playing';
    this.#app.dataset.mode = mode;
    this.#menuOverlay.hidden = true;
    this.#completionOverlay.hidden = true;
    this.#pauseOverlay.hidden = true;
    this.#hud.hidden = false;
    this.#toolbar.hidden = false;
    this.#canvas.tabIndex = 0;
    this.#renderer.resume();
    this.#resumeTiming();
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave(0);

    await this.#bridge.gameStart();
    await this.#bridge.levelStart(puzzle.level);
    await this.#bridge.customEvent('Puzzle', 'Level_Start', {
      mode: puzzle.mode,
      level: puzzle.level,
      tier: puzzle.config.tier,
      activeTiles: puzzle.tiles.length,
      plants: this.#analysis.totalPlants,
    });

    // A page can close during the short final-turn flourish after the solved board was
    // persisted but before completion cleanup. Resume that state as a win instead of
    // asking the player to disturb an already-complete circuit.
    if (this.#analysis.solved && !this.#completionPending) {
      this.#completionPending = true;
      window.setTimeout(() => void this.#completePuzzle(), this.#progress.settings.reducedMotion ? 40 : 180);
    }

    requestAnimationFrame(() => this.#canvas.focus({ preventScroll: true }));
  }

  #restoreSnapshot(snapshot: ActiveRunSnapshot): PuzzleDefinition {
    const tutorial = snapshot.mode === 'campaign' && isTutorialSeed(snapshot.seed) ? tutorialForLevel(snapshot.level) : null;
    const puzzle =
      tutorial?.puzzle ??
      generatePuzzle({
        seed: snapshot.seed,
        mode: snapshot.mode,
        level: snapshot.level,
        config: snapshot.config,
      });
    if (snapshot.rotations.length === puzzle.tiles.length) {
      puzzle.tiles.forEach((tile, index) => {
        const period = rotationPeriod(tile.baseMask);
        const rotation = (snapshot.rotations[index] as number) % period;
        tile.rotation = rotation;
        tile.visualTurns = rotation;
      });
    }
    return puzzle;
  }

  #bindEvents(): void {
    this.#app.addEventListener('pointerdown', () => void this.#audio.unlock(), { passive: true });
    this.#app.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
      if (!target || target.hasAttribute('disabled')) {
        return;
      }
      const action = target.dataset.action;
      if (action) {
        void this.#handleAction(action);
      }
    });

    this.#canvas.addEventListener('pointerup', (event) => {
      if (this.#screen !== 'playing' || this.#pauseReasons.size > 0 || this.#completionPending) {
        return;
      }
      const tileId = this.#renderer.hitTest(event.clientX, event.clientY);
      if (!tileId) {
        return;
      }
      this.#selectedId = tileId;
      this.#renderer.setSelected(tileId);
      this.#renderCanvasLabel();
      this.#rotateTile(tileId);
    });
    this.#canvas.addEventListener('pointermove', (event) => {
      if (this.#screen !== 'playing' || this.#pauseReasons.size > 0 || this.#completionPending) {
        this.#renderer.setHovered(null);
        return;
      }
      this.#renderer.setHovered(this.#renderer.hitTest(event.clientX, event.clientY));
    });
    this.#canvas.addEventListener('pointerleave', () => this.#renderer.setHovered(null));

    this.#canvas.addEventListener('keydown', (event) => this.#handleCanvasKey(event));
    this.#app.addEventListener('change', (event) => this.#handleControlChange(event));
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
      } else {
        this.resume('visibility');
      }
    });

    window.addEventListener('blur', () => this.pause('visibility'));
    window.addEventListener('focus', () => {
      if (document.visibilityState === 'visible') {
        this.resume('visibility');
      }
    });

    window.addEventListener('pagehide', () => {
      this.#pauseTiming();
      void this.#saveNow();
      void this.#bridge.gameEnd();
      void this.#audio.suspend();
    });

    window.addEventListener('error', (event) => void this.#bridge.reportError(event.error ?? event.message));
    window.addEventListener('unhandledrejection', (event) => void this.#bridge.reportError(event.reason));
  }

  async #handleAction(action: string): Promise<void> {
    switch (action) {
      case 'continue-run':
        if (this.#progress.activeRun) {
          await this.#startMode(this.#progress.activeRun.mode, true);
        }
        break;
      case 'campaign':
        await this.#startMode('campaign', false);
        break;
      case 'daily':
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
      case 'rotate-left':
        this.#renderer.rotateView(-1);
        break;
      case 'rotate-right':
        this.#renderer.rotateView(1);
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
        this.#showMenu();
        break;
      case 'resume':
        this.resume('manual');
        break;
      case 'pause':
        this.pause('manual');
        break;
      case 'toggle-sound':
        await this.#toggleSound();
        break;
      case 'next':
        await this.#nextPuzzle();
        break;
      case 'replay':
        await this.#replayPuzzle();
        break;
      case 'return-menu':
        this.#showMenu();
        break;
      default:
        break;
    }
  }

  #handleCanvasKey(event: KeyboardEvent): void {
    if (this.#screen !== 'playing' || this.#pauseReasons.size > 0 || this.#completionPending) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
      event.preventDefault();
      this.#moveSelection(key);
      return;
    }
    if (key === 'enter' || key === ' ') {
      event.preventDefault();
      if (this.#selectedId) {
        this.#rotateTile(this.#selectedId);
      }
      return;
    }
    if (key === 'z') {
      event.preventDefault();
      this.#undo();
    } else if (key === 'h') {
      event.preventDefault();
      void this.#useHint();
    } else if (key === 'q') {
      event.preventDefault();
      this.#renderer.rotateView(-1);
    } else if (key === 'e') {
      event.preventDefault();
      this.#renderer.rotateView(1);
    } else if (key === 'm') {
      event.preventDefault();
      void this.#toggleSound();
    } else if (key === 'r') {
      event.preventDefault();
      this.#openRestartConfirmation();
    } else if (key === 'escape') {
      event.preventDefault();
      this.pause('manual');
    }
  }

  #handleControlChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) {
      return;
    }
    if (target.id === 'language-select' && isSupportedLanguage(target.value)) {
      this.#progress.settings.language = target.value;
      this.#i18n.language = target.value;
      this.#applyTranslations();
      this.#renderHud();
      this.#renderCanvasLabel();
      if (this.#modalKind === 'settings') {
        this.#openSettings(true);
      }
      this.#scheduleSave(0);
    } else if (target.id === 'setting-sound' && target instanceof HTMLInputElement) {
      this.#progress.settings.sound = target.checked;
      this.#audio.setEnabled(target.checked);
      void this.#bridge.menuAction(target.checked ? 'Sound_On' : 'Sound_Off');
      this.#renderHud();
      this.#scheduleSave(0);
    } else if (target.id === 'setting-motion' && target instanceof HTMLInputElement) {
      this.#progress.settings.reducedMotion = target.checked;
      this.#applySettings();
      this.#scheduleSave(0);
    } else if (target.id === 'setting-contrast' && target instanceof HTMLInputElement) {
      this.#progress.settings.highContrast = target.checked;
      this.#applySettings();
      this.#scheduleSave(0);
    }
  }

  #rotateTile(tileId: string): void {
    const puzzle = this.#puzzle;
    const previousAnalysis = this.#analysis;
    if (!puzzle || !previousAnalysis) {
      return;
    }
    const tile = puzzle.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) {
      return;
    }
    if (this.#tutorialTargetId && tileId !== this.#tutorialTargetId) {
      this.#audio.denied();
      this.#selectedId = this.#tutorialTargetId;
      this.#renderer.setSelected(this.#tutorialTargetId);
      this.#showToast(this.#i18n.t('tutorialTryGlow'));
      this.#renderer.setCoach(this.#tutorialTargetId);
      this.#renderCanvasLabel();
      return;
    }
    const period = rotationPeriod(tile.baseMask);
    if (tile.fixed || period === 1) {
      this.#audio.denied();
      this.#showToast(this.#i18n.t('fixedTile'));
      this.#announce(this.#i18n.t('fixedTile'));
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
    if (this.#analysis.poweredPlants > previousAnalysis.poweredPlants) {
      this.#audio.connect();
    } else {
      this.#audio.turn();
    }

    this.#announce(
      this.#i18n.t('tileRotated', {
        row: tile.y + 1,
        column: tile.x + 1,
        powered: this.#analysis.poweredPlants,
        total: this.#analysis.totalPlants,
      }),
    );
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave();

    if (this.#analysis.solved && !this.#completionPending) {
      this.#coachOverlay.hidden = true;
      this.#renderer.setCoach(null);
      this.#completionPending = true;
      window.setTimeout(
        () => void this.#completePuzzle(),
        this.#progress.settings.reducedMotion ? 80 : 620,
      );
    }
  }

  #undo(): void {
    const puzzle = this.#puzzle;
    const record = this.#history.pop();
    if (!puzzle || !record || this.#completionPending) {
      this.#audio.denied();
      this.#showToast(this.#i18n.t('undoEmpty'));
      return;
    }
    const tile = puzzle.tiles.find((candidate) => candidate.id === record.tileId);
    if (!tile) {
      return;
    }
    tile.rotation = record.rotation;
    tile.visualTurns = record.visualTurns;
    this.#moves += 1;
    this.#selectedId = tile.id;
    this.#analysis = analyzeBoard(puzzle);
    this.#renderer.setSelected(tile.id);
    this.#renderer.setAnalysis(this.#analysis);
    this.#renderer.syncTile(tile);
    this.#audio.undo();
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave();
  }

  async #useHint(): Promise<void> {
    if (!this.#puzzle || !this.#analysis || this.#hintBusy || this.#completionPending) {
      return;
    }
    this.#hintBusy = true;
    this.#renderHud();
    this.#showToast(this.#i18n.t('hintThinking'), 2_000);

    const freeRemaining = Math.max(0, FREE_HINTS - this.#hintsUsed);
    if (freeRemaining === 0) {
      const rewarded = await this.#bridge.showRewarded();
      if (!rewarded) {
        this.#hintBusy = false;
        this.#showToast(this.#bridge.rewardedAvailable ? this.#i18n.t('rewardedFailed') : this.#i18n.t('adUnavailable'));
        this.#renderHud();
        return;
      }
    }

    await delay(this.#progress.settings.reducedMotion ? 40 : 320);
    const suggestion = suggestHint(this.#puzzle);
    this.#hintBusy = false;
    if (!suggestion) {
      this.#showToast(this.#i18n.t('noHint'));
      this.#renderHud();
      return;
    }

    const tile = this.#puzzle.tiles.find((candidate) => candidate.id === suggestion.tileId);
    if (!tile) {
      return;
    }
    this.#hintsUsed += 1;
    this.#selectedId = tile.id;
    this.#renderer.setSelected(tile.id);
    this.#renderer.setHint(tile.id);
    this.#audio.hint();
    const turns =
      suggestion.rotations === 1
        ? this.#i18n.t('once')
        : suggestion.rotations === 2
          ? this.#i18n.t('twice')
          : this.#i18n.t('threeTimes');
    const message = this.#i18n.t('hintTile', { row: tile.y + 1, column: tile.x + 1, turns });
    this.#showToast(message, 5_000);
    this.#announce(message);
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave();
    await this.#bridge.customEvent('AI_Hint', suggestion.reason, {
      level: this.#puzzle.level,
      mode: this.#puzzle.mode,
      rotations: suggestion.rotations,
      hintsUsed: this.#hintsUsed,
    });
  }

  async #completePuzzle(): Promise<void> {
    const puzzle = this.#puzzle;
    const analysis = this.#analysis;
    if (!puzzle || !analysis || !analysis.solved) {
      this.#completionPending = false;
      return;
    }

    this.#pauseTiming();
    const elapsedMs = this.#elapsedBaseMs;
    const stats = calculateCompletion(puzzle, this.#moves, this.#hintsUsed, elapsedMs);
    this.#progress.totalScore += stats.score;
    if (!isTutorialSeed(puzzle.seed)) {
      this.#progress.skill = updateSkillProfile(this.#progress.skill, stats, puzzle.tiles.length);
    }
    if (puzzle.mode === 'campaign') {
      this.#progress.campaignLevel = Math.max(this.#progress.campaignLevel, puzzle.level + 1);
    }

    let dailyIsBest = false;
    if (puzzle.mode === 'daily') {
      const key = puzzle.seed.replace('daily:', '');
      const previous = this.#progress.bestDaily[key] ?? 0;
      if (stats.score > previous) {
        this.#progress.bestDaily[key] = stats.score;
        dailyIsBest = true;
      }
    }
    window.clearTimeout(this.#saveTimer);
    delete this.#progress.activeRun;

    this.#coachOverlay.hidden = true;
    this.#renderer.setCoach(null);
    this.#toolbar.hidden = true;
    this.#app.dataset.state = 'celebrating';
    this.#audio.bloom();
    const celebrationDuration = this.#progress.settings.reducedMotion ? 320 : 1_850;
    this.#renderer.startVictorySequence(celebrationDuration);

    // Start the payoff immediately. Persistence, lifecycle, analytics, and leaderboard
    // work continue during the flourish instead of delaying visible player feedback.
    const platformWork = (async (): Promise<boolean> => {
      await this.#saveNow(false);
      await this.#bridge.levelEnd(puzzle.level, stats.score);
      await this.#bridge.gameWon(stats.score, elapsedMs / 1_000);
      return puzzle.mode === 'daily' ? this.#bridge.postDailyScore(stats.score) : false;
    })();
    const [, leaderboardPosted] = await Promise.all([delay(celebrationDuration), platformWork]);

    this.#renderCompletion(stats, dailyIsBest, leaderboardPosted);
    this.#screen = 'complete';
    this.#app.dataset.screen = 'complete';
    delete this.#app.dataset.state;
    this.#hud.hidden = true;
    this.#completionOverlay.hidden = false;
    this.#completionOverlay.classList.remove('is-entering');
    void this.#completionOverlay.offsetWidth;
    this.#completionOverlay.classList.add('is-entering');
    this.#canvas.tabIndex = -1;
    this.#completionPending = false;
  }

  #renderCompletion(stats: CompletionStats, dailyIsBest: boolean, leaderboardPosted: boolean): void {
    const puzzle = this.#puzzle;
    if (!puzzle) {
      return;
    }
    setText(this.#completionOverlay, '[data-completion-title]', this.#i18n.t(puzzle.mode === 'daily' ? 'dailyCompleteTitle' : 'completeTitle'));
    setText(
      this.#completionOverlay,
      '[data-completion-grade]',
      this.#i18n.t(stats.stars === 3 ? 'perfectCircuit' : stats.stars === 2 ? 'gracefulCircuit' : 'restoredCircuit'),
    );
    setText(this.#completionOverlay, '[data-stars]', '★'.repeat(stats.stars) + '☆'.repeat(3 - stats.stars));
    setText(this.#completionOverlay, '[data-final-score]', this.#i18n.formatNumber(stats.score));
    setText(this.#completionOverlay, '[data-final-moves]', this.#i18n.formatNumber(stats.moves));
    setText(this.#completionOverlay, '[data-final-time]', this.#i18n.formatTime(stats.elapsedMs));
    setText(this.#completionOverlay, '[data-best-label]', dailyIsBest ? this.#i18n.t('newBest') : puzzle.mode === 'daily' ? this.#i18n.t('bestDaily') : '');
    setText(
      this.#completionOverlay,
      '[data-leaderboard-status]',
      puzzle.mode === 'daily' ? this.#i18n.t(leaderboardPosted ? 'leaderboardPosted' : 'leaderboardOffline') : '',
    );
    const unlocked = puzzle.mode === 'campaign' ? specimenUnlockedAt(puzzle.level) : null;
    setText(
      this.#completionOverlay,
      '[data-unlock-message]',
      unlocked ? this.#i18n.t('specimenUnlocked', { specimen: this.#specimenName(unlocked) }) : '',
    );

    const nextButton = mustElement<HTMLButtonElement>(this.#completionOverlay, '[data-action="next"]');
    nextButton.textContent = puzzle.mode === 'campaign' ? this.#i18n.t('nextLevel') : puzzle.mode === 'daily' ? this.#i18n.t('replay') : this.#i18n.t('startNew');
    nextButton.dataset.action = puzzle.mode === 'daily' ? 'replay' : 'next';
  }

  async #nextPuzzle(): Promise<void> {
    const puzzle = this.#puzzle;
    if (!puzzle) {
      return;
    }
    if (puzzle.mode === 'campaign' && puzzle.level % 3 === 0) {
      this.#showToast(this.#i18n.t('interstitial'), 2_500);
      await this.#bridge.showInterstitial();
    }
    await this.#startMode(puzzle.mode, false);
  }

  async #replayPuzzle(): Promise<void> {
    const puzzle = this.#puzzle;
    if (!puzzle) {
      return;
    }
    const fresh = this.#freshPuzzle(puzzle);
    this.#puzzle = fresh;
    this.#analysis = analyzeBoard(fresh);
    this.#moves = 0;
    this.#hintsUsed = 0;
    this.#elapsedBaseMs = 0;
    this.#history = [];
    this.#completionPending = false;
    this.#selectedId = fresh.sourceId;
    this.#renderer.setPuzzle(fresh);
    this.#renderer.setAnalysis(this.#analysis);
    this.#renderer.setSelected(fresh.sourceId);
    this.#screen = 'playing';
    this.#configureTutorial(fresh);
    this.#app.dataset.screen = 'playing';
    this.#completionOverlay.hidden = true;
    this.#hud.hidden = false;
    this.#toolbar.hidden = false;
    this.#canvas.tabIndex = 0;
    this.#resumeTiming();
    this.#scheduleSave(0);
    await this.#bridge.levelStart(fresh.level);
    this.#canvas.focus({ preventScroll: true });
  }

  async #restartPuzzle(): Promise<void> {
    const puzzle = this.#puzzle;
    if (!puzzle) {
      return;
    }
    const fresh = this.#freshPuzzle(puzzle);
    this.#puzzle = fresh;
    this.#analysis = analyzeBoard(fresh);
    this.#moves = 0;
    this.#hintsUsed = 0;
    this.#elapsedBaseMs = 0;
    this.#history = [];
    this.#completionPending = false;
    this.#selectedId = fresh.sourceId;
    this.#renderer.setPuzzle(fresh);
    this.#renderer.setAnalysis(this.#analysis);
    this.#renderer.setSelected(fresh.sourceId);
    this.#configureTutorial(fresh);
    this.#resumeTiming();
    this.#renderHud();
    this.#scheduleSave(0);
    await this.#bridge.customEvent('Puzzle', 'Restart', { mode: fresh.mode, level: fresh.level });
    await this.#bridge.levelStart(fresh.level);
  }

  #freshPuzzle(puzzle: PuzzleDefinition): PuzzleDefinition {
    const tutorial = puzzle.mode === 'campaign' && isTutorialSeed(puzzle.seed) ? tutorialForLevel(puzzle.level) : null;
    return tutorial?.puzzle ?? generatePuzzle({ seed: puzzle.seed, mode: puzzle.mode, level: puzzle.level, config: puzzle.config });
  }

  #moveSelection(key: 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright'): void {
    const puzzle = this.#puzzle;
    if (!puzzle) {
      return;
    }
    const current = puzzle.tiles.find((tile) => tile.id === this.#selectedId) ?? puzzle.tiles[0];
    if (!current) {
      return;
    }
    const direction =
      key === 'arrowup' ? { x: 0, y: -1 } : key === 'arrowdown' ? { x: 0, y: 1 } : key === 'arrowleft' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    const candidates = puzzle.tiles
      .filter((tile) => {
        const dx = tile.x - current.x;
        const dy = tile.y - current.y;
        return dx * direction.x + dy * direction.y > 0;
      })
      .map((tile) => {
        const dx = tile.x - current.x;
        const dy = tile.y - current.y;
        const forward = dx * direction.x + dy * direction.y;
        const sideways = Math.abs(dx * direction.y - dy * direction.x);
        return { tile, score: forward + sideways * 2.5 };
      })
      .sort((a, b) => a.score - b.score);
    const next = candidates[0]?.tile;
    if (!next) {
      return;
    }
    this.#selectedId = next.id;
    this.#renderer.setSelected(next.id);
    this.#renderCanvasLabel();
    this.#announce(this.#i18n.t('tileSelected', { row: next.y + 1, column: next.x + 1 }));
  }

  #showMenu(): void {
    if (this.#screen === 'playing') {
      this.#pauseTiming();
      this.#scheduleSave(0);
    }
    this.#screen = 'menu';
    this.#app.dataset.screen = 'menu';
    this.#menuOverlay.hidden = false;
    this.#completionOverlay.hidden = true;
    this.#pauseOverlay.hidden = true;
    this.#hud.hidden = true;
    this.#toolbar.hidden = true;
    this.#coachOverlay.hidden = true;
    this.#renderer.setCoach(null);
    this.#renderer.setHovered(null);
    this.#canvas.tabIndex = -1;
    this.#pauseReasons.clear();
    this.#renderer.resume();
    this.#renderMenu();
  }

  #renderMenu(): void {
    const continueButton = mustElement<HTMLButtonElement>(this.#menuOverlay, '[data-action="continue-run"]');
    const active = this.#progress.activeRun;
    continueButton.hidden = !active;
    if (active) {
      continueButton.textContent = `${this.#i18n.t('continueRun')} · ${this.#modeName(active.mode)} ${active.level}`;
    }
    setText(this.#menuOverlay, '[data-campaign-progress]', `${this.#chapterName(this.#progress.campaignLevel)} · ${this.#i18n.t('level')} ${this.#progress.campaignLevel}`);
    setText(this.#menuOverlay, '[data-total-score]', this.#i18n.formatNumber(this.#progress.totalScore));
    const restored = Math.max(0, this.#progress.campaignLevel - 1);
    const chamberProgress = restored % 5;
    setText(
      this.#menuOverlay,
      '[data-restoration-count]',
      this.#i18n.t('circuitsRestored', { count: restored }),
    );
    setText(
      this.#menuOverlay,
      '[data-chamber-progress]',
      this.#i18n.t('chamberProgress', { current: chamberProgress, total: 5 }),
    );
    const progressBar = mustElement<HTMLElement>(this.#menuOverlay, '[data-restoration-bar]');
    progressBar.style.setProperty('--restoration-progress', `${(chamberProgress / 5) * 100}%`);
    this.#menuOverlay.querySelectorAll<HTMLElement>('[data-specimen]').forEach((element) => {
      const kind = element.dataset.specimen as PlantKind | undefined;
      if (!kind) {
        return;
      }
      const unlocked = restored >= specimenUnlockLevel(kind);
      element.dataset.unlocked = String(unlocked);
      element.setAttribute(
        'aria-label',
        unlocked
          ? this.#i18n.t('specimenCollected', { specimen: this.#specimenName(kind) })
          : this.#i18n.t('specimenLocked'),
      );
      element.title = element.getAttribute('aria-label') ?? '';
    });
    setText(this.#menuOverlay, '[data-version]', this.#i18n.t('version', { version: this.#version }));
    const status = mustElement(this.#menuOverlay, '[data-sdk-status]');
    status.textContent = this.#bridge.connected ? 'Arkadium SDK ready' : 'Standalone preview';
    status.dataset.connected = String(this.#bridge.connected);
  }

  #renderHud(): void {
    const puzzle = this.#puzzle;
    const analysis = this.#analysis;
    if (!puzzle || !analysis || this.#screen !== 'playing') {
      return;
    }
    setText(this.#hud, '[data-hud-chapter]', this.#chapterName(puzzle.level));
    setText(this.#hud, '[data-hud-level]', `${this.#modeName(puzzle.mode)} · ${this.#i18n.t('level')} ${puzzle.level}`);
    setText(this.#hud, '[data-hud-plants]', `${analysis.poweredPlants}/${analysis.totalPlants}`);
    const activeLeaks = analysis.leaks.filter((leak) => analysis.powered.has(leak.tileId)).length;
    setText(this.#hud, '[data-hud-leaks]', this.#i18n.formatNumber(activeLeaks));
    const leakStat = mustElement<HTMLElement>(this.#hud, '.leak-stat');
    leakStat.hidden = this.#tutorialStep === 1;
    setText(this.#hud, '[data-hud-moves]', this.#i18n.formatNumber(this.#moves));
    setText(this.#hud, '[data-hud-time]', this.#i18n.formatTime(this.#currentElapsedMs()));
    setText(this.#hud, '[data-hud-score]', this.#i18n.formatNumber(this.#estimatedScore()));

    const hintButton = mustElement<HTMLButtonElement>(this.#toolbar, '[data-action="hint"]');
    const remaining = Math.max(0, FREE_HINTS - this.#hintsUsed);
    hintButton.textContent = this.#hintBusy
      ? this.#i18n.t('hintThinking')
      : remaining > 0
        ? this.#i18n.t('hintFree', { count: remaining })
        : this.#i18n.t('hintRewarded');
    hintButton.disabled = this.#hintBusy || this.#completionPending;
    hintButton.setAttribute('aria-busy', String(this.#hintBusy));

    const undoButton = mustElement<HTMLButtonElement>(this.#toolbar, '[data-action="undo"]');
    undoButton.disabled = this.#history.length === 0 || this.#completionPending;
    const soundButton = mustElement<HTMLButtonElement>(this.#toolbar, '[data-action="toggle-sound"]');
    soundButton.setAttribute('aria-pressed', String(this.#progress.settings.sound));
    soundButton.textContent = this.#progress.settings.sound ? '♪' : '♪̸';
    soundButton.title = this.#i18n.t('sound');
    soundButton.setAttribute('aria-label', this.#i18n.t('sound'));
  }

  #configureTutorial(puzzle: PuzzleDefinition): void {
    const tutorial = puzzle.mode === 'campaign' && isTutorialSeed(puzzle.seed) ? tutorialForLevel(puzzle.level) : null;
    this.#tutorialStep = tutorial?.step ?? null;
    this.#tutorialTargetId = tutorial?.targetTileId ?? null;
    this.#renderer.setCoach(this.#tutorialTargetId);
    this.#renderer.setLeakWarnings(this.#tutorialStep !== 1);
    this.#renderer.setAnchorIndicators(this.#tutorialStep === null || this.#tutorialStep === 3);
    if (this.#tutorialTargetId) {
      this.#selectedId = this.#tutorialTargetId;
      this.#renderer.setSelected(this.#tutorialTargetId);
    }
    this.#renderCoach();
  }

  #renderCoach(): void {
    const step = this.#tutorialStep;
    if (!step || this.#screen !== 'playing') {
      this.#coachOverlay.hidden = true;
      return;
    }
    setText(this.#coachOverlay, '[data-coach-kicker]', this.#i18n.t('guidedRestoration', { step, total: 3 }));
    setText(this.#coachOverlay, '[data-coach-title]', this.#i18n.t(`tutorial${step}Title` as TranslationKey));
    setText(this.#coachOverlay, '[data-coach-body]', this.#i18n.t(`tutorial${step}Body` as TranslationKey));
    const legend = mustElement<HTMLElement>(this.#coachOverlay, '[data-coach-legend]');
    legend.innerHTML =
      step === 1
        ? `<span><b class="legend-source">✦</b>${escapeHtml(this.#i18n.t('sourceShort'))}</span><span><b class="legend-plant">❀</b>${escapeHtml(this.#i18n.t('bloomShort'))}</span>`
        : step === 2
          ? `<span><b class="legend-leak">!</b>${escapeHtml(this.#i18n.t('leakShort'))}</span><span><b class="legend-glow">↻</b>${escapeHtml(this.#i18n.t('turnOnce'))}</span>`
          : `<span><b class="legend-fixed">◆</b>${escapeHtml(this.#i18n.t('anchoredShort'))}</span><span><b class="legend-plant">❀</b>${escapeHtml(this.#i18n.t('everyBloom'))}</span>`;
    this.#coachOverlay.hidden = false;
  }

  #specimenName(kind: PlantKind): string {
    return this.#i18n.t(`specimen${kind[0]?.toUpperCase()}${kind.slice(1)}` as TranslationKey);
  }

  #renderCanvasLabel(): void {
    const puzzle = this.#puzzle;
    const analysis = this.#analysis;
    if (!puzzle || !analysis) {
      this.#canvas.setAttribute('aria-label', this.#i18n.t('title'));
      return;
    }
    const tile = puzzle.tiles.find((candidate) => candidate.id === this.#selectedId);
    if (!tile) {
      return;
    }
    const kind =
      tile.kind === 'source'
        ? this.#i18n.t('sourceLabel')
        : tile.kind === 'plant'
          ? this.#i18n.t('plantLabel', { plant: tile.plantKind ?? '' })
          : this.#i18n.t('pathLabel');
    const state = analysis.powered.has(tile.id) ? this.#i18n.t('powered') : this.#i18n.t('unpowered');
    const fixed = tile.fixed ? this.#i18n.t('fixed') : this.#i18n.t('adjustable');
    this.#canvas.setAttribute(
      'aria-label',
      `${this.#i18n.t('title')}. ${kind}, ${this.#i18n.t('level')} ${puzzle.level}, row ${tile.y + 1}, column ${tile.x + 1}, ${state}, ${fixed}. ${this.#i18n.t('rotateInstruction')}`,
    );
  }

  #openHelp(): void {
    this.#modalKind = 'help';
    this.pause('modal');
    this.#modalContent.innerHTML = `
      <div class="modal-heading">
        <span class="eyebrow">${escapeHtml(this.#i18n.t('objectiveTitle'))}</span>
        <h2>${escapeHtml(this.#i18n.t('howToPlay'))}</h2>
        <p>${escapeHtml(this.#i18n.t('objectiveBody'))}</p>
      </div>
      <div class="help-grid">
        ${helpCard('↻', this.#i18n.t('helpStep1Title'), this.#i18n.t('helpStep1Body'))}
        ${helpCard('✦', this.#i18n.t('helpStep2Title'), this.#i18n.t('helpStep2Body'))}
        ${helpCard('❀', this.#i18n.t('helpStep3Title'), this.#i18n.t('helpStep3Body'))}
      </div>
      <div class="keyboard-card"><strong>${escapeHtml(this.#i18n.t('keyboardTitle'))}</strong><p>${escapeHtml(this.#i18n.t('keyboardBody'))}</p></div>
      <button class="button primary modal-close" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>
    `;
    this.#showModal();
  }

  #openSettings(preserveOpen = false): void {
    this.#modalKind = 'settings';
    if (!preserveOpen) {
      this.pause('modal');
    }
    const settings = this.#progress.settings;
    this.#modalContent.innerHTML = `
      <div class="modal-heading">
        <span class="eyebrow">${escapeHtml(this.#i18n.t('privacy'))}</span>
        <h2>${escapeHtml(this.#i18n.t('settings'))}</h2>
        <p>${escapeHtml(this.#i18n.t('aiBody'))}</p>
      </div>
      <div class="settings-list">
        ${settingToggle('setting-sound', this.#i18n.t('sound'), settings.sound)}
        ${settingToggle('setting-motion', this.#i18n.t('motion'), settings.reducedMotion)}
        ${settingToggle('setting-contrast', this.#i18n.t('contrast'), settings.highContrast)}
        <label class="setting-row" for="language-select"><span>${escapeHtml(this.#i18n.t('language'))}</span>
          <select id="language-select">
            ${languageOption('en', 'English', settings.language)}
            ${languageOption('es', 'Español', settings.language)}
            ${languageOption('fr', 'Français', settings.language)}
            ${languageOption('de', 'Deutsch', settings.language)}
            ${languageOption('it', 'Italiano', settings.language)}
          </select>
        </label>
      </div>
      <button class="button primary modal-close" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>
    `;
    if (!preserveOpen) {
      this.#showModal();
    }
  }

  #openRestartConfirmation(): void {
    if (!this.#puzzle) {
      return;
    }
    this.#modalKind = 'restart';
    this.pause('modal');
    this.#modalContent.innerHTML = `
      <div class="modal-heading compact">
        <span class="eyebrow">${escapeHtml(this.#i18n.t('restart'))}</span>
        <h2>${escapeHtml(this.#i18n.t('confirmRestartTitle'))}</h2>
        <p>${escapeHtml(this.#i18n.t('confirmRestartBody'))}</p>
      </div>
      <div class="modal-actions">
        <button class="button secondary" data-action="close-modal">${escapeHtml(this.#i18n.t('cancel'))}</button>
        <button class="button danger" data-action="confirm-restart">${escapeHtml(this.#i18n.t('confirm'))}</button>
      </div>
    `;
    this.#showModal();
  }

  #showModal(): void {
    if (!this.#modal.open) {
      this.#modal.showModal();
    }
    requestAnimationFrame(() => this.#modal.querySelector<HTMLElement>('button, select, input')?.focus());
  }

  #closeModal(): void {
    this.#modalKind = null;
    if (this.#modal.open) {
      this.#modal.close();
    }
    this.resume('modal');
  }

  async #toggleSound(): Promise<void> {
    await this.#audio.unlock();
    this.#progress.settings.sound = !this.#progress.settings.sound;
    this.#audio.setEnabled(this.#progress.settings.sound);
    await this.#bridge.menuAction(this.#progress.settings.sound ? 'Sound_On' : 'Sound_Off');
    this.#renderHud();
    this.#scheduleSave(0);
  }

  #applySettings(): void {
    const settings = this.#progress.settings;
    this.#audio.setEnabled(settings.sound);
    this.#renderer.setReducedMotion(settings.reducedMotion);
    this.#renderer.setHighContrast(settings.highContrast);
    this.#app.classList.toggle('reduced-motion', settings.reducedMotion);
    this.#app.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.lang = settings.language;
  }

  #applyTranslations(): void {
    this.#app.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n as TranslationKey | undefined;
      if (key) {
        element.textContent = this.#i18n.t(key);
      }
    });
    this.#app.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((element) => {
      const key = element.dataset.i18nAria as TranslationKey | undefined;
      if (key) {
        element.setAttribute('aria-label', this.#i18n.t(key));
        element.setAttribute('title', this.#i18n.t(key));
      }
    });
    this.#renderMenu();
    this.#renderCoach();
  }

  #chapterName(level: number): string {
    const keys: readonly TranslationKey[] = ['chapterDawn', 'chapterVerdant', 'chapterTwilight', 'chapterAurora'];
    return this.#i18n.t(keys[Math.floor((Math.max(1, level) - 1) / 5) % keys.length] as TranslationKey);
  }

  #modeName(mode: GameMode): string {
    return this.#i18n.t(mode === 'daily' ? 'daily' : mode === 'zen' ? 'zen' : 'chapter');
  }

  #estimatedScore(): number {
    const puzzle = this.#puzzle;
    if (!puzzle) {
      return 0;
    }
    const base = puzzle.tiles.length * 72 + puzzle.config.tier * 120;
    return Math.max(0, Math.round(base - this.#moves * 6 - this.#hintsUsed * 85 - this.#currentElapsedMs() / 2_500));
  }

  #resumeTiming(): void {
    if (this.#timingActive || this.#screen !== 'playing') {
      return;
    }
    this.#runStartedAt = performance.now();
    this.#timingActive = true;
  }

  #pauseTiming(): void {
    if (!this.#timingActive) {
      return;
    }
    this.#elapsedBaseMs = this.#currentElapsedMs();
    this.#timingActive = false;
  }

  #currentElapsedMs(): number {
    return this.#elapsedBaseMs + (this.#timingActive ? performance.now() - this.#runStartedAt : 0);
  }

  #scheduleSave(delayMs = 450): void {
    window.clearTimeout(this.#saveTimer);
    this.#saveTimer = window.setTimeout(() => void this.#saveNow(), delayMs);
  }

  async #saveNow(captureActiveRun = true): Promise<void> {
    if (captureActiveRun && this.#screen === 'playing' && this.#puzzle) {
      this.#progress.activeRun = {
        mode: this.#puzzle.mode,
        level: this.#puzzle.level,
        seed: this.#puzzle.seed,
        config: this.#puzzle.config,
        rotations: this.#puzzle.tiles.map((tile) => tile.rotation),
        moves: this.#moves,
        hintsUsed: this.#hintsUsed,
        elapsedMs: Math.round(this.#currentElapsedMs()),
        score: this.#estimatedScore(),
      };
    }
    if (serializedSize(this.#progress) > 32_000) {
      delete this.#progress.activeRun;
    }
    await this.#bridge.saveProgress(SAVE_KEY, this.#progress);
  }

  #showToast(message: string, durationMs = 3_200): void {
    window.clearTimeout(this.#toastTimer);
    this.#toast.textContent = message;
    this.#toast.hidden = false;
    this.#toast.classList.add('visible');
    this.#toastTimer = window.setTimeout(() => {
      this.#toast.classList.remove('visible');
      window.setTimeout(() => {
        this.#toast.hidden = true;
      }, 220);
    }, durationMs);
  }

  #announce(message: string): void {
    this.#liveRegion.textContent = '';
    requestAnimationFrame(() => {
      this.#liveRegion.textContent = message;
    });
  }
}

function shellTemplate(): string {
  return `
    <canvas id="game-canvas" role="application" aria-describedby="game-instructions" tabindex="-1"></canvas>
    <p id="game-instructions" class="sr-only">Use arrow keys to select a mechanism and Enter to rotate it.</p>

    <header id="game-hud" class="game-hud" hidden>
      <div class="hud-brand">
        <span class="brand-glyph" aria-hidden="true">✦</span>
        <div><strong data-hud-chapter></strong><span data-hud-level></span></div>
      </div>
      <div class="hud-stats" aria-live="off">
        <div class="hud-stat"><span data-i18n="plants">Blooms</span><strong data-hud-plants>0/0</strong></div>
        <div class="hud-stat leak-stat"><span data-i18n="leaks">Leaks</span><strong data-hud-leaks>0</strong></div>
        <div class="hud-stat"><span data-i18n="moves">Moves</span><strong data-hud-moves>0</strong></div>
        <div class="hud-stat"><span data-i18n="time">Time</span><strong data-hud-time>00:00</strong></div>
        <div class="hud-stat score-stat"><span data-i18n="score">Score</span><strong data-hud-score>0</strong></div>
      </div>
      <button class="icon-button hud-settings" data-action="settings" data-i18n-aria="settings" aria-label="Settings">⚙</button>
    </header>

    <nav id="game-toolbar" class="game-toolbar" aria-label="Game controls" hidden>
      <button class="icon-button" data-action="menu" data-i18n-aria="menu" aria-label="Garden menu">☰</button>
      <button class="icon-button" data-action="rotate-left" data-i18n-aria="rotateLeft" aria-label="Turn view left">↶</button>
      <button class="tool-button" data-action="undo"><span aria-hidden="true">↩</span><span data-i18n="undo">Undo</span></button>
      <button class="tool-button hint-button" data-action="hint">Garden hint · 3</button>
      <button class="icon-button" data-action="rotate-right" data-i18n-aria="rotateRight" aria-label="Turn view right">↷</button>
      <button class="icon-button" data-action="toggle-sound" data-i18n-aria="sound" aria-label="Sound">♪</button>
      <button class="icon-button wide-only" data-action="restart" data-i18n-aria="restart" aria-label="Restart">⟳</button>
    </nav>

    <aside id="coach-overlay" class="coach-overlay glass-panel" hidden aria-live="polite">
      <div class="coach-copy">
        <span class="eyebrow" data-coach-kicker>Guided restoration · 1/3</span>
        <strong data-coach-title>Wake the first bloom</strong>
        <p data-coach-body>Tap the glowing mechanism once.</p>
      </div>
      <div class="coach-legend" data-coach-legend></div>
      <span class="coach-pointer" aria-hidden="true">⌁</span>
    </aside>

    <section id="menu-overlay" class="screen-overlay menu-overlay">
      <div class="menu-panel glass-panel">
        <div class="logo-lockup" aria-labelledby="game-title">
          <div class="logo-orbit" aria-hidden="true"><span>✦</span><i></i><b></b></div>
          <p class="eyebrow" data-i18n="subtitle">Bloom Circuit</p>
          <h1 id="game-title" data-i18n="title">Clockwork Conservatory</h1>
          <p class="tagline" data-i18n="tagline">Awaken a living glasshouse, one perfect connection at a time.</p>
        </div>

        <button class="button primary continue-button" data-action="continue-run" hidden>Continue current puzzle</button>
        <button class="button primary" data-action="campaign">
          <span data-i18n="play">Begin restoration</span>
          <small data-campaign-progress>Dawn Atrium · Level 1</small>
        </button>
        <div class="mode-grid">
          <button class="mode-card" data-action="daily"><span class="mode-icon">☀</span><strong data-i18n="daily">Daily bloom</strong><small data-i18n="dailyDescription">One shared puzzle. One score. Every day.</small></button>
          <button class="mode-card" data-action="zen"><span class="mode-icon">❀</span><strong data-i18n="zen">Zen garden</strong><small data-i18n="zenDescription">A calm, untimed adaptive puzzle.</small></button>
        </div>
        <section class="restoration-summary" aria-labelledby="restoration-title">
          <div class="restoration-heading">
            <div><span class="eyebrow" id="restoration-title" data-i18n="restoration">Glasshouse restoration</span><strong data-restoration-count>0 circuits restored</strong></div>
            <span data-chamber-progress>0 / 5</span>
          </div>
          <div class="restoration-track" data-restoration-bar><i></i></div>
          <div class="specimen-row" aria-label="Plant collection">
            <span data-specimen="aster" data-unlocked="false">✿</span>
            <span data-specimen="fern" data-unlocked="false">❧</span>
            <span data-specimen="orchid" data-unlocked="false">❀</span>
            <span data-specimen="lotus" data-unlocked="false">✾</span>
            <span data-specimen="rose" data-unlocked="false">❁</span>
          </div>
        </section>
        <div class="menu-actions">
          <button class="text-button" data-action="help" data-i18n="howToPlay">How to play</button>
          <button class="text-button" data-action="settings" data-i18n="settings">Settings</button>
        </div>
        <div class="menu-footer">
          <span><span data-i18n="score">Score</span> <strong data-total-score>0</strong></span>
          <span data-sdk-status data-connected="false">Standalone preview</span>
          <span data-version>Version 0.2.0</span>
        </div>
      </div>
    </section>

    <section id="completion-overlay" class="screen-overlay completion-overlay" hidden>
      <div class="completion-card glass-panel">
        <span class="completion-flourish" aria-hidden="true">❀</span>
        <p class="eyebrow" data-completion-grade>Perfect circuit</p>
        <h2 data-completion-title>Conservatory restored!</h2>
        <div class="stars" data-stars aria-label="3 stars">★★★</div>
        <div class="final-score"><span data-i18n="score">Score</span><strong data-final-score>0</strong></div>
        <div class="completion-stats">
          <div><span data-i18n="moves">Moves</span><strong data-final-moves>0</strong></div>
          <div><span data-i18n="time">Time</span><strong data-final-time>00:00</strong></div>
        </div>
        <p class="best-label" data-best-label></p>
        <p class="unlock-message" data-unlock-message></p>
        <p class="leaderboard-status" data-leaderboard-status></p>
        <button class="button primary" data-action="next" data-i18n="nextLevel">Open next chamber</button>
        <button class="text-button" data-action="return-menu" data-i18n="returnMenu">Return to menu</button>
      </div>
    </section>

    <section id="pause-overlay" class="pause-overlay" hidden>
      <div class="glass-panel pause-card">
        <span aria-hidden="true">❦</span>
        <h2 data-i18n="paused">Garden paused</h2>
        <button class="button primary" data-action="resume" data-i18n="resume">Resume</button>
      </div>
    </section>

    <section id="loading-overlay" class="loading-overlay">
      <div class="loading-mark" aria-hidden="true"><span>✦</span></div>
      <p data-i18n="loading">Restoring the glasshouse…</p>
    </section>

    <dialog id="game-modal" class="game-modal"><div id="modal-content"></div></dialog>
    <div id="toast" class="toast" role="status" hidden></div>
    <div id="live-region" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  `;
}

function mustElement<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }
  return element;
}

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = value;
  }
}

function helpCard(icon: string, title: string, body: string): string {
  return `<article class="help-card"><span aria-hidden="true">${escapeHtml(icon)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></article>`;
}

function settingToggle(id: string, label: string, checked: boolean): string {
  return `<label class="setting-row" for="${id}"><span>${escapeHtml(label)}</span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}></label>`;
}

function languageOption(value: SupportedLanguage, label: string, selected: SupportedLanguage): string {
  return `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' };
    return entities[character] as string;
  });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const SPECIMEN_UNLOCKS: Readonly<Record<PlantKind, number>> = {
  aster: 1,
  fern: 3,
  orchid: 5,
  lotus: 8,
  rose: 12,
};

function specimenUnlockLevel(kind: PlantKind): number {
  return SPECIMEN_UNLOCKS[kind];
}

function specimenUnlockedAt(level: number): PlantKind | null {
  const match = (Object.entries(SPECIMEN_UNLOCKS) as Array<[PlantKind, number]>).find(([, unlockLevel]) => unlockLevel === level);
  return match?.[0] ?? null;
}
