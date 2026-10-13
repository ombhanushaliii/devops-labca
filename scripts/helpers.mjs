import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

export const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const runtime = join(project, '.runtime');
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', error => reject(new Error(`Port ${port} is unavailable (${error.code}). Choose another PRODUCTION_PORT or STAGING_PORT before running the pipeline.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
export async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (err) { if (err.code === 'ENOENT' && fallback !== undefined) return fallback; throw err; }
}
export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2));
  await rename(temp, path);
}
export async function health(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(750) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}
export async function waitReady(port, instanceId, child) {
  for (let i = 0; i < 40; i++) {
    const result = await health(port);
    if (result?.appId === 'k6-deployment-lab' && result.instanceId === instanceId) return result;
    if (child && child.exitCode !== null) throw new Error(`Application exited before becoming ready on port ${port}. See .runtime/*.log.`);
    await delay(150);
  }
  throw new Error(`Release did not become ready on port ${port}. See .runtime/*.log. Check for a port conflict.`);
}
export function startApp(snapshot, port, production = false) {
  const fd = openSync(join(runtime, `${production ? 'production' : 'staging'}.log`), 'a');
  const child = spawn(process.execPath, [join(snapshot, 'src', 'app.mjs')], {
    cwd: project,
    env: { ...process.env, HOST: '127.0.0.1', PORT: String(port),
      RELEASE_FILE: join(snapshot, 'release.json'), RUN_STATE_DIR: runtime,
      APP_ENV: production ? 'demo-production' : 'staging', RELEASE_VERSION: '', DELAY_MS: '' },
    detached: production,
    windowsHide: true,
    stdio: ['ignore', fd, fd],
  });
  closeSync(fd);
  // Clear inherited overrides so staging and production use the exact saved release.
  child.on('error', err => console.error('Application start failed:', err.message));
  if (production) child.unref();
  return child;
}
export async function stopOwnedProduction(state) {
  if (!state) return;
  const port = state.port || 3000;
  const running = await health(port);
  if (!running) return;
  if (running.appId !== 'k6-deployment-lab' || running.instanceId !== state.instanceId) {
    throw new Error(`Port ${port} is occupied by another process. It was left untouched.`);
  }
  try { process.kill(state.pid); } catch (err) { if (err.code !== 'ESRCH') throw err; }
  for (let i = 0; i < 30; i++) {
    if (!(await health(port))) return;
    await delay(100);
  }
  throw new Error('Previous production process did not stop.');
}
