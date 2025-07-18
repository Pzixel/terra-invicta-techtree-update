import { TechTemplate, LocalizationDb, TemplateData, EffectTemplate } from './index';
import { TechDb } from '../utils/TechDb';
import { Language } from 'src/language';

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
  techDb: TechDb;
  templateData: TemplateData, 
  onNavigateToNode: (node: TechTemplate | null) => void;
  navigatedToNode: TechTemplate | null;
}

export interface SearchboxProps {
  techDb: TechDb;
  setShowProjects: (show: boolean) => void;
  onNavigateToNode: (node: TechTemplate | null) => void;
  localizationDb: LocalizationDb;
  templateData: TemplateData;
  language: Language;
}

export interface LanguageSelectorProps {
    onLanguageChange: (language: Language) => void;
}

export interface AppStaticData {
  templateData: TemplateData;
  effects: EffectTemplate[];
  techs: TechTemplate[];
  projects: TechTemplate[];
  localizationDb: LocalizationDb;
}