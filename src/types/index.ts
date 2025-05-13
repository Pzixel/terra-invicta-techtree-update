// Basic data types
export interface LocalizationEntry {
  [field: string]: string | { [faction: string]: string };
}

export const TemplateTypes = {
    "battery": "TIBatteryTemplate",
    "drive": "TIDriveTemplate",
    "effect": "TIEffectTemplate",
    "faction": "TIFactionTemplate",
    "gun": "TIGunTemplate",
    "habmodule": "TIHabModuleTemplate",
    "heatsink": "TIHeatSinkTemplate",
    "laserweapon": "TILaserWeaponTemplate",
    "magneticgun": "TIMagneticGunTemplate",
    "missile": "TIMissileTemplate",
    "nation": "TINationTemplate",
    "objective": "TIObjectiveTemplate",
    "org": "TIOrgTemplate",
    "particleweapon": "TIParticleWeaponTemplate",
    "plasmaweapon": "TIPlasmaWeaponTemplate",
    "powerplant": "TIPowerPlantTemplate",
    "project": "TIProjectTemplate",
    "radiator": "TIRadiatorTemplate",
    "region": "TIRegionTemplate",
    "shiparmor": "TIShipArmorTemplate",
    "shiphull": "TIShipHullTemplate",
    "tech": "TITechTemplate",
    "trait": "TITraitTemplate",
    "utilitymodule": "TIUtilityModuleTemplate"
};

export type TemplateType = keyof typeof TemplateTypes;

export class LocalizationDb {
    localizationStrings: Map<string, string>;
    
    constructor(localizationFileContent: string[]) {
        this.localizationStrings = new Map<string, string>();

        for (const file of localizationFileContent) {
            const lines = file.split("\n");
            for (const line of lines) {
                const equalIndex = line.indexOf('=');
                if (equalIndex > 0) {
                    const commentIndex = line.indexOf('//');
                    
                    // Extract the key (left side of =)
                    const key = line.substring(0, equalIndex).trim();
                    
                    // Extract the value (right side of =, but before any comment)
                    let value;
                    if (commentIndex > equalIndex) {
                        value = line.substring(equalIndex + 1, commentIndex).trim();
                    } else {
                        value = line.substring(equalIndex + 1).trim();
                    }
                    
                    this.localizationStrings.set(key, value);
                }
            }
        }
    }

    private toKey(
        type: TemplateType,
        dataName: string,
        field: string
    ): string {
        return `${TemplateTypes[type]}.${field}.${dataName}`;
    }
    

    getLocalizationString(
      type: TemplateType,
      dataName: string,
      field: string
    ): string | undefined {
      return this.localizationStrings.get(this.toKey(type, dataName, field));
    }

    getReadable(
        type: TemplateType,
        dataName: string,
        field: string
    ): string {
        let text = this.getLocalizationString(type, dataName, field);

        if (text) {
            return text;
        }

        if (dataName.startsWith("2070")) {
            return "";
        }

        if (dataName.startsWith("map_")) {
            text = this.getLocalizationString(type, dataName.replace("map_", ""), field);
        }

        if (text) {
            return text;
        }

        console.log(`Missing localization for ${this.toKey(type, dataName, field)}`);

        return this.toKey(type, dataName, field);
    }
}

export type TemplateData = Record<string, any[]>;

export function getTemplateData(
    templates: [string, any[]][],
): TemplateData {
    const db: TemplateData = {};
    for (const [type, entries] of templates) {
        db[type] = entries.filter((entry: any) => !entry.disable);
    }
    return db;
}

export interface TechTemplate {
  dataName: string;
  displayName: string;
  friendlyName?: string;
  prereqs: string[];
  altPrereq0?: string;
  researchCost: number;
  techCategory: string;
  id?: number;
  isProject?: boolean;
  researchDone?: boolean;
  effects?: string[];
  resourcesGranted?: ResourceGrant[];
  orgGranted?: string;
  factionAlways?: string;
  factionPrereq?: string[];
  factionAvailableChance?: number;
  initialUnlockChance?: number;
  deltaUnlockChance?: number;
  maxUnlockChance?: number;
  requiredMilestone?: string;
  endGameTech?: boolean;
  oneTimeGlobally?: boolean;
  repeatable?: boolean;
}

export interface ResourceGrant {
  resource: string;
  value: number;
}

export interface Effect {
  dataName: string;
  value: number;
  strValue: string;
}

export interface ModuleData {
  data: any;
  type: string;
}

export interface VisNode {
  label: string;
  id: string;
  shape: string;
  image: string;
  level: number;
  color: {
    border: string;
  };
}

export interface VisEdge {
  from: string;
  to: string;
}

export interface VisData {
  nodes: any;
  edges: any;
}

export type Claim = any;
export type Adjacency = any;
export type DataModule = any;