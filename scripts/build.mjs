import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import process from 'node:process';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, 'src'), { recursive: true });

const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
let command = 'tsc';
try { await stat(localTsc); command = localTsc; } catch { /* global TypeScript is supported in the lightweight build environment */ }
const compile = spawnSync(command, ['-p', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
if (compile.status !== 0) process.exit(compile.status ?? 1);

await cp(join(root, 'index.html'), join(dist, 'index.html'));
await cp(join(root, 'src', 'styles.css'), join(dist, 'src', 'styles.css'));
await cp(join(root, 'public'), dist, { recursive: true });

const files = await listFiles(dist);
const totals = { html: 0, css: 0, javascript: 0, assets: 0, maps: 0, total: 0 };
for (const file of files) {
  const info = await stat(file);
  totals.total += info.size;
  if (file.endsWith('.html')) totals.html += info.size;
  else if (file.endsWith('.css')) totals.css += info.size;
  else if (file.endsWith('.js')) totals.javascript += info.size;
  else if (file.endsWith('.map')) totals.maps += info.size;
  else totals.assets += info.size;
}
const initial = totals.html + totals.css + totals.javascript + totals.assets;
const report = {
  name: 'Clockwork Conservatory: Bloom Circuit',
  version: JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version,
  generatedAt: new Date().toISOString(),
  initialBytes: initial,
  totalBytes: totals.total,
  breakdown: totals,
  files: await Promise.all(files.map(async (file) => ({ path: relative(dist, file), bytes: (await stat(file)).size }))),
  budgets: { initialBytes: 15_000_000, totalBytes: 100_000_000, pass: initial < 15_000_000 && totals.total < 100_000_000 },
};
await writeFile(join(dist, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
if (!report.budgets.pass) throw new Error('Arkadium package budget exceeded.');
console.log(`Built ${report.version}: ${(initial / 1024).toFixed(1)} KiB initial, ${(totals.total / 1024).toFixed(1)} KiB total.`);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(path));
    else output.push(path);
  }
  return output;
}
