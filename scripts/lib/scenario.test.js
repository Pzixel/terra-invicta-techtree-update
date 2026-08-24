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
  markScenarioMenuDiscovered,
  scenarioBundlePath,
  scenarioBadgeColor,
  compactScenarioLabel,
  scenarioDisplayName,
  scenarioMarkerColor,
  scenarioMarkerPresentation,
  scenarioMenuNeedsDiscovery,
  scenarioStatusText,
  selectScenarioLoadErrorTemplate,
  searchWithScenario,
  scenarioFromLocation,
  Scenarios,
} = await jiti.import('../../src/scenario.ts');
const { Languages } = await jiti.import('../../src/language.ts');

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
  assert.equal(
    searchWithScenario('?lang=en&ver=stable', 'broken-earth'),
    '?lang=en&ver=stable&scenario=broken-earth',
  );
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
  assert.equal(scenarioDisplayName(Scenarios.standard, { standard: 'Standard' }), 'Standard');
  assert.equal(scenarioDisplayName(Scenarios.standard, { standard: 'Localized Standard' }), 'Localized Standard');
  assert.equal(
    scenarioDisplayName(Scenarios['2003'], {}, 'Dark Skies DLC'),
    '2003 Scenario — Dark Skies DLC',
  );
  assert.equal(
    scenarioDisplayName(Scenarios['broken-earth'], {}, 'Dark Skies DLC'),
    'Broken Earth Scenario — Dark Skies DLC',
  );
});

test('scenario labels compact for quiet status and contextual markers', () => {
  assert.equal(compactScenarioLabel(Scenarios.standard, 'Standard', 'Scenario'), 'Standard');
  assert.equal(compactScenarioLabel(Scenarios['2003'], '2003 Scenario', 'Scenario'), '2003');
  assert.equal(compactScenarioLabel(Scenarios['broken-earth'], 'Broken Earth Scenario', 'Scenario'), 'Broken Earth');
  assert.equal(compactScenarioLabel(Scenarios['2003'], '2003-Szenario', 'Szenario'), '2003');
  assert.equal(compactScenarioLabel(Scenarios['broken-earth'], 'シナリオ：崩壊した地球', 'シナリオ'), '崩壊した地球');
  assert.equal(compactScenarioLabel(Scenarios['broken-earth'], '瘡痍大地情境', '情境'), '瘡痍大地');
});

test('every UI language has localized scenario fallbacks for initial loads and failures', () => {
  for (const language of Object.values(Languages)) {
    const { uiTexts } = language;
    assert.ok(uiTexts.scenario2003Fallback);
    assert.ok(uiTexts.scenarioBrokenEarthFallback);
    assert.ok(uiTexts.scenarioSettingsDiscovery);
    assert.ok(uiTexts.settingsCurrentScenario.includes('{scenario}'));
    assert.ok(compactScenarioLabel(
      Scenarios['2003'],
      uiTexts.scenario2003Fallback,
      uiTexts.scenarioLabel,
    ));
    assert.ok(compactScenarioLabel(
      Scenarios['broken-earth'],
      uiTexts.scenarioBrokenEarthFallback,
      uiTexts.scenarioLabel,
    ));
  }
});

test('scenario status distinguishes initial, switching, and settled views', () => {
  const templates = {
    tree: 'Scenario: {scenario}',
    viewingLoading: 'Viewing {active} · Loading {target}…',
    loading: 'Loading {target}…',
  };
  assert.equal(scenarioStatusText({
    activeScenario: null,
    targetScenario: '2003',
    activeLabel: null,
    targetLabel: '2003 — Dark Skies',
    loading: true,
    templates,
  }), 'Loading 2003 — Dark Skies…');
  assert.equal(scenarioStatusText({
    activeScenario: 'standard',
    targetScenario: 'broken-earth',
    activeLabel: 'Standard',
    targetLabel: 'Broken Earth — Dark Skies',
    loading: true,
    templates,
  }), 'Viewing Standard · Loading Broken Earth — Dark Skies…');
  assert.equal(scenarioStatusText({
    activeScenario: 'standard',
    targetScenario: 'standard',
    activeLabel: 'Standard',
    targetLabel: 'Standard',
    loading: true,
    templates,
  }), 'Scenario: Standard');
  assert.equal(scenarioStatusText({
    activeScenario: null,
    targetScenario: 'standard',
    activeLabel: null,
    targetLabel: 'Standard',
    loading: false,
    templates,
  }), '');
});

test('scenario marker presentation fixes chip and graph semantics', () => {
  assert.deepEqual(scenarioMarkerPresentation({ dlcOnly: true }), {
    kind: 'addition',
    chipVariant: 'filled',
    graphDiamond: true,
  });
  assert.deepEqual(scenarioMarkerPresentation({ scenarioVariant: true }), {
    kind: 'variant',
    chipVariant: 'outlined',
    graphDiamond: false,
  });
  assert.equal(scenarioMarkerPresentation({}), null);
  assert.deepEqual(scenarioMarkerPresentation({ dlcOnly: true, scenarioVariant: true }), {
    kind: 'addition',
    chipVariant: 'filled',
    graphDiamond: true,
  });
});

test('scenario badges use stable colours and marker-specific variants', () => {
  assert.equal(scenarioBadgeColor('standard'), 'info');
  assert.equal(scenarioBadgeColor('2003'), 'secondary');
  assert.equal(scenarioBadgeColor('broken-earth'), 'warning');
  assert.equal(scenarioMarkerColor('addition', 'broken-earth'), 'secondary');
  assert.equal(scenarioMarkerColor('variant', '2003'), 'secondary');
  assert.equal(scenarioMarkerColor('variant', 'broken-earth'), 'warning');
});

test('scenario menu discovery persists and fails open when storage is unavailable', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(scenarioMenuNeedsDiscovery(storage), true);
  markScenarioMenuDiscovered(storage);
  assert.equal(scenarioMenuNeedsDiscovery(storage), false);
  assert.equal(scenarioMenuNeedsDiscovery(null), true);
  assert.equal(scenarioMenuNeedsDiscovery({ getItem: () => { throw new Error('blocked'); } }), true);
  assert.doesNotThrow(() => markScenarioMenuDiscovered({ setItem: () => { throw new Error('blocked'); } }));
});

test('scenario load errors distinguish rollback from initial failure', () => {
  const templates = {
    scenarioLoadError: 'previous-view error',
    scenarioInitialLoadError: 'initial-load error',
  };
  assert.equal(selectScenarioLoadErrorTemplate(true, templates), templates.scenarioLoadError);
  assert.equal(selectScenarioLoadErrorTemplate(false, templates), templates.scenarioInitialLoadError);
});
