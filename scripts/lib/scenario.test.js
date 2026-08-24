import assert from 'node:assert/strict';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const {
  applyScenarioQuery,
  canonicalPathForScenario,
  canonicalUrlForScenario,
  entityDataNameFromPath,
  graphArtifactPath,
  layoutArtifactPath,
  scenarioBundlePath,
  scenarioDisplayName,
  searchWithScenario,
  scenarioFromLocation,
  Scenarios,
} = await jiti.import('../../src/scenario.ts');

test('scenario URLs normalize to the two public query values', () => {
  assert.equal(
    scenarioFromLocation('/terra-invicta-techtree-update/Project_X/', '?scenario=2003', '/terra-invicta-techtree-update/').code,
    '2003',
  );
  assert.equal(
    scenarioFromLocation('/terra-invicta-techtree-update/Project_X/', '?scenario=unknown', '/terra-invicta-techtree-update/').code,
    'standard',
  );
  const params = new URLSearchParams('lang=en&scenario=broken-earth');
  applyScenarioQuery(params, 'standard');
  assert.equal(params.toString(), 'lang=en');
  assert.equal(searchWithScenario('?lang=en&ver=stable', '2003'), '?lang=en&ver=stable&scenario=2003');
  assert.equal(searchWithScenario('?lang=en&scenario=2003&ver=stable', 'standard'), '?lang=en&ver=stable');
});

test('crawlable Dark Skies paths take precedence and are canonical targets', () => {
  const scenario = scenarioFromLocation(
    '/terra-invicta-techtree-update/dark-skies/broken-earth/',
    '?scenario=2003',
    '/terra-invicta-techtree-update/',
  );
  assert.equal(scenario.code, 'broken-earth');
  assert.equal(canonicalPathForScenario(scenario.code), 'dark-skies/broken-earth/');
  assert.equal(
    canonicalUrlForScenario(scenario.code, 'https://pzixel.github.io', '/terra-invicta-techtree-update/'),
    'https://pzixel.github.io/terra-invicta-techtree-update/dark-skies/broken-earth/',
  );
  assert.equal(
    canonicalUrlForScenario('2003', 'https://pzixel.github.io', '/terra-invicta-techtree-update'),
    'https://pzixel.github.io/terra-invicta-techtree-update/dark-skies/2003/',
  );
  assert.equal(canonicalPathForScenario('standard'), null);
});

test('route parsing distinguishes entity pages from static and malformed paths', () => {
  const basePath = '/terra-invicta-techtree-update/';
  assert.equal(entityDataNameFromPath(`${basePath}Project_X/`, basePath), 'Project_X');
  assert.equal(entityDataNameFromPath('/Project_X/', basePath), 'Project_X');
  assert.equal(entityDataNameFromPath(`${basePath}dark-skies/2003/`, basePath), null);
  assert.equal(entityDataNameFromPath(`${basePath}dark-skies/`, basePath), null);
  assert.equal(entityDataNameFromPath(`${basePath}browse/`, basePath), null);
  assert.equal(entityDataNameFromPath(`${basePath}nested/Project_X/`, basePath), null);
  assert.equal(entityDataNameFromPath(`${basePath}%E0%A4%A/`, basePath), null);
  assert.equal(entityDataNameFromPath('/Project_X/', '/'), 'Project_X');
});

test('scenario artifact paths isolate version, scenario, and language', () => {
  assert.equal(layoutArtifactPath('stable', 'standard'), 'layout/stable.standard.json');
  assert.equal(layoutArtifactPath('experimental', 'broken-earth'), 'layout/experimental.broken-earth.json');
  assert.equal(graphArtifactPath('stable', '2003', 'en'), 'graph/stable.2003.en.json');
  assert.equal(graphArtifactPath('experimental', 'broken-earth', 'ukr'), 'graph/experimental.broken-earth.ukr.json');
  assert.equal(scenarioBundlePath('stable', '2003', 'en'), 'bundles/stable/2003/en.json');
});

test('scenario selector keeps the required Standard and Dark Skies labels', () => {
  assert.equal(scenarioDisplayName(Scenarios.standard, { standard: 'Modern Scenario' }), 'Standard');
  assert.equal(
    scenarioDisplayName(Scenarios['2003'], {}, 'Dark Skies DLC'),
    '2003 Scenario — Dark Skies DLC',
  );
  assert.equal(
    scenarioDisplayName(Scenarios['broken-earth'], {}, 'Dark Skies DLC'),
    'Broken Earth Scenario — Dark Skies DLC',
  );
});
