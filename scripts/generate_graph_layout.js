#!/usr/bin/env node
// Builds layout and localized graph artifacts exclusively from the verified
// version/scenario/language bundles produced earlier in the release pipeline.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createJiti } from 'jiti';
import { assertReleaseReady } from './lib/release_metadata.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist');
const release = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'gamefiles', 'release.json'), 'utf8'));
assertReleaseReady(release);

// Browser environment shim (must exist before vis-network loads).
const dom = new JSDOM('<!doctype html><html><body><div id="mynetwork"></div></body></html>', {
  url: 'http://localhost/terra-invicta-techtree-update/',
  pretendToBeVisual: true,
});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'MouseEvent', 'TouchEvent', 'PointerEvent', 'CustomEvent',
  'Image', 'HTMLImageElement', 'HTMLCanvasElement', 'DOMParser', 'XMLSerializer', 'performance']) {
  if (dom.window[key] !== undefined && globalThis[key] === undefined) {
    globalThis[key] = dom.window[key];
  }
}

// Layout only needs measureText-ish APIs; drawing is discarded.
const makeContextStub = () => {
  const store = {};
  return new Proxy({}, {
    get(_, prop) {
      if (prop in store) return store[prop];
      if (prop === 'measureText') return (text) => ({ width: String(text).length * 12 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop() {} });
      }
      if (prop === 'getImageData') return () => ({ data: [] });
      return () => undefined;
    },
    set(_, prop, value) { store[prop] = value; return true; },
  });
};
dom.window.HTMLCanvasElement.prototype.getContext = function getContext() { return makeContextStub(); };

const jiti = createJiti(import.meta.url);
const { hydrateScenarioBundle } = await jiti.import(path.join(ROOT, 'src/data/loadScenarioView.ts'));
const { Languages } = await jiti.import(path.join(ROOT, 'src/language.ts'));
const {
  OrderedScenarios,
  graphArtifactPath,
  layoutArtifactPath,
  scenarioBundlePath,
} = await jiti.import(path.join(ROOT, 'src/scenario.ts'));
const { OrderedGameVersions } = await jiti.import(path.join(ROOT, 'src/version.ts'));
const { parseNode, draw } = await jiti.import(path.join(ROOT, 'src/techGraphRender.ts'));
const vis = await import('vis-network/standalone/esm/vis-network.js');

const readBundleView = (version, scenario, language) => {
  const relativePath = scenarioBundlePath(version, scenario, language.code);
  const absolutePath = path.join(PUBLIC, ...relativePath.split('/'));
  let bundle;
  try {
    bundle = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath}: required scenario bundle is missing or invalid: ${error.message}`);
  }

  const expectedKey = { version, scenario, language: language.code };
  for (const [field, expected] of Object.entries(expectedKey)) {
    if (bundle.key?.[field] !== expected) {
      throw new Error(`${relativePath}: bundle key ${field} is ${bundle.key?.[field] ?? 'missing'}, expected ${expected}`);
    }
  }
  const expectedSnapshot = release.versions?.[version]?.snapshotId;
  if (!expectedSnapshot || bundle.snapshotId !== expectedSnapshot) {
    throw new Error(`${relativePath}: bundle is not bound to the verified ${version} snapshot`);
  }
  const expectedCounts = release.scenarios?.[scenario];
  const actualCounts = {
    technologies: bundle.collections?.tech?.length,
    projects: bundle.collections?.project?.length,
  };
  if (!expectedCounts ||
      bundle.effectiveCounts?.technologies !== expectedCounts.technologies ||
      bundle.effectiveCounts?.projects !== expectedCounts.projects ||
      actualCounts.technologies !== expectedCounts.technologies ||
      actualCounts.projects !== expectedCounts.projects) {
    throw new Error(`${relativePath}: bundle counts do not match the verified ${scenario} contract`);
  }
  return hydrateScenarioBundle(bundle, language);
};

const writeJson = (relativePath, value) => {
  const absolutePath = path.join(OUT_DIR, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, JSON.stringify(value));
};

const parsedGraph = ({ techDb, appStaticData }) =>
  parseNode(techDb, appStaticData.templateData, false);

const graphNodeIds = (parsed) =>
  parsed.nodes.concat(parsed.lateNodes).map((node) => node.id).sort();

for (const { code: version } of OrderedGameVersions) {
  const languages = Object.values(Languages).filter((language) => language.availableVersions.includes(version));
  if (!languages.some((language) => language.code === 'en')) {
    throw new Error(`${version}: English is required to compute the shared layout`);
  }

  for (const { code: scenario } of OrderedScenarios) {
    if (!release.scenarios?.[scenario]?.available) continue;

    const englishView = readBundleView(version, scenario, Languages.en);
    const englishParsed = parsedGraph(englishView);
    const data = {
      nodes: new vis.DataSet(englishParsed.nodes),
      edges: new vis.DataSet(englishParsed.edges),
    };
    const network = draw(data, englishParsed.lateNodes, englishParsed.lateEdges, () => {});
    const positions = network.getPositions();
    network.destroy();

    const rounded = {};
    for (const [id, position] of Object.entries(positions)) {
      rounded[id] = { x: Math.round(position.x), y: Math.round(position.y) };
    }
    const expectedNodeIds = graphNodeIds(englishParsed);
    const positionedNodeIds = Object.keys(rounded).sort();
    if (JSON.stringify(positionedNodeIds) !== JSON.stringify(expectedNodeIds)) {
      throw new Error(`${version}/${scenario}: computed layout does not cover the English node set`);
    }

    const layoutPath = layoutArtifactPath(version, scenario);
    writeJson(layoutPath, rounded);
    console.log(`${layoutPath}: ${positionedNodeIds.length} node positions`);

    for (const language of languages) {
      const view = language.code === 'en'
        ? englishView
        : readBundleView(version, scenario, language);
      const parsed = language.code === 'en' ? englishParsed : parsedGraph(view);
      const localizedNodeIds = graphNodeIds(parsed);
      if (JSON.stringify(localizedNodeIds) !== JSON.stringify(expectedNodeIds)) {
        throw new Error(`${version}/${scenario}/${language.code}: localized node set differs from English`);
      }

      const BASE = '/terra-invicta-techtree-update/';
      const nodes = parsed.nodes.concat(parsed.lateNodes).map((node) => ({
        ...node,
        ...rounded[node.id],
        image: node.image && !node.image.startsWith(BASE)
          ? BASE + node.image.replace(/^\/+/, '')
          : node.image,
      }));
      if (!nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))) {
        throw new Error(`${version}/${scenario}/${language.code}: node set does not match the computed layout`);
      }

      // parseNode emits the first-prerequisite edge in both collections.
      const seenEdges = new Set();
      const edges = parsed.edges.concat(parsed.lateEdges).filter((edge) => {
        const key = `${edge.from} ${edge.to}`;
        if (seenEdges.has(key)) return false;
        seenEdges.add(key);
        return true;
      });
      const graphPath = graphArtifactPath(version, scenario, language.code);
      writeJson(graphPath, { nodes, edges });
    }
    console.log(`graph/${version}.${scenario}.*.json: ${languages.length} language bundles written`);
  }
}
process.exit(0);
