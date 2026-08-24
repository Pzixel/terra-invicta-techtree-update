import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const EXPECTED_SCENARIO_COUNTS = Object.freeze({
  standard: Object.freeze({ technologies: 149, projects: 718 }),
  '2003': Object.freeze({ technologies: 152, projects: 748 }),
  'broken-earth': Object.freeze({ technologies: 148, projects: 714 }),
});

export const EXPECTED_STEAM_RELEASE = Object.freeze({
  appId: 1176470,
  branch: 'public',
  buildId: 24479907,
  windowsDepot: Object.freeze({ depotId: 1176471, manifestId: '3504609025059582964' }),
  darkSkiesDepot: Object.freeze({ depotId: 4713340, manifestId: '1117456866270863502' }),
});

export const RELEASE_SOURCE_ROOTS = Object.freeze([
  'stable',
  'experimental',
  'dark-skies/2003',
  'dark-skies/broken-earth',
  'dark-skies/localization',
]);

const SHA256 = /^[a-f0-9]{64}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const REQUIRED_VERSIONS = ['stable', 'experimental'];

export const releaseSnapshotId = (steam) => [
  'steam',
  steam.appId,
  steam.branch,
  `build-${steam.buildId}`,
  `base-${steam.windowsDepot?.manifestId}`,
  `dark-skies-${steam.darkSkiesDepot?.manifestId}`,
].join('-');

export function validateReleaseMetadata(metadata) {
  const failures = [];
  if (!metadata || typeof metadata !== 'object') return ['release metadata must be an object'];
  if (metadata.schemaVersion !== 1) failures.push('schemaVersion must be 1');
  if (metadata.status !== 'verified') {
    const blocker = typeof metadata.blocker === 'string' && metadata.blocker ? `: ${metadata.blocker}` : '';
    failures.push(`release status is ${metadata.status ?? 'missing'}, not verified${blocker}`);
    return failures;
  }
  if (metadata.marketingVersion !== '1.0') failures.push('marketingVersion must be 1.0');
  if (typeof metadata.verifiedAt !== 'string' || !ISO_INSTANT.test(metadata.verifiedAt) ||
      !Number.isFinite(Date.parse(metadata.verifiedAt))) {
    failures.push('verifiedAt must be an ISO date');
  }

  const steam = metadata.steam ?? {};
  if (String(steam.appId) !== String(EXPECTED_STEAM_RELEASE.appId)) failures.push('Steam appId must be 1176470');
  if (steam.branch !== EXPECTED_STEAM_RELEASE.branch) failures.push('Steam branch must be public');
  if (String(steam.buildId) !== String(EXPECTED_STEAM_RELEASE.buildId)) {
    failures.push(`Steam buildId must be ${EXPECTED_STEAM_RELEASE.buildId}`);
  }
  if (String(steam.windowsDepot?.depotId) !== String(EXPECTED_STEAM_RELEASE.windowsDepot.depotId)) {
    failures.push('Windows depotId must be 1176471');
  }
  if (String(steam.windowsDepot?.manifestId) !== EXPECTED_STEAM_RELEASE.windowsDepot.manifestId) {
    failures.push(`Windows manifestId must be ${EXPECTED_STEAM_RELEASE.windowsDepot.manifestId}`);
  }
  if (String(steam.darkSkiesDepot?.depotId) !== String(EXPECTED_STEAM_RELEASE.darkSkiesDepot.depotId)) {
    failures.push('Dark Skies depotId must be 4713340');
  }
  if (String(steam.darkSkiesDepot?.manifestId) !== EXPECTED_STEAM_RELEASE.darkSkiesDepot.manifestId) {
    failures.push(`Dark Skies manifestId must be ${EXPECTED_STEAM_RELEASE.darkSkiesDepot.manifestId}`);
  }
  if (steam.platform !== 'windows') failures.push('Steam source platform must be windows');
  if (steam.downloadMethod !== 'SteamCMD download_depot') {
    failures.push('Steam downloadMethod must be SteamCMD download_depot');
  }

  const provenance = metadata.provenance ?? {};
  if (provenance.source !== 'SteamCMD console_log.txt') {
    failures.push('provenance source must be SteamCMD console_log.txt');
  }
  if (!SHA256.test(provenance.consoleLogSha256 ?? '')) {
    failures.push('provenance consoleLogSha256 must be a SHA-256');
  }
  if (String(provenance.appInfoBuildId) !== String(EXPECTED_STEAM_RELEASE.buildId)) {
    failures.push(`provenance appInfoBuildId must be ${EXPECTED_STEAM_RELEASE.buildId}`);
  }
  if (provenance.authentication !== 'Steam account session') {
    failures.push('provenance authentication must be a Steam account session');
  }
  if (typeof provenance.authenticatedSessionStartedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(provenance.authenticatedSessionStartedAt)) {
    failures.push('provenance authenticatedSessionStartedAt must be a SteamCMD timestamp');
  }
  const downloads = Array.isArray(provenance.depotDownloads) ? provenance.depotDownloads : [];
  for (const expected of [EXPECTED_STEAM_RELEASE.windowsDepot, EXPECTED_STEAM_RELEASE.darkSkiesDepot]) {
    const download = downloads.find((entry) => String(entry?.depotId) === String(expected.depotId));
    const contentPath = path.posix.join(
      'steamapps', 'content', `app_${EXPECTED_STEAM_RELEASE.appId}`, `depot_${expected.depotId}`,
    );
    if (!download) {
      failures.push(`provenance is missing completed depot ${expected.depotId}`);
      continue;
    }
    if (String(download.manifestId) !== expected.manifestId) {
      failures.push(`provenance depot ${expected.depotId} manifestId must be ${expected.manifestId}`);
    }
    if (!Number.isSafeInteger(download.fileCount) || download.fileCount < 1) {
      failures.push(`provenance depot ${expected.depotId} fileCount must be positive`);
    }
    if (download.fileCountSource !== 'filesystem enumeration') {
      failures.push(`provenance depot ${expected.depotId} fileCountSource is invalid`);
    }
    if (download.contentPath !== contentPath) {
      failures.push(`provenance depot ${expected.depotId} contentPath is invalid`);
    }
  }
  if (downloads.length !== 2) failures.push('provenance must contain exactly two depot downloads');

  const hashes = metadata.sourceHashes;
  if (!Array.isArray(hashes) || hashes.length === 0) {
    failures.push('sourceHashes must contain at least one file hash');
  } else {
    const seenPaths = new Set();
    const sourcePaths = hashes.map((source) => source?.path);
    const sortedPaths = [...sourcePaths].sort();
    if (sourcePaths.some((sourcePath, index) => sourcePath !== sortedPaths[index])) {
      failures.push('sourceHashes must be sorted by path');
    }
    for (const source of hashes) {
      if (typeof source?.path !== 'string' || !source.path || source.path.startsWith('/') || source.path.includes('..')) {
        failures.push('every source hash path must be a safe relative path');
      } else if (seenPaths.has(source.path)) {
        failures.push(`duplicate source hash path: ${source.path}`);
      } else {
        seenPaths.add(source.path);
      }
      if (!SHA256.test(source?.sha256 ?? '')) failures.push(`invalid SHA-256 for ${source?.path ?? 'unknown source'}`);
    }
  }

  for (const [scenario, expected] of Object.entries(EXPECTED_SCENARIO_COUNTS)) {
    const actual = metadata.scenarios?.[scenario];
    if (!actual?.available) failures.push(`${scenario} scenario is not available`);
    if (actual?.technologies !== expected.technologies || actual?.projects !== expected.projects) {
      failures.push(`${scenario} effective count must be ${expected.technologies}/${expected.projects}`);
    }
  }

  const expectedSnapshot = releaseSnapshotId(steam);
  const snapshotIds = REQUIRED_VERSIONS.map((version) => {
    const snapshotId = metadata.versions?.[version]?.snapshotId;
    if (typeof snapshotId !== 'string' || !snapshotId) failures.push(`${version} snapshotId is missing`);
    else if (snapshotId !== expectedSnapshot) failures.push(`${version} snapshotId is not bound to the Steam manifests`);
    return snapshotId;
  });
  if (snapshotIds.every(Boolean) && new Set(snapshotIds).size !== 1) {
    failures.push('stable and experimental must resolve to the same verified snapshot');
  }
  return failures;
}

