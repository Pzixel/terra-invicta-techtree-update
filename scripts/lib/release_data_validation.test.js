import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createJiti } from 'jiti';
import {
  validateCompiledScenarioData,
  validateImportedSourceDocuments,
} from './release_data_validation.js';
import { EXPECTED_SCENARIO_COUNTS, RELEASE_SOURCE_ROOTS } from './release_metadata.js';

const jiti = createJiti(import.meta.url);
const { AppTemplateFiles } = await jiti.import('../../src/data/loadScenarioView.ts');
const { Languages } = await jiti.import('../../src/language.ts');

const writeFile = (root, relative, content) => {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
};

const records = (prefix, count) => Array.from({ length: count }, (_, index) => ({
  dataName: `${prefix}${index}`,
  prereqs: [],
  researchCost: 1,
  techCategory: 'Energy',
}));

test('release validation uses the runtime JSON5 compile and hydration boundary', async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-release-runtime-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const gamefilesRoot = path.join(root, 'public', 'gamefiles');
  const templateRoot = path.join(gamefilesRoot, 'stable', 'Templates');
  const localizationRoot = path.join(gamefilesRoot, 'stable', 'Localization', 'en');

  for (const [collection, filename] of Object.entries(AppTemplateFiles)) {
    let value = [];
    if (collection === 'tech') value = records('Tech', EXPECTED_SCENARIO_COUNTS.standard.technologies);
    if (collection === 'project') value = records('Project', EXPECTED_SCENARIO_COUNTS.standard.projects);
    if (collection === 'meta') value = [{ dataName: 'ModernScenario', scenarioTags: ['NotPostApoc'] }];
    writeFile(templateRoot, `${filename}.json`, `${JSON.stringify(value)}\n`);
  }
  // First-party scenario files may contain comments and trailing commas.
  writeFile(templateRoot, 'TIMetaTemplate.json', `[
    // public scenario metadata
    { dataName: 'ModernScenario', scenarioTags: ['NotPostApoc'], },
  ]\n`);

  for (const filename of Object.values(AppTemplateFiles)) {
    if (filename === 'TIBilateralTemplate') continue;
    let localization = '';
    if (filename === 'TITechTemplate') {
      localization = records('Tech', EXPECTED_SCENARIO_COUNTS.standard.technologies)
        .flatMap((record) => [
          `${filename}.displayName.${record.dataName}=${record.dataName}`,
          `${filename}.summary.${record.dataName}=${record.dataName} summary`,
        ])
        .join('\n');
    }
    if (filename === 'TIProjectTemplate') {
      localization = records('Project', EXPECTED_SCENARIO_COUNTS.standard.projects)
        .flatMap((record) => [
          `${filename}.displayName.${record.dataName}=${record.dataName}`,
          `${filename}.summary.${record.dataName}=${record.dataName} summary`,
        ])
        .join('\n');
    }
    writeFile(localizationRoot, `${filename}.en`, `${localization}\n`);
  }

  const metadata = { versions: { stable: { snapshotId: 'verified-fixture' } } };
  assert.deepEqual(await validateCompiledScenarioData(gamefilesRoot, metadata, {
    versions: ['stable'],
    scenarios: ['standard'],
    languages: [Languages.en],
  }), []);
});

test('release validation hydrates every configured version/scenario/language tuple', async () => {
  const languages = [
    { code: 'en', availableVersions: ['stable', 'experimental'] },
    { code: 'fr', availableVersions: ['stable', 'experimental'] },
  ];
  const loaded = [];
  const hydrated = [];
  const metadata = {
    versions: {
      stable: { snapshotId: 'same-snapshot' },
      experimental: { snapshotId: 'same-snapshot' },
    },
  };

  const failures = await validateCompiledScenarioData('/unused/public/gamefiles', metadata, {
    languages,
    scenarios: ['standard', '2003', 'broken-earth'],
    loadBundle: async (key, _readText, snapshotId) => {
      loaded.push(`${key.version}/${key.scenario}/${key.language}`);
      const expected = EXPECTED_SCENARIO_COUNTS[key.scenario];
      return {
        schemaVersion: 1,
        key,
        snapshotId,
        effectiveCounts: {
          ...expected,
          ...(key.version === 'experimental' && key.scenario === 'broken-earth' && key.language === 'fr'
            ? { projects: expected.projects + 1 }
            : {}),
        },
      };
    },
    hydrateBundle: (bundle) => {
      hydrated.push(`${bundle.key.version}/${bundle.key.scenario}/${bundle.key.language}`);
      if (bundle.key.version === 'stable' && bundle.key.scenario === '2003' && bundle.key.language === 'fr') {
        throw new Error('missing localized summary');
      }
    },
  });

  assert.equal(loaded.length, 12);
  assert.equal(hydrated.length, 11);
  assert.deepEqual(failures, [
    'stable/2003/fr: missing localized summary',
    'experimental/broken-earth/fr: compiled count is 148/715, expected 148/714',
  ]);
});

test('runtime validation refuses data not bound to a release snapshot', async () => {
  let loaded = false;
  assert.deepEqual(await validateCompiledScenarioData('/unused/public/gamefiles', {}, {
    versions: ['stable'],
    scenarios: ['standard'],
    languages: [{ code: 'en', availableVersions: ['stable'] }],
    loadBundle: async () => {
      loaded = true;
      throw new Error('must not load');
    },
  }), ['stable: verified release snapshotId is missing']);
  assert.equal(loaded, false);
});

test('source document validation accepts JSON5 and rejects corrupt or empty source roots', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-release-json5-'));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));

  for (const sourceRoot of RELEASE_SOURCE_ROOTS) {
    const relative = sourceRoot === 'dark-skies/localization'
      ? `${sourceRoot}/en/TITechTemplate.en`
      : `${sourceRoot}/Templates/source.json`;
    const content = relative.endsWith('.json') ? `[{ dataName: 'Example', },] // JSON5\n` : 'key=value\n';
    writeFile(root, relative, content);
  }
  assert.deepEqual(validateImportedSourceDocuments(root), []);

  writeFile(root, 'dark-skies/2003/Templates/source.json', '[unterminated');
  assert.match(
    validateImportedSourceDocuments(root).find((failure) => failure.startsWith('dark-skies/2003/Templates/source.json:')),
    /invalid JSON5/,
  );

  fs.rmSync(path.join(root, 'dark-skies', 'broken-earth'), { recursive: true, force: true });
  fs.mkdirSync(path.join(root, 'dark-skies', 'broken-earth'));
  assert.ok(validateImportedSourceDocuments(root).includes(
    'dark-skies/broken-earth: required source directory is empty'
  ));
});
