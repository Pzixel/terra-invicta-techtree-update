import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { prepareScenarioView } = await jiti.import('../../src/data/loadScenarioView.ts');
const { Languages } = await jiti.import('../../src/language.ts');

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
