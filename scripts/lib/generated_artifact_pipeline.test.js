import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import {
  createRuntimeArtifactManifest,
  resetGeneratedArtifactDirectories,
  runtimeArtifactsMatchManifest,
} from './generated_artifacts.js';
import {
  GRAPH_ARTIFACT_INPUT_DIRECTORIES,
  GRAPH_ARTIFACT_INPUTS,
  generatedArtifactInputFingerprint,
  inputDirectoryFiles,
} from '../prepare_generated_artifacts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = '/terra-invicta-techtree-update/';

test('development and production generate graph artifacts before Vite serves them', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.predev, 'npm run prepare:generated-artifacts');
  assert.match(packageJson.scripts.build, /validate:release.*prepare:generated-artifacts -- --release-validated/);
  assert.ok(
    packageJson.scripts.build.indexOf('prepare:generated-artifacts') <
      packageJson.scripts.build.indexOf('vite build'),
  );
  assert.equal(packageJson.scripts['prepare:generated-artifacts'], 'node scripts/prepare_generated_artifacts.js');
  assert.ok(GRAPH_ARTIFACT_INPUTS.includes('src/techGraphRender.ts'));
  assert.ok(GRAPH_ARTIFACT_INPUTS.includes('src/data/scenarioCompiler.ts'));
  assert.ok(GRAPH_ARTIFACT_INPUTS.includes('scripts/prepare_generated_artifacts.js'));
  assert.ok(GRAPH_ARTIFACT_INPUTS.includes('scripts/validate_release_data.js'));
  assert.ok(GRAPH_ARTIFACT_INPUTS.includes('scripts/lib/release_data_validation.js'));
  assert.ok(GRAPH_ARTIFACT_INPUTS.includes('scripts/lib/rendered_icon_validation.js'));
  assert.ok(GRAPH_ARTIFACT_INPUT_DIRECTORIES.includes('public/icons'));
  assert.equal(GRAPH_ARTIFACT_INPUTS.includes('src/App.tsx'), false);
  assert.match(generatedArtifactInputFingerprint(), /^[a-f0-9]{64}$/);
});

test('artifact regeneration removes stale graph and layout tuples only', () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-artifacts-'));
  try {
    fs.mkdirSync(path.join(outputDirectory, 'graph'), { recursive: true });
    fs.mkdirSync(path.join(outputDirectory, 'layout'), { recursive: true });
    fs.mkdirSync(path.join(outputDirectory, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, 'graph', 'stale.json'), '{}');
    fs.writeFileSync(path.join(outputDirectory, 'layout', 'stale.json'), '{}');
    fs.writeFileSync(path.join(outputDirectory, 'assets', 'keep.js'), 'keep');

    resetGeneratedArtifactDirectories(outputDirectory);

    assert.equal(fs.existsSync(path.join(outputDirectory, 'graph')), false);
    assert.equal(fs.existsSync(path.join(outputDirectory, 'layout')), false);
    assert.equal(fs.readFileSync(path.join(outputDirectory, 'assets', 'keep.js'), 'utf8'), 'keep');
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test('artifact cache detects changed, missing, and extra generated files', () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-artifact-cache-'));
  try {
    for (const relativePath of [
      'bundles/stable/standard/en.json',
      'graph/stable.standard.en.json',
      'layout/stable.standard.json',
    ]) {
      const absolutePath = path.join(outputDirectory, ...relativePath.split('/'));
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, '{}');
    }
    const manifest = createRuntimeArtifactManifest(outputDirectory, 'inputs-v1');
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v1'), true);
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v2'), false);

    fs.writeFileSync(path.join(outputDirectory, 'graph', 'stable.standard.en.json'), '[]');
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v1'), false);
    fs.writeFileSync(path.join(outputDirectory, 'graph', 'stable.standard.en.json'), '{}');

    fs.rmSync(path.join(outputDirectory, 'bundles'), { recursive: true });
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v1'), false);
    const restoredBundle = path.join(outputDirectory, 'bundles', 'stable', 'standard', 'en.json');
    fs.mkdirSync(path.dirname(restoredBundle), { recursive: true });
    fs.writeFileSync(restoredBundle, '{}');

    const unexpectedFile = path.join(outputDirectory, 'graph', 'notes.txt');
    fs.writeFileSync(unexpectedFile, 'unexpected');
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v1'), false);
    fs.rmSync(unexpectedFile);

    const unexpectedLink = path.join(outputDirectory, 'graph', 'linked.json');
    fs.symlinkSync(path.join(outputDirectory, 'graph', 'stable.standard.en.json'), unexpectedLink);
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v1'), false);
    fs.rmSync(unexpectedLink);

    fs.writeFileSync(path.join(outputDirectory, 'layout', 'stale.json'), '{}');
    assert.equal(runtimeArtifactsMatchManifest(outputDirectory, manifest, 'inputs-v1'), false);
  } finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true });
  }
});

test('artifact roots and validated input roots must be real directories', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-artifact-roots-'));
  try {
    for (const relativePath of [
      'bundles/stable/standard/en.json',
      'graph/stable.standard.en.json',
      'layout/stable.standard.json',
    ]) {
      const absolutePath = path.join(root, ...relativePath.split('/'));
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
      fs.writeFileSync(absolutePath, '{}');
    }
    const manifest = createRuntimeArtifactManifest(root, 'inputs-v1');
    fs.renameSync(path.join(root, 'graph'), path.join(root, 'graph-real'));
    fs.symlinkSync(path.join(root, 'graph-real'), path.join(root, 'graph'));
    assert.equal(runtimeArtifactsMatchManifest(root, manifest, 'inputs-v1'), false);

    const iconsReal = path.join(root, 'icons-real');
    fs.mkdirSync(iconsReal);
    fs.writeFileSync(path.join(iconsReal, 'icon.png'), 'icon');
    fs.mkdirSync(path.join(root, 'public'));
    fs.symlinkSync(iconsReal, path.join(root, 'public', 'icons'));
    assert.throws(
      () => inputDirectoryFiles('public/icons', root),
      /artifact input must be a real directory/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Vite development serves generated JSON and expands the base once', async () => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-vite-'));
  const graphPath = path.join(fixtureRoot, 'public', 'graph', 'stable.standard.en.json');
  fs.mkdirSync(path.dirname(graphPath), { recursive: true });
  fs.writeFileSync(graphPath, JSON.stringify({ nodes: [], edges: [] }));
  fs.writeFileSync(
    path.join(fixtureRoot, 'index.html'),
    '<link rel="preload" href="/graph/stable.standard.en.json" as="fetch">',
  );

  const vite = await createViteServer({
    root: fixtureRoot,
    base: BASE,
    configFile: false,
    appType: 'spa',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  const server = http.createServer(vite.middlewares);

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;

    const htmlResponse = await fetch(`${origin}${BASE}`);
    const html = await htmlResponse.text();
    assert.equal(htmlResponse.status, 200);
    assert.match(html, /href="\/terra-invicta-techtree-update\/graph\/stable\.standard\.en\.json"/);
    assert.doesNotMatch(html, /terra-invicta-techtree-update\/terra-invicta-techtree-update/);

    const graphResponse = await fetch(`${origin}${BASE}graph/stable.standard.en.json`);
    assert.equal(graphResponse.status, 200);
    assert.match(graphResponse.headers.get('content-type') ?? '', /application\/json/);
    assert.deepEqual(await graphResponse.json(), { nodes: [], edges: [] });
  } finally {
    await vite.close();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
