export function shellTemplate(): string {
  return `
  <canvas id="game-canvas" aria-label="Clockwork Conservatory puzzle board"></canvas>
  <section id="menu-overlay" class="menu-screen" aria-label="Main menu">
    <div class="menu-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="menu-frame ornate-panel">
      <header class="logo-lockup">
        <span class="logo-emblem" aria-hidden="true"><b>✦</b></span>
        <p class="eyebrow" data-i18n="subtitle">Bloom Circuit</p>
        <h1 data-i18n="title">Clockwork Conservatory</h1>
        <p class="tagline" data-i18n="tagline"></p>
      </header>
      <div class="menu-modes">
        <button class="mode-card continue-card" data-action="continue">
          <span class="mode-icon">↻</span><strong data-i18n="continue"></strong><small data-continue-level></small>
        </button>
        <button class="mode-card" data-action="campaign">
          <span class="mode-icon">⚙</span><strong data-i18n="campaign"></strong><small data-campaign-detail></small>
        </button>
        <button class="mode-card daily-card" data-action="daily">
          <span class="mode-icon">✿</span><strong data-i18n="daily"></strong><small data-i18n="dailyDetail"></small>
        </button>
        <button class="mode-card" data-action="zen">
          <span class="mode-icon">❧</span><strong data-i18n="zen"></strong><small data-i18n="zenDetail"></small>
        </button>
      </div>
      <div class="meta-grid">
        <button class="progress-card" data-action="map">
          <div class="progress-ring"><span data-progress-percent>0%</span></div>
          <div><p class="eyebrow" data-i18n="restoration"></p><strong data-i18n="chamber"></strong>
            <div class="progress-track" data-progress-bar><i></i></div>
            <small><span data-chamber-progress></span> <span data-i18n="completed"></span></small>
          </div>
        </button>
        <section class="collection-card">
          <header><p class="eyebrow" data-i18n="collection"></p></header>
          <div class="specimen-row" data-specimens></div>
        </section>
      </div>
      <footer class="menu-footer">
        <div><small>Best score</small><strong data-best-score>0</strong></div>
        <div><small>Daily streak</small><strong><span data-streak>0</span> days</strong></div>
        <nav><button class="text-button" data-action="help" data-i18n="howToPlay"></button><button class="text-button" data-action="settings" data-i18n="settings"></button></nav>
        <span data-sdk-status></span><span data-version></span>
      </footer>
    </div>
  </section>

  <header id="game-hud" class="game-hud" hidden>
    <div class="hud-logo"><span>✦</span><div><strong>Clockwork Conservatory</strong><small data-tier></small></div></div>
    <div class="hud-stats ornate-panel">
      <div><small data-i18n="level"></small><strong data-level>1</strong></div>
      <div><small data-i18n="score"></small><strong data-score>0</strong></div>
      <div class="moves"><small data-i18n="moves"></small><strong data-moves>0</strong></div>
      <div><small data-i18n="blooms"></small><strong data-blooms>0 / 0</strong></div>
      <div><small data-i18n="leaks"></small><strong data-leaks>0</strong></div>
    </div>
    <div class="hud-actions">
      <button class="round-button" data-action="toggle-sound" aria-label="Sound">♪</button>
      <button class="round-button" data-action="settings" aria-label="Settings">⚙</button>
      <button class="round-button" data-action="pause" aria-label="Pause">Ⅱ</button>
    </div>
  </header>

  <aside id="coach-overlay" class="coach-card ornate-panel" hidden>
    <span class="coach-glyph">✦</span><div><h2 data-coach-title></h2><p data-coach-body></p></div>
    <button class="coach-cta" data-i18n="tryIt" data-action="coach-focus"></button>
  </aside>

  <nav id="game-toolbar" class="game-toolbar ornate-panel" hidden>
    <button class="tool-button" data-action="undo"><span>↶</span><strong data-i18n="undo"></strong></button>
    <button class="tool-button hint-button" data-action="hint"><span>✿</span><strong data-i18n="hint"></strong><em data-hint-count>3</em></button>
    <button class="center-medallion" tabindex="-1" aria-hidden="true"><span>❧</span></button>
    <button class="tool-button view-button" data-action="rotate-left" aria-label="Rotate view left"><span>↺</span></button>
    <button class="tool-button view-button" data-action="rotate-right" aria-label="Rotate view right"><span>↻</span></button>
    <button class="tool-button" data-action="restart"><span>⟳</span><strong data-i18n="restart"></strong></button>
    <button class="tool-button" data-action="menu"><span>☰</span><strong data-i18n="menu"></strong></button>
  </nav>

  <section id="completion-overlay" class="completion-screen" hidden>
    <div class="completion-card ornate-panel">
      <span class="completion-emblem">✦</span><p class="eyebrow" data-completion-grade></p><h2 data-completion-title></h2>
      <div class="stars" data-stars></div>
      <div class="final-score"><small data-i18n="score"></small><strong data-final-score></strong><em data-record></em></div>
      <div class="completion-stats"><div><small data-i18n="moves"></small><strong data-final-moves></strong></div><div><small>Time</small><strong data-final-time></strong></div></div>
      <p class="unlock" data-unlock></p><p class="leaderboard" data-leaderboard></p>
      <div class="completion-actions">
        <button class="button primary" data-action="next"></button>
        <button class="button secondary" data-action="replay" data-i18n="replay"></button>
        <button class="text-button" data-action="menu" data-i18n="returnMenu"></button>
      </div>
    </div>
  </section>

  <section id="pause-overlay" class="pause-screen" hidden>
    <div class="pause-card ornate-panel"><span>❧</span><h2 data-i18n="pauseTitle"></h2>
      <button class="button primary" data-action="resume" data-i18n="resume"></button>
      <button class="button secondary" data-action="settings" data-i18n="settings"></button>
      <button class="text-button" data-action="menu" data-i18n="returnMenu"></button>
    </div>
  </section>

  <section id="loading-overlay" class="loading-screen"><span class="loading-sunwell">✦</span><p data-i18n="loading"></p></section>
  <dialog id="game-modal" class="game-modal"><div id="modal-content"></div></dialog>
  <div id="toast" class="toast ornate-panel" hidden></div>
  <div id="live-region" class="sr-only" aria-live="polite"></div>`;
}
