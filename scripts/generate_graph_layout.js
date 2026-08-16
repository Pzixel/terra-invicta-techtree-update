#!/usr/bin/env node
// Precomputes the vis-network graph layout for each game version by running
// the app's real graph code (TechDb + parseNode + draw) in Node under jsdom
// with a stubbed canvas. Node positions come from vis-network's hierarchical
// layout algorithm, which does not depend on actual pixel rendering.
// Results go to <outDir>/layout/<version>.json; the app falls back to laying
// out live when a file is missing.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { createJiti } from 'jiti';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GAMEFILES = path.join(ROOT, 'public', 'gamefiles');
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist');
const VERSIONS = ['stable', 'experimental'];

// --- Browser environment shim (must exist before vis-network loads) ---
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

// 2D context stub: layout only needs measureText-ish APIs, drawing is discarded
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

// --- Load the app's real modules (TypeScript, via jiti) ---
const jiti = createJiti(import.meta.url);
const { TechDb } = await jiti.import(path.join(ROOT, 'src/utils/TechDb.ts'));
const { LocalizationDb, getTemplateData, TemplateTypes } = await jiti.import(path.join(ROOT, 'src/types/index.ts'));
const { Languages } = await jiti.import(path.join(ROOT, 'src/language.ts'));
const { parseNode, draw } = await jiti.import(path.join(ROOT, 'src/techGraphRender.ts'));
const vis = await import('vis-network/standalone/esm/vis-network.js');

const readGamefile = (version, relative) =>
  fs.readFileSync(path.join(GAMEFILES, version, relative), 'utf8');

// Mirrors loadTemplateData + init from src/App.tsx (which can't be imported
// in Node because it pulls in React and CSS)
const buildTechDb = (version, language) => {
  const localizationResults = Object.values(TemplateTypes).map((filename) =>
    readGamefile(version, `Localization/${language.code}/${filename}.${language.code}`)
  );
  const templateResults = Object.entries(TemplateTypes)
    .concat([['bilateral', 'TIBilateralTemplate']])
    .map(([type, filename]) => [type, JSON.parse(readGamefile(version, `Templates/${filename}.json`))]);

  const localizationDb = new LocalizationDb(localizationResults, language.uiTexts);
  const templateData = getTemplateData(templateResults);

  // Remove alien master projects, same as loadTemplateData in src/App.tsx
  if (templateData.project) {
    templateData.project = templateData.project.filter(
      (project) => project.dataName !== 'Project_AlienMasterProject' && project.dataName !== 'Project_AlienAdvancedMasterProject'
    );
  }

  const techs = templateData.tech ?? [];
  const projects = templateData.project ?? [];
  projects.forEach((project) => { project.isProject = true; });

  const counts = {};
  const techTree = techs.concat(projects);
  techTree.forEach((tech, index) => {
    tech.displayName = localizationDb.getReadable(tech.isProject ? 'project' : 'tech', tech.dataName, 'displayName');
    tech.id = index;
    counts[tech.displayName] = (counts[tech.displayName] ?? 0) + 1;
  });
  for (const tech of techTree) {
    if (counts[tech.displayName] > 1) {
      tech.displayName += ` (${tech.friendlyName})`;
    }
  }
  return { techDb: new TechDb(techTree), templateData };
};

fs.mkdirSync(path.join(OUT_DIR, 'layout'), { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, 'graph'), { recursive: true });
for (const version of VERSIONS) {
  const { techDb, templateData } = buildTechDb(version, Languages.en);
  const { nodes, edges, lateNodes, lateEdges } = parseNode(techDb, templateData, false);
  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  const network = draw(data, lateNodes, lateEdges, () => {});
  const positions = network.getPositions();
  network.destroy();
  const rounded = {};
  for (const [id, pos] of Object.entries(positions)) {
    rounded[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
  }
  fs.writeFileSync(path.join(OUT_DIR, 'layout', `${version}.json`), JSON.stringify(rounded));
  console.log(`layout/${version}.json: ${Object.keys(rounded).length} node positions`);

  // Precompiled graph bundles: parseNode output (labels are localized) plus
  // the coordinates above, one file per language. Positions are language-
  // independent (validated: 0px delta), only labels differ.
  for (const language of Object.values(Languages)) {
    if (!language.availableVersions.includes(version)) continue;
    try {
      const built = language.code === 'en'
        ? { techDb, templateData }
        : buildTechDb(version, language);
      const parsed = parseNode(built.techDb, built.templateData, false);
      const bundleNodes = parsed.nodes.concat(parsed.lateNodes).map((node) => ({
        ...node,
        ...rounded[node.id],
      }));
      const bundleEdges = parsed.edges.concat(parsed.lateEdges);
      if (!bundleNodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))) {
        throw new Error('node set does not match computed positions');
      }
      fs.writeFileSync(
        path.join(OUT_DIR, 'graph', `${version}.${language.code}.json`),
        JSON.stringify({ nodes: bundleNodes, edges: bundleEdges })
      );
    } catch (error) {
      console.warn(`graph/${version}.${language.code}.json skipped: ${error.message}`);
    }
  }
  console.log(`graph/${version}.*.json bundles written`);
}
process.exit(0);
