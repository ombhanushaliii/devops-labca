// The deployment gate is the k6 exit code. No deployment happens after a failed test.
import { spawn } from 'node:child_process';
import { access, mkdir, cp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { project, runtime, readJson, writeJson, health, waitReady, startApp, stopOwnedProduction, delay, assertPortAvailable } from './helpers.mjs';

const scenario = process.argv[2];
const productionPort = Number(process.env.PRODUCTION_PORT || 3100);
const stagingPort = Number(process.env.STAGING_PORT || 3001);
if (![productionPort, stagingPort].every(port => Number.isInteger(port) && port > 0 && port <= 65535) || productionPort === stagingPort) {
  console.error('Choose different valid PRODUCTION_PORT and STAGING_PORT values.'); process.exit(1);
}
if (!['fast', 'slow', 'fixed'].includes(scenario)) {
  console.error('Usage: node scripts/pipeline.mjs fast|slow|fixed'); process.exit(1);
}
const k6 = process.env.K6_PATH || join(project, 'tools', process.platform === 'win32' ? 'k6.exe' : 'k6');
const lock = join(runtime, 'pipeline.lock');
let staging;
let locked = false;
let history;
let run;
async function saveRun() {
  const index = history.findIndex(item => item.id === run.id);
  if (index === -1) history.push(run); else history[index] = run;
  await writeJson(join(runtime, 'history.json'), history);
}
function runK6(report, version) {
  return new Promise((resolve, reject) => {
    const child = spawn(k6, ['run', '--quiet', join(project, 'tests', 'performance.js')], {
      cwd: project, windowsHide: true, stdio: 'inherit',
      env: { ...process.env, BASE_URL: `http://127.0.0.1:${stagingPort}`, EXPECTED_VERSION: version,
        K6_REPORT: report, K6_NO_USAGE_REPORT: 'true', K6_NO_COLOR: 'true', K6_NEW_MACHINE_READABLE_SUMMARY: 'false' },
    });
    child.on('error', reject);
    child.on('exit', code => resolve(code ?? 1));
  });
}
try {
  try { await access(k6); } catch { throw new Error(`k6 is missing at ${k6}. Run scripts/install-k6.ps1 or set K6_PATH to your executable.`); }
  await mkdir(runtime, { recursive: true });
  try { await writeFile(lock, String(process.pid), { flag: 'wx' }); locked = true; }
  catch { throw new Error('Another pipeline is running. If interrupted, stop it before removing .runtime/pipeline.lock.'); }
  const config = await readJson(join(project, 'releases', `${scenario}.json`));
  const id = `${Date.now()}-${scenario}`;
  const instanceId = randomUUID();
  const snapshot = join(runtime, 'releases', id);
  await mkdir(snapshot, { recursive: true });
  await cp(join(project, 'src'), join(snapshot, 'src'), { recursive: true });
  await writeJson(join(snapshot, 'release.json'), { ...config, instanceId });
  const old = await readJson(join(runtime, 'production.json'), null);
  const running = await health(productionPort);
  if (running && (!old || running.appId !== 'k6-deployment-lab' || running.instanceId !== old.instanceId)) {
    throw new Error(`Port ${productionPort} belongs to another application. Choose another PRODUCTION_PORT.`);
  }
  if (!running) await assertPortAvailable(productionPort);
  await assertPortAvailable(stagingPort);
  history = await readJson(join(runtime, 'history.json'), []);
  run = { id, scenario, version: config.version, status: 'testing', startedAt: new Date().toISOString(), p95Ms: null, failureRate: null, requests: null };
  await saveRun();
  console.log(`\n[1/4] BUILD: snapshot ${config.version} (delay ${config.delayMs} ms)`);
  console.log(`[2/4] STAGING: start candidate on port ${stagingPort}`);
  staging = startApp(snapshot, stagingPort);
  await waitReady(stagingPort, instanceId, staging);
  console.log(`[3/4] TEST: k6 with ${process.env.VUS || 10} virtual users for ${process.env.DURATION || '15s'}`);
  const reports = join(project, 'reports');
  await mkdir(reports, { recursive: true });
  const reportPath = join(reports, `${id}.json`);
  const exitCode = await runK6(reportPath, config.version);
  const report = await readJson(reportPath, null);
  if (report) Object.assign(run, { p95Ms: report.p95Ms, failureRate: report.failureRate, requests: report.requests, checksRate: report.checksRate });
  run.exitCode = exitCode;
  run.report = `reports/${id}.json`;
  if (exitCode !== 0) {
    run.status = exitCode === 99 ? 'blocked' : 'error';
    await saveRun();
    console.log(`\n[4/4] ${run.status === 'blocked' ? 'BLOCKED' : 'ERROR'}: k6 exited ${exitCode}. Deployment skipped.`);
    console.log(`Current production remains: ${(await health(productionPort))?.version || 'no release deployed'}`);
    process.exitCode = exitCode;
  } else {
    if (!report || report.p95Ms == null || report.requests < 1 || report.checksRate !== 1) {
      throw new Error('k6 returned success without a complete valid report. Deployment skipped.');
    }
    console.log(`\n[4/4] PASSED: deploy the exact tested snapshot to port ${productionPort}`);
    await stopOwnedProduction(old);
    const production = startApp(snapshot, productionPort, true);
    try {
      await waitReady(productionPort, instanceId, production);
      await writeJson(join(runtime, 'production.json'), { pid: production.pid, port: productionPort, instanceId, snapshot, version: config.version });
    } catch (err) {
      production.kill();
      await delay(300);
      if (old?.snapshot) {
        const restored = startApp(old.snapshot, old.port || 3000, true);
        await waitReady(old.port || 3000, old.instanceId, restored);
        await writeJson(join(runtime, 'production.json'), { ...old, pid: restored.pid });
        console.error('Previous release restored after deployment startup failure.');
      }
      throw err;
    }
    run.status = 'deployed';
    await saveRun();
    console.log(`DEPLOYED: ${config.version} → http://localhost:${productionPort}`);
  }
} catch (err) {
  console.error(`\nPIPELINE ERROR: ${err.message}`);
  if (run) { run.status = 'error'; run.error = err.message; await saveRun(); }
  process.exitCode = 1;
} finally {
  if (staging && staging.exitCode === null) { staging.kill(); await delay(250); }
  if (locked) await rm(lock, { force: true });
}
