#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { ROOT_SEO, assertSeoMetadata } from './lib/seo_metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const SITE = 'https://pzixel.github.io/terra-invicta-techtree-update/';
const DLC_SCENARIOS = {
  '2003': 'dark-skies/2003/',
  'broken-earth': 'dark-skies/broken-earth/',
};
const failures = [];

const readStableEnglishBundle = (scenario) => {
  const relativePath = `bundles/stable/${scenario}/en.json`;
  const bundle = JSON.parse(fs.readFileSync(path.join(PUBLIC, ...relativePath.split('/')), 'utf8'));
  if (bundle.key?.version !== 'stable' ||
      bundle.key?.scenario !== scenario ||
      bundle.key?.language !== 'en' ||
      !Array.isArray(bundle.collections?.tech) ||
      !Array.isArray(bundle.collections?.project)) {
    failures.push(`${relativePath}: invalid stable/${scenario}/en bundle`);
  }
  return bundle;
};

const standardBundle = readStableEnglishBundle('standard');
const standardDataNames = new Set(
  [...standardBundle.collections.tech, ...standardBundle.collections.project]
    .map((item) => item.dataName)
    .filter((dataName) => typeof dataName === 'string')
);
const dlcRouteShells = new Map();
for (const [scenario, landingPath] of Object.entries(DLC_SCENARIOS)) {
  const bundle = readStableEnglishBundle(scenario);
  for (const item of [...bundle.collections.tech, ...bundle.collections.project].filter((candidate) => candidate.dlcOnly)) {
    const dataName = item.dataName;
    if (typeof dataName !== 'string' || !/^[A-Za-z0-9_-]+$/.test(dataName)) {
      failures.push(`stable/${scenario}/en: invalid DLC-only dataName ${JSON.stringify(dataName)}`);
      continue;
    }
    if (standardDataNames.has(dataName)) {
      failures.push(`stable/${scenario}/en: DLC-only route ${dataName} collides with a Standard entity`);
      continue;
    }
    if (dlcRouteShells.has(dataName)) {
      failures.push(`stable/${scenario}/en: DLC-only route ${dataName} appears in multiple scenarios`);
      continue;
    }
    dlcRouteShells.set(dataName, { scenario, landingPath });
  }
}

const findCanonicalHtml = (directory) => {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...findCanonicalHtml(absolute));
    if (entry.isFile() && entry.name === 'index.html') results.push(absolute);
  }
  return results;
};

const seen = {
  title: new Map(),
  description: new Map(),
  canonical: new Map(),
};
const rememberUnique = (kind, value, label) => {
  if (seen[kind].has(value)) {
    failures.push(`${label}: duplicate ${kind} also used by ${seen[kind].get(value)}`);
  } else {
    seen[kind].set(value, label);
  }
};

