// Basic data types
export interface LocalizationEntry {
  [field: string]: string | { [faction: string]: string };
}

export interface LocalizationData {
  [type: string]: {
    [dataName: string]: LocalizationEntry;
  };
}

export interface TemplateData {
  [type: string]: any[];
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