import { analyzeBoard, rotationPeriod } from '../core/board.js';
import { dailySeed, generatePuzzle } from '../core/generator.js';
import { hashSeed } from '../core/random.js';
import { suggestHint } from '../core/hints.js';
import { createDefaultProgress, sanitizeProgress, SAVE_KEY, specimenForLevel } from '../core/progress.js';
import { calculateCompletion } from '../core/scoring.js';
import type {
  ActiveRunSnapshot,
  BoardAnalysis,
  CompletionStats,
  GameMode,
  PersistedProgress,
  PlantKind,
  PuzzleDefinition,
  QualityMode,
} from '../core/types.js';
import { ArkadiumBridge } from '../platform/arkadium.js';
import { detectLanguage, I18n, isLanguage, type TranslationKey } from '../ui/i18n.js';
import { shellTemplate } from '../ui/shell.js';
import { AudioEngine } from './audio.js';
import { ConservatoryRenderer } from './renderer.js';

const FREE_HINTS = 3;
const CHAMBER_SIZE = 6;

type Screen = 'loading' | 'menu' | 'playing' | 'complete';
type PauseReason = 'host' | 'visibility' | 'manual' | 'modal';
type ModalKind = 'help' | 'settings' | 'restart' | 'map' | null;

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
  readonly #coach: HTMLElement;
  readonly #completion: HTMLElement;
  readonly #pauseOverlay: HTMLElement;
  readonly #loading: HTMLElement;
  readonly #toast: HTMLElement;
  readonly #live: HTMLElement;
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
  #tutorialTarget: string | null = null;
  #history: MoveRecord[] = [];
  #moves = 0;
  #hintsUsed = 0;
  #elapsedBase = 0;
  #runStartedAt = 0;
  #timing = false;
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

    this.#canvas = must<HTMLCanvasElement>(app, '#game-canvas');
    this.#menuOverlay = must(app, '#menu-overlay');
    this.#hud = must(app, '#game-hud');
    this.#toolbar = must(app, '#game-toolbar');
    this.#coach = must(app, '#coach-overlay');
    this.#completion = must(app, '#completion-overlay');
    this.#pauseOverlay = must(app, '#pause-overlay');
    this.#loading = must(app, '#loading-overlay');
    this.#toast = must(app, '#toast');
    this.#live = must(app, '#live-region');
    this.#modal = must<HTMLDialogElement>(app, '#game-modal');
    this.#modalContent = must(app, '#modal-content');
    this.#renderer = new ConservatoryRenderer(this.#canvas);

    this.#bindEvents();
    this.#bridge.bindPauseHandlers(() => this.pause('host'), () => this.resume('host'));
    this.#bridge.addEventListener('status', () => this.#renderSdkStatus());
    this.#hudTimer = window.setInterval(() => this.#renderHud(), 200);
  }

  public async initialize(): Promise<void> {
    this.#app.dataset.loaded = 'false';
    this.#applyTranslations();
    void this.#bridge.initialize();

    const [raw] = await Promise.all([
      this.#bridge.loadProgress(SAVE_KEY).catch((error: unknown) => {
        void this.#bridge.reportError(error);
        return null;
      }),
      this.#renderer.preload(),
      delay(420),
    ]);

    this.#progress = sanitizeProgress(raw, this.#i18n.language);
    this.#i18n.language = this.#progress.settings.language;
    this.#applySettings();
    this.#applyTranslations();
    this.#showMenu(false);
    this.#loading.hidden = true;
    this.#app.dataset.loaded = 'true';
    this.#app.dataset.version = this.#version;

    await this.#bridge.markReady();
    await this.#bridge.appStarted();
    await this.#bridge.mainScreenReady();
    this.#announce(this.#i18n.t('title'));

    const autostart = new URLSearchParams(location.search).get('autostart');
    if (autostart === 'campaign' || autostart === 'daily' || autostart === 'zen') {
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
    const alreadyPaused = this.#pauseReasons.size > 0;
    this.#pauseReasons.add(reason);
    if (!alreadyPaused && this.#screen === 'playing') {
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
    if (this.#pauseReasons.size > 0 || this.#screen !== 'playing') return;
    this.#pauseOverlay.hidden = true;
    this.#renderer.resume();
    this.#resumeTiming();
    void this.#audio.resume();
    requestAnimationFrame(() => this.#canvas.focus({ preventScroll: true }));
  }

  #bindEvents(): void {
    this.#app.addEventListener('pointerdown', () => void this.#audio.unlock(), { passive: true });
    this.#app.addEventListener('click', (event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
      if (!element || element.hasAttribute('disabled')) return;
      const action = element.dataset.action;
      if (!action) return;
      this.#audio.click();
      void this.#handleAction(action);
    });
    this.#app.addEventListener('change', (event) => this.#handleControlChange(event));

    this.#canvas.addEventListener('pointerup', (event) => {
      if (this.#screen !== 'playing' || this.#pauseReasons.size > 0 || this.#completionPending) return;
      const id = this.#renderer.hitTest(event.clientX, event.clientY);
      if (!id) return;
      this.#selectedId = id;
      this.#renderer.setSelected(id);
      this.#renderCanvasLabel();
      this.#rotateTile(id);
    });
    this.#canvas.addEventListener('pointermove', (event) => {
      if (this.#screen !== 'playing' || this.#pauseReasons.size > 0 || this.#completionPending) {
        this.#renderer.setHovered(null);
        return;
      }
      this.#renderer.setHovered(this.#renderer.hitTest(event.clientX, event.clientY));
    });
    this.#canvas.addEventListener('pointerleave', () => this.#renderer.setHovered(null));
    this.#canvas.addEventListener('keydown', (event) => this.#handleKey(event));

    this.#modal.addEventListener('close', () => {
      this.#modalKind = null;
      this.resume('modal');
    });
    this.#modal.addEventListener('cancel', () => {
      this.#modalKind = null;
      this.resume('modal');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause('visibility');
        this.#scheduleSave(0);
      } else {
        this.resume('visibility');
      }
    });
    window.addEventListener('blur', () => this.pause('visibility'));
    window.addEventListener('focus', () => {
      if (!document.hidden) this.resume('visibility');
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
      case 'continue':
        if (this.#progress.activeRun) await this.#startMode(this.#progress.activeRun.mode, true);
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
      case 'map':
        this.#openMap();
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
      case 'toggle-sound':
        this.#progress.settings.sound = !this.#progress.settings.sound;
        this.#audio.setEnabled(this.#progress.settings.sound);
        await this.#bridge.menuAction(this.#progress.settings.sound ? 'Sound_On' : 'Sound_Off');
        this.#renderHud();
        this.#scheduleSave(0);
        break;
      case 'restart':
        this.#openRestart();
        break;
      case 'confirm-restart':
        this.#closeModal();
        await this.#restartPuzzle();
        break;
      case 'coach-focus':
        if (this.#tutorialTarget) {
          this.#selectedId = this.#tutorialTarget;
          this.#renderer.setSelected(this.#tutorialTarget);
          this.#renderer.setCoach(this.#tutorialTarget);
          this.#canvas.focus({ preventScroll: true });
        }
        break;
      case 'pause':
        this.pause('manual');
        break;
      case 'resume':
        this.resume('manual');
        break;
      case 'menu':
        this.#showMenu(true);
        break;
      case 'next':
        await this.#nextPuzzle();
        break;
      case 'replay':
        await this.#replayPuzzle();
        break;
      default:
        break;
    }
  }

  async #startMode(mode: GameMode, resumePreferred: boolean): Promise<void> {
    const snapshot = this.#progress.activeRun;
    const todaySeed = dailySeed();
    const todayLevel = dailyDifficultyLevel(todaySeed);
    const canResume = resumePreferred && snapshot !== undefined && (
      snapshot.mode !== 'daily' || (snapshot.seed === todaySeed && snapshot.level === todayLevel)
    );
    let puzzle: PuzzleDefinition;
    let moves = 0;
    let elapsed = 0;

    if (canResume && snapshot) {
      puzzle = this.#restoreSnapshot(snapshot);
      moves = snapshot.moves;
      elapsed = snapshot.elapsedMs;
    } else {
      const level = mode === 'campaign'
        ? this.#progress.campaignLevel
        : mode === 'daily'
          ? todayLevel
          : Math.max(4, this.#progress.campaignLevel);
      const seed = mode === 'daily'
        ? todaySeed
        : mode === 'campaign'
          ? `campaign:${level}:premium-v3`
          : `zen:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`;
      puzzle = generatePuzzle({ seed, mode, level });
    }

    await this.#activatePuzzle(puzzle, moves, elapsed);
    if (canResume) this.#showToast(this.#i18n.t('saveRestored'));
  }

  async #activatePuzzle(puzzle: PuzzleDefinition, moves = 0, elapsed = 0): Promise<void> {
    this.#pauseTiming();
    this.#moves = moves;
    this.#elapsedBase = elapsed;
    this.#puzzle = puzzle;
    this.#analysis = analyzeBoard(puzzle);
    this.#history = [];
    this.#hintsUsed = 0;
    this.#completionPending = false;
    this.#hintBusy = false;
    this.#firstMoveSent = false;
    this.#selectedId = puzzle.sourceId;
    this.#tutorialTarget = this.#findTutorialTarget(puzzle);
    if (this.#tutorialTarget) this.#selectedId = this.#tutorialTarget;

    this.#renderer.setPuzzle(puzzle);
    this.#renderer.setAnalysis(this.#analysis);
    this.#renderer.setSelected(this.#selectedId);
    this.#renderer.setCoach(this.#progress.settings.tutorialHints ? this.#tutorialTarget : null);
    this.#renderer.setScene('game');

    this.#screen = 'playing';
    this.#pauseReasons.clear();
    this.#app.dataset.screen = 'playing';
    this.#app.dataset.mode = puzzle.mode;
    this.#menuOverlay.hidden = true;
    this.#completion.hidden = true;
    this.#pauseOverlay.hidden = true;
    this.#hud.hidden = false;
    this.#toolbar.hidden = false;
    this.#canvas.tabIndex = 0;
    this.#renderer.resume();
    this.#resumeTiming();
    this.#renderTutorial();
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
      artTier: 'premium-2.5d',
    });

    if (this.#analysis.solved && !this.#completionPending) {
      this.#completionPending = true;
      window.setTimeout(() => void this.#completePuzzle(), this.#progress.settings.reducedMotion ? 40 : 180);
    }
    requestAnimationFrame(() => this.#canvas.focus({ preventScroll: true }));
  }

  #restoreSnapshot(snapshot: ActiveRunSnapshot): PuzzleDefinition {
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
  }

  #handleKey(event: KeyboardEvent): void {
    if (this.#screen !== 'playing' || this.#pauseReasons.size > 0 || this.#completionPending) return;
    const key = event.key.toLowerCase();
    if (key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright') {
      event.preventDefault();
      this.#moveSelection(key);
      return;
    }
    if (key === 'enter' || key === ' ') {
      event.preventDefault();
      if (this.#selectedId) this.#rotateTile(this.#selectedId);
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
    } else if (key === 'r') {
      event.preventDefault();
      this.#openRestart();
    } else if (key === 'm') {
      event.preventDefault();
      void this.#handleAction('toggle-sound');
    } else if (key === 'escape') {
      event.preventDefault();
      this.pause('manual');
    }
  }

  #handleControlChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.id === 'language-select' && isLanguage(target.value)) {
      this.#progress.settings.language = target.value;
      this.#i18n.language = target.value;
      document.documentElement.lang = target.value;
      this.#applyTranslations();
      this.#renderHud();
      this.#renderCanvasLabel();
      if (this.#modalKind === 'settings') this.#openSettings(true);
      this.#scheduleSave(0);
    } else if (target.id === 'setting-sound' && target instanceof HTMLInputElement) {
      this.#progress.settings.sound = target.checked;
      this.#audio.setEnabled(target.checked);
      void this.#bridge.menuAction(target.checked ? 'Sound_On' : 'Sound_Off');
      this.#scheduleSave(0);
    } else if (target.id === 'setting-motion' && target instanceof HTMLInputElement) {
      this.#progress.settings.reducedMotion = target.checked;
      this.#applySettings();
      this.#scheduleSave(0);
    } else if (target.id === 'setting-contrast' && target instanceof HTMLInputElement) {
      this.#progress.settings.highContrast = target.checked;
      this.#applySettings();
      this.#scheduleSave(0);
    } else if (target.id === 'setting-tutorial' && target instanceof HTMLInputElement) {
      this.#progress.settings.tutorialHints = target.checked;
      this.#renderer.setCoach(target.checked ? this.#tutorialTarget : null);
      this.#renderTutorial();
      this.#scheduleSave(0);
    } else if (target.id === 'quality-select' && isQuality(target.value)) {
      this.#progress.settings.quality = target.value;
      this.#renderer.setQuality(target.value);
      this.#scheduleSave(0);
    }
  }

  #rotateTile(tileId: string): void {
    const puzzle = this.#puzzle;
    const previous = this.#analysis;
    if (!puzzle || !previous) return;
    const tile = puzzle.tiles.find((candidate) => candidate.id === tileId);
    if (!tile) return;

    if (this.#tutorialTarget && this.#progress.settings.tutorialHints && tileId !== this.#tutorialTarget) {
      this.#audio.denied();
      this.#selectedId = this.#tutorialTarget;
      this.#renderer.setSelected(this.#tutorialTarget);
      this.#renderer.setCoach(this.#tutorialTarget);
      this.#showToast(this.#i18n.t('wrongTutorial'));
      this.#renderCanvasLabel();
      return;
    }

    const period = rotationPeriod(tile.baseMask);
    if (tile.fixed || period === 1) {
      this.#audio.denied();
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
    if (this.#analysis.poweredPlants > previous.poweredPlants || this.#analysis.powered.size > previous.powered.size) this.#audio.connect();
    else this.#audio.turn();

    this.#tutorialTarget = this.#findTutorialTarget(puzzle);
    this.#renderer.setCoach(this.#progress.settings.tutorialHints ? this.#tutorialTarget : null);
    this.#selectedId = this.#tutorialTarget ?? tile.id;
    this.#renderer.setSelected(this.#selectedId);
    this.#renderTutorial();
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave();

    if (this.#analysis.solved && !this.#completionPending) {
      this.#completionPending = true;
      this.#coach.hidden = true;
      this.#renderer.setCoach(null);
      window.setTimeout(() => void this.#completePuzzle(), this.#progress.settings.reducedMotion ? 90 : 620);
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
    if (!tile) return;
    tile.rotation = record.rotation;
    tile.visualTurns = record.visualTurns;
    this.#moves += 1;
    this.#analysis = analyzeBoard(puzzle);
    this.#selectedId = tile.id;
    this.#renderer.setSelected(tile.id);
    this.#renderer.setAnalysis(this.#analysis);
    this.#renderer.syncTile(tile);
    this.#tutorialTarget = this.#findTutorialTarget(puzzle);
    this.#renderer.setCoach(this.#progress.settings.tutorialHints ? this.#tutorialTarget : null);
    this.#audio.undo();
    this.#renderTutorial();
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave();
  }

  async #useHint(): Promise<void> {
    if (!this.#puzzle || !this.#analysis || this.#hintBusy || this.#completionPending) return;
    this.#hintBusy = true;
    this.#renderHud();
    this.#showToast(this.#i18n.t('hintThinking'), 2_000);

    if (this.#hintsUsed >= FREE_HINTS) {
      const rewarded = await this.#bridge.showRewarded();
      if (!rewarded) {
        this.#hintBusy = false;
        this.#showToast(this.#i18n.t('adUnavailable'));
        this.#renderHud();
        return;
      }
    }

    await delay(this.#progress.settings.reducedMotion ? 30 : 320);
    const suggestion = suggestHint(this.#puzzle);
    this.#hintBusy = false;
    if (!suggestion) {
      this.#showToast(this.#i18n.t('noHint'));
      this.#renderHud();
      return;
    }
    const tile = this.#puzzle.tiles.find((candidate) => candidate.id === suggestion.tileId);
    if (!tile) return;
    this.#hintsUsed += 1;
    this.#selectedId = tile.id;
    this.#renderer.setSelected(tile.id);
    this.#renderer.setHint(tile.id);
    this.#audio.hint();
    const turns = suggestion.rotations === 1
      ? this.#i18n.t('once')
      : suggestion.rotations === 2
        ? this.#i18n.t('twice')
        : this.#i18n.t('threeTimes');
    const message = this.#i18n.t('hintInstruction', { row: tile.y + 1, column: tile.x + 1, turns });
    this.#showToast(message, 5_000);
    this.#announce(message);
    this.#renderHud();
    this.#renderCanvasLabel();
    this.#scheduleSave();
    await this.#bridge.customEvent('Garden_Hint', suggestion.reason, {
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
    const elapsedMs = this.#elapsedBase;
    const stats = calculateCompletion(puzzle, this.#moves, this.#hintsUsed, elapsedMs);
    this.#progress.totalScore += stats.score;
    this.#progress.totalStars += stats.stars;
    this.#progress.completedLevels += 1;

    let unlocked: PlantKind | null = null;
    if (puzzle.mode === 'campaign') {
      this.#progress.campaignLevel = Math.max(this.#progress.campaignLevel, puzzle.level + 1);
      unlocked = specimenForLevel(puzzle.level);
      if (unlocked && !this.#progress.unlockedSpecimens.includes(unlocked)) this.#progress.unlockedSpecimens.push(unlocked);
    }

    let dailyIsBest = false;
    if (puzzle.mode === 'daily') {
      const date = puzzle.seed.replace('daily:', '');
      const previousBest = this.#progress.bestDaily[date] ?? 0;
      if (stats.score > previousBest) {
        this.#progress.bestDaily[date] = stats.score;
        dailyIsBest = true;
      }
      this.#updateDailyStreak(date);
    }

    delete this.#progress.activeRun;
    window.clearTimeout(this.#saveTimer);
    this.#coach.hidden = true;
    this.#toolbar.hidden = true;
    this.#app.dataset.state = 'celebrating';
    this.#renderer.setCoach(null);
    this.#renderer.setScene('victory');
    this.#audio.bloom();

    const duration = this.#progress.settings.reducedMotion ? 360 : 2_150;
    this.#renderer.startVictorySequence(duration);
    const platformWork = (async (): Promise<boolean> => {
      await this.#saveNow(false);
      await this.#bridge.levelEnd(puzzle.level, stats.score);
      await this.#bridge.gameWon(stats.score, elapsedMs / 1_000);
      return puzzle.mode === 'daily' ? this.#bridge.postDailyScore(stats.score) : false;
    })();
    const [, leaderboardPosted] = await Promise.all([delay(duration), platformWork]);

    this.#renderCompletion(stats, dailyIsBest, leaderboardPosted, unlocked);
    this.#screen = 'complete';
    this.#app.dataset.screen = 'complete';
    delete this.#app.dataset.state;
    this.#hud.hidden = true;
    this.#completion.hidden = false;
    this.#completion.classList.remove('enter');
    void this.#completion.offsetWidth;
    this.#completion.classList.add('enter');
    this.#canvas.tabIndex = -1;
    this.#completionPending = false;
    this.#completion.querySelector<HTMLButtonElement>('[data-action="next"]')?.focus({ preventScroll: true });
  }

  #renderCompletion(stats: CompletionStats, dailyIsBest: boolean, leaderboardPosted: boolean, unlocked: PlantKind | null): void {
    const puzzle = this.#puzzle;
    if (!puzzle) return;
    setText(this.#completion, '[data-completion-grade]', this.#i18n.t(stats.stars === 3 ? 'perfect' : stats.stars === 2 ? 'graceful' : 'complete'));
    setText(this.#completion, '[data-completion-title]', this.#i18n.t('restored'));
    setText(this.#completion, '[data-stars]', '★'.repeat(stats.stars) + '☆'.repeat(3 - stats.stars));
    setText(this.#completion, '[data-final-score]', this.#i18n.number(stats.score));
    setText(this.#completion, '[data-final-moves]', this.#i18n.number(stats.moves));
    setText(this.#completion, '[data-final-time]', this.#i18n.time(stats.elapsedMs));
    setText(this.#completion, '[data-record]', dailyIsBest ? this.#i18n.t('newRecord') : '');
    setText(this.#completion, '[data-unlock]', unlocked ? this.#i18n.t('specimenUnlocked', { name: this.#i18n.t(unlocked) }) : '');
    setText(
      this.#completion,
      '[data-leaderboard]',
      puzzle.mode === 'daily' ? this.#i18n.t(leaderboardPosted ? 'leaderboardPosted' : 'leaderboardOffline') : '',
    );
    const next = must<HTMLButtonElement>(this.#completion, '[data-action="next"]');
    next.textContent = puzzle.mode === 'campaign' ? this.#i18n.t('nextLevel') : puzzle.mode === 'daily' ? this.#i18n.t('replay') : this.#i18n.t('zen');
  }

  async #nextPuzzle(): Promise<void> {
    const puzzle = this.#puzzle;
    if (!puzzle) return;
    if (puzzle.mode === 'daily') {
      await this.#replayPuzzle();
      return;
    }
    if (puzzle.mode === 'campaign' && puzzle.level % 3 === 0) await this.#bridge.showInterstitial();
    await this.#startMode(puzzle.mode, false);
  }

  async #replayPuzzle(): Promise<void> {
    const puzzle = this.#puzzle;
    if (!puzzle) return;
    const fresh = generatePuzzle({ seed: puzzle.seed, mode: puzzle.mode, level: puzzle.level });
    await this.#activatePuzzle(fresh);
  }

  async #restartPuzzle(): Promise<void> {
    await this.#replayPuzzle();
  }

  #showMenu(captureActive: boolean): void {
    if (captureActive && this.#screen === 'playing') {
      this.#pauseTiming();
      this.#captureActiveRun();
      void this.#bridge.saveProgress(SAVE_KEY, this.#progress);
    } else {
      this.#pauseTiming();
    }
    this.#pauseReasons.clear();
    this.#screen = 'menu';
    this.#app.dataset.screen = 'menu';
    delete this.#app.dataset.state;
    this.#renderer.setScene('menu');
    this.#renderer.resume();
    this.#hud.hidden = true;
    this.#toolbar.hidden = true;
    this.#coach.hidden = true;
    this.#completion.hidden = true;
    this.#pauseOverlay.hidden = true;
    this.#menuOverlay.hidden = false;
    this.#canvas.tabIndex = -1;
    this.#renderMenu();
  }

  #renderMenu(): void {
    const level = this.#progress.campaignLevel;
    const chamberProgress = (level - 1) % CHAMBER_SIZE;
    const percent = Math.round(chamberProgress / CHAMBER_SIZE * 100);
    const continueCard = this.#menuOverlay.querySelector<HTMLButtonElement>('[data-action="continue"]');
    if (continueCard) {
      continueCard.hidden = !this.#progress.activeRun;
      const detail = continueCard.querySelector<HTMLElement>('[data-continue-level]');
      if (detail && this.#progress.activeRun) {
        const active = this.#progress.activeRun;
        const mode = active.mode === 'daily' ? this.#i18n.t('daily') : active.mode === 'zen' ? this.#i18n.t('zen') : this.#i18n.t('campaign');
        detail.textContent = `${mode} · ${this.#i18n.t('level')} ${active.level}`;
      }
    }
    setText(this.#menuOverlay, '[data-campaign-detail]', `${chamberName(level)} · ${this.#i18n.t('level')} ${level}`);
    setText(this.#menuOverlay, '[data-progress-percent]', `${percent}%`);
    setText(this.#menuOverlay, '[data-chamber-progress]', `${chamberProgress}/${CHAMBER_SIZE}`);
    setText(this.#menuOverlay, '[data-best-score]', this.#i18n.number(this.#progress.totalScore));
    setText(this.#menuOverlay, '[data-streak]', this.#i18n.number(this.#progress.streak));
    setText(this.#menuOverlay, '[data-version]', `v${this.#version}`);
    const progressRing = this.#menuOverlay.querySelector<HTMLElement>('.progress-ring');
    progressRing?.style.setProperty('--progress', `${percent}%`);
    const progressBar = this.#menuOverlay.querySelector<HTMLElement>('[data-progress-bar]');
    progressBar?.style.setProperty('--progress', `${percent}%`);

    const specimens = must(this.#menuOverlay, '[data-specimens]');
    const plantKinds: PlantKind[] = ['lumen', 'orchid', 'starbell', 'ember', 'moonfern'];
    specimens.replaceChildren(...plantKinds.map((kind) => {
      const unlocked = this.#progress.unlockedSpecimens.includes(kind);
      const item = document.createElement('div');
      item.className = `specimen ${unlocked ? '' : 'locked'}`.trim();
      item.title = unlocked ? this.#i18n.t(kind) : 'Locked specimen';
      item.innerHTML = `<span class="specimen-art plant-${kind}" aria-hidden="true">${plantGlyph(kind)}</span><strong>${unlocked ? escapeHtml(this.#i18n.t(kind)) : '••••'}</strong><span>${unlocked ? '★'.repeat(Math.min(3, 1 + (this.#progress.completedLevels % 3))) : '🔒'}</span>`;
      return item;
    }));
    this.#renderSdkStatus();
  }

  #renderHud(): void {
    if (this.#screen !== 'playing' || !this.#puzzle || !this.#analysis) return;
    setText(this.#hud, '[data-tier]', `${chamberName(this.#puzzle.level)} · ${this.#puzzle.config.tier}`);
    setText(this.#hud, '[data-level]', this.#i18n.number(this.#puzzle.level));
    const liveScore = this.#progress.totalScore + this.#analysis.poweredPlants * 75 + Math.max(0, this.#puzzle.tiles.length - this.#analysis.leaks.length) * 4;
    setText(this.#hud, '[data-score]', this.#i18n.number(liveScore));
    setText(this.#hud, '[data-moves]', this.#i18n.number(this.#moves));
    setText(this.#hud, '[data-blooms]', `${this.#analysis.poweredPlants} / ${this.#analysis.totalPlants}`);
    setText(this.#hud, '[data-leaks]', this.#i18n.number(this.#analysis.leaks.length));

    const soundButton = this.#hud.querySelector<HTMLButtonElement>('[data-action="toggle-sound"]');
    if (soundButton) {
      soundButton.textContent = this.#progress.settings.sound ? '♪' : '×';
      soundButton.setAttribute('aria-label', this.#progress.settings.sound ? 'Mute sound' : 'Enable sound');
    }
    const undo = this.#toolbar.querySelector<HTMLButtonElement>('[data-action="undo"]');
    if (undo) undo.disabled = this.#history.length === 0 || this.#completionPending;
    const hint = this.#toolbar.querySelector<HTMLButtonElement>('[data-action="hint"]');
    if (hint) {
      hint.disabled = this.#hintBusy || this.#completionPending;
      const badge = hint.querySelector<HTMLElement>('[data-hint-count]');
      if (badge) badge.textContent = this.#hintsUsed < FREE_HINTS ? String(FREE_HINTS - this.#hintsUsed) : 'AD';
    }
  }

  #renderTutorial(): void {
    const puzzle = this.#puzzle;
    if (!puzzle?.tutorial || !this.#tutorialTarget || !this.#progress.settings.tutorialHints) {
      this.#coach.hidden = true;
      return;
    }
    this.#coach.hidden = false;
    const step = puzzle.tutorial;
    setText(this.#coach, '[data-coach-title]', this.#i18n.t(`tutorial${step}Title` as TranslationKey));
    setText(this.#coach, '[data-coach-body]', this.#i18n.t(`tutorial${step}Body` as TranslationKey));
  }

  #findTutorialTarget(puzzle: PuzzleDefinition): string | null {
    if (!puzzle.tutorial) return null;
    return puzzle.tiles.find((tile) => !tile.fixed && tile.rotation !== 0 && rotationPeriod(tile.baseMask) > 1)?.id ?? null;
  }

  #moveSelection(key: 'arrowup' | 'arrowdown' | 'arrowleft' | 'arrowright'): void {
    const puzzle = this.#puzzle;
    if (!puzzle || puzzle.tiles.length === 0) return;
    if (this.#tutorialTarget && this.#progress.settings.tutorialHints) {
      this.#selectedId = this.#tutorialTarget;
      this.#renderer.setSelected(this.#tutorialTarget);
      return;
    }
    const current = puzzle.tiles.find((tile) => tile.id === this.#selectedId) ?? puzzle.tiles[0];
    if (!current) return;
    const [dx, dy] = key === 'arrowup' ? [0, -1] : key === 'arrowdown' ? [0, 1] : key === 'arrowleft' ? [-1, 0] : [1, 0];
    const candidates = puzzle.tiles
      .filter((tile) => (tile.x - current.x) * dx + (tile.y - current.y) * dy > 0)
      .map((tile) => ({
        tile,
        score: Math.abs(tile.x - current.x - dx) + Math.abs(tile.y - current.y - dy) + Math.abs((tile.x - current.x) * dy - (tile.y - current.y) * dx) * 2,
      }))
      .sort((left, right) => left.score - right.score);
    const next = candidates[0]?.tile;
    if (!next) return;
    this.#selectedId = next.id;
    this.#renderer.setSelected(next.id);
    this.#renderCanvasLabel();
  }

  #renderCanvasLabel(): void {
    const puzzle = this.#puzzle;
    const analysis = this.#analysis;
    if (!puzzle || !analysis) {
      this.#canvas.setAttribute('aria-label', this.#i18n.t('title'));
      return;
    }
    const selected = puzzle.tiles.find((tile) => tile.id === this.#selectedId);
    const selectedText = selected ? ` Row ${selected.y + 1}, column ${selected.x + 1}.` : '';
    this.#canvas.setAttribute(
      'aria-label',
      `${this.#i18n.t('level')} ${puzzle.level}. ${this.#i18n.t('blooms')} ${analysis.poweredPlants} of ${analysis.totalPlants}. ${this.#i18n.t('leaks')} ${analysis.leaks.length}.${selectedText}`,
    );
  }

  #applySettings(): void {
    this.#i18n.language = this.#progress.settings.language;
    document.documentElement.lang = this.#i18n.language;
    this.#audio.setEnabled(this.#progress.settings.sound);
    this.#renderer.setReducedMotion(this.#progress.settings.reducedMotion);
    this.#renderer.setHighContrast(this.#progress.settings.highContrast);
    this.#renderer.setQuality(this.#progress.settings.quality);
    this.#app.classList.toggle('reduced-motion', this.#progress.settings.reducedMotion);
    this.#app.classList.toggle('high-contrast', this.#progress.settings.highContrast);
  }

  #applyTranslations(): void {
    this.#app.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n as TranslationKey | undefined;
      if (key) element.textContent = this.#i18n.t(key);
    });
    document.title = `${this.#i18n.t('title')} · ${this.#i18n.t('subtitle')}`;
    if (this.#screen === 'menu') this.#renderMenu();
  }

  #renderSdkStatus(): void {
    this.#app.querySelectorAll<HTMLElement>('[data-sdk-status]').forEach((element) => {
      element.textContent = this.#bridge.connected ? this.#i18n.t('connected') : this.#i18n.t('standalone');
      element.dataset.connected = String(this.#bridge.connected);
    });
  }

  #openHelp(): void {
    this.#modalKind = 'help';
    this.pause('modal');
    this.#modalContent.innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">✦</span><p class="eyebrow">Bloom Circuit</p><h2>${escapeHtml(this.#i18n.t('helpTitle'))}</h2></div>
      <div class="help-grid">
        <article><span>1</span><p>${escapeHtml(this.#i18n.t('help1'))}</p></article>
        <article><span>2</span><p>${escapeHtml(this.#i18n.t('help2'))}</p></article>
        <article><span>3</span><p>${escapeHtml(this.#i18n.t('help3'))}</p></article>
      </div>
      <button class="button primary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>`;
    this.#showModal();
  }

  #openSettings(refresh = false): void {
    this.#modalKind = 'settings';
    if (!refresh) this.pause('modal');
    const settings = this.#progress.settings;
    this.#modalContent.innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">⚙</span><h2>${escapeHtml(this.#i18n.t('settings'))}</h2><p>Readability, comfort and performance.</p></div>
      <div class="settings-list">
        ${toggleRow('setting-sound', this.#i18n.t('sound'), settings.sound)}
        ${toggleRow('setting-motion', this.#i18n.t('motion'), settings.reducedMotion)}
        ${toggleRow('setting-contrast', this.#i18n.t('contrast'), settings.highContrast)}
        ${toggleRow('setting-tutorial', this.#i18n.t('tutorialHints'), settings.tutorialHints)}
        <label class="setting-row"><span>${escapeHtml(this.#i18n.t('quality'))}</span><select id="quality-select">${qualityOptions(settings.quality, this.#i18n)}</select></label>
        <label class="setting-row"><span>${escapeHtml(this.#i18n.t('language'))}</span><select id="language-select">${languageOptions(settings.language)}</select></label>
      </div>
      <button class="button primary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>`;
    this.#showModal(refresh);
  }

  #openRestart(): void {
    this.#modalKind = 'restart';
    this.pause('modal');
    this.#modalContent.innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">↻</span><h2>${escapeHtml(this.#i18n.t('restart'))}?</h2><p>Your current moves on this circuit will be reset.</p></div>
      <div class="modal-actions"><button class="button secondary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button><button class="button primary" data-action="confirm-restart">${escapeHtml(this.#i18n.t('restart'))}</button></div>`;
    this.#showModal();
  }

  #openMap(): void {
    this.#modalKind = 'map';
    this.pause('modal');
    const currentChamber = Math.floor((this.#progress.campaignLevel - 1) / CHAMBER_SIZE);
    const names = ['Dawn Atrium', 'Orchid Gallery', 'Mist Conservatory', 'Moon Fern Hall', 'Aurora Dome', 'Celestial Orangery'];
    const nodes: string[] = [];
    names.forEach((name, index) => {
      const state = index < currentChamber ? 'complete' : index === currentChamber ? 'current' : 'locked';
      nodes.push(`<article class="map-node ${state}"><span>${state === 'complete' ? '✓' : state === 'current' ? '✦' : '🔒'}</span><strong>${escapeHtml(name)}</strong><small>${state === 'complete' ? 'Restored' : state === 'current' ? `Level ${this.#progress.campaignLevel}` : 'Locked'}</small></article>`);
      if (index < names.length - 1) nodes.push('<i class="map-link" aria-hidden="true"></i>');
    });
    this.#modalContent.innerHTML = `
      <div class="modal-heading"><span class="modal-glyph">❧</span><p class="eyebrow">Restoration Map</p><h2>The Conservatory</h2><p>Reconnect every chamber and awaken its botanical collection.</p></div>
      <div class="restoration-map">${nodes.join('')}</div>
      <button class="button primary" data-action="close-modal">${escapeHtml(this.#i18n.t('close'))}</button>`;
    this.#showModal();
  }

  #showModal(refresh = false): void {
    if (!this.#modal.open) this.#modal.showModal();
    if (!refresh) requestAnimationFrame(() => this.#modal.querySelector<HTMLElement>('button, input, select')?.focus());
  }

  #closeModal(): void {
    if (this.#modal.open) this.#modal.close();
  }

  #resumeTiming(): void {
    if (this.#timing || this.#screen !== 'playing') return;
    this.#runStartedAt = performance.now();
    this.#timing = true;
  }

  #pauseTiming(): void {
    if (!this.#timing) return;
    this.#elapsedBase += performance.now() - this.#runStartedAt;
    this.#timing = false;
  }

  #currentElapsed(): number {
    return this.#elapsedBase + (this.#timing ? performance.now() - this.#runStartedAt : 0);
  }

  #captureActiveRun(): void {
    const puzzle = this.#puzzle;
    if (!puzzle || this.#completionPending) return;
    this.#progress.activeRun = {
      seed: puzzle.seed,
      mode: puzzle.mode,
      level: puzzle.level,
      rotations: puzzle.tiles.map((tile) => tile.rotation),
      moves: this.#moves,
      elapsedMs: Math.round(this.#currentElapsed()),
    };
  }

  #scheduleSave(wait = 450): void {
    window.clearTimeout(this.#saveTimer);
    this.#saveTimer = window.setTimeout(() => void this.#saveNow(), wait);
  }

  async #saveNow(includeActive = true): Promise<void> {
    if (includeActive && this.#screen === 'playing') this.#captureActiveRun();
    await this.#bridge.saveProgress(SAVE_KEY, this.#progress);
  }

  #updateDailyStreak(date: string): void {
    const previous = this.#progress.lastDailyDate;
    if (previous === date) return;
    if (!previous) this.#progress.streak = 1;
    else {
      const difference = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000);
      this.#progress.streak = difference === 1 ? this.#progress.streak + 1 : 1;
    }
    this.#progress.lastDailyDate = date;
  }

  #showToast(message: string, duration = 2_800): void {
    window.clearTimeout(this.#toastTimer);
    this.#toast.textContent = message;
    this.#toast.hidden = false;
    this.#toast.classList.remove('show');
    void this.#toast.offsetWidth;
    this.#toast.classList.add('show');
    this.#toastTimer = window.setTimeout(() => {
      this.#toast.classList.remove('show');
      window.setTimeout(() => { this.#toast.hidden = true; }, 220);
    }, duration);
  }

  #announce(message: string): void {
    this.#live.textContent = '';
    requestAnimationFrame(() => { this.#live.textContent = message; });
  }
}


function dailyDifficultyLevel(seed: string): number {
  // Stable for every player on a given UTC date, so leaderboard entries always
  // refer to the same board size and difficulty rather than personal campaign progress.
  return 10 + (hashSeed(seed) % 10);
}

function must<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function isQuality(value: string): value is QualityMode {
  return value === 'auto' || value === 'high' || value === 'balanced' || value === 'low';
}

function chamberName(level: number): string {
  const names = ['Dawn Atrium', 'Orchid Gallery', 'Mist Conservatory', 'Moon Fern Hall', 'Aurora Dome', 'Celestial Orangery'];
  return names[Math.floor((Math.max(1, level) - 1) / CHAMBER_SIZE) % names.length] ?? 'Dawn Atrium';
}

function plantGlyph(kind: PlantKind): string {
  return kind === 'lumen' ? '✿' : kind === 'orchid' ? '❀' : kind === 'starbell' ? '✦' : kind === 'ember' ? '✺' : '❧';
}

function toggleRow(id: string, label: string, checked: boolean): string {
  return `<label class="setting-row"><span>${escapeHtml(label)}</span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><i class="toggle" aria-hidden="true"></i></label>`;
}

function languageOptions(selected: string): string {
  const options: Array<[string, string]> = [['en','English'],['es','Español'],['fr','Français'],['de','Deutsch'],['it','Italiano']];
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function qualityOptions(selected: QualityMode, i18n: I18n): string {
  return (['auto','high','balanced','low'] as const)
    .map((value) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${escapeHtml(i18n.t(value))}</option>`)
    .join('');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character] ?? character);
}