for (const file of findCanonicalHtml(DIST)) {
  const label = path.relative(DIST, file) || 'index.html';
  const relativeDirectory = path.dirname(label);
  const expectedCanonical = relativeDirectory === '.'
    ? SITE
    : `${SITE}${relativeDirectory.split(path.sep).join('/')}/`;
  const dom = new JSDOM(fs.readFileSync(file, 'utf8'));
  const document = dom.window.document;
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
  if (/\bnoindex\b/i.test(robots)) {
    if (!dlcRouteShells.has(relativeDirectory)) {
      failures.push(`${label}: unexpected noindex page`);
    }
    continue;
  }

  const titles = document.querySelectorAll('title');
  const descriptions = document.querySelectorAll('meta[name="description"]');
  const canonicals = document.querySelectorAll('link[rel="canonical"]');
  const headings = document.querySelectorAll('h1');
  if (titles.length !== 1) failures.push(`${label}: expected one title, found ${titles.length}`);
  if (descriptions.length !== 1) failures.push(`${label}: expected one description, found ${descriptions.length}`);
  if (canonicals.length !== 1) failures.push(`${label}: expected one canonical URL, found ${canonicals.length}`);
  if (headings.length !== 1 || !headings[0]?.textContent?.trim()) {
    failures.push(`${label}: expected one non-empty H1, found ${headings.length}`);
  }
  if (titles.length !== 1 || descriptions.length !== 1 || canonicals.length !== 1) continue;

  const title = titles[0].textContent.trim();
  const description = descriptions[0].getAttribute('content')?.trim() || '';
  const canonical = canonicals[0].getAttribute('href')?.trim() || '';
  try {
    assertSeoMetadata({ title, description, label });
  } catch (error) {
    failures.push(error.message);
  }
  if (canonical !== expectedCanonical) {
    failures.push(`${label}: canonical URL is ${canonical}, expected ${expectedCanonical}`);
  }
  rememberUnique('title', title, label);
  rememberUnique('description', description, label);
  rememberUnique('canonical', canonical, label);

  const parity = [
    ['og:title', document.querySelector('meta[property="og:title"]')?.getAttribute('content'), title],
    ['og:description', document.querySelector('meta[property="og:description"]')?.getAttribute('content'), description],
    ['og:url', document.querySelector('meta[property="og:url"]')?.getAttribute('content'), canonical],
    ['twitter:title', document.querySelector('meta[name="twitter:title"]')?.getAttribute('content'), title],
    ['twitter:description', document.querySelector('meta[name="twitter:description"]')?.getAttribute('content'), description],
  ];
  for (const [name, actual, expected] of parity) {
    if (actual !== expected) failures.push(`${label}: ${name} does not match canonical metadata`);
  }

  if (canonical === SITE) {
    if (title !== ROOT_SEO.title || description !== ROOT_SEO.description) {
      failures.push(`${label}: root metadata does not match the approved copy`);
    }
    if (headings[0]?.textContent?.trim() !== ROOT_SEO.title) {
      failures.push(`${label}: root H1 does not match the approved title`);
    }
    if (document.querySelector('.tagline')?.textContent?.trim() !== ROOT_SEO.description) {
      failures.push(`${label}: root lead does not match the approved description`);
    }
  }
}

