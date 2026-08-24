import { TechTemplate } from './types';
import { TechDb } from './utils/TechDb';
import { selectedPrerequisiteTechs } from './utils/prerequisites';

// Same-origin path of the deploy base (vite `base` may be a full URL); ends with '/'.
// The env fallback covers non-Vite contexts (build scripts importing this module).
export const BASE_PATH = new URL(import.meta.env?.BASE_URL ?? '/', window.location.origin).pathname;

// Resolve a public asset path against the deploy base so it works from nested
// routes like /SomeTech/ where relative URLs would break
export function assetUrl(path: string): string {
  return BASE_PATH + path.replace(/^\.?\//, '');
}

export function findBlockingTechs(techDb: TechDb, techToSearch: TechTemplate | null): TechTemplate[] {
  if (!techToSearch) {
    return [];
  }
  return techDb.getBlockingTechs(techToSearch);
}

export function findPrereqTechs(techDb: TechDb, techToSearch: TechTemplate): TechTemplate[] {
  return selectedPrerequisiteTechs(techToSearch, (dataName) => techDb.getTechByDataName(dataName));
}

export function getAncestorTechs(techDb: TechDb, techToSearch: TechTemplate | null): TechTemplate[] {
  if (!techToSearch) {
    return [];
  }

  return findPrereqTechs(techDb, techToSearch)
    .reduce<TechTemplate[]>((arr, curr) => arr.concat(getAncestorTechs(techDb, curr)), [])
    .concat(findPrereqTechs(techDb, techToSearch));
}

export function getDescendentTechs(techDb: TechDb, techToSearch: TechTemplate | null): TechTemplate[] {
  if (!techToSearch) {
    return [];
  }
  return findBlockingTechs(techDb, techToSearch)
    .reduce<TechTemplate[]>((arr, curr) => arr.concat(getDescendentTechs(techDb, curr)), [])
    .concat(findBlockingTechs(techDb, techToSearch));
}
