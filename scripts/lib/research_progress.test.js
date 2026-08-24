import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const {
  clearResearchProgress,
  loadResearchProgress,
  researchProgressKey,
  saveResearchProgress,
} = await jiti.import('../../src/utils/researchProgress.ts');

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test('legacy progress migrates only to stable Standard', () => {
  const storage = new MemoryStorage();
  storage.setItem('terraInvictaResearchState', JSON.stringify({ TechA: true, TechB: false }));
  assert.deepEqual(loadResearchProgress(storage, 'experimental', 'standard'), {});
  assert.notEqual(storage.getItem('terraInvictaResearchState'), null);

  assert.deepEqual(loadResearchProgress(storage, 'stable', 'standard'), { TechA: true });
  assert.equal(storage.getItem('terraInvictaResearchState'), null);
  assert.equal(storage.getItem(researchProgressKey('stable', 'standard')), JSON.stringify({ TechA: true }));
});

test('research progress is isolated by version and scenario', () => {
  const storage = new MemoryStorage();
  saveResearchProgress(storage, 'stable', '2003', { TechA: true });
  saveResearchProgress(storage, 'stable', 'broken-earth', { TechB: true });
  assert.deepEqual(loadResearchProgress(storage, 'stable', '2003'), { TechA: true });
  assert.deepEqual(loadResearchProgress(storage, 'stable', 'broken-earth'), { TechB: true });
  assert.deepEqual(loadResearchProgress(storage, 'experimental', '2003'), {});

  clearResearchProgress(storage, 'stable', '2003');
  assert.deepEqual(loadResearchProgress(storage, 'stable', '2003'), {});
  assert.deepEqual(loadResearchProgress(storage, 'stable', 'broken-earth'), { TechB: true });
});
