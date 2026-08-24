import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { selectedPrerequisiteTechs } = await jiti.import('../../src/utils/prerequisites.ts');

test('a completed alternate satisfies its OR slot for research traversal', () => {
  const primary = { dataName: 'Primary', prereqs: [], researchDone: false };
  const alternate = { dataName: 'Alternate', prereqs: [], researchDone: true };
  const secondSlot = { dataName: 'SecondSlot', prereqs: [], researchDone: false };
  const records = new Map([primary, alternate, secondSlot].map((record) => [record.dataName, record]));
  const target = {
    dataName: 'Target',
    prereqs: ['Primary', 'SecondSlot'],
    altPrereq0: 'Alternate',
  };

  assert.deepEqual(
    selectedPrerequisiteTechs(target, (dataName) => records.get(dataName)).map((record) => record.dataName),
    ['Alternate', 'SecondSlot'],
  );
});
