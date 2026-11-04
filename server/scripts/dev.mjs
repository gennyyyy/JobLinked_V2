// Dev runner for the API. Replaces `node --watch`.
//
// Guarantees:
//  1. Restart only after a real save of a runtime source file. The signature is
//     mtime+size — the fs events that made `node --watch` restart the API every
//     few seconds on Windows (metadata only, content unchanged) are invisible
//     to it. Test files and `__tests__/` are excluded: they don't run here.
//  2. A crashed or killed child is respawned within ~1s.
//  3. It never fights another healthy API on the same port: before spawning it
//     asks `/api/health`; if something else is already answering, it idles and
//     re-checks periodically, taking over only when the port goes unhealthy.
//     Two dev windows (or agents) can never wedge each other.
//  4. A port held by a DEAD process is not a recoverable condition in-process:
//     after 3 boot cycles that never bound, it exits with a clear error and the
//     watchdog (Windows scheduled task) retries later.
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = fileURLToPath(new URL('..', import.meta.url));
const srcDir = path.join(serverDir, 'src');
const port = Number(process.env.PORT) || 4000;
const POLL_MS = 700;        // file signature poll
const SETTLE_MS = 350;      // let a burst of saves settle before restarting
const CRASH_RETRY_MS = 1000;
const SPAWN_HEARTBEAT_MS = 15_000; // idle runners re-check the port at this pace
const MAX_BOOT_FAILURES = 3;
const MIN_REAL_LIFETIME_MS = 5000; // a child that lived this long actually bound the port
const HEALTH_TIMEOUT_MS = 2500;

const isRuntimeFile = (file) =>
  file.endsWith('.js') && !file.endsWith('.test.js') && !file.includes(`${path.sep}__tests__${path.sep}`);

function collect(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { collect(full, out); continue; }
    if (!isRuntimeFile(full)) continue;
    const stat = statSync(full);
    out.push(`${full}:${stat.mtimeMs}:${stat.size}`);
  }
  return out;
}

// A file can vanish between readdir and stat; a failed scan is not a change.
function signature() {
  try { return collect(srcDir, []).sort().join('|'); } catch { return null; }
}

// A 200 body with ok:true means SOME instance is serving this port properly,
// whether it is ours or not — and two servers can be right after a restart.
async function portHealthy() {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    if (!r.ok) return false;
    return Boolean((await r.json())?.ok);
  } catch { return false; }
}

let child = null;
let wantRestart = false;
let stopping = false;
let restartTimer = null;
let childStartedAt = 0;
let bootFails = 0;
let healthyWarned = false;
let lastSpawnAttempt = 0;

async function startChild() {
  if (stopping || child) return;
  lastSpawnAttempt = Date.now();
  if (await portHealthy()) {
    if (!healthyWarned) {
      console.log(`[dev] another healthy api already answers on :${port} - idling until the port is free`);
      healthyWarned = true;
    }
    return;
  }
  healthyWarned = false;
  console.log('[dev] starting api');
  childStartedAt = Date.now();
  child = spawn(process.execPath, ['src/index.js'], { cwd: serverDir, stdio: 'inherit' });
  child.on('exit', (code, signal) => {
    const lifetime = Date.now() - childStartedAt;
    child = null;
    if (stopping) return;
    if (wantRestart) { wantRestart = false; startChild(); return; }
    if (lifetime < MIN_REAL_LIFETIME_MS) {
      bootFails += 1;
      if (bootFails >= MAX_BOOT_FAILURES) {
        console.log(`[dev] api failed to boot ${bootFails} times in a row (port ${port} is probably held by a dead process). Giving up; free the port and run "npm run dev" again.`);
        process.exit(1);
      }
    } else {
      bootFails = 0;
    }
    console.log(`[dev] api exited (${signal ?? code}); restarting in ${CRASH_RETRY_MS}ms`);
    restartTimer = setTimeout(startChild, CRASH_RETRY_MS);
  });
}

function restart() {
  if (stopping) return;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (!child) { startChild(); return; }
  if (wantRestart) return;
  wantRestart = true;
  child.kill();
}

let last = signature();
let settleTimer = null;
setInterval(() => {
  const next = signature();
  if (next === null || next === last) return;
  last = next;
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    settleTimer = null;
    console.log('[dev] source changed - restarting');
    restart();
  }, SETTLE_MS);
}, POLL_MS);

// Idle runners must wake up on their own when the port goes unhealthy — that is
// how one of them takes over after another stack (or an agent) dies.
setInterval(() => {
  if (child || stopping) return;
  if (Date.now() - lastSpawnAttempt < SPAWN_HEARTBEAT_MS) return;
  lastSpawnAttempt = Date.now();
  startChild();
}, SPAWN_HEARTBEAT_MS);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => { stopping = true; child?.kill(); process.exit(0); });
}

startChild();
