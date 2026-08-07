import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
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
await assembleStarlightRelease(output);

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

async function assembleStarlightRelease(directory) {
  const release = join(directory, 'starlight-relay');
  const parts = join(release, '.bundle-parts');
  const partNames = (await readdir(parts))
    .filter((name) => /^index-\d{2}(?:-\d{2}){0,2}\.txt$/.test(name))
    .sort((a, b) => a.localeCompare(b));

  if (partNames.length !== 18) {
    throw new Error(`Starlight bundle must contain exactly 18 ordered parts; found ${partNames.length}.`);
  }

  const javascript = (
    await Promise.all(partNames.map((name) => readFile(join(parts, name), 'utf8')))
  ).join('');
  assertSha256(
    'Starlight JavaScript',
    javascript,
    '603e16eebb7c4ddcd0ea4fe79bd5b38f8e2caa4804f7458ec302901514f17637',
  );
  if (javascript.includes('sourceMappingURL=')) {
    throw new Error('Starlight public JavaScript must not reference a source map.');
  }

  const assets = join(release, 'assets');
  await mkdir(assets, { recursive: true });
  await writeFile(join(assets, 'index-BIXdqmAE.js'), javascript);
  await rm(parts, { recursive: true, force: true });

  const html = await readFile(join(release, 'index.html'), 'utf8');
  for (const expected of [
    '<title>Starlight Relay</title>',
    'data-role="app"',
    'data-role="energy"',
    'https://cdn.jsdelivr.net/npm/phaser@4.2.1/dist/phaser.min.js',
    './assets/index-BIXdqmAE.js',
    './assets/index-Dca4xZzP.css',
  ]) {
    if (!html.includes(expected)) {
      throw new Error(`Starlight HTML is missing required release marker: ${expected}`);
    }
  }

  const buildInfo = JSON.parse(await readFile(join(release, 'build-info.json'), 'utf8'));
  if (buildInfo.sourceCommit !== '9e1a39bc1a86267b7afe9e3b8cc90e7e3cf48643') {
    throw new Error('Starlight build-info source commit does not match the verified private source.');
  }

  await assertFileSha256(
    join(assets, 'index-Dca4xZzP.css'),
    'c7737cfd5e0b7c5637d75f033338950245859826ce140cdb2c9abcc9d4bec928',
  );
  await assertFileSha256(
    join(release, 'index.html'),
    'cce9eb3d36446ec2f8ab7f32b9c5d3b6dd15fa98dc13907b630a2ea032f24248',
  );

  console.log(
    `Assembled Starlight Relay from ${partNames.length} verified parts (${formatBytes(Buffer.byteLength(javascript))}).`,
  );
}

async function assertFileSha256(path, expected) {
  const content = await readFile(path);
  const actual = createHash('sha256').update(content).digest('hex');
  if (actual !== expected) {
    throw new Error(`SHA-256 mismatch for ${relative(root, path)}: ${actual}`);
  }
}

function assertSha256(label, content, expected) {
  const actual = createHash('sha256').update(content).digest('hex');
  if (actual !== expected) {
    throw new Error(`${label} SHA-256 mismatch: ${actual}`);
  }
}

async function buildReport(directory, version) {
  const files = [];
  await walk(directory, async (path) => {
    const info = await stat(path);
    files.push({ path: relative(directory, path).replaceAll('\\', '/'), bytes: info.size });
  });
  files.sort((a, b) => a.path.localeCompare(b));
  return {
    name: 'Clockwork Conservatory',
    version,
    generatedAt: new Date().toISOString(),
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };
}

async function walk(directory, visitor) {
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