export function assertReleaseReady(metadata) {
  const failures = validateReleaseMetadata(metadata);
  if (failures.length > 0) {
    throw new Error(`Release data validation failed:\n- ${failures.join('\n- ')}`);
  }
}

export function validateSourceHashes(metadata, sourceRoot) {
  const failures = [];
  const declared = new Map((metadata.sourceHashes ?? []).map((source) => [source.path, source.sha256]));
  const actualFiles = [];
  const walk = (relativeDirectory) => {
    const absoluteDirectory = path.join(sourceRoot, relativeDirectory);
    if (!fs.existsSync(absoluteDirectory) || !fs.statSync(absoluteDirectory).isDirectory()) {
      failures.push(`${relativeDirectory}: required source directory is missing`);
      return;
    }
    for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      if (entry.isSymbolicLink()) {
        failures.push(`${relative}: source symlinks are not allowed`);
      } else if (entry.isDirectory()) {
        walk(relative);
      } else if (entry.isFile()) {
        actualFiles.push(relative);
      }
    }
  };
  for (const sourceDirectory of RELEASE_SOURCE_ROOTS) walk(sourceDirectory);

  const actualSet = new Set(actualFiles);
  for (const sourcePath of actualFiles) {
    if (!declared.has(sourcePath)) failures.push(`${sourcePath}: source hash is missing from release metadata`);
  }
  for (const sourcePath of declared.keys()) {
    if (!actualSet.has(sourcePath)) failures.push(`${sourcePath}: release metadata names a non-source file`);
  }

  for (const sourcePath of actualFiles) {
    const source = { path: sourcePath, sha256: declared.get(sourcePath) };
    const absolute = path.resolve(sourceRoot, source.path);
    const relative = path.relative(sourceRoot, absolute);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      failures.push(`${source.path}: source path escapes the gamefiles directory`);
      continue;
    }
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      failures.push(`${source.path}: source file is missing`);
      continue;
    }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    if (actual !== source.sha256) failures.push(`${source.path}: SHA-256 does not match release metadata`);
  }

  const versionHashes = (version) => new Map(
    actualFiles
      .filter((sourcePath) => sourcePath.startsWith(`${version}/`))
      .map((sourcePath) => [sourcePath.slice(version.length + 1), declared.get(sourcePath)])
  );
  const stable = versionHashes('stable');
  const experimental = versionHashes('experimental');
  const versionPaths = new Set([...stable.keys(), ...experimental.keys()]);
  for (const relative of versionPaths) {
    if (stable.get(relative) !== experimental.get(relative)) {
      failures.push(`${relative}: stable and experimental source bytes differ`);
    }
  }
  return failures;
}
