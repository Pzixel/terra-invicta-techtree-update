import type { GameVersionCode } from './version';

export type ScenarioCode = 'standard' | '2003' | 'broken-earth';
export type ScenarioQueryCode = Exclude<ScenarioCode, 'standard'>;
export type ScenarioBadgeColor = 'info' | 'secondary' | 'warning';
export type ScenarioMarkerKind = 'addition' | 'variant';
export type ScenarioBadgeKind = 'identity' | ScenarioMarkerKind;

export const SCENARIO_MENU_DISCOVERY_KEY = 'terra-invicta.scenario-menu-seen.v1';

export interface ScenarioDiscoveryStorage {
  getItem?: (key: string) => string | null;
  setItem?: (key: string, value: string) => unknown;
}

const ENTITY_DATA_NAME = /^[A-Za-z0-9_-]+$/;
const NON_ENTITY_PATHS = new Set(['browse', 'dark-skies', 'drives']);

export interface Scenario {
  code: ScenarioCode;
  dataName: 'ModernScenario' | '2003Scenario' | 'BrokenEarthScenario';
  fallbackName: string;
  dlcName?: 'Dark Skies DLC';
  landingPath?: `dark-skies/${ScenarioQueryCode}/`;
}

export const Scenarios: Record<ScenarioCode, Scenario> = {
  standard: {
    code: 'standard',
    dataName: 'ModernScenario',
    fallbackName: 'Standard',
  },
  '2003': {
    code: '2003',
    dataName: '2003Scenario',
    fallbackName: '2003 Scenario',
    dlcName: 'Dark Skies DLC',
    landingPath: 'dark-skies/2003/',
  },
  'broken-earth': {
    code: 'broken-earth',
    dataName: 'BrokenEarthScenario',
    fallbackName: 'Broken Earth Scenario',
    dlcName: 'Dark Skies DLC',
    landingPath: 'dark-skies/broken-earth/',
  },
};

export const DefaultScenario = Scenarios.standard;
export const OrderedScenarios = [Scenarios.standard, Scenarios['2003'], Scenarios['broken-earth']];

export function scenarioBadgeColor(scenario: ScenarioCode): ScenarioBadgeColor {
  if (scenario === '2003') return 'secondary';
  if (scenario === 'broken-earth') return 'warning';
  return 'info';
}

export function scenarioMarkerColor(
  kind: ScenarioMarkerKind,
  scenario: ScenarioCode,
): ScenarioBadgeColor {
  return kind === 'addition' ? 'secondary' : scenarioBadgeColor(scenario);
}

export function scenarioBadgeVariant(
  kind: ScenarioBadgeKind,
  selected = false,
): 'filled' | 'outlined' {
  return kind === 'addition' || (kind === 'identity' && selected) ? 'filled' : 'outlined';
}

export function scenarioMenuNeedsDiscovery(
  storage: ScenarioDiscoveryStorage | null | undefined,
): boolean {
  try {
    return storage?.getItem?.(SCENARIO_MENU_DISCOVERY_KEY) !== '1';
  } catch {
    return true;
  }
}

export function markScenarioMenuDiscovered(
  storage: ScenarioDiscoveryStorage | null | undefined,
): void {
  try {
    storage?.setItem?.(SCENARIO_MENU_DISCOVERY_KEY, '1');
  } catch {
    // Storage can be unavailable in privacy modes. The in-memory UI state still dismisses the badge.
  }
}

export function scenarioDisplayName(
  scenario: Scenario,
  scenarioLabels: Partial<Record<ScenarioCode, string>> = {},
  dlcLabel?: string,
): string {
  const scenarioName = scenarioLabels[scenario.code] ?? scenario.fallbackName;
  const scenarioDlcName = scenario.dlcName ? (dlcLabel ?? scenario.dlcName) : null;
  return scenarioDlcName ? `${scenarioName} — ${scenarioDlcName}` : scenarioName;
}

export type ScenarioStatusTemplates = {
  tree: string;
  viewingLoading: string;
  loading: string;
};

export type ScenarioMarkerPresentation =
  | { kind: Extract<ScenarioMarkerKind, 'addition'>; chipVariant: 'filled'; graphDiamond: true }
  | { kind: Extract<ScenarioMarkerKind, 'variant'>; chipVariant: 'outlined'; graphDiamond: false };

