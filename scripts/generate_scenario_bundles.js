#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import { EXPECTED_SCENARIO_COUNTS, assertReleaseReady } from './lib/release_metadata.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const GAMEFILES = path.join(PUBLIC, 'gamefiles');
const OUT = path.join(PUBLIC, 'bundles');
const release = JSON.parse(fs.readFileSync(path.join(GAMEFILES, 'release.json'), 'utf8'));
assertReleaseReady(release);

const jiti = createJiti(import.meta.url);
const { loadScenarioBundle } = await jiti.import('../src/data/loadScenarioView.ts');
const { Languages } = await jiti.import('../src/language.ts');
const { OrderedScenarios } = await jiti.import('../src/scenario.ts');

const readText = async (relativePath) => fs.readFileSync(path.join(PUBLIC, relativePath), 'utf8');
fs.rmSync(OUT, { recursive: true, force: true });

let generated = 0;
for (const version of ['stable', 'experimental']) {
  const snapshotId = release.versions[version].snapshotId;
  for (const scenario of OrderedScenarios) {
    const expected = EXPECTED_SCENARIO_COUNTS[scenario.code];
    for (const language of Object.values(Languages)) {
      if (!language.availableVersions.includes(version)) continue;
      const key = { version, scenario: scenario.code, language: language.code };
      const bundle = await loadScenarioBundle(key, readText, snapshotId);
      if (bundle.effectiveCounts.technologies !== expected.technologies ||
          bundle.effectiveCounts.projects !== expected.projects) {
        throw new Error(
          `${version}/${scenario.code}/${language.code} count is ` +
          `${bundle.effectiveCounts.technologies}/${bundle.effectiveCounts.projects}, ` +
          `expected ${expected.technologies}/${expected.projects}`
        );
      }
      const directory = path.join(OUT, version, scenario.code);
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, `${language.code}.json`), JSON.stringify(bundle));
      generated += 1;
    }
  }
}

console.log(`Generated ${generated} verified version/scenario/language bundles`);
