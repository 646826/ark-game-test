import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import process from 'node:process';

const root = new URL('..', import.meta.url).pathname;
const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
let command = 'tsc';
try { await stat(localTsc); command = localTsc; } catch { /* use global TypeScript */ }
const check = spawnSync(command, ['-p', join(root, 'tsconfig.json'), '--noEmit'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (check.status !== 0) process.exit(check.status ?? 1);

const sourceFiles = await collect(join(root, 'src'));
const source = (await Promise.all(sourceFiles.filter((file) => /\.(ts|css)$/.test(file)).map((file) => readFile(file, 'utf8')))).join('\n');
const failures = [];
if (/document\.cookie|eval\(|new Function\(/.test(source)) failures.push('Unsafe runtime API found.');
if (/window\.open\(|location\.href\s*=/.test(source)) failures.push('External navigation found.');
if (/showRewarded[\s\S]{0,900}return true;/.test(source)) failures.push('Rewarded fallback appears to grant rewards unconditionally.');
if (!source.includes('onTestReady') || !source.includes('onGameStart') || !source.includes('onLevelStart')) failures.push('Required Arkadium lifecycle integration is missing.');
if (!source.includes('prefers-reduced-motion') && !source.includes('reducedMotion')) failures.push('Reduced motion support is missing.');
if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
console.log(`Static release checks passed across ${sourceFiles.length} source files.`);

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collect(path));
    else result.push(path);
  }
  return result;
}
