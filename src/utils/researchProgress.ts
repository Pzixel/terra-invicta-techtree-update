import type { ScenarioCode } from '../scenario';
import type { GameVersionCode } from '../version';

export type ResearchProgress = Record<string, boolean>;

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const LEGACY_KEY = 'terraInvictaResearchState';
const PREFIX = `${LEGACY_KEY}:`;

export const researchProgressKey = (version: GameVersionCode, scenario: ScenarioCode) =>
  `${PREFIX}${version}:${scenario}`;

const parseProgress = (value: string | null): ResearchProgress => {
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter(([key, done]) => key.length > 0 && done === true)
  );
};

export function loadResearchProgress(
  storage: ProgressStorage,
  version: GameVersionCode,
  scenario: ScenarioCode,
): ResearchProgress {
  const key = researchProgressKey(version, scenario);
  const namespaced = storage.getItem(key);
  if (namespaced !== null) return parseProgress(namespaced);

  if (version === 'stable' && scenario === 'standard') {
    const legacy = storage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const progress = parseProgress(legacy);
      if (Object.keys(progress).length > 0) storage.setItem(key, JSON.stringify(progress));
      storage.removeItem(LEGACY_KEY);
      return progress;
    }
  }
  return {};
}

export function saveResearchProgress(
  storage: ProgressStorage,
  version: GameVersionCode,
  scenario: ScenarioCode,
  progress: ResearchProgress,
): void {
  const key = researchProgressKey(version, scenario);
  const completed = Object.fromEntries(Object.entries(progress).filter(([, done]) => done === true));
  if (Object.keys(completed).length === 0) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, JSON.stringify(completed));
  }
}

export function clearResearchProgress(
  storage: ProgressStorage,
  version: GameVersionCode,
  scenario: ScenarioCode,
): void {
  storage.removeItem(researchProgressKey(version, scenario));
}
