import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { runtime, readJson, stopOwnedProduction } from './helpers.mjs';
try {
  const state = await readJson(join(runtime, 'production.json'), null);
  await stopOwnedProduction(state);
  await rm(join(runtime, 'production.json'), { force: true });
  console.log('Demo production stopped. Saved reports and history remain.');
} catch (err) { console.error(err.message); process.exitCode = 1; }
