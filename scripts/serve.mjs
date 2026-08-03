import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist');
const port = Number(process.env.PORT ?? process.argv[3] ?? 4173);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const requested = resolve(root, `.${normalize(pathname)}`);
    if (requested !== root && !requested.startsWith(`${root}${sep}`)) {
      send(response, 403, 'Forbidden');
      return;
    }

    let file = requested;
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
      await access(file);
    } catch {
      send(response, 404, 'Not found');
      return;
    }

    const type = MIME_TYPES.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    createReadStream(file).pipe(response);
  } catch (error) {
    console.error(error);
    send(response, 500, 'Internal server error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Clockwork Conservatory preview: http://127.0.0.1:${port}`);
});

function send(response, status, text) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(text);
}
