// A dependency-free product API. k6 sends real HTTP requests to /api/products.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const saved = process.env.RELEASE_FILE
  ? JSON.parse(await readFile(process.env.RELEASE_FILE, 'utf8'))
  : { version: 'development', delayMs: 30, instanceId: 'development' };
const release = {
  ...saved,
  version: process.env.RELEASE_VERSION || saved.version,
  delayMs: Number(process.env.DELAY_MS || saved.delayMs),
};
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const environment = process.env.APP_ENV || 'demo-production';
const products = [
  { id: 1, name: 'Everyday Headphones', category: 'Audio', price: 1499, icon: '♫', color: '#d4e6ff' },
  { id: 2, name: 'Desk Companion', category: 'Accessories', price: 799, icon: '◈', color: '#eadfff' },
  { id: 3, name: 'Travel Bottle', category: 'Essentials', price: 599, icon: '▥', color: '#d9f1e4' },
  { id: 4, name: 'Pocket Speaker', category: 'Audio', price: 1299, icon: '◉', color: '#ffe6cf' },
];
const json = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET') return json(res, 405, { error: 'GET only' });
    if (url.pathname === '/health') {
      return json(res, 200, { status: 'ok', appId: 'k6-deployment-lab', ...release, environment });
    }
    if (url.pathname === '/api/products') {
      // Controlled slowdown models an inefficient query. It does not add HTTP errors.
      await new Promise(resolve => setTimeout(resolve, release.delayMs));
      return json(res, 200, { products, version: release.version });
    }
    if (url.pathname === '/api/release') return json(res, 200, { ...release, environment });
    if (url.pathname === '/api/demo-status') {
      let history = [];
      try { history = JSON.parse(await readFile(join(process.env.RUN_STATE_DIR || '.runtime', 'history.json'), 'utf8')); }
      catch (err) { if (err.code !== 'ENOENT') throw err; }
      return json(res, 200, { release: { ...release, environment }, history });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
      return res.end(await readFile(join(root, 'index.html')));
    }
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err.message);
    if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
    else res.end();
  }
});
server.on('error', err => { console.error(err.message); process.exit(1); });
server.listen(port, host, () => console.log(`${environment}: ${release.version} on http://${host}:${port}, delay=${release.delayMs}ms`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