for (const [dataName, route] of dlcRouteShells) {
  const label = `${dataName}/index.html`;
  const file = path.join(DIST, dataName, 'index.html');
  if (!fs.existsSync(file)) {
    failures.push(`${label}: DLC route shell is missing`);
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  const document = new JSDOM(html).window.document;
  const titles = document.querySelectorAll('title');
  const descriptions = document.querySelectorAll('meta[name="description"]');
  const headings = document.querySelectorAll('h1');
  const robots = document.querySelectorAll('meta[name="robots"]');
  const canonicals = document.querySelectorAll('link[rel="canonical"]');
  const ogUrls = document.querySelectorAll('meta[property="og:url"]');
  const graphPreloads = [...document.querySelectorAll('link[rel="preload"][as="fetch"]')]
    .filter((entry) => entry.getAttribute('href')?.includes('/graph/'));
  const scenarioBootstraps = document.querySelectorAll('script[data-dlc-route-scenario]');
  const appBootScripts = document.querySelectorAll('script[type="module"], script[defer]');

  if (titles.length !== 1) failures.push(`${label}: expected one title, found ${titles.length}`);
  if (descriptions.length !== 1) failures.push(`${label}: expected one description, found ${descriptions.length}`);
  if (headings.length !== 1 || !headings[0]?.textContent?.trim()) {
    failures.push(`${label}: expected one non-empty H1, found ${headings.length}`);
  }
  if (robots.length !== 1 || robots[0]?.getAttribute('content')?.trim().toLowerCase() !== 'noindex, follow') {
    failures.push(`${label}: robots metadata must be exactly noindex, follow`);
  }

  const landingUrl = `${SITE}${route.landingPath}`;
  if (canonicals.length !== 1 || canonicals[0]?.getAttribute('href')?.trim() !== landingUrl) {
    failures.push(`${label}: canonical URL must be ${landingUrl}`);
  }
  if (ogUrls.length !== 1 || ogUrls[0]?.getAttribute('content')?.trim() !== landingUrl) {
    failures.push(`${label}: og:url must be ${landingUrl}`);
  }

  const expectedGraphPreload = new URL(`graph/stable.${route.scenario}.en.json`, SITE).pathname;
  if (graphPreloads.length !== 1 || graphPreloads[0]?.getAttribute('href') !== expectedGraphPreload) {
    failures.push(`${label}: graph preload must be ${expectedGraphPreload}`);
  }

  if (scenarioBootstraps.length !== 1 ||
      scenarioBootstraps[0]?.getAttribute('data-dlc-route-scenario') !== route.scenario) {
    failures.push(`${label}: expected one ${route.scenario} scenario bootstrap`);
  } else {
    if (appBootScripts.length === 0) {
      failures.push(`${label}: module/deferred app boot is missing`);
    }
    for (const appBoot of appBootScripts) {
      const bootstrapPrecedesApp = Boolean(
        scenarioBootstraps[0].compareDocumentPosition(appBoot) & document.defaultView.Node.DOCUMENT_POSITION_FOLLOWING
      );
      if (!bootstrapPrecedesApp) {
        failures.push(`${label}: scenario bootstrap must precede every module/deferred app boot`);
      }
    }

    const requestedUrl = new URL(
      `${dataName}/?lang=fr&scenario=wrong&tag=one&tag=two#selected=keep`,
      SITE
    );
    const expectedUrl = new URL(requestedUrl);
    expectedUrl.searchParams.set('scenario', route.scenario);
    const bootWindow = new JSDOM(html, {
      runScripts: 'dangerously',
      url: requestedUrl.href,
    }).window;
    if (bootWindow.location.pathname !== expectedUrl.pathname ||
        bootWindow.location.search !== expectedUrl.search ||
        bootWindow.location.hash !== expectedUrl.hash) {
      failures.push(
        `${label}: scenario bootstrap must override scenario while preserving path, other query parameters, and hash`
      );
    }
  }

  if (titles.length === 1 && descriptions.length === 1) {
    try {
      assertSeoMetadata({
        title: titles[0].textContent.trim(),
        description: descriptions[0].getAttribute('content')?.trim() || '',
        label,
      });
    } catch (error) {
      failures.push(error.message);
    }
  }
}

const sitemapFile = path.join(DIST, 'sitemap.xml');
if (!fs.existsSync(sitemapFile)) {
  failures.push('sitemap.xml is missing');
} else {
  const sitemap = new JSDOM(fs.readFileSync(sitemapFile, 'utf8'), { contentType: 'text/xml' }).window.document;
  const sitemapUrls = [...sitemap.querySelectorAll('url > loc')].map((entry) => entry.textContent?.trim() || '');
  const sitemapSet = new Set(sitemapUrls);
  if (sitemapSet.size !== sitemapUrls.length) failures.push('sitemap.xml contains duplicate canonical URLs');
  for (const canonical of seen.canonical.keys()) {
    if (!sitemapSet.has(canonical)) failures.push(`sitemap.xml is missing ${canonical}`);
  }
  for (const sitemapUrl of sitemapSet) {
    if (!seen.canonical.has(sitemapUrl)) failures.push(`sitemap.xml contains non-canonical URL ${sitemapUrl}`);
  }
  for (const scenarioPath of ['dark-skies/2003/', 'dark-skies/broken-earth/']) {
    if (!sitemapSet.has(`${SITE}${scenarioPath}`)) failures.push(`sitemap.xml is missing ${scenarioPath}`);
  }
  for (const dataName of dlcRouteShells.keys()) {
    const routeUrl = `${SITE}${dataName}/`;
    if (sitemapSet.has(routeUrl)) failures.push(`sitemap.xml contains noindex DLC route shell ${routeUrl}`);
  }
}

if (failures.length) {
  throw new Error(`SEO validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${seen.canonical.size} canonical HTML pages: unique metadata, lengths, parity, canonical URLs, and H1s`);
console.log(`Validated ${dlcRouteShells.size} noindex DLC route shells from stable scenario bundles`);
