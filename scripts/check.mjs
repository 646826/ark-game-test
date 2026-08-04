import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
execFileSync(existsSync(localTsc) ? localTsc : 'tsc', ['--noEmit', '-p', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const main = readFileSync(join(root, 'src/main.ts'), 'utf8');
const bridge = readFileSync(join(root, 'src/platform/arkadium.ts'), 'utf8');
const game = readFileSync(join(root, 'src/game/game.ts'), 'utf8');
const renderer = readFileSync(join(root, 'src/game/renderer.ts'), 'utf8');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const allSource = [main, bridge, game, renderer, html].join('\n');

if (lock.version !== packageJson.version || lock.packages?.['']?.version !== packageJson.version) {
  throw new Error('package.json and package-lock.json versions must match.');
}
if (!main.includes(`const VERSION = '${packageJson.version}'`)) throw new Error('Visible runtime version is inconsistent.');
if (!bridge.includes('https://developers.arkadium.com/cdn/sdk/v2/sdk.js')) throw new Error('Official Arkadium SDK v2 CDN URL is missing.');
if (!bridge.includes("reason: 'Completed'")) throw new Error('Successful round analytics must use Completed.');
if (/showRewarded[\s\S]{0,500}if \(!this\.#sdk[^\n]*\) return true;/.test(bridge)) throw new Error('Rewarded ads must fail closed outside explicit debug mode.');
for (const lifecycle of ['onTestReady', 'onGameStart', 'onChangeScore', 'onLevelStart', 'onLevelEnd', 'onGameEnd']) {
  if (!bridge.includes(lifecycle)) throw new Error(`Mandatory lifecycle event ${lifecycle} is missing.`);
}
for (const prohibited of [
  ['external navigation', /window\.open\s*\(|location\.(?:href|assign|replace)\s*[=(]/],
  ['fullscreen', /requestFullscreen|webkitRequestFullscreen/],
  ['clipboard', /navigator\.clipboard/],
  ['dynamic evaluation', /\beval\s*\(|new\s+Function\s*\(/],
]) {
  const [label, pattern] = prohibited;
  if (pattern.test(allSource)) throw new Error(`Prohibited ${label} capability found.`);
}
if (!html.includes('arkadium-app-insights-id')) throw new Error('Arkadium App Insights hook is missing.');
if (/<script[^>]+src=["']https?:/i.test(html)) throw new Error('index.html must not depend on remote executable code.');
if (!html.includes('viewport-fit=cover')) throw new Error('Safe-area viewport support is missing.');
if (!renderer.includes('densePortrait')) throw new Error('Dense portrait readability composition is missing.');
if (!renderer.includes("await this.#ensureAsset('atrium')")) throw new Error('Title art must be the only blocking scene asset.');

const requiredAssets = [
  'atrium-desktop.webp',
  'garden-desktop.webp',
  'garden-portrait.webp',
  'map-desktop.webp',
  'victory-desktop.webp',
];
for (const asset of requiredAssets) {
  const path = join(root, 'public', 'assets', asset);
  if (!existsSync(path) || statSync(path).size < 4_000) throw new Error(`Missing or suspiciously small asset: ${asset}`);
}
for (const doc of ['README.md', 'CREDITS.md', 'docs/ARKADIUM_CHECKLIST.md', 'docs/QA_PLAN.md', 'docs/RELEASE_NOTES_0.3.0.md']) {
  if (!existsSync(join(root, doc))) throw new Error(`Release document is missing: ${doc}`);
}

console.log('TypeScript, SDK lifecycle, policy, asset, version, and release-document guardrails passed.');
