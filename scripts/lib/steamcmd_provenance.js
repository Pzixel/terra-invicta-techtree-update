function quotedBlocks(content, key) {
  const blocks = [];
  const startPattern = new RegExp(`"${key}"\\s*\\{`, 'g');
  for (const match of content.matchAll(startPattern)) {
    const open = content.indexOf('{', match.index);
    let depth = 0;
    for (let index = open; index < content.length; index += 1) {
      if (content[index] === '{') depth += 1;
      if (content[index] === '}') depth -= 1;
      if (depth === 0) {
        blocks.push(content.slice(open, index + 1));
        break;
      }
    }
  }
  return blocks;
}

function hasQuotedValue(content, key, value) {
  return new RegExp(`"${key}"\\s+"${value}"`).test(content);
}

function hasPublicDepotManifest(depotsBlock, depotId, manifestId) {
  return quotedBlocks(depotsBlock, depotId).some((depotBlock) =>
    quotedBlocks(depotBlock, 'manifests').some((manifestsBlock) =>
      quotedBlocks(manifestsBlock, 'public').some((publicBlock) =>
        hasQuotedValue(publicBlock, 'gid', manifestId)
      )
    )
  );
}

export function hasPinnedAppInfo(consoleLog, expectedRelease) {
  return quotedBlocks(consoleLog, expectedRelease.appId).some((block) =>
    quotedBlocks(block, 'depots').some((depotsBlock) =>
      quotedBlocks(depotsBlock, 'branches').some((branchesBlock) =>
        quotedBlocks(branchesBlock, expectedRelease.branch).some((publicBranch) =>
          hasQuotedValue(publicBranch, 'buildid', expectedRelease.buildId)
        )
      ) &&
      hasPublicDepotManifest(
        depotsBlock,
        expectedRelease.windowsDepot.depotId,
        expectedRelease.windowsDepot.manifestId,
      ) &&
      hasPublicDepotManifest(
        depotsBlock,
        expectedRelease.darkSkiesDepot.depotId,
        expectedRelease.darkSkiesDepot.manifestId,
      )
    )
  );
}

export function completedDepotEntries(consoleLog, depot) {
  const pattern = new RegExp(
    `Depot download complete\\s*:\\s*"([^"\\r\\n]+)"\\s*\\((?:(\\d+)\\s+files,\\s*)?manifest\\s+${depot.manifestId}\\)`,
    'gi',
  );
  return [...consoleLog.matchAll(pattern)].map((match) => ({
    contentPath: match[1],
    fileCount: match[2] === undefined ? null : Number(match[2]),
  }));
}

const ACCOUNT_LOGIN = /Logging in user .*\[U:\d+:\d+\] to Steam Public/i;
const LOGIN_OUTCOME = /\]\s*(OK|FAILED|ERROR)\b/i;
const LOG_TIMESTAMP = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/;
const STEAM_API_LOAD = /Loading Steam API/i;
const STEAM_API_UNLOAD = /Unloading Steam API/i;

const steamApiSessions = (lines) => {
  const sessions = [];
  let start = null;
  for (let index = 0; index < lines.length; index += 1) {
    if (STEAM_API_LOAD.test(lines[index])) {
      if (start !== null) sessions.push(lines.slice(start, index));
      start = index;
    }
    if (start !== null && STEAM_API_UNLOAD.test(lines[index])) {
      sessions.push(lines.slice(start, index + 1));
      start = null;
    }
  }
  if (start !== null) sessions.push(lines.slice(start));
  return sessions;
};

const completedDepotAfterStart = (lines, depot) => {
  const startPattern = new RegExp(`Downloading depot\\s+${depot.depotId}\\b`, 'i');
  const start = lines.findIndex((line) => startPattern.test(line));
  if (start < 0) return null;
  const entries = completedDepotEntries(lines.slice(start + 1).join('\n'), depot);
  return entries.at(-1) ?? null;
};

/**
 * Returns exact-manifest completions only when every requested depot was
 * started and completed inside one successful authenticated Steam session.
 * App-info may be printed in a separate public session: the pinned manifest
 * IDs are the binding between that block and these downloads.
 */
export function completedAuthenticatedDepotSession(consoleLog, depots) {
  const lines = consoleLog.split(/\r?\n/);
  const sessions = steamApiSessions(lines);

  // Prefer the latest complete authenticated session. Older successful
  // sessions remain irrelevant when a newer invocation downloaded both
  // pinned depots together.
  for (let sessionIndex = sessions.length - 1; sessionIndex >= 0; sessionIndex -= 1) {
    const sessionLines = sessions[sessionIndex];
    const loginIndex = sessionLines.findIndex((line) => ACCOUNT_LOGIN.test(line));
    if (loginIndex < 0) continue;
    const authenticatedLines = sessionLines.slice(loginIndex);
    const firstOutcome = authenticatedLines.slice(1)
      .map((line) => LOGIN_OUTCOME.exec(line)?.[1]?.toUpperCase())
      .find(Boolean);
    if (firstOutcome !== 'OK') continue;

    const completions = [];
    let complete = true;
    for (const depot of depots) {
      const entry = completedDepotAfterStart(authenticatedLines, depot);
      if (!entry) {
        complete = false;
        break;
      }
      completions.push({ depotId: depot.depotId, ...entry });
    }
    if (!complete) continue;

    return {
      startedAt: LOG_TIMESTAMP.exec(sessionLines[loginIndex])?.[1] ?? null,
      completions,
    };
  }
  return null;
}
