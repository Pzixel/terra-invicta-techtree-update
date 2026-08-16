#!/usr/bin/env node
// Generates a static HTML page per tech/project in dist/ after `vite build`,
// plus /browse and /drives pages and a sitemap. Each page returns HTTP 200
// with real content for crawlers, then hydrates into the SPA route.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const GAMEFILES = path.join(ROOT, 'public', 'gamefiles');
const SITE = 'https://pzixel.github.io/terra-invicta-techtree-update/';

const template = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stripMarkup = (s) =>
  (s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const parseLocalization = (file) => {
  const map = {};
  if (!fs.existsSync(file)) return map;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    map[line.slice(0, idx).trim()] = line.slice(idx + 1);
  }
  return map;
};

// Collect techs and projects from stable, add experimental-only entries
const entries = new Map();
for (const version of ['stable', 'experimental']) {
  for (const [templateName, kind] of [
    ['TITechTemplate', 'Technology'],
    ['TIProjectTemplate', 'Project'],
  ]) {
    const templateFile = path.join(GAMEFILES, version, 'Templates', `${templateName}.json`);
    if (!fs.existsSync(templateFile)) continue;
    const loc = parseLocalization(
      path.join(GAMEFILES, version, 'Localization', 'en', `${templateName}.en`)
    );
    for (const item of JSON.parse(fs.readFileSync(templateFile, 'utf8'))) {
      const dataName = item.dataName;
      if (!dataName || !/^[A-Za-z0-9_-]+$/.test(dataName) || entries.has(dataName)) continue;
      entries.set(dataName, {
        dataName,
        kind,
        version,
        name: stripMarkup(loc[`${templateName}.displayName.${dataName}`]) || item.friendlyName || dataName,
        summary: stripMarkup(loc[`${templateName}.summary.${dataName}`]),
        description: stripMarkup(
          loc[`${templateName}.description.${dataName}`] || loc[`${templateName}.desc.${dataName}`]
        ),
        category: item.techCategory || '',
        researchCost: item.researchCost,
        prereqs: (item.prereqs || []).filter((p) => p),
      });
    }
  }
}

// Reverse edges: what each entry unlocks
const unlocks = new Map();
for (const entry of entries.values()) {
  for (const prereq of entry.prereqs) {
    if (!entries.has(prereq)) continue;
    if (!unlocks.has(prereq)) unlocks.set(prereq, []);
    unlocks.get(prereq).push(entry.dataName);
  }
}

const DETAILS_RE = /<!-- seo-details-start -->[\s\S]*<!-- seo-details-end -->/;
const HREFLANG_RE = /^\s*(<link rel="alternate" hreflang=|<!-- hreflang alternates).*\n/gm;

const breadcrumbJsonLd = (name, url) =>
  `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Terra Invicta Tech Tree', item: SITE },
      { '@type': 'ListItem', position: 2, name, item: url },
    ],
  })}</script>\n  `;

const renderPage = ({ url, title, description, detailsHtml, breadcrumbName }) => {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return template
    .replace('</head>', `${breadcrumbName ? breadcrumbJsonLd(breadcrumbName, url) : ''}</head>`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${d}"`)
    .replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${url}"`)
    .replace(/<meta property="og:title" content="[^"]*"/, `<meta property="og:title" content="${t}"`)
    .replace(/<meta property="og:description" content="[^"]*"/, `<meta property="og:description" content="${d}"`)
    .replace(/<meta property="og:url" content="[^"]*"/, `<meta property="og:url" content="${url}"`)
    .replace(/<meta name="twitter:title" content="[^"]*"/, `<meta name="twitter:title" content="${t}"`)
    .replace(/<meta name="twitter:description" content="[^"]*"/, `<meta name="twitter:description" content="${d}"`)
    .replace(HREFLANG_RE, '')
    .replace(DETAILS_RE, detailsHtml);
};

const writePage = (relDir, html) => {
  const dir = path.join(DIST, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
};

const linkList = (names) =>
  names
    .filter((n) => entries.has(n))
    .map((n) => `<li><a href="${SITE}${n}/">${escapeHtml(entries.get(n).name)}</a></li>`)
    .join('\n');

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

for (const entry of entries.values()) {
  const url = `${SITE}${entry.dataName}/`;
  const summaryText = entry.summary || entry.description || '';
  const description = truncate(
    `${entry.name} — Terra Invicta ${entry.kind.toLowerCase()}. ${summaryText}`,
    160
  );
  const prereqHtml = linkList(entry.prereqs);
  const unlocksHtml = linkList(unlocks.get(entry.dataName) || []);
  const detailsHtml = `
          <h2>${escapeHtml(entry.name)}</h2>
          <p><strong>${entry.kind}</strong>${entry.category ? ` · ${escapeHtml(entry.category)}` : ''}${
            typeof entry.researchCost === 'number'
              ? ` · Research cost: ${entry.researchCost.toLocaleString('en-US')}`
              : ''
          }</p>
          ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ''}
          ${entry.description && entry.description !== entry.summary ? `<p>${escapeHtml(entry.description)}</p>` : ''}
          ${prereqHtml ? `<h3>Prerequisites</h3><ul>${prereqHtml}</ul>` : ''}
          ${unlocksHtml ? `<h3>Leads to</h3><ul>${unlocksHtml}</ul>` : ''}
          <p><a href="${SITE}">Open the full interactive Terra Invicta tech tree</a></p>`;
  writePage(entry.dataName, renderPage({
    url,
    title: `${entry.name} — Terra Invicta Tech Tree`,
    description,
    detailsHtml,
    breadcrumbName: entry.name,
  }));
}

writePage('browse', renderPage({
  url: `${SITE}browse/`,
  title: 'Game Files Browser — Terra Invicta Tech Tree',
  description: 'Browse and download the raw Terra Invicta game data files (templates and localization) used by the tech tree viewer.',
  detailsHtml: '<p>Browse the raw Terra Invicta game data files used by this site.</p>',
}));
writePage('drives', renderPage({
  url: `${SITE}drives/`,
  title: 'Ship Drives Chart — Terra Invicta Tech Tree',
  description: 'Interactive comparison chart of all Terra Invicta ship drives: exhaust velocity, thrust, cooling and required research.',
  detailsHtml: '<p>Interactive comparison chart of all Terra Invicta ship drives.</p>',
}));

// Sitemap: root keeps language alternates, subpages are English-only
const langAlternates = [
  ['x-default', ''], ['en', '?lang=en'], ['zh-Hans', '?lang=chs'], ['zh-Hant', '?lang=cht'],
  ['de', '?lang=deu'], ['es', '?lang=esp'], ['fr', '?lang=fr'], ['ja', '?lang=jpn'],
  ['pl', '?lang=pol'], ['pt-BR', '?lang=por'], ['ko', '?lang=kor'], ['ru', '?lang=rus'],
  ['uk', '?lang=ukr'],
]
  .map(([lang, q]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE}${q}"/>`)
  .join('\n');

const urls = [
  `  <url>\n    <loc>${SITE}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n${langAlternates}\n  </url>`,
  `  <url>\n    <loc>${SITE}drives/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
  `  <url>\n    <loc>${SITE}browse/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.3</priority>\n  </url>`,
  ...[...entries.keys()].sort().map(
    (dn) => `  <url>\n    <loc>${SITE}${dn}/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`
  ),
];

fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`
);

console.log(`Generated ${entries.size} tech/project pages + browse/drives, sitemap with ${urls.length} URLs`);
