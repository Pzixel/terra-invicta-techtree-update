import { TechTemplate } from './types';
import { TechDb } from './utils/TechDb';

export function findBlockingTechs(techDb: TechDb, techToSearch: TechTemplate | null): TechTemplate[] {
  if (!techToSearch) {
    return [];
  }
  return techDb.getBlockingTechs(techToSearch);
}

export function findBlockingTechsIncludingProjects(techDb: TechDb, techToSearch: TechTemplate | null): TechTemplate[] {
  if (!techToSearch) {
    return [];
  }
  return techDb.getBlockingTechs(techToSearch);
}

export function findPrereqTechs(techDb: TechDb, techToSearch: TechTemplate): TechTemplate[] {
  if (!techToSearch.prereqs) {
    return [];
  }
  return techToSearch.prereqs
    .filter(prereq => prereq !== "")
    .flatMap(prereq => {
      const tech = techDb.getTechByDataNameIncludingProjects(prereq);
      return tech ? [tech] : [];
    });
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
