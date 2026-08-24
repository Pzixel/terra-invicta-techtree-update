import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MARKER_SCHEMA = 1;

const exists = (target) => fs.existsSync(target);

const assertDirectory = (target, label) => {
  if (!exists(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`${label} directory is missing: ${target}`);
  }
};

const removeMarker = (marker) => {
  if (exists(marker)) fs.rmSync(marker, { force: false });
};

function readExpectedMarker(marker, expected) {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(marker, 'utf8'));
  } catch (error) {
    throw new Error(`Directory swap marker is invalid: ${error instanceof Error ? error.message : error}`);
  }
  if (value?.schemaVersion !== MARKER_SCHEMA ||
      path.resolve(value.live ?? '') !== path.resolve(expected.live) ||
      path.resolve(value.backup ?? '') !== path.resolve(expected.backup) ||
      typeof value.stage !== 'string' ||
      path.dirname(path.resolve(value.stage)) !== path.dirname(path.resolve(expected.live)) ||
      !path.basename(value.stage).startsWith('.gamefiles-import-')) {
    throw new Error('Directory swap marker does not match the expected import paths');
  }
  return { ...value, stage: path.resolve(value.stage) };
}

function writeMarker(marker, state) {
  const temporary = `${marker}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify({ schemaVersion: MARKER_SCHEMA, ...state }, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
  try {
    fs.renameSync(temporary, marker);
  } catch (error) {
    if (exists(temporary)) fs.rmSync(temporary, { force: false });
    throw error;
  }
}

/**
 * Repairs the four interruption points of the live/backup/stage rename
 * sequence. It either retains a newly installed live directory or restores
 * the previous one; ambiguous states fail without deleting anything.
 */
export function recoverStagedDirectorySwap({ live, backup, marker }) {
  if (!exists(marker)) {
    if (exists(backup)) {
      throw new Error(`Unmarked directory swap backup requires manual inspection: ${backup}`);
    }
    return { recovered: false, action: 'none' };
  }

  const state = readExpectedMarker(marker, { live, backup });
  const liveExists = exists(live);
  const backupExists = exists(backup);
  const stageExists = exists(state.stage);

  if (liveExists && backupExists && stageExists) {
    throw new Error('Directory swap recovery state is ambiguous; no directory was removed');
  }

  if (liveExists) {
    // Before the first rename, live+stage exist. After the second rename,
    // live+backup exist. In both cases live is authoritative and the other
    // directory is safe to discard.
    if (backupExists) fs.rmSync(backup, { recursive: true, force: false });
    if (stageExists) fs.rmSync(state.stage, { recursive: true, force: false });
    removeMarker(marker);
    return { recovered: true, action: backupExists ? 'kept-new-live' : 'kept-previous-live' };
  }

  if (backupExists) {
    fs.renameSync(backup, live);
    if (stageExists) fs.rmSync(state.stage, { recursive: true, force: false });
    removeMarker(marker);
    return { recovered: true, action: 'restored-previous-live' };
  }

  throw new Error('Directory swap recovery cannot find either the live or backup directory');
}

export function replaceDirectoryWithRecovery({ live, stage, backup, marker }) {
  assertDirectory(live, 'Live');
  assertDirectory(stage, 'Staged');
  if (exists(backup) || exists(marker)) {
    throw new Error('Directory swap state must be recovered before replacement');
  }
  if (path.dirname(path.resolve(stage)) !== path.dirname(path.resolve(live)) ||
      path.dirname(path.resolve(backup)) !== path.dirname(path.resolve(live)) ||
      path.dirname(path.resolve(marker)) !== path.dirname(path.resolve(live))) {
    throw new Error('Live, staged, backup, and marker paths must share one parent directory');
  }

  writeMarker(marker, {
    live: path.resolve(live),
    stage: path.resolve(stage),
    backup: path.resolve(backup),
  });
  fs.renameSync(live, backup);
  try {
    fs.renameSync(stage, live);
  } catch (error) {
    try {
      fs.renameSync(backup, live);
      removeMarker(marker);
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], 'Staged directory install and rollback both failed');
    }
    throw error;
  }

  fs.rmSync(backup, { recursive: true, force: false });
  removeMarker(marker);
}

const processExists = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
};

export function acquireProcessLock(lockPath) {
  const acquire = () => {
    try {
      const descriptor = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      fs.closeSync(descriptor);
      return;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }

    let owner;
    try {
      owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch {
      throw new Error(`Import lock is unreadable: ${lockPath}`);
    }
    if (Number.isSafeInteger(owner?.pid) && owner.pid > 0 && processExists(owner.pid)) {
      throw new Error(`Another release import is active with process ${owner.pid}`);
    }
    fs.rmSync(lockPath, { force: false });
    const descriptor = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
    fs.closeSync(descriptor);
  };

  acquire();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (!exists(lockPath)) return;
    let owner;
    try {
      owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    } catch {
      throw new Error(`Import lock became unreadable: ${lockPath}`);
    }
    if (owner?.pid !== process.pid) {
      throw new Error(`Import lock ownership changed before release: ${lockPath}`);
    }
    fs.rmSync(lockPath, { force: false });
  };
}
