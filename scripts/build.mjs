import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'src'), { recursive: true });

const localTsc = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
execFileSync(existsSync(localTsc) ? localTsc : 'tsc', ['-p', join(root, 'tsconfig.json')], { cwd: root, stdio: 'inherit' });
cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'src', 'styles.css'), join(dist, 'src', 'styles.css'));
cpSync(join(root, 'public'), dist, { recursive: true });

const files = walk(dist);
const totalBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
// The renderer preloads every packaged scene during initialization, and native ES
// modules load the complete dependency graph. Count every runtime file except maps
// and the build report rather than reporting only the entry module.
const initialBytes = files
  .filter((file) => {
    const relative = file.slice(dist.length + 1).replaceAll('\\', '/');
    if (extname(file) === '.map' || basename(file) === 'build-report.json') return false;
    return relative === 'index.html'
      || relative === 'favicon.svg'
      || relative === 'manifest.webmanifest'
      || relative === 'assets/atrium-desktop.webp'
      || relative === 'src/styles.css'
      || (relative.startsWith('src/') && relative.endsWith('.js'));
  })
  .reduce((sum, file) => sum + statSync(file).size, 0);
const report = {
  version: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version,
  generatedAt: new Date().toISOString(),
  initialBytes,
  totalBytes,
  initialMegabytes: Number((initialBytes / 1024 / 1024).toFixed(3)),
  totalMegabytes: Number((totalBytes / 1024 / 1024).toFixed(3)),
  files: files.map((file) => ({ path: file.slice(dist.length + 1), bytes: statSync(file).size })),
};
writeFileSync(join(dist, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
if (initialBytes > 15 * 1024 * 1024) throw new Error(`Initial package exceeds Arkadium's 15 MB budget: ${report.initialMegabytes} MB`);
if (totalBytes > 100 * 1024 * 1024) throw new Error(`Total package exceeds Arkadium's 100 MB budget: ${report.totalMegabytes} MB`);
console.log(`Built v${report.version}: ${report.initialMegabytes} MB initial / ${report.totalMegabytes} MB total.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
