import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const {
  compileScenarioData,
  prerequisiteSlots,
  validatePrerequisiteReferences,
} = await jiti.import('../../src/data/scenarioCompiler.ts');

const brokenEarth = {
  scenario: 'broken-earth',
  activeScenarioTags: ['PostApoc'],
  recordCollections: ['tech', 'project'],
};

test('scenario compiler replaces whole records, applies tombstones, and replaces non-record collections', () => {
  const base = {
    tech: [
      { dataName: 'Keep', prereqs: [], researchCost: 10 },
      { dataName: 'Replace', prereqs: ['Keep'], researchCost: 20, retainedOnlyByMerge: true },
      { dataName: 'Remove', prereqs: [] },
    ],
    scalarList: ['base-a', 'base-b'],
  };
  const overlay = {
    tech: [
      { dataName: 'Replace', prereqs: [], researchCost: 5 },
      { dataName: 'Remove', disable: true },
      { dataName: 'Added', prereqs: ['Replace'], scenarioTags: ['PostApoc'] },
    ],
    scalarList: ['scenario-only'],
  };

  const compiled = compileScenarioData(base, overlay, brokenEarth);
  assert.deepEqual(compiled.collections.scalarList, ['scenario-only']);
  assert.deepEqual(compiled.collections.tech.map(({ dataName }) => dataName), ['Keep', 'Replace', 'Added']);
  assert.equal(compiled.collections.tech[1].retainedOnlyByMerge, undefined);
  assert.equal(compiled.collections.tech[1].scenarioVariant, true);
  assert.equal(compiled.collections.tech[1].dlcOnly, false);
  assert.equal(compiled.collections.tech[2].dlcOnly, true);

  assert.throws(() => compileScenarioData({ tech: [
    { dataName: 'Duplicate', prereqs: [] },
    { dataName: 'Duplicate', prereqs: [] },
  ] }, {}, brokenEarth), /Duplicate base dataName: Duplicate/);
  assert.throws(() => compileScenarioData({ tech: [
    { dataName: 'Valid', prereqs: [] },
    { prereqs: [] },
  ] }, {}, brokenEarth), /tech base record 1 has a missing or empty dataName/);
});

test('scenario eligibility is evaluated after the overlay', () => {
  const base = {
    tech: [
      { dataName: 'ModernOnly', prereqs: [], scenarioTags: ['NotPostApoc'] },
      { dataName: 'Untagged', prereqs: [] },
      { dataName: 'Retagged', prereqs: [], scenarioTags: ['NotPostApoc'] },
    ],
  };
  const overlay = {
    tech: [{ dataName: 'Retagged', prereqs: [], scenarioTags: ['PostApoc'] }],
  };

  const compiled = compileScenarioData(base, overlay, brokenEarth);
  assert.deepEqual(compiled.collections.tech.map(({ dataName }) => dataName), ['Untagged', 'Retagged']);
});

test('aliases resolve by concern and reject cycles or missing targets', () => {
  const compiled = compileScenarioData({
    project: [
      { dataName: 'Canonical', prereqs: [] },
      { dataName: 'ScenarioCopy', prereqs: [], referenceAlias: 'Canonical' },
      { dataName: 'LocalizedCopy', prereqs: [], localizationAlias: 'Canonical' },
      { dataName: 'ExternalLocalizedCopy', prereqs: [], localizationAlias: 'LocalizationOnlyStem' },
    ],
  }, {}, brokenEarth);

  assert.equal(compiled.aliases.reference.project.Canonical, 'ScenarioCopy');
  assert.equal(compiled.aliases.localization.project.LocalizedCopy, 'Canonical');
  assert.equal(compiled.aliases.localization.project.ExternalLocalizedCopy, 'LocalizationOnlyStem');

  const selfAliasedCanonical = compileScenarioData({
    project: [
      {
        dataName: 'Canonical',
        prereqs: [],
        referenceAlias: 'Canonical',
        localizationAlias: 'Canonical',
      },
      { dataName: 'ScenarioCopy', prereqs: [], referenceAlias: 'Canonical' },
    ],
  }, {}, brokenEarth);
  assert.equal(selfAliasedCanonical.aliases.reference.project.Canonical, 'ScenarioCopy');
  assert.equal(selfAliasedCanonical.aliases.localization.project.Canonical, undefined);

  const eraVariants = compileScenarioData({
    nation: [
      { dataName: 'Canonical', referenceAlias: 'Canonical' },
      { dataName: '2026_Canonical', referenceAlias: 'Canonical' },
      { dataName: '2070_Canonical', referenceAlias: 'Canonical' },
    ],
  }, {}, {
    ...brokenEarth,
    recordCollections: ['nation'],
    annotatedCollections: [],
  });
  assert.deepEqual(eraVariants.aliases.reference.nation, {});

  const virtualCanonical = compileScenarioData({
    nation: [{
      dataName: '1962_KRU',
      referenceAlias: 'KRU',
      localizationAlias: 'KRU',
    }],
  }, {}, {
    ...brokenEarth,
    recordCollections: ['nation'],
    annotatedCollections: [],
  });
  assert.equal(virtualCanonical.aliases.localization.nation['1962_KRU'], 'KRU');
  assert.throws(
    () => compileScenarioData({ nation: [{
      dataName: 'InvalidVirtual',
      referenceAlias: 'Missing',
      localizationAlias: 'DifferentStem',
    }] }, {}, {
      ...brokenEarth,
      recordCollections: ['nation'],
      annotatedCollections: [],
    }),
    /referenceAlias target Missing is missing/,
  );

  assert.throws(
    () => compileScenarioData({ project: [
      { dataName: 'A', prereqs: [], localizationAlias: 'B' },
      { dataName: 'B', prereqs: [], localizationAlias: 'A' },
    ] }, {}, brokenEarth),
    /localizationAlias cycle/,
  );
  assert.throws(
    () => compileScenarioData({ project: [
      { dataName: 'A', prereqs: [], referenceAlias: 'Missing' },
    ] }, {}, brokenEarth),
    /referenceAlias target Missing is missing/,
  );
});

test('alternate prerequisites are OR within a positional slot and AND between slots', () => {
  const record = {
    dataName: 'AutomatedOutpostCore',
    prereqs: ['OutpostCore', 'AppliedAI'],
    altPrereq0: 'ProprietaryResearch',
    altPrereq1: 'ProprietaryResearch',
  };
  assert.deepEqual(prerequisiteSlots(record), [
    ['OutpostCore', 'ProprietaryResearch'],
    ['AppliedAI', 'ProprietaryResearch'],
  ]);

  assert.doesNotThrow(() => validatePrerequisiteReferences({
    tech: [
      { dataName: 'OutpostCore', prereqs: [] },
      { dataName: 'AppliedAI', prereqs: [] },
      { dataName: 'ProprietaryResearch', prereqs: [] },
    ],
    project: [record],
  }));
  assert.throws(
    () => validatePrerequisiteReferences({ project: [record] }),
    /Missing prerequisite OutpostCore/,
  );
});

test('empty primary values do not shift alternate slots and out-of-range alternates fail', () => {
  assert.deepEqual(prerequisiteSlots({
    dataName: 'SparseSlots',
    prereqs: ['A', '', 'C'],
    altPrereq2: 'D',
  }), [
    ['A'],
    [],
    ['C', 'D'],
  ]);
  assert.throws(() => prerequisiteSlots({
    dataName: 'OutOfRange',
    prereqs: ['A', '', 'C'],
    altPrereq3: 'D',
  }), /altPrereq3 is outside prereqs for OutOfRange/);
});
