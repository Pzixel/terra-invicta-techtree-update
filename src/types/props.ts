import { TechTemplate, LocalizationData, TemplateData, Effect } from './index';
import { TechDb } from '../utils/TechDb';
import { Language } from 'src/language';

export interface TechSidebarProps {
  templateData: TemplateData;
  getLocalizationString: (type: string, dataName: string, field: string) => string | undefined;
  getReadable: (type: string, dataName: string, field: string) => string;
  language: Language;
  techDb: TechDb;
  onNavigateToNode: (node: TechTemplate | null) => void;
  navigatedToNode: TechTemplate | null;
  handleIsolatedChanged: (isolated: boolean) => void;
  effects?: Effect[];
}

export interface TechGraphProps {
  techDb: TechDb;
  onNavigateToNode: (node: TechTemplate | null) => void;
  navigatedToNode: TechTemplate | null;
}

export interface SearchboxProps {
  techDb: TechDb;
  setShowProjects: (show: boolean) => void;
  onNavigateToNode: (node: TechTemplate | null) => void;
  getLocalizationString: (type: string, dataName: string, field: string) => string | undefined;
  getReadable: (type: string, dataName: string, field: string) => string;
  templateData: TemplateData;
  language: Language;
}

export interface LanguageSelectorProps {
    onLanguageChange: (language: Language) => void;
}

export interface AppStaticData {
  templateData: TemplateData;
  effects: Effect[];
  techs: TechTemplate[];
  projects: TechTemplate[];
  getLocalizationString: (type: string, dataName: string, field: string) => string | undefined;
  getReadable: (type: string, dataName: string, field: string) => string;
}