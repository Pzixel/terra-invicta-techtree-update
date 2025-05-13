import { LocalizationData, TemplateData, TechTemplate } from './types';
import { TechDb } from './utils/TechDb';

export function findBlockingTechs(techDb: TechDb, techToSearch: TechTemplate | null): TechTemplate[] {
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
      const tech = techDb.getTechByDataName(prereq);
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

export function parselocalization(
  localizationStrings: LocalizationData,
  text: string,
  localizationType: string
): void {
  const lines = text.split("\n");

  lines.forEach(line => {
    line = line.split("//")[0].trim();

    const splitter = line.split(/=(.*)/s);
    const key = splitter[0];
    const value = splitter[1];

    if (!key || !value) return;

    const keySplit = key.split(".");
    const keyId = keySplit[2];

    if (!keyId) return;

    if (!localizationStrings[localizationType]) {
      localizationStrings[localizationType] = {};
    }

    if (!localizationStrings[localizationType][keyId]) {
      localizationStrings[localizationType][keyId] = {};
    }

    try {
      if (keySplit.length == 3) {
        localizationStrings[localizationType][keyId][keySplit[1]] = value;
      } else {
        if (!localizationStrings[localizationType][keyId][keySplit[1]]) {
          localizationStrings[localizationType][keyId][keySplit[1]] = {};
        }
        
        if (typeof localizationStrings[localizationType][keyId][keySplit[1]] === 'object') {
          (localizationStrings[localizationType][keyId][keySplit[1]] as Record<string, string>)[keySplit[3]] = value;
        }
      }
    } catch (error) {
      // TODO: why we're getting in here?
    }
  });
}

export function getLocalizationString(
  localizationStrings: LocalizationData,
  type: string,
  dataName: string,
  field: string
): string | undefined {
  return localizationStrings[type]?.[dataName]?.[field] as any; // TODO: fix the type
}

export function getReadable(
  localizationStrings: LocalizationData,
  type: string,
  dataName: string,
  field: string
): string {
  let text = getLocalizationString(localizationStrings, type, dataName, field);

  if (text) {
    return text;
  }

  if (dataName.startsWith("2070")) {
    return "";
  }

  if (dataName.startsWith("map_")) {
    text = getLocalizationString(localizationStrings, type, dataName.replace("map_", ""), field);
  }

  if (text) {
    return text;
  }

  console.log(`Missing localization for ${type}.${dataName}.${field}`);

  return type + "." + dataName + "." + field;
}

export function parseTemplate(templateData: TemplateData, text: string, templateType: string): void {
  const data = JSON.parse(text);
  templateData[templateType] = data.filter((entry: any) => !entry.disable);
}