import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await run('tsc', ['-p', 'tsconfig.json'], root);
await cp(join(root, 'public'), output, { recursive: true });
await cp(join(root, 'index.html'), join(output, 'index.html'));
await cp(join(root, 'src', 'styles.css'), join(output, 'src', 'styles.css'));

const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const report = await buildReport(output, packageJson.version);
await writeFile(join(output, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);

const initialBytes = report.files
  .filter((file) => /(?:index\.html|\.css|\.js)$/.test(file.path) && !file.path.endsWith('.map'))
  .reduce((sum, file) => sum + file.bytes, 0);

if (initialBytes >= 15 * 1024 * 1024) {
  throw new Error(`Initial payload exceeds 15 MB: ${formatBytes(initialBytes)}`);
}
if (report.totalBytes >= 100 * 1024 * 1024) {
  throw new Error(`Total build exceeds 100 MB: ${formatBytes(report.totalBytes)}`);
}

console.log(`Built Clockwork Conservatory ${report.version}`);
console.log(`Initial payload: ${formatBytes(initialBytes)} / 15 MB`);
console.log(`Total build: ${formatBytes(report.totalBytes)} / 100 MB`);

async function buildReport(directory, version) {
  const files = [];
  await walk(directory, async (path) => {
    const info = await stat(path);
    files.push({ path: relative(directory, path).replaceAll('\\', '/'), bytes: info.size });
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return {
    name: 'Clockwork Conservatory',
    version,
    generatedAt: new Date().toISOString(),
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };
}

async function walk(directory, visitor) {
  const { readdir } = await import('node:fs/promises');
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path, visitor);
    } else if (entry.isFile()) {
      await visitor(path);
    }
  }
}

function run(command, args, cwd) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
