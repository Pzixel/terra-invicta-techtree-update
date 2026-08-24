import type { GameVersionCode } from './version';

export type ScenarioCode = 'standard' | '2003' | 'broken-earth';
export type ScenarioQueryCode = Exclude<ScenarioCode, 'standard'>;

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

export function scenarioDisplayName(
  scenario: Scenario,
  scenarioLabels: Partial<Record<ScenarioCode, string>> = {},
  dlcLabel?: string,
): string {
  const scenarioName = scenario.code === 'standard'
    ? scenario.fallbackName
    : scenarioLabels[scenario.code] ?? scenario.fallbackName;
  const scenarioDlcName = scenario.dlcName ? (dlcLabel ?? scenario.dlcName) : null;
  return scenarioDlcName ? `${scenarioName} — ${scenarioDlcName}` : scenarioName;
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
