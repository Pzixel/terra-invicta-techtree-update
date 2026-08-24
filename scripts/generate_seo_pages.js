#!/usr/bin/env node
// Generates canonical static pages after Vite builds the SPA shell.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';
import {
  DLC_LANDING_SEO,
  assertSeoMetadata,
  makeEntityDescription,
  makeEntityTitle,
} from './lib/seo_metadata.js';
import { assertReleaseReady } from './lib/release_metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const jiti = createJiti(import.meta.url);
const { hydrateScenarioBundle } = await jiti.import(path.join(ROOT, 'src', 'data', 'loadScenarioView.ts'));
const { Languages } = await jiti.import(path.join(ROOT, 'src', 'language.ts'));
const { prerequisiteSlots } = await jiti.import(path.join(ROOT, 'src', 'data', 'scenarioCompiler.ts'));
const { graphArtifactPath, scenarioBundlePath } = await jiti.import(path.join(ROOT, 'src', 'scenario.ts'));
const DIST = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const SITE = 'https://pzixel.github.io/terra-invicta-techtree-update/';
const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const release = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'gamefiles', 'release.json'), 'utf8'));
assertReleaseReady(release);

const escapeHtml = (value) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stripMarkup = (value) =>
  (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Canonical entity pages describe the Standard tree. Scenario variants remain
// query-driven and canonicalize to their DLC landing page.
const readVerifiedBundle = (scenario) => {
  const relativePath = scenarioBundlePath('stable', scenario, 'en');
  const bundle = JSON.parse(fs.readFileSync(path.join(PUBLIC, ...relativePath.split('/')), 'utf8'));
  const expectedCounts = release.scenarios?.[scenario];
  if (bundle.key?.version !== 'stable' ||
      bundle.key?.scenario !== scenario ||
      bundle.key?.language !== 'en' ||
      bundle.snapshotId !== release.versions?.stable?.snapshotId ||
      bundle.effectiveCounts?.technologies !== expectedCounts?.technologies ||
      bundle.effectiveCounts?.projects !== expectedCounts?.projects ||
      bundle.collections?.tech?.length !== expectedCounts?.technologies ||
      bundle.collections?.project?.length !== expectedCounts?.projects) {
    throw new Error(`${relativePath}: bundle does not match the verified stable/${scenario}/en contract`);
  }
  return bundle;
};

const standardBundle = readVerifiedBundle('standard');
const standardView = hydrateScenarioBundle(standardBundle, Languages.en);
const localization = standardView.appStaticData.localizationDb;
const entries = new Map();
for (const [items, type, kind] of [
  [standardView.appStaticData.techs, 'tech', 'Technology'],
  [standardView.appStaticData.projects, 'project', 'Project'],
]) {
  for (const item of items) {
    const dataName = item.dataName;
    if (!dataName || !/^[A-Za-z0-9_-]+$/.test(dataName) || entries.has(dataName)) continue;
    entries.set(dataName, {
      dataName,
      kind,
      name: stripMarkup(item.displayName) || item.friendlyName || dataName,
      summary: stripMarkup(localization.getLocalizationString(type, dataName, 'summary')),
      description: stripMarkup(
        localization.getLocalizationString(type, dataName, 'description') ||
        localization.getLocalizationString(type, dataName, 'desc')
      ),
      category: item.techCategory || '',
      researchCost: item.researchCost,
      prerequisiteSlots: prerequisiteSlots(item),
    });
  }
}

const unlocks = new Map();
for (const entry of entries.values()) {
  for (const slot of entry.prerequisiteSlots) {
    for (const prereq of slot) {
      if (!entries.has(prereq)) continue;
      if (!unlocks.has(prereq)) unlocks.set(prereq, new Set());
      unlocks.get(prereq).add(entry.dataName);
    }
  }
}

const nameCounts = new Map();
for (const entry of entries.values()) {
  if (!nameCounts.has(entry.name)) nameCounts.set(entry.name, []);
  nameCounts.get(entry.name).push(entry);
}
const metadataQualifier = (entry) => {
  const sameName = nameCounts.get(entry.name) || [];
  if (sameName.length <= 1) return '';
  const sameKind = sameName.filter((candidate) => candidate.kind === entry.kind);
  return sameKind.length <= 1 ? entry.kind : entry.dataName;
};

const DETAILS_RE = /<!-- seo-details-start -->[\s\S]*<!-- seo-details-end -->/;
const HREFLANG_RE = /^\s*(<link rel="alternate" hreflang=|<!-- hreflang alternates).*\n/gm;
const GRAPH_PRELOAD_RE = /<link rel="preload" href="[^"]*\/graph\/[^"]+" as="fetch" crossorigin="anonymous"\s*\/?>/g;
const MODULE_SCRIPT_RE = /<script\b[^>]*\btype="module"[^>]*>/g;
const graphPreloads = template.match(GRAPH_PRELOAD_RE) ?? [];
if (graphPreloads.length !== 1) {
  throw new Error(`SPA template must contain exactly one graph preload, found ${graphPreloads.length}`);
}
const moduleScripts = template.match(MODULE_SCRIPT_RE) ?? [];
if (moduleScripts.length !== 1) {
  throw new Error(`SPA template must contain exactly one module app boot, found ${moduleScripts.length}`);
}

const breadcrumbJsonLd = (name, url) =>
  `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Terra Invicta Tech Tree', item: SITE },
      { '@type': 'ListItem', position: 2, name, item: url },
    ],
  })}</script>\n  `;

const renderPage = ({
  url,
  title,
  description,
  h1,
  detailsHtml,
  breadcrumbName,
  scenario = 'standard',
  robots = 'index, follow',
  bootstrapScenario = null,
}) => {
  assertSeoMetadata({ title, description, label: url });
  const escapedTitle = escapeHtml(title);
  const escapedDescription = escapeHtml(description);
  const graphPreload = new URL(graphArtifactPath('stable', scenario, 'en'), SITE).pathname;
  const scenarioBootstrap = bootstrapScenario
    ? `<script data-dlc-route-scenario="${bootstrapScenario}">
      (() => {
        const url = new URL(window.location.href);
        url.searchParams.set('scenario', ${JSON.stringify(bootstrapScenario)});
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      })();
    </script>
    `
    : '';
  return template
    .replace('</head>', `${breadcrumbName ? breadcrumbJsonLd(breadcrumbName, url) : ''}</head>`)
    .replace(moduleScripts[0], `${scenarioBootstrap}${moduleScripts[0]}`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapedTitle}</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${escapedDescription}"`)
    .replace(/<meta name="robots" content="[^"]*"/, `<meta name="robots" content="${robots}"`)
    .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${url}"`)
    .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${escapedTitle}"`)
    .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${escapedDescription}"`)
    .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`)
    .replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${escapedTitle}"`)
    .replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${escapedDescription}"`)
    .replace(
      graphPreloads[0],
      `<link rel="preload" href="${graphPreload}" as="fetch" crossorigin="anonymous">`
    )
    .replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${escapeHtml(h1)}</h1>`)
    .replace(/<p class="tagline">[\s\S]*?<\/p>/, `<p class="tagline">${escapedDescription}</p>`)
    .replace(HREFLANG_RE, '')
    .replace(DETAILS_RE, detailsHtml);
};

const writePage = (relativeDirectory, html) => {
  const directory = path.join(DIST, relativeDirectory);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'index.html'), html);
};

const linkList = (dataNames) =>
  [...dataNames]
    .filter((dataName) => entries.has(dataName))
    .map((dataName) => `<li><a href="${SITE}${dataName}/">${escapeHtml(entries.get(dataName).name)}</a></li>`)
    .join('\n');

for (const entry of entries.values()) {
  const url = `${SITE}${entry.dataName}/`;
  const qualifier = metadataQualifier(entry);
  const title = makeEntityTitle(entry.name, qualifier);
  const description = makeEntityDescription({
    name: qualifier ? `${entry.name} (${qualifier})` : entry.name,
    kind: entry.kind,
    summary: entry.summary || entry.description,
  });
  const prereqHtml = linkList(entry.prerequisiteSlots.flat());
  const unlocksHtml = linkList(unlocks.get(entry.dataName) || []);
  const detailsHtml = `<!-- seo-details-start -->
          <h2>About ${escapeHtml(entry.name)}</h2>
          <p><strong>${escapeHtml(entry.name)}</strong> is a Terra Invicta ${entry.kind.toLowerCase()}${entry.category ? ` in ${escapeHtml(entry.category)}` : ''}${
            typeof entry.researchCost === 'number'
              ? ` with a research cost of ${entry.researchCost.toLocaleString('en-US')}`
              : ''
          }.</p>
          ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ''}
          ${entry.description && entry.description !== entry.summary ? `<p>${escapeHtml(entry.description)}</p>` : ''}
          ${prereqHtml ? `<h3>Prerequisites</h3><ul>${prereqHtml}</ul>` : ''}
          ${unlocksHtml ? `<h3>Leads to</h3><ul>${unlocksHtml}</ul>` : ''}
          <p><a href="${SITE}">Open the full interactive Terra Invicta tech tree</a></p>
          <!-- seo-details-end -->`;
  writePage(entry.dataName, renderPage({
    url,
    title,
    description,
    h1: entry.name,
    detailsHtml,
    breadcrumbName: entry.name,
  }));
}

const utilityPages = [
  {
    directory: 'browse',
    title: 'Game Files Browser — Terra Invicta Tech Tree',
    description: 'Browse and download the raw Terra Invicta game data files, templates, and localization used by the interactive tech tree.',
    h1: 'Terra Invicta Game Files Browser',
    details: '<p>Browse the raw Terra Invicta game data files used by this site.</p>',
  },
  {
    directory: 'drives',
    title: 'Ship Drives Chart — Terra Invicta Tech Tree',
    description: 'Compare Terra Invicta ship drives by exhaust velocity, thrust, cooling, required power, and prerequisite research.',
    h1: 'Terra Invicta Ship Drives Chart',
    details: '<p>Compare every Terra Invicta ship drive in the interactive chart.</p>',
  },
];

for (const page of utilityPages) {
  const url = `${SITE}${page.directory}/`;
  writePage(page.directory, renderPage({
    url,
    title: page.title,
    description: page.description,
    h1: page.h1,
    detailsHtml: `<!-- seo-details-start -->${page.details}<!-- seo-details-end -->`,
    breadcrumbName: page.h1,
  }));
}

for (const [scenario, metadata] of Object.entries(DLC_LANDING_SEO)) {
  const relativeDirectory = `dark-skies/${scenario}`;
  const url = `${SITE}${relativeDirectory}/`;
  const scenarioName = scenario === '2003' ? '2003 Scenario' : 'Broken Earth Scenario';
  writePage(relativeDirectory, renderPage({
    url,
    ...metadata,
    h1: metadata.title,
    scenario,
    detailsHtml: `<!-- seo-details-start -->
          <h2>${escapeHtml(scenarioName)} technology and project tree</h2>
          <p>${escapeHtml(metadata.description)}</p>
          <p><a href="${url}">Open the interactive ${escapeHtml(scenarioName)} tech tree</a></p>
          <!-- seo-details-end -->`,
    breadcrumbName: scenarioName,
  }));
}

const dlcRouteShells = new Map();
for (const scenario of Object.keys(DLC_LANDING_SEO)) {
  const bundle = readVerifiedBundle(scenario);
  const scenarioView = hydrateScenarioBundle(bundle, Languages.en);
  const scenarioLocalization = scenarioView.appStaticData.localizationDb;
  for (const [items, type, kind] of [
    [scenarioView.appStaticData.techs, 'tech', 'Technology'],
    [scenarioView.appStaticData.projects, 'project', 'Project'],
  ]) {
    for (const item of items.filter((candidate) => candidate.dlcOnly)) {
      const dataName = item.dataName;
      if (!dataName || !/^[A-Za-z0-9_-]+$/.test(dataName)) {
        throw new Error(`stable/${scenario}/en: invalid DLC-only dataName ${JSON.stringify(dataName)}`);
      }
      if (entries.has(dataName) || dlcRouteShells.has(dataName)) {
        throw new Error(`stable/${scenario}/en: DLC-only route ${dataName} collides with another entity`);
      }
      dlcRouteShells.set(dataName, {
        dataName,
        scenario,
        kind,
        name: stripMarkup(item.displayName) || item.friendlyName || dataName,
        summary: stripMarkup(scenarioLocalization.getLocalizationString(type, dataName, 'summary')),
        description: stripMarkup(
          scenarioLocalization.getLocalizationString(type, dataName, 'description') ||
          scenarioLocalization.getLocalizationString(type, dataName, 'desc')
        ),
        category: item.techCategory || '',
        researchCost: item.researchCost,
      });
    }
  }
}

for (const entry of dlcRouteShells.values()) {
  const landingUrl = `${SITE}dark-skies/${entry.scenario}/`;
  const title = makeEntityTitle(entry.name);
  const description = makeEntityDescription({
    name: entry.name,
    kind: entry.kind,
    summary: entry.summary || entry.description,
  });
  const detailsHtml = `<!-- seo-details-start -->
          <h2>About ${escapeHtml(entry.name)}</h2>
          <p><strong>${escapeHtml(entry.name)}</strong> is a Dark Skies ${entry.kind.toLowerCase()}${entry.category ? ` in ${escapeHtml(entry.category)}` : ''}${
            typeof entry.researchCost === 'number'
              ? ` with a research cost of ${entry.researchCost.toLocaleString('en-US')}`
              : ''
          }.</p>
          ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ''}
          ${entry.description && entry.description !== entry.summary ? `<p>${escapeHtml(entry.description)}</p>` : ''}
          <p><a href="${landingUrl}">Open the interactive Dark Skies scenario tech tree</a></p>
          <!-- seo-details-end -->`;
  writePage(entry.dataName, renderPage({
    url: landingUrl,
    title,
    description,
    h1: entry.name,
    detailsHtml,
    scenario: entry.scenario,
    robots: 'noindex, follow',
    bootstrapScenario: entry.scenario,
  }));
}

const languageAlternates = [
  ['x-default', ''], ['en', '?lang=en'], ['zh-Hans', '?lang=chs'], ['zh-Hant', '?lang=cht'],
  ['de', '?lang=deu'], ['es', '?lang=esp'], ['fr', '?lang=fr'], ['ja', '?lang=jpn'],
  ['pl', '?lang=pol'], ['pt-BR', '?lang=por'], ['ko', '?lang=kor'], ['ru', '?lang=rus'],
  ['uk', '?lang=ukr'],
]
  .map(([language, query]) => `    <xhtml:link rel="alternate" hreflang="${language}" href="${SITE}${query}"/>`)
  .join('\n');

const sitemapEntries = [
  `  <url>\n    <loc>${SITE}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n${languageAlternates}\n  </url>`,
  ...utilityPages.map((page) =>
    `  <url>\n    <loc>${SITE}${page.directory}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${page.directory === 'drives' ? '0.8' : '0.3'}</priority>\n  </url>`
  ),
  ...Object.keys(DLC_LANDING_SEO).map((scenario) =>
    `  <url>\n    <loc>${SITE}dark-skies/${scenario}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>`
  ),
  ...[...entries.keys()].sort().map((dataName) =>
    `  <url>\n    <loc>${SITE}${dataName}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`
  ),
];

fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemapEntries.join('\n')}\n</urlset>\n`
);

console.log(`Generated ${entries.size} entity pages, ${utilityPages.length} utility pages, ${Object.keys(DLC_LANDING_SEO).length} DLC pages, and ${sitemapEntries.length} sitemap URLs`);
console.log(`Generated ${dlcRouteShells.size} noindex DLC route shells`);
