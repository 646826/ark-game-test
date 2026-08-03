import { ClockworkGame } from './game/game.js';
import { ArkadiumBridge } from './platform/arkadium.js';

const VERSION = '0.2.0';
const app = document.querySelector<HTMLElement>('#app');

if (!app) {
  throw new Error('Application root is missing.');
}

const bridge = new ArkadiumBridge(VERSION);
const game = new ClockworkGame(app, bridge, VERSION);

void game
  .initialize()
  .then(() => app.removeAttribute('aria-busy'))
  .catch(async (error: unknown) => {
    await bridge.reportError(error);
    app.removeAttribute('aria-busy');
    app.innerHTML = `
      <section style="display:grid;place-items:center;width:100%;height:100%;padding:24px;text-align:center;background:#082b31;color:#f5fff9;font:16px system-ui">
        <div><h1 style="font:500 2rem Georgia,serif">Clockwork Conservatory</h1><p>The glasshouse could not be restored. Reload the page to try again.</p></div>
      </section>`;
  });
