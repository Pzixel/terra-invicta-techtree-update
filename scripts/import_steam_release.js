#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';
import { createJiti } from 'jiti';
import {
  EXPECTED_SCENARIO_COUNTS,
  EXPECTED_STEAM_RELEASE,
  RELEASE_SOURCE_ROOTS,
  releaseSnapshotId,
  validateReleaseMetadata,
  validateSourceHashes,
} from './lib/release_metadata.js';
import { createRenderedIconGate } from './lib/rendered_icon_validation.js';
import {
  completedAuthenticatedDepotSession,
  hasPinnedAppInfo,
} from './lib/steamcmd_provenance.js';
import {
  acquireProcessLock,
  recoverStagedDirectorySwap,
  replaceDirectoryWithRecovery,
} from './lib/staged_directory_swap.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const LIVE_GAMEFILES = path.join(PUBLIC, 'gamefiles');
const [steamcmdRootArgument] = process.argv.slice(2);

if (!steamcmdRootArgument) {
  throw new Error('Usage: node scripts/import_steam_release.js <authenticated-steamcmd-root>');
}

const steamcmdRoot = fs.realpathSync(path.resolve(steamcmdRootArgument));
if (!fs.statSync(steamcmdRoot).isDirectory() || !fs.existsSync(path.join(steamcmdRoot, 'steamcmd.sh'))) {
  throw new Error('Expected the SteamCMD installation root');
}

const depotRoot = (depotId) => {
  const expected = path.join(
    steamcmdRoot,
    'steamapps',
    'content',
    `app_${EXPECTED_STEAM_RELEASE.appId}`,
    `depot_${depotId}`,
  );
  if (!fs.existsSync(expected) || !fs.statSync(expected).isDirectory()) {
    throw new Error(`Expected the completed SteamCMD depot_${depotId} directory`);
  }
  return fs.realpathSync(expected);
};

const baseDepot = depotRoot(EXPECTED_STEAM_RELEASE.windowsDepot.depotId);
const darkSkiesDepot = depotRoot(EXPECTED_STEAM_RELEASE.darkSkiesDepot.depotId);

const requireUniqueRoot = (label, candidates, requiredChildren) => {
  const matches = candidates.filter((candidate) =>
    fs.existsSync(candidate) && requiredChildren.every((child) => fs.existsSync(path.join(candidate, child)))
  );
  if (matches.length !== 1) {
    throw new Error(`${label} source root is ${matches.length === 0 ? 'missing' : 'ambiguous'}`);
  }
  return matches[0];
};

const baseStreamingAssets = requireUniqueRoot('Windows StreamingAssets', [
  path.join(baseDepot, 'TerraInvicta_Data', 'StreamingAssets'),
  path.join(baseDepot, 'StreamingAssets'),
], ['Templates', 'Localization']);

const darkSkiesRoot = requireUniqueRoot('Dark Skies', [
  path.join(darkSkiesDepot, 'DLC_Content', 'DarkSkies'),
  path.join(darkSkiesDepot, 'DarkSkies'),
], ['2003_Scenario/Templates', 'Broken_Earth_Scenario/Templates', 'Localization']);

const copyDirectory = (source, destination) => {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: false, errorOnExist: true });
};

