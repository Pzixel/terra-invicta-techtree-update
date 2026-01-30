#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GAMEFILES_ROOT = path.resolve(__dirname, '../public/gamefiles');

const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');

const validVersions = new Set(['stable', 'experimental']);
const versionFlag = args.find((arg) => arg.startsWith('--version='));
const positionalVersion = args.find((arg) => validVersions.has(arg));
const version = (versionFlag ? versionFlag.split('=')[1] : positionalVersion) || 'stable';

if (helpRequested) {
  console.log('Usage: node scripts/sum_global_tech_costs.js [stable|experimental]');
  console.log('       node scripts/sum_global_tech_costs.js --version=stable');
  process.exit(0);
}

if (!validVersions.has(version)) {
  console.error(`Unknown version: ${version}`);
  console.error('Use one of: stable, experimental');
  process.exit(1);
}

const techPath = path.join(GAMEFILES_ROOT, version, 'Templates', 'TITechTemplate.json');

if (!fs.existsSync(techPath)) {
  console.error('Tech template not found at', techPath);
  process.exit(1);
}

const raw = fs.readFileSync(techPath, 'utf8');
const techs = JSON.parse(raw);

if (!Array.isArray(techs)) {
  console.error('Unexpected tech template format; expected JSON array.');
  process.exit(1);
}

const totals = new Map();
const byCategory = new Map();
let grandTotal = 0;
let counted = 0;

const formatThousands = (value) => {
  const thousands = value / 1000;
  const rounded = Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1);
  return `${rounded}k`;
};

for (const tech of techs) {
  if (!tech || typeof tech !== 'object') continue;

  const category = typeof tech.techCategory === 'string' && tech.techCategory.trim()
    ? tech.techCategory
    : 'Unknown';
  const cost = Number.isFinite(tech.researchCost) ? tech.researchCost : Number(tech.researchCost ?? 0);
  const safeCost = Number.isFinite(cost) ? cost : 0;

  totals.set(category, (totals.get(category) ?? 0) + safeCost);
  const name = typeof tech.friendlyName === 'string' && tech.friendlyName.trim()
    ? tech.friendlyName
    : (typeof tech.dataName === 'string' && tech.dataName.trim() ? tech.dataName : 'Unknown');
  const dataName = typeof tech.dataName === 'string' ? tech.dataName : '';
  if (name.startsWith('Future Tech:') || dataName.startsWith('FutureTech')) {
    continue;
  }
  const list = byCategory.get(category) ?? [];
  list.push({ name, cost: safeCost });
  byCategory.set(category, list);
  grandTotal += safeCost;
  counted += 1;
}

const sorted = [...totals.entries()].sort((a, b) => {
  const diff = b[1] - a[1];
  return diff !== 0 ? diff : a[0].localeCompare(b[0]);
});

console.log(`Version: ${version}`);
console.log(`Global techs counted: ${counted}`);
console.log('');
for (const [category, total] of sorted) {
  const items = (byCategory.get(category) ?? [])
    .slice()
    .sort((a, b) => {
      const diff = b.cost - a.cost;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    })
    .slice(0, 5)
    .map((item) => `${item.name} ${formatThousands(item.cost)}`)
    .join(', ');
  console.log(`${category.toString().padEnd(20, ' ')}:\t${formatThousands(total)}\t[${items}]`);
}
console.log('');
console.log(`Grand total: ${formatThousands(grandTotal)}`);