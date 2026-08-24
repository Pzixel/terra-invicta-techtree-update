import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const jiti = createJiti(import.meta.url);
const { graphRenderSource } = await jiti.import(path.join(ROOT, 'src', 'graphArtifactState.ts'));

const ready = {
  key: 'stable.standard.en',
  dataReady: true,
  layoutReady: true,
};

test('waits for the current compiled graph instead of starting a live render', () => {
  assert.deepEqual(graphRenderSource({
    ...ready,
    artifact: null,
    forceLive: false,
  }), {
    bundle: null,
    drawLive: false,
    pending: true,
  });

  assert.deepEqual(graphRenderSource({
    ...ready,
    artifact: { key: 'stable.2003.en', bundle: { nodes: [], edges: [] } },
    forceLive: false,
  }), {
    bundle: null,
    drawLive: false,
    pending: true,
  });
});

test('uses the compiled graph as soon as the current artifact resolves', () => {
  const bundle = { nodes: [{ id: 'TECH' }], edges: [] };
  assert.deepEqual(graphRenderSource({
    ...ready,
    artifact: { key: ready.key, bundle },
    forceLive: false,
  }), {
    bundle,
    drawLive: false,
    pending: false,
  });
});

test('falls back to live rendering only after artifact failure', () => {
  assert.deepEqual(graphRenderSource({
    ...ready,
    artifact: { key: ready.key, bundle: null },
    forceLive: false,
  }), {
    bundle: null,
    drawLive: true,
    pending: false,
  });
});

test('explicit graph filters continue to force live rendering', () => {
  assert.deepEqual(graphRenderSource({
    ...ready,
    artifact: null,
    forceLive: true,
  }), {
    bundle: null,
    drawLive: true,
    pending: false,
  });
});
