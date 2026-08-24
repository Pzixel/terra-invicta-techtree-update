import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const {
  hydrateScenarioBundle,
  loadScenarioBundle,
  prepareScenarioView,
} = await jiti.import('../../src/data/loadScenarioView.ts');
const { Languages } = await jiti.import('../../src/language.ts');

const sharedScenarioMetaPath =
  'gamefiles/dark-skies/localization/en/2003 Scenario/TIMetaTemplate.en';
const sharedScenarioMetaLocalization = `
TIMetaTemplate.displayName.2003Scenario=Localized 2003
TIMetaTemplate.displayName.BrokenEarthScenario=Localized Broken Earth
`;

function scenarioBundleFixtureReader(reads) {
  return async (relativePath) => {
    reads.push(relativePath);
    if (relativePath === 'gamefiles/stable/Templates/TIMetaTemplate.json') {
      return JSON.stringify([{ dataName: 'ModernScenario', scenarioTags: ['NotPostApoc'] }]);
    }
    if (relativePath === 'gamefiles/dark-skies/2003/Templates/TIMetaTemplate.json') {
      return JSON.stringify([{
        dataName: '2003Scenario',
        scenarioTags: ['2003'],
        scenarioLocalizationPostfix: '.2003',
      }]);
    }
    if (relativePath === 'gamefiles/dark-skies/broken-earth/Templates/TIMetaTemplate.json') {
      return JSON.stringify([{
        dataName: 'BrokenEarthScenario',
        scenarioTags: ['PostApoc'],
        scenarioLocalizationPostfix: '.BrokenEarth',
      }]);
    }
    if (relativePath.endsWith('.json')) return '[]';
    if (relativePath === sharedScenarioMetaPath) return sharedScenarioMetaLocalization;
    if (relativePath === 'gamefiles/stable/Localization/en/TIMetaTemplate.en') {
      return 'TIMetaTemplate.displayName.ModernScenario=Localized Standard';
    }
    if (relativePath.includes('/Localization/') || relativePath.includes('/localization/')) return '';
    throw new Error(`Unexpected fixture path: ${relativePath}`);
  };
}

