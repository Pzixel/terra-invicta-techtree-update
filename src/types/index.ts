// Basic data types
import type { LocalizedUi } from '../language';

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
    private uiTexts: LocalizedUi;
    
    constructor(localizationFileContent: string[], uiTexts: LocalizedUi) {
        this.localizationStrings = new Map<string, string>();
        this.uiTexts = uiTexts;

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
        if (type === 'faction' && dataName === 'Random') {
            return this.uiTexts.randomFaction;
        }
        return this.localizationStrings.get(this.toKey(type, dataName, field));
    }

    getReadable(
        type: TemplateType,
        dataName: string,
        field: string
    ): string {
        let text = this.tryGetReadable(type, dataName, field);

        if (text) {
            return text;
        }

        console.log(`Missing localization for ${this.toKey(type, dataName, field)}`);

        return this.toKey(type, dataName, field);
    }

    tryGetReadable(
        type: TemplateType,
        dataName: string,
        field: string
    ): string | undefined {
        let text = this.getLocalizationString(type, dataName, field);

        if (text) {
            return text;
        }

        if (dataName.startsWith("2070")) {
            return "";
        }

        if (dataName.startsWith("2026")) {
            return "";
        }

        if (dataName.startsWith("map_")) {
            text = this.getLocalizationString(type, dataName.replace("map_", ""), field);
        }

        return text;
    }
}

export type TemplateData = {
  battery?: ModuleTemplate[];
  drive?: ModuleTemplate[];
  gun?: ModuleTemplate[];
  habmodule?: ModuleTemplate[];
  heatsink?: ModuleTemplate[];
  laserweapon?: ModuleTemplate[];
  magneticgun?: ModuleTemplate[];
  missile?: ModuleTemplate[];
  particleweapon?: ModuleTemplate[];
  plasmaweapon?: ModuleTemplate[];
  powerplant?: ModuleTemplate[];
  radiator?: ModuleTemplate[];
  shiparmor?: ModuleTemplate[];
  shiphull?: ModuleTemplate[];
  utilitymodule?: ModuleTemplate[];
  effects?: EffectTemplate[];
  effect?: EffectTemplate[];
  bilateral?: (Claim | Adjacency)[];
  org?: OrgTemplate[];
  trait?: TraitTemplate[];
  tech?: TechTemplate[];
  project?: TechTemplate[];
  [key: string]: unknown[] | undefined;
}

export function getTemplateData(
    templates: [string, unknown[]][],
): TemplateData {
    const db: TemplateData = {};
    for (const [type, entries] of templates) {
        db[type] = entries.filter((entry: unknown) => {
            if (entry && typeof entry === 'object' && 'disable' in entry) {
                return !entry.disable;
            }
            return true;
        });
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
  resourcesGranted?: ResourceGranted[];
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

export interface ResourceGranted {
  resource: string;
  value: number;
}

export type WeightedBuildMaterials = {
    water?: number;
    volatiles?: number;
    metals?: number;
    nobleMetals?: number;
    fissiles?: number;
    exotics?: number;
    [key: string]: number | undefined;
}

export interface ModuleTemplate {
  dataName: string;
    friendlyName?: string;
  requiredProjectName?: string;
  iconResource?: string;
  baseIconResource?: string;
  stationIconResource?: string;
    specialModuleValue?: number;
    baseMass_tons?: number;
    flatMass_tons?: number;
    weightedBuildMaterials?: WeightedBuildMaterials;
    perTankPropellantMaterials?: WeightedBuildMaterials;
    thrusters?: number;
    thrust_N?: number;
    EV_kps?: number;
    thrustRating_GW?: string | number;
    "req power"?: string | number;
    driveClassification?: string;
    requiredPowerPlant?: string;
    thrustCap?: number;
    cooling?: string;
    powerGen?: string;
    propellant?: string;
    notes?: string;
  // Add other common module properties as needed
}

export interface EffectTemplate {
  dataName: string;
  strValue?: string;
  value?: number;
  // Add other effect properties as needed
}

export interface OrgTemplate {
  dataName: string;
  tier: number;
  requiredTechName?: string;
  // Add other org properties as needed
}

export interface TraitTemplate {
  dataName: string;
  projectDataName?: string;
  // Add other trait properties as needed
}

export interface DataModule {
  data: ModuleTemplate;
  type: TemplateType;
}

export interface Claim {
    dataName: string;
    relationType: "Claim";
    nation1: string;
    region1: string;
    projectUnlockName?: string;
}

export interface Adjacency {
    dataName: string;
    relationType: "PhysicalAdjacency";
    region1: string;
    region2: string;    
    projectUnlockName?: string;
    friendlyOnly?: true;
}
