import fs from 'node:fs';
import path from 'node:path';

const TECH_CATEGORY_ICONS = Object.freeze({
  Energy: 'tech_energy_icon.png',
  InformationScience: 'tech_info_icon.png',
  LifeScience: 'tech_life_icon.png',
  Materials: 'tech_material_icon.png',
  MilitaryScience: 'tech_military_icon.png',
  SocialScience: 'tech_society_icon.png',
  SpaceScience: 'tech_space_icon.png',
  Xenology: 'tech_xeno_icon.png',
});

const MODULE_COLLECTIONS = Object.freeze([
  'battery', 'drive', 'gun', 'habmodule', 'heatsink', 'laserweapon',
  'magneticgun', 'missile', 'particleweapon', 'plasmaweapon', 'powerplant',
  'radiator', 'shiparmor', 'shiphull', 'utilitymodule',
]);
const MODULE_ICON_FIELDS = Object.freeze(['iconResource', 'baseIconResource', 'stationIconResource']);

function isSafeIconResource(resource) {
  if (path.posix.isAbsolute(resource) || resource.includes('\\') || resource.includes('\0')) return false;
  return resource.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function hasExactFile(root, relativePath) {
  let current = root;
  const segments = relativePath.split('/');
  for (let index = 0; index < segments.length; index += 1) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory()) return false;
    if (!fs.readdirSync(current).includes(segments[index])) return false;
    current = path.join(current, segments[index]);
  }
  return fs.existsSync(current) && fs.statSync(current).isFile();
}

function requireIcon(requirements, relativePath, context) {
  const contexts = requirements.get(relativePath) ?? new Set();
  contexts.add(context);
  requirements.set(relativePath, contexts);
}

/**
 * Covers only image paths the current graph/sidebar render: node category
 * images, project/faction chrome, and icon resources on modules reachable from
 * an active project. Org logos and other unrendered game assets are excluded.
 */
export function validateRenderedIcons(bundle, iconsRoot, loadedView) {
  const failures = [];
  const requirements = new Map();
  const collections = loadedView?.appStaticData?.templateData ?? bundle?.collections ?? {};
  const nodes = [...(collections.tech ?? []), ...(collections.project ?? [])];
  const activeProjects = new Set(
    (collections.project ?? [])
      .filter((record) => record && typeof record === 'object' && typeof record.dataName === 'string')
      .map((record) => record.dataName)
  );

  for (const node of nodes) {
    const dataName = node?.dataName ?? 'unknown';
    const icon = TECH_CATEGORY_ICONS[node?.techCategory];
    if (!icon) {
      failures.push(`${dataName}: unsupported rendered techCategory ${String(node?.techCategory)}`);
    } else {
      requireIcon(requirements, icon, `${dataName}.techCategory`);
    }
  }

  if (activeProjects.size > 0) {
    requireIcon(requirements, 'ICO_projects.png', 'project marker (dark theme)');
    requireIcon(requirements, 'ICO_projects_Invert.png', 'project marker (light theme)');
  }

  for (const project of collections.project ?? []) {
    const factionNames = [project?.factionAlways, ...(Array.isArray(project?.factionPrereq) ? project.factionPrereq : [])];
    for (const faction of factionNames) {
      if (typeof faction === 'string' && faction.length > 0) {
        requireIcon(requirements, `FAC_${faction}_128.png`, `${project.dataName}.faction`);
      }
    }
  }

  for (const collection of MODULE_COLLECTIONS) {
    for (const module of collections[collection] ?? []) {
      if (!activeProjects.has(module?.requiredProjectName)) continue;
      const field = MODULE_ICON_FIELDS.find((candidate) => module?.[candidate] != null && module[candidate] !== '');
      if (!field) continue;
      const resource = module[field];
      if (typeof resource !== 'string' || !isSafeIconResource(resource)) {
        failures.push(`${collection}.${module?.dataName ?? 'unknown'}.${field}: invalid icon resource ${String(resource)}`);
        continue;
      }
      requireIcon(requirements, `${resource}.png`, `${collection}.${module.dataName}.${field}`);
    }
  }

  for (const [relativePath, contexts] of requirements) {
    if (!hasExactFile(iconsRoot, relativePath)) {
      failures.push(`${relativePath}: missing rendered icon referenced by ${[...contexts].sort().join(', ')}`);
    }
  }
  return failures;
}

export function createRenderedIconGate(iconsRoot) {
  const validatedViews = new Set();
  const failures = new Set();
  return {
    validate(bundle, loadedView) {
      const key = `${bundle?.key?.version ?? 'unknown'}/${bundle?.key?.scenario ?? 'unknown'}`;
      if (validatedViews.has(key)) return;
      validatedViews.add(key);
      for (const failure of validateRenderedIcons(bundle, iconsRoot, loadedView)) failures.add(`${key}: ${failure}`);
    },
    failures() {
      return [...failures];
    },
  };
}
