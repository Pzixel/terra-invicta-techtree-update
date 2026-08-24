import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  acquireProcessLock,
  recoverStagedDirectorySwap,
  replaceDirectoryWithRecovery,
} from './staged_directory_swap.js';

const fixture = (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-directory-swap-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    live: path.join(root, 'gamefiles'),
    stage: path.join(root, '.gamefiles-import-stage'),
    backup: path.join(root, '.gamefiles-previous'),
    marker: path.join(root, '.gamefiles-swap.json'),
  };
};

const writeTree = (directory, value) => {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'identity.txt'), value);
};

const writeMarker = ({ live, stage, backup, marker }) => fs.writeFileSync(marker, JSON.stringify({
  schemaVersion: 1,
  live,
  stage,
  backup,
}));

test('staged directory replacement installs the complete tree and removes recovery state', (context) => {
  const paths = fixture(context);
  writeTree(paths.live, 'old');
  writeTree(paths.stage, 'new');

  replaceDirectoryWithRecovery(paths);

  assert.equal(fs.readFileSync(path.join(paths.live, 'identity.txt'), 'utf8'), 'new');
  assert.equal(fs.existsSync(paths.stage), false);
  assert.equal(fs.existsSync(paths.backup), false);
  assert.equal(fs.existsSync(paths.marker), false);
});

test('swap recovery restores old live data when interrupted between renames', (context) => {
  const paths = fixture(context);
  writeTree(paths.stage, 'new');
  writeTree(paths.backup, 'old');
  writeMarker(paths);

  assert.deepEqual(recoverStagedDirectorySwap(paths), {
    recovered: true,
    action: 'restored-previous-live',
  });
  assert.equal(fs.readFileSync(path.join(paths.live, 'identity.txt'), 'utf8'), 'old');
  assert.equal(fs.existsSync(paths.stage), false);
  assert.equal(fs.existsSync(paths.marker), false);
});

test('swap recovery keeps the new live data when interrupted after installation', (context) => {
  const paths = fixture(context);
  writeTree(paths.live, 'new');
  writeTree(paths.backup, 'old');
  writeMarker(paths);

  assert.deepEqual(recoverStagedDirectorySwap(paths), {
    recovered: true,
    action: 'kept-new-live',
  });
  assert.equal(fs.readFileSync(path.join(paths.live, 'identity.txt'), 'utf8'), 'new');
  assert.equal(fs.existsSync(paths.backup), false);
  assert.equal(fs.existsSync(paths.marker), false);
});

test('swap recovery fails closed on an impossible three-directory state', (context) => {
  const paths = fixture(context);
  writeTree(paths.live, 'unknown-live');
  writeTree(paths.stage, 'unknown-stage');
  writeTree(paths.backup, 'unknown-backup');
  writeMarker(paths);

  assert.throws(() => recoverStagedDirectorySwap(paths), /state is ambiguous/);
  assert.equal(fs.existsSync(paths.live), true);
  assert.equal(fs.existsSync(paths.stage), true);
  assert.equal(fs.existsSync(paths.backup), true);
  assert.equal(fs.existsSync(paths.marker), true);
});

test('process lock rejects a live owner and replaces a stale owner', (context) => {
  const { root } = fixture(context);
  const lock = path.join(root, '.gamefiles-import.lock');
  const release = acquireProcessLock(lock);
  assert.throws(() => acquireProcessLock(lock), /Another release import is active/);
  release();

  fs.writeFileSync(lock, JSON.stringify({ pid: 2147483647 }));
  const releaseAfterStale = acquireProcessLock(lock);
  assert.equal(fs.existsSync(lock), true);
  releaseAfterStale();
  assert.equal(fs.existsSync(lock), false);
});
