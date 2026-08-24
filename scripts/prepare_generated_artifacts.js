#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createRuntimeArtifactManifest,
  runtimeArtifactsMatchManifest,
} from './lib/generated_artifacts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const CACHE_PATH = path.join(
  ROOT,
  'node_modules',
  '.cache',
  'terra-invicta',
  'generated-artifacts-v1.json',
);

export const GRAPH_ARTIFACT_INPUTS = Object.freeze([
  'package-lock.json',
  'public/gamefiles/release.json',
  'scripts/generate_scenario_bundles.js',
  'scripts/generate_graph_layout.js',
  'scripts/prepare_generated_artifacts.js',
  'scripts/lib/generated_artifacts.js',
  'scripts/lib/release_data_validation.js',
  'scripts/lib/release_metadata.js',
  'scripts/lib/rendered_icon_validation.js',
  'scripts/validate_release_data.js',
  'src/data/loadScenarioView.ts',
  'src/data/scenarioCompiler.ts',
  'src/language.ts',
  'src/scenario.ts',
  'src/techGraphRender.ts',
  'src/types/index.ts',
  'src/types/props.ts',
  'src/utils.ts',
  'src/utils/TechDb.ts',
  'src/utils/prerequisites.ts',
  'src/version.ts',
]);
export const GRAPH_ARTIFACT_INPUT_DIRECTORIES = Object.freeze(['public/icons']);

export function inputDirectoryFiles(relativeDirectory, rootDirectory = ROOT) {
  const files = [];
  const root = path.join(rootDirectory, ...relativeDirectory.split('/'));
  if (!fs.existsSync(root) || !fs.lstatSync(root).isDirectory()) {
    throw new Error(`${relativeDirectory}: artifact input must be a real directory`);
  }
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolutePath);
      else if (entry.isFile()) files.push(path.relative(rootDirectory, absolutePath).split(path.sep).join('/'));
      else throw new Error(`${path.relative(rootDirectory, absolutePath)}: unsupported artifact input`);
    }
  }
  return files.sort();
}

export function generatedArtifactInputFingerprint() {
  const hash = crypto.createHash('sha256');
  hash.update(`node=${process.version}\nplatform=${process.platform}\narch=${process.arch}\n`);
  const relativePaths = GRAPH_ARTIFACT_INPUTS.concat(
    GRAPH_ARTIFACT_INPUT_DIRECTORIES.flatMap((directory) => inputDirectoryFiles(directory)),
  );
  for (const relativePath of relativePaths) {
    hash.update(`${relativePath}\0`);
    hash.update(fs.readFileSync(path.join(ROOT, ...relativePath.split('/'))));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function readCacheManifest() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function generateRuntimeArtifacts() {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate_scenario_bundles.js')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'generate_graph_layout.js'), PUBLIC], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function validateReleaseData() {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'validate_release_data.js')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

function writeCacheManifest(manifest) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  const temporaryPath = `${CACHE_PATH}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, JSON.stringify(manifest));
  fs.renameSync(temporaryPath, CACHE_PATH);
}

export function prepareGeneratedArtifacts({ releaseValidated = false } = {}) {
  const inputFingerprint = generatedArtifactInputFingerprint();
  const cached = readCacheManifest();
  if (runtimeArtifactsMatchManifest(PUBLIC, cached, inputFingerprint)) {
    console.log(`Reused ${Object.keys(cached.artifacts).length} verified generated runtime artifacts`);
    return;
  }

  if (!releaseValidated) validateReleaseData();
  generateRuntimeArtifacts();
  const manifest = createRuntimeArtifactManifest(PUBLIC, inputFingerprint);
  writeCacheManifest(manifest);
  console.log(`Cached ${Object.keys(manifest.artifacts).length} verified generated runtime artifacts`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  prepareGeneratedArtifacts({ releaseValidated: process.argv.includes('--release-validated') });
}
