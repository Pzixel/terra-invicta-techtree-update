import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  EXPECTED_STEAM_RELEASE,
  assertReleaseReady,
  releaseSnapshotId,
  validateReleaseMetadata,
  validateSourceHashes,
} from './release_metadata.js';

const snapshotId = releaseSnapshotId(EXPECTED_STEAM_RELEASE);

const verifiedFixture = () => ({
  schemaVersion: 1,
  status: 'verified',
  marketingVersion: '1.0',
  verifiedAt: '2026-08-24T00:00:00.000Z',
  steam: {
    ...EXPECTED_STEAM_RELEASE,
    windowsDepot: { ...EXPECTED_STEAM_RELEASE.windowsDepot },
    darkSkiesDepot: { ...EXPECTED_STEAM_RELEASE.darkSkiesDepot },
    platform: 'windows',
    downloadMethod: 'SteamCMD download_depot',
  },
  provenance: {
    source: 'SteamCMD console_log.txt',
    consoleLogSha256: 'b'.repeat(64),
    appInfoBuildId: EXPECTED_STEAM_RELEASE.buildId,
    authentication: 'Steam account session',
    authenticatedSessionStartedAt: '2026-08-24 10:46:05',
    depotDownloads: [
      {
        ...EXPECTED_STEAM_RELEASE.windowsDepot,
        fileCount: 10,
        fileCountSource: 'filesystem enumeration',
        contentPath: 'steamapps/content/app_1176470/depot_1176471',
      },
      {
        ...EXPECTED_STEAM_RELEASE.darkSkiesDepot,
        fileCount: 10,
        fileCountSource: 'filesystem enumeration',
        contentPath: 'steamapps/content/app_1176470/depot_4713340',
      },
    ],
  },
  sourceHashes: [{ path: 'base/Templates/TITechTemplate.json', sha256: 'a'.repeat(64) }],
  scenarios: {
    standard: { available: true, technologies: 149, projects: 718 },
    '2003': { available: true, technologies: 152, projects: 748 },
    'broken-earth': { available: true, technologies: 148, projects: 714 },
  },
  versions: {
    stable: { snapshotId },
    experimental: { snapshotId },
  },
});

test('release gate accepts only the required same-build scenario contract', () => {
  assert.doesNotThrow(() => assertReleaseReady(verifiedFixture()));

  const wrong = verifiedFixture();
  wrong.scenarios['broken-earth'].projects = 734;
  wrong.versions.experimental.snapshotId = 'anything';
  assert.deepEqual(validateReleaseMetadata(wrong).filter((failure) =>
    failure.includes('broken-earth') || failure.includes('snapshotId') || failure.includes('same verified snapshot')
  ), [
    'broken-earth effective count must be 148/714',
    'experimental snapshotId is not bound to the Steam manifests',
    'stable and experimental must resolve to the same verified snapshot',
  ]);

  const fabricated = verifiedFixture();
  fabricated.steam.buildId = 1;
  fabricated.steam.windowsDepot.manifestId = '1';
  fabricated.steam.darkSkiesDepot.manifestId = '1';
  fabricated.versions.stable.snapshotId = releaseSnapshotId(fabricated.steam);
  fabricated.versions.experimental.snapshotId = releaseSnapshotId(fabricated.steam);
  assert.deepEqual(validateReleaseMetadata(fabricated).filter((failure) =>
    failure.includes('buildId') || failure.includes('manifestId')
  ), [
    'Steam buildId must be 24479907',
    'Windows manifestId must be 3504609025059582964',
    'Dark Skies manifestId must be 1117456866270863502',
  ]);

  const unproven = verifiedFixture();
  unproven.verifiedAt = 'not-an-instant';
  unproven.steam.platform = 'macos';
  unproven.steam.downloadMethod = 'copied files';
  unproven.provenance.authentication = 'anonymous';
  unproven.provenance.authenticatedSessionStartedAt = 'not-a-timestamp';
  unproven.provenance.depotDownloads[1].manifestId = '1';
  assert.deepEqual(validateReleaseMetadata(unproven).filter((failure) =>
    failure.includes('verifiedAt') || failure.includes('platform') ||
    failure.includes('downloadMethod') || failure.includes('authentication') ||
    failure.includes('authenticatedSessionStartedAt') ||
    failure.includes('provenance depot 4713340 manifestId')
  ), [
    'verifiedAt must be an ISO date',
    'Steam source platform must be windows',
    'Steam downloadMethod must be SteamCMD download_depot',
    'provenance authentication must be a Steam account session',
    'provenance authenticatedSessionStartedAt must be a SteamCMD timestamp',
    'provenance depot 4713340 manifestId must be 1117456866270863502',
  ]);
});

test('release source hashes detect missing or changed imported bytes', (context) => {
  const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-release-hashes-'));
  context.after(() => fs.rmSync(sourceRoot, { recursive: true, force: true }));
  const files = {
    'dark-skies/2003/source.json': '{"scenario":"2003"}\n',
    'dark-skies/broken-earth/source.json': '{"scenario":"broken-earth"}\n',
    'dark-skies/localization/en.txt': 'localized\n',
    'experimental/source.json': '{"build":24479907}\n',
    'stable/source.json': '{"build":24479907}\n',
  };
  for (const [relative, content] of Object.entries(files)) {
    const absolute = path.join(sourceRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
  }
  const metadata = verifiedFixture();
  metadata.sourceHashes = Object.keys(files).sort().map((relative) => ({
    path: relative,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceRoot, relative))).digest('hex'),
  }));
  assert.deepEqual(validateSourceHashes(metadata, sourceRoot), []);

  fs.appendFileSync(path.join(sourceRoot, 'stable/source.json'), 'changed');
  assert.deepEqual(validateSourceHashes(metadata, sourceRoot), [
    'stable/source.json: SHA-256 does not match release metadata',
  ]);

  metadata.sourceHashes = metadata.sourceHashes.filter((source) => source.path !== 'dark-skies/2003/source.json');
  assert.ok(validateSourceHashes(metadata, sourceRoot).includes(
    'dark-skies/2003/source.json: source hash is missing from release metadata'
  ));
});