const walkFiles = (root, relative = '') => {
  const files = [];
  const directory = path.join(root, relative);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${child}: source symlinks are not allowed`);
    if (entry.isDirectory()) files.push(...walkFiles(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
};

const sourceHashes = (gamefilesRoot) => RELEASE_SOURCE_ROOTS
  .flatMap((sourceRoot) => walkFiles(gamefilesRoot, sourceRoot))
  .sort()
  .map((relative) => ({
    path: relative,
    sha256: crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(gamefilesRoot, relative)))
      .digest('hex'),
  }));

const consoleLogFile = path.join(steamcmdRoot, 'logs', 'console_log.txt');
if (!fs.existsSync(consoleLogFile) || !fs.statSync(consoleLogFile).isFile()) {
  throw new Error('SteamCMD console log is missing; exact-manifest provenance cannot be verified');
}
const consoleLog = fs.readFileSync(consoleLogFile, 'utf8');

if (!hasPinnedAppInfo(consoleLog, EXPECTED_STEAM_RELEASE)) {
  throw new Error('SteamCMD app-info evidence does not match the pinned public build and manifests');
}

const authenticatedSession = completedAuthenticatedDepotSession(consoleLog, [
  EXPECTED_STEAM_RELEASE.windowsDepot,
  EXPECTED_STEAM_RELEASE.darkSkiesDepot,
]);
if (!authenticatedSession) {
  throw new Error('Both pinned depots must complete inside one successful authenticated Steam account session');
}

const completedDepot = (depot, expectedRoot) => {
  const actualFileCount = walkFiles(expectedRoot).length;
  const completion = authenticatedSession.completions.find((entry) => entry.depotId === depot.depotId);
  if (completion) {
    const loggedPath = path.resolve(completion.contentPath.replace(/\\/g, path.sep));
    if (fs.existsSync(loggedPath) && fs.realpathSync(loggedPath) === expectedRoot &&
        (completion.fileCount === null || completion.fileCount === actualFileCount)) {
      return {
        depotId: depot.depotId,
        manifestId: depot.manifestId,
        fileCount: actualFileCount,
        fileCountSource: 'filesystem enumeration',
        contentPath: path.posix.join(
          'steamapps', 'content', `app_${EXPECTED_STEAM_RELEASE.appId}`, `depot_${depot.depotId}`,
        ),
      };
    }
  }
  throw new Error(`SteamCMD completion evidence is missing for depot ${depot.depotId} manifest ${depot.manifestId}`);
};

const depotDownloads = [
  completedDepot(EXPECTED_STEAM_RELEASE.windowsDepot, baseDepot),
  completedDepot(EXPECTED_STEAM_RELEASE.darkSkiesDepot, darkSkiesDepot),
];
const provenance = {
  source: 'SteamCMD console_log.txt',
  consoleLogSha256: crypto.createHash('sha256').update(consoleLog).digest('hex'),
  appInfoBuildId: EXPECTED_STEAM_RELEASE.buildId,
  authentication: 'Steam account session',
  authenticatedSessionStartedAt: authenticatedSession.startedAt,
  depotDownloads,
};

const importLockPath = path.join(PUBLIC, '.gamefiles-import.lock');
const swapBackup = path.join(PUBLIC, '.gamefiles-previous');
const swapMarker = path.join(PUBLIC, '.gamefiles-swap.json');
const releaseImportLock = acquireProcessLock(importLockPath);
let stage = null;
let stageIsLive = false;

try {
  const recovery = recoverStagedDirectorySwap({
    live: LIVE_GAMEFILES,
    backup: swapBackup,
    marker: swapMarker,
  });
  if (recovery.recovered) {
    console.warn(`Recovered interrupted gamefiles swap: ${recovery.action}`);
  }
  stage = fs.mkdtempSync(path.join(PUBLIC, '.gamefiles-import-'));
  for (const version of ['stable', 'experimental']) {
    copyDirectory(path.join(baseStreamingAssets, 'Templates'), path.join(stage, version, 'Templates'));
    copyDirectory(path.join(baseStreamingAssets, 'Localization'), path.join(stage, version, 'Localization'));
  }
  copyDirectory(
    path.join(darkSkiesRoot, '2003_Scenario', 'Templates'),
    path.join(stage, 'dark-skies', '2003', 'Templates'),
  );
  copyDirectory(
    path.join(darkSkiesRoot, 'Broken_Earth_Scenario', 'Templates'),
    path.join(stage, 'dark-skies', 'broken-earth', 'Templates'),
  );
  copyDirectory(
    path.join(darkSkiesRoot, 'Localization'),
    path.join(stage, 'dark-skies', 'localization'),
  );

  for (const relative of walkFiles(stage).filter((file) => file.endsWith('.json'))) {
    try {
      JSON5.parse(fs.readFileSync(path.join(stage, relative), 'utf8'));
    } catch (error) {
      throw new Error(`${relative}: invalid JSON/JSON5 (${error instanceof Error ? error.message : error})`);
    }
  }

  const jiti = createJiti(import.meta.url);
  const { hydrateScenarioBundle, loadScenarioBundle } = await jiti.import('../src/data/loadScenarioView.ts');
  const { Languages } = await jiti.import('../src/language.ts');
  const { OrderedScenarios } = await jiti.import('../src/scenario.ts');
  const snapshotId = releaseSnapshotId(EXPECTED_STEAM_RELEASE);
  const readText = async (relative) => fs.readFileSync(path.join(stage, relative.replace(/^gamefiles\//, '')), 'utf8');
  const iconGate = createRenderedIconGate(path.join(PUBLIC, 'icons'));
  let validatedTuples = 0;

  for (const version of ['stable', 'experimental']) {
    for (const scenario of OrderedScenarios) {
      for (const language of Object.values(Languages)) {
        if (!language.availableVersions.includes(version)) continue;
        const key = { version, scenario: scenario.code, language: language.code };
        const tuple = `${version}/${scenario.code}/${language.code}`;
        let bundle;
        try {
          bundle = await loadScenarioBundle(key, readText, snapshotId);
        } catch (error) {
          throw new Error(`${tuple}: ${error instanceof Error ? error.message : error}`, { cause: error });
        }
        const expected = EXPECTED_SCENARIO_COUNTS[scenario.code];
        if (bundle.effectiveCounts.technologies !== expected.technologies ||
            bundle.effectiveCounts.projects !== expected.projects) {
          throw new Error(
            `${tuple} compiled count is ` +
            `${bundle.effectiveCounts.technologies}/${bundle.effectiveCounts.projects}, ` +
            `expected ${expected.technologies}/${expected.projects}`
          );
        }
        let view;
        try {
          view = hydrateScenarioBundle(bundle, language);
        } catch (error) {
          throw new Error(`${tuple}: ${error instanceof Error ? error.message : error}`, { cause: error });
        }
        iconGate.validate(bundle, view);
        validatedTuples += 1;
      }
    }
  }
  const iconFailures = iconGate.failures();
  if (iconFailures.length > 0) {
    throw new Error(`Staged release rendered icons are invalid:\n- ${iconFailures.join('\n- ')}`);
  }

  const metadata = {
    schemaVersion: 1,
    status: 'verified',
    marketingVersion: '1.0',
    verifiedAt: new Date().toISOString(),
    steam: {
      ...EXPECTED_STEAM_RELEASE,
      platform: 'windows',
      downloadMethod: 'SteamCMD download_depot',
    },
    provenance,
    sourceHashes: sourceHashes(stage),
    scenarios: Object.fromEntries(Object.entries(EXPECTED_SCENARIO_COUNTS).map(([scenario, counts]) => [
      scenario,
      { available: true, ...counts },
    ])),
    versions: {
      stable: { snapshotId },
      experimental: { snapshotId },
    },
  };
  const metadataFailures = validateReleaseMetadata(metadata);
  if (metadataFailures.length > 0) {
    throw new Error(`Generated release metadata is invalid:\n- ${metadataFailures.join('\n- ')}`);
  }
  const hashFailures = validateSourceHashes(metadata, stage);
  if (hashFailures.length > 0) {
    throw new Error(`Staged release hashes are invalid:\n- ${hashFailures.join('\n- ')}`);
  }
  fs.writeFileSync(path.join(stage, 'release.json'), `${JSON.stringify(metadata, null, 2)}${os.EOL}`);

  replaceDirectoryWithRecovery({
    live: LIVE_GAMEFILES,
    stage,
    backup: swapBackup,
    marker: swapMarker,
  });
  stageIsLive = true;
  console.log(
    `Imported verified Steam build ${EXPECTED_STEAM_RELEASE.buildId}: ` +
    `${metadata.sourceHashes.length} hashed source files, ${validatedTuples} validated runtime tuples`
  );
} finally {
  if (!stageIsLive && stage && fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  releaseImportLock();
}
