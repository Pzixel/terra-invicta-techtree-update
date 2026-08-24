import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED_STEAM_RELEASE } from './release_metadata.js';
import {
  completedAuthenticatedDepotSession,
  completedDepotEntries,
  hasPinnedAppInfo,
} from './steamcmd_provenance.js';

const appInfo = `
"1176470"
{
  "depots"
  {
    "1176471" { "manifests" { "public" { "gid" "3504609025059582964" } } }
    "4713340" { "manifests" { "public" { "gid" "1117456866270863502" } } }
    "branches" { "public" { "buildid" "24479907" } }
  }
}
`;

test('SteamCMD provenance binds app, public build, and both depot manifests in one app-info block', () => {
  assert.equal(hasPinnedAppInfo(appInfo, EXPECTED_STEAM_RELEASE), true);
  assert.equal(hasPinnedAppInfo(appInfo.replace('24479907', '1'), EXPECTED_STEAM_RELEASE), false);
  assert.equal(hasPinnedAppInfo(appInfo.replace('1117456866270863502', '1'), EXPECTED_STEAM_RELEASE), false);

  const splitAcrossApps = appInfo
    .replace('"4713340"', '"other"') +
    `\n"999" { "4713340" { "gid" "1117456866270863502" } }`;
  assert.equal(hasPinnedAppInfo(splitAcrossApps, EXPECTED_STEAM_RELEASE), false);
});

test('SteamCMD provenance rejects exact IDs that exist only on non-public branches', () => {
  const betaOnly = appInfo
    .replace('"branches" { "public"', '"branches" { "beta"')
    .replaceAll('"manifests" { "public"', '"manifests" { "legacy"');
  assert.equal(hasPinnedAppInfo(betaOnly, EXPECTED_STEAM_RELEASE), false);

  const mixed = betaOnly + `
"unrelated"
{
  "public" { "buildid" "24479907" "gid" "3504609025059582964" "othergid" "1117456866270863502" }
}`;
  assert.equal(hasPinnedAppInfo(mixed, EXPECTED_STEAM_RELEASE), false);
});

test('SteamCMD completion parsing requires the pinned manifest and accepts the observed no-count format', () => {
  const log = `
Depot download complete : "/private/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_1176471" (manifest 3504609025059582964)
Depot download complete : "/tmp/other" (1 files, manifest 9)
`;
  assert.deepEqual(completedDepotEntries(log, EXPECTED_STEAM_RELEASE.windowsDepot), [{
    contentPath: '/private/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_1176471',
    fileCount: null,
  }]);
  assert.deepEqual(completedDepotEntries(log, EXPECTED_STEAM_RELEASE.darkSkiesDepot), []);

  const counted = 'Depot download complete : "/tmp/depot" (123 files, manifest 3504609025059582964)';
  assert.deepEqual(completedDepotEntries(counted, EXPECTED_STEAM_RELEASE.windowsDepot), [{
    contentPath: '/tmp/depot',
    fileCount: 123,
  }]);
});

const authenticatedSession = ({
  firstManifest = EXPECTED_STEAM_RELEASE.windowsDepot.manifestId,
  secondManifest = EXPECTED_STEAM_RELEASE.darkSkiesDepot.manifestId,
  firstDepot = true,
  secondDepot = true,
  outcome = 'OK',
} = {}) => `
[2026-08-24 10:46:05] Loading Steam API...
[2026-08-24 10:46:05] Logging in user redacted [U:1:123] to Steam Public...
[2026-08-24 10:46:32] ${outcome}
${firstDepot ? `[2026-08-24 10:46:36] Downloading depot 1176471 (1425 files, 17516 MB) ...
[2026-08-24 10:55:46] Depot download complete : "/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_1176471" (manifest ${firstManifest})` : ''}
${secondDepot ? `[2026-08-24 10:55:46] Downloading depot 4713340 (408 files, 5032 MB) ...
[2026-08-24 10:58:20] Depot download complete : "/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_4713340" (manifest ${secondManifest})` : ''}
`;

test('authenticated provenance requires both exact depots in one successful account session', () => {
  assert.deepEqual(
    completedAuthenticatedDepotSession(authenticatedSession(), [
      EXPECTED_STEAM_RELEASE.windowsDepot,
      EXPECTED_STEAM_RELEASE.darkSkiesDepot,
    ]),
    {
      startedAt: '2026-08-24 10:46:05',
      completions: [
        {
          depotId: 1176471,
          contentPath: '/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_1176471',
          fileCount: null,
        },
        {
          depotId: 4713340,
          contentPath: '/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_4713340',
          fileCount: null,
        },
      ],
    },
  );

  const splitSessions = authenticatedSession({ secondDepot: false }) +
    authenticatedSession({ firstDepot: false });
  assert.equal(completedAuthenticatedDepotSession(splitSessions, [
    EXPECTED_STEAM_RELEASE.windowsDepot,
    EXPECTED_STEAM_RELEASE.darkSkiesDepot,
  ]), null);

  assert.equal(completedAuthenticatedDepotSession(
    authenticatedSession({ outcome: 'FAILED (Invalid Password)' }),
    [EXPECTED_STEAM_RELEASE.windowsDepot, EXPECTED_STEAM_RELEASE.darkSkiesDepot],
  ), null);
  assert.equal(completedAuthenticatedDepotSession(
    authenticatedSession().replace('Logging in user redacted [U:1:123]', 'Logging in user anonymous'),
    [EXPECTED_STEAM_RELEASE.windowsDepot, EXPECTED_STEAM_RELEASE.darkSkiesDepot],
  ), null);
  assert.equal(completedAuthenticatedDepotSession(
    authenticatedSession({ secondManifest: '1' }),
    [EXPECTED_STEAM_RELEASE.windowsDepot, EXPECTED_STEAM_RELEASE.darkSkiesDepot],
  ), null);

  const completionAfterUnload = authenticatedSession({ secondDepot: false }) + `
[2026-08-24 10:55:47] Unloading Steam API...
[2026-08-24 10:55:48] Downloading depot 4713340 (408 files, 5032 MB) ...
[2026-08-24 10:58:20] Depot download complete : "/tmp/depot_4713340" (manifest 1117456866270863502)
`;
  assert.equal(completedAuthenticatedDepotSession(completionAfterUnload, [
    EXPECTED_STEAM_RELEASE.windowsDepot,
    EXPECTED_STEAM_RELEASE.darkSkiesDepot,
  ]), null);

  const secondDownload = '[2026-08-24 10:55:46] Downloading depot 4713340 (408 files, 5032 MB) ...';
  const secondCompletion = '[2026-08-24 10:58:20] Depot download complete : "/tmp/steamcmd\\steamapps\\content\\app_1176470\\depot_4713340" (manifest 1117456866270863502)';
  const completionBeforeStart = authenticatedSession().replace(
    `${secondDownload}\n${secondCompletion}`,
    `${secondCompletion}\n${secondDownload}`,
  );
  assert.equal(completedAuthenticatedDepotSession(completionBeforeStart, [
    EXPECTED_STEAM_RELEASE.windowsDepot,
    EXPECTED_STEAM_RELEASE.darkSkiesDepot,
  ]), null);
});
