import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await run('tsc', ['-p', 'tsconfig.json', '--noEmit']);

const sourceFiles = [
  'src/game/game.ts',
  'src/game/renderer.ts',
  'src/platform/arkadium.ts',
  'src/main.ts',
  'index.html',
];
const source = (await Promise.all(sourceFiles.map((file) => readFile(join(root, file), 'utf8')))).join('\n');

const forbidden = [
  ['requestFullscreen(', 'Arkadium embeds must not expose a fullscreen toggle'],
  ['window.open(', 'External redirects/actions are not allowed'],
  ['location.href =', 'External redirects/actions are not allowed'],
  ['eval(', 'Dynamic code execution is forbidden'],
];
for (const [needle, reason] of forbidden) {
  if (source.includes(needle)) throw new Error(`${reason}: found ${needle}`);
}

const requiredSignals = [
  'onTestReady',
  'onGameStart',
  'onGameEnd',
  'onLevelStart',
  'onLevelEnd',
  'onChangeScore',
  'getLocalStorageItem',
  'setLocalStorageItem',
  'showInterstitialAd',
  'showRewardAd',
];
for (const signal of requiredSignals) {
  if (!source.includes(signal)) throw new Error(`Missing Arkadium integration signal: ${signal}`);
}

const cssBytes = (await stat(join(root, 'src/styles.css'))).size;
if (cssBytes > 250_000) throw new Error(`CSS unexpectedly large: ${cssBytes} bytes`);
console.log('Static production checks passed.');

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    child.once('error', reject);
    child.once('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`${command} exited with ${code}`))));
  });
}