test('prepared scenario view shares overlay, alias, localization, and collection semantics', () => {
  const baseCollections = {
    meta: [{ dataName: 'ModernScenario', scenarioTags: ['NotPostApoc'] }],
    tech: [
      { dataName: 'CanonicalTech', prereqs: [], researchCost: 10, techCategory: 'InformationScience' },
      { dataName: 'ModernOnly', prereqs: [], researchCost: 10, techCategory: 'InformationScience', scenarioTags: ['NotPostApoc'] },
    ],
    project: [],
    effect: [{ dataName: 'BaseEffect' }],
    nation: [],
    bilateral: [{ dataName: 'BaseRelation' }],
  };
  const overlayCollections = {
    meta: [{
      dataName: 'BrokenEarthScenario',
      scenarioTags: ['PostApoc'],
      scenarioLocalizationPostfix: '.BrokenEarth',
    }],
    tech: [{
      dataName: 'ScenarioTech',
      referenceAlias: 'CanonicalTech',
      prereqs: [],
      researchCost: 5,
      techCategory: 'InformationScience',
      effects: ['ScenarioEffect'],
      scenarioTags: ['PostApoc'],
    }],
    project: [{
      dataName: 'ScenarioProject',
      friendlyName: 'Shared project',
      prereqs: ['CanonicalTech'],
      researchCost: 5,
      techCategory: 'InformationScience',
      scenarioTags: ['PostApoc'],
    }, {
      dataName: 'ScenarioProjectCopy',
      friendlyName: 'Shared project',
      localizationAlias: 'ScenarioProject',
      prereqs: ['CanonicalTech'],
      researchCost: 5,
      techCategory: 'InformationScience',
      scenarioTags: ['PostApoc'],
    }],
    effect: [{ dataName: 'ScenarioEffect', localizationAlias: 'EffectOnlyStem' }],
    nation: [{ dataName: '1962_KRU', localizationAlias: 'KRU' }],
    objective: [{
      dataName: 'ScenarioObjective',
      localizationAlias: 'ObjectiveStem',
      scenarioTags: ['PostApoc'],
    }],
    bilateral: [{ dataName: 'ScenarioRelation' }],
  };
  const baseLocalization = `
TIMetaTemplate.displayName.BrokenEarthScenario=Broken Earth Localized
TITechTemplate.displayName.CanonicalTech=Canonical
TITechTemplate.summary.CanonicalTech=Canonical summary
TINationTemplate.displayName.1962_KRU=Wrong base direct
TIEffectTemplate.description.ScenarioEffect=Wrong base direct
TIObjectiveTemplate.displayName.ObjectiveStem.ResistCouncil=Faction-qualified objective
`;
  const scenarioLocalization = `
TITechTemplate.displayName.ScenarioTech.BrokenEarth=Scenario tech
TITechTemplate.summary.ScenarioTech.BrokenEarth=Scenario tech summary
TIProjectTemplate.displayName.ScenarioProject.BrokenEarth=Scenario project
TIProjectTemplate.summary.ScenarioProject.BrokenEarth=Scenario project summary
TIEffectTemplate.description.EffectOnlyStem=Scenario effect description
TINationTemplate.displayName.KRU=Kru
`;
  const localizationLayers = [
    { files: [baseLocalization], postfix: '' },
    { files: [scenarioLocalization], postfix: '.BrokenEarth' },
  ];

  const view = prepareScenarioView(
    { version: 'stable', scenario: 'broken-earth', language: 'en' },
    Languages.en,
    { baseCollections, overlayCollections, localizationLayers },
  );

  assert.deepEqual(view.scenarioLabels, {
    standard: 'Standard',
    '2003': '2003 Scenario',
    'broken-earth': 'Broken Earth Localized',
  });
  assert.equal(view.scenarioName, 'Broken Earth Localized');
  assert.equal(view.techDb.getTechByDataName('CanonicalTech')?.dataName, 'ScenarioTech');
  assert.equal(view.techDb.getTechByDataName('ScenarioProject')?.dlcOnly, true);
  assert.equal(
    view.techDb.getTechByDataName('ScenarioProject')?.displayName,
    'Scenario project (ScenarioProject)',
  );
  assert.equal(
    view.techDb.getTechByDataName('ScenarioProjectCopy')?.displayName,
    'Scenario project (ScenarioProjectCopy)',
  );
  assert.equal(view.techDb.getTechByDataName('ModernOnly'), undefined);
  assert.deepEqual(view.appStaticData.templateData.bilateral, [{ dataName: 'ScenarioRelation' }]);
  assert.equal(
    view.appStaticData.localizationDb.getLocalizationString('nation', '1962_KRU', 'displayName'),
    'Kru',
  );
  assert.equal(
    view.appStaticData.localizationDb.getLocalizationString('effect', 'ScenarioEffect', 'description'),
    'Scenario effect description',
  );
});

test('every generated scenario bundle resolves and includes all scenario labels exactly once', async () => {
  const expectedLabels = {
    standard: 'Localized Standard',
    '2003': 'Localized 2003',
    'broken-earth': 'Localized Broken Earth',
  };

  for (const scenario of ['standard', '2003', 'broken-earth']) {
    const reads = [];
    const bundle = await loadScenarioBundle(
      { version: 'stable', scenario, language: 'en' },
      scenarioBundleFixtureReader(reads),
      'fixture-snapshot',
    );
    const view = hydrateScenarioBundle(bundle, Languages.en);

    assert.equal(bundle.schemaVersion, 1);
    assert.deepEqual(view.scenarioLabels, expectedLabels);
    assert.equal(view.scenarioName, expectedLabels[scenario]);
    assert.equal(reads.filter((path) => path === sharedScenarioMetaPath).length, 1);
    assert.equal(
      bundle.localizationLayers
        .flatMap((layer) => layer.files)
        .filter((content) => content === sharedScenarioMetaLocalization)
        .length,
      1,
    );
  }
});
