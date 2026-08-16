import { TechTemplate, LocalizationDb, TemplateData, EffectTemplate } from './index';
import { TechDb } from '../utils/TechDb';
import { GraphBundle } from '../techGraphRender';
import { Language } from 'src/language';
import { GameVersion } from '../version';

export interface TechSidebarProps {
  templateData: TemplateData;
  localizationDb: LocalizationDb;
  language: Language;
  techDb: TechDb;
  onNavigateToNode: (node: TechTemplate | null) => void;
  navigatedToNode: TechTemplate | null;
  handleIsolatedChanged: (isolated: boolean) => void;
  effects?: EffectTemplate[];
  isMobile?: boolean;
}

export interface TechGraphProps {
  techDb?: TechDb | null;
  templateData?: TemplateData;
  onNavigateToNode: (dataName: string | null) => void;
  selectedDataName: string | null;
  precomputedPositions?: Record<string, { x: number; y: number }> | null;
  bundle?: GraphBundle | null;
}

export interface SearchboxProps {
  techDb: TechDb | null;
  setShowProjects: (show: boolean) => void;
  onNavigateToNode: (node: TechTemplate | null) => void;
  localizationDb: LocalizationDb;
  templateData: TemplateData;
  language: Language;
}

export interface LanguageSelectorProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  version: GameVersion;
  onVersionChange: (version: GameVersion) => void;
  variant?: 'card' | 'inline';
}

export interface AppStaticData {
  templateData: TemplateData;
  effects: EffectTemplate[];
  techs: TechTemplate[];
  projects: TechTemplate[];
  localizationDb: LocalizationDb;
}