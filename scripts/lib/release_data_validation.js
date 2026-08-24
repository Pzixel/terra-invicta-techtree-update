import fs from 'node:fs';
import path from 'node:path';
import JSON5 from 'json5';
import { createJiti } from 'jiti';
import {
  EXPECTED_SCENARIO_COUNTS,
  RELEASE_SOURCE_ROOTS,
} from './release_metadata.js';

const jiti = createJiti(import.meta.url);
const {
  hydrateScenarioBundle,
  loadScenarioBundle,
} = await jiti.import('../../src/data/loadScenarioView.ts');
const { Languages } = await jiti.import('../../src/language.ts');
const { OrderedScenarios } = await jiti.import('../../src/scenario.ts');

const REQUIRED_VERSIONS = Object.freeze(['stable', 'experimental']);

const errorMessage = (error) => error instanceof Error ? error.message : String(error);

function walkSourceFiles(gamefilesRoot, relativeRoot, failures) {
  const absoluteRoot = path.join(gamefilesRoot, relativeRoot);
  if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
    failures.push(`${relativeRoot}: required source directory is missing`);
    return [];
  }

  const files = [];
  const walk = (absoluteDirectory, relativeDirectory) => {
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const absolute = path.join(absoluteDirectory, entry.name);
      const relative = path.posix.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute, relative);
      } else if (entry.isFile()) {
        files.push({ absolute, relative });
      }
    }
  };
  walk(absoluteRoot, relativeRoot);
  if (files.length === 0) failures.push(`${relativeRoot}: required source directory is empty`);
  return files;
}

/**
 * Checks every imported JSON document without imposing record semantics on
 * collections the application does not consume. The game ships JSON5 syntax
 * in some scenario templates, so strict JSON.parse is intentionally not used.
 */
export function validateImportedSourceDocuments(gamefilesRoot) {
  const failures = [];
  for (const relativeRoot of RELEASE_SOURCE_ROOTS) {
    for (const source of walkSourceFiles(gamefilesRoot, relativeRoot, failures)) {
      if (path.extname(source.relative).toLowerCase() !== '.json') continue;
      try {
        JSON5.parse(fs.readFileSync(source.absolute, 'utf8'));
      } catch (error) {
        failures.push(`${source.relative}: invalid JSON5 (${errorMessage(error)})`);
      }
    }
  }
  return failures;
}

function normalizeScenarios(scenarios) {
  return scenarios.map((scenario) => typeof scenario === 'string' ? { code: scenario } : scenario);
}

/**
 * Validates the exact boundary used by generated runtime bundles. Counts,
 * overlays, aliases, scenario eligibility, prerequisite references, and
 * localization hydration therefore cannot drift into a second validator.
 */
export async function validateCompiledScenarioData(gamefilesRoot, metadata = {}, options = {}) {
  const failures = [];
  const publicRoot = path.dirname(gamefilesRoot);
  const versions = options.versions ?? REQUIRED_VERSIONS;
  const scenarios = normalizeScenarios(options.scenarios ?? OrderedScenarios);
  const languages = options.languages ?? Object.values(Languages);
  const loadBundle = options.loadBundle ?? loadScenarioBundle;
  const hydrateBundle = options.hydrateBundle ?? hydrateScenarioBundle;
  const onBundle = options.onBundle;
  const readText = options.readText ?? (async (relativePath) => {
    const absolute = path.resolve(publicRoot, relativePath);
    const relative = path.relative(publicRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Source path escapes public directory: ${relativePath}`);
    }
    return fs.readFileSync(absolute, 'utf8');
  });

  for (const version of versions) {
    const snapshotId = metadata.versions?.[version]?.snapshotId;
    if (typeof snapshotId !== 'string' || snapshotId.length === 0) {
      failures.push(`${version}: verified release snapshotId is missing`);
      continue;
    }
    for (const scenario of scenarios) {
      const expected = EXPECTED_SCENARIO_COUNTS[scenario.code];
      if (!expected) {
        failures.push(`${scenario.code}: expected scenario counts are not configured`);
        continue;
      }
      for (const language of languages) {
        if (!language.availableVersions?.includes(version)) continue;
        const key = { version, scenario: scenario.code, language: language.code };
        const label = `${version}/${scenario.code}/${language.code}`;
        try {
          const bundle = await loadBundle(key, readText, snapshotId);
          if (bundle.schemaVersion !== 1) {
            throw new Error(`bundle schema is ${bundle.schemaVersion}, expected 1`);
          }
          if (bundle.key?.version !== version || bundle.key?.scenario !== scenario.code ||
              bundle.key?.language !== language.code) {
            throw new Error('bundle key does not match the requested version/scenario/language');
          }
          if (bundle.snapshotId !== snapshotId) {
            throw new Error(`bundle snapshot ${bundle.snapshotId} does not match release snapshot ${snapshotId}`);
          }
          const actual = bundle.effectiveCounts ?? {};
          if (actual.technologies !== expected.technologies || actual.projects !== expected.projects) {
            throw new Error(
              `compiled count is ${actual.technologies ?? 'missing'}/${actual.projects ?? 'missing'}, ` +
              `expected ${expected.technologies}/${expected.projects}`
            );
          }

          // Hydration is part of the production boundary. It proves aliases and
          // mandatory DLC localization resolve in this exact language tuple.
          const view = hydrateBundle(bundle, language);
          if (onBundle) await onBundle(bundle, language, view);
        } catch (error) {
          failures.push(`${label}: ${errorMessage(error)}`);
        }
      }
    }
  }
  return failures;
}