export function scenarioMarkerPresentation({
  dlcOnly,
  scenarioVariant,
}: {
  dlcOnly?: boolean;
  scenarioVariant?: boolean;
}): ScenarioMarkerPresentation | null {
  if (dlcOnly) return { kind: 'addition', chipVariant: 'filled', graphDiamond: true };
  if (scenarioVariant) return { kind: 'variant', chipVariant: 'outlined', graphDiamond: false };
  return null;
}

export function selectScenarioLoadErrorTemplate(
  hasPreviousView: boolean,
  templates: {
    scenarioLoadError: string;
    scenarioInitialLoadError: string;
  },
): string {
  return hasPreviousView ? templates.scenarioLoadError : templates.scenarioInitialLoadError;
}

export function interpolateScenarioText(
  template: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

export function scenarioStatusText({
  activeScenario,
  targetScenario,
  activeLabel,
  targetLabel,
  loading,
  templates,
}: {
  activeScenario: ScenarioCode | null;
  targetScenario: ScenarioCode;
  activeLabel: string | null;
  targetLabel: string;
  loading: boolean;
  templates: ScenarioStatusTemplates;
}): string {
  if ((!activeScenario || !activeLabel) && loading) {
    return interpolateScenarioText(templates.loading, { target: targetLabel });
  }
  if (!activeScenario || !activeLabel) return '';
  if (loading && activeScenario !== targetScenario) {
    return interpolateScenarioText(templates.viewingLoading, {
      active: activeLabel,
      target: targetLabel,
    });
  }
  if (loading) return interpolateScenarioText(templates.loading, { target: targetLabel });
  return '';
}

export function isScenarioCode(value: string | null | undefined): value is ScenarioCode {
  return value === 'standard' || value === '2003' || value === 'broken-earth';
}

export function isScenarioQueryCode(value: string | null | undefined): value is ScenarioQueryCode {
  return value === '2003' || value === 'broken-earth';
}

function pathSegments(pathname: string, basePath: string): string[] {
  const normalizedBase = normalizeBasePath(basePath);
  const pathWithLeadingSlash = `/${pathname.replace(/^\/+/, '')}`;
  const relativePath = normalizedBase !== '/' && pathWithLeadingSlash.startsWith(normalizedBase)
    ? pathWithLeadingSlash.slice(normalizedBase.length)
    : pathWithLeadingSlash.slice(1);
  return relativePath.split('/').filter(Boolean);
}

function normalizeBasePath(basePath: string): string {
  const stripped = basePath.replace(/^\/+|\/+$/g, '');
  return stripped ? `/${stripped}/` : '/';
}

export function scenarioFromLocation(pathname: string, search: string, basePath: string): Scenario {
  const segments = pathSegments(pathname, basePath);
  if (segments.length === 2 && segments[0] === 'dark-skies' && isScenarioQueryCode(segments[1])) {
    return Scenarios[segments[1]];
  }

  const queryCode = new URLSearchParams(search).get('scenario');
  return isScenarioQueryCode(queryCode) ? Scenarios[queryCode] : DefaultScenario;
}

export function applyScenarioQuery(params: URLSearchParams, scenario: ScenarioCode): void {
  if (scenario === 'standard') {
    params.delete('scenario');
  } else {
    params.set('scenario', scenario);
  }
}

export function searchWithScenario(search: string, scenario: ScenarioCode): string {
  const params = new URLSearchParams(search);
  applyScenarioQuery(params, scenario);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function entityDataNameFromPath(pathname: string, basePath: string): string | null {
  const segments = pathSegments(pathname, basePath);
  if (segments.length !== 1 || NON_ENTITY_PATHS.has(segments[0])) return null;

  try {
    const dataName = decodeURIComponent(segments[0]);
    return ENTITY_DATA_NAME.test(dataName) ? dataName : null;
  } catch {
    return null;
  }
}

export function layoutArtifactPath(version: GameVersionCode, scenario: ScenarioCode): string {
  return `layout/${version}.${scenario}.json`;
}

export function scenarioBundlePath(version: GameVersionCode, scenario: ScenarioCode, language: string): string {
  return `bundles/${version}/${scenario}/${language}.json`;
}

export function graphArtifactPath(version: GameVersionCode, scenario: ScenarioCode, language: string): string {
  return `graph/${version}.${scenario}.${language}.json`;
}

export function canonicalPathForScenario(scenario: ScenarioCode): string | null {
  return Scenarios[scenario].landingPath ?? null;
}

export function canonicalUrlForScenario(scenario: ScenarioCode, origin: string, basePath: string): string | null {
  const landingPath = canonicalPathForScenario(scenario);
  return landingPath ? new URL(`${normalizeBasePath(basePath)}${landingPath}`, origin).href : null;
}
