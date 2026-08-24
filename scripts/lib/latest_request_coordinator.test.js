import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { LatestRequestCoordinator } = await jiti.import('../../src/data/latestRequestCoordinator.ts');

test('scenario requests suppress stale results and retain rollback state on failure', () => {
  const coordinator = new LatestRequestCoordinator();
  const standard = { view: 'standard', committedUrl: '/?lang=en&ver=stable' };
  const first = coordinator.begin(standard);
  const second = coordinator.begin(standard);

  assert.equal(first.controller.signal.aborted, true);
  assert.equal(coordinator.accept(first), false);
  assert.deepEqual(coordinator.reject(second), standard);

  const third = coordinator.begin(standard);
  assert.equal(coordinator.accept(third), true);
  assert.equal(coordinator.reject(third), null);
});
