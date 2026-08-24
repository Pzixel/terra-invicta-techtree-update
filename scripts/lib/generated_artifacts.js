import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const GENERATED_ARTIFACT_DIRECTORIES = ['graph', 'layout'];
export const RUNTIME_ARTIFACT_DIRECTORIES = ['bundles', ...GENERATED_ARTIFACT_DIRECTORIES];
export const ARTIFACT_MANIFEST_SCHEMA_VERSION = 1;

export function resetGeneratedArtifactDirectories(outputDirectory) {
  for (const directory of GENERATED_ARTIFACT_DIRECTORIES) {
    fs.rmSync(path.join(outputDirectory, directory), { recursive: true, force: true });
  }
}

function runtimeArtifactPaths(outputDirectory) {
  const relativePaths = [];
  for (const directory of RUNTIME_ARTIFACT_DIRECTORIES) {
    const root = path.join(outputDirectory, directory);
    if (!fs.existsSync(root) || !fs.lstatSync(root).isDirectory()) return [];
    const directoryStart = relativePaths.length;
    const pending = [root];
    while (pending.length > 0) {
      const current = pending.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) pending.push(absolutePath);
        else if (entry.isFile() && entry.name.endsWith('.json')) {
          relativePaths.push(path.relative(outputDirectory, absolutePath).split(path.sep).join('/'));
        } else return [];
      }
    }
    if (relativePaths.length === directoryStart) return [];
  }
  return relativePaths.sort();
}

function hashFile(absolutePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absolutePath)).digest('hex');
}

export function createRuntimeArtifactManifest(outputDirectory, inputFingerprint) {
  const relativePaths = runtimeArtifactPaths(outputDirectory);
  if (relativePaths.length === 0) {
    throw new Error('Generated runtime artifacts are missing');
  }
  return {
    schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION,
    inputFingerprint,
    artifacts: Object.fromEntries(relativePaths.map((relativePath) => {
      const absolutePath = path.join(outputDirectory, ...relativePath.split('/'));
      return [relativePath, {
        bytes: fs.statSync(absolutePath).size,
        sha256: hashFile(absolutePath),
      }];
    })),
  };
}

export function runtimeArtifactsMatchManifest(outputDirectory, manifest, inputFingerprint) {
  if (manifest?.schemaVersion !== ARTIFACT_MANIFEST_SCHEMA_VERSION ||
      manifest.inputFingerprint !== inputFingerprint ||
      typeof manifest.artifacts !== 'object' || manifest.artifacts === null) {
    return false;
  }

  const currentPaths = runtimeArtifactPaths(outputDirectory);
  const recordedPaths = Object.keys(manifest.artifacts).sort();
  if (JSON.stringify(currentPaths) !== JSON.stringify(recordedPaths)) return false;

  return currentPaths.every((relativePath) => {
    const expected = manifest.artifacts[relativePath];
    const absolutePath = path.join(outputDirectory, ...relativePath.split('/'));
    return expected &&
      fs.statSync(absolutePath).size === expected.bytes &&
      hashFile(absolutePath) === expected.sha256;
  });
}
