import React, { useContext, useEffect, useMemo, useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { Config, Data, Layout } from 'plotly.js';
import { Link } from 'react-router';
import { useTheme } from '@mui/material/styles';
import { DefaultLanguage, Language, Languages } from './language';
import { DefaultVersion, GameVersion, GameVersionCode, GameVersions, isGameVersionCode } from './version';
import { TechDb } from './utils/TechDb';
import { getAncestorTechs } from './utils';
import { ColorModeContext } from './theme';

const Plot = createPlotlyComponent(Plotly);

type DrivePoint = {
  ev: number;
  thrust: number;
  name: string;
  cooling: string;
  category: string;
  treeCost?: number;
};

const colorMap: Record<string, string> = {
  Chemical: '#CC0000',
  Electrothermal: '#CCC2CC',
  Electrostatic: '#7F6000',
  Electromagnetic: '#DDAA00',
  Fission_Thermal: '#663300',
  Fission_SaltWater: '#996633',
  Fission_Gas: '#144205',
  Fission_Solid: '#548285',
  Fission_Pulse: '#FFF2CC',
  Fusion_Electrostatic: '#0066CC',
  Fusion_Toroid: '#FBE5D6',
  Fusion_Mirrored: '#F4B183',
  Fusion_Hybrid: '#94748A',
  Fusion_ZPinch: '#BDD7EE',
  Fusion_Inertial: '#4472C4',
  Fission_Any: '#CCF2CC',
  Fission_Liquid: '#a4c2a5',
  Antimatter: '#000000',
  Alien: '#7030A0',
  NuclearSaltWater: '#A6A6A6',
};

const coolingSymbols: Record<string, string> = { Open: 'O ', Closed: '' };
const markerSymbolForCooling = (cooling: string) => (cooling === 'Closed' ? 'square' : 'circle');

const parseLocalization = (raw: string): Record<string, string> => {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('displayName'))
    .reduce<Record<string, string>>((acc, line) => {
      const [key, ...rest] = line.split('=');
      if (!key || !rest.length) return acc;
      acc[key] = rest.join('=').trim();
      return acc;
    }, {});
};

const getDriveCategory = (classification: string, name: string, requiredPowerPlant: string | undefined): string => {
  if (name && name.includes('Alien')) return 'Alien';

  const [baseClass] = classification.split('_');
  if (baseClass === 'Fission') {
    const powerType = (requiredPowerPlant || '').split('_')[0];
    return `${baseClass}_${powerType || 'Any'}`;
  }
  if (baseClass === 'Fusion') {
    let powerType = (requiredPowerPlant || '').split('_')[0];
    if (powerType === 'Z') powerType = 'ZPinch';
    return `${baseClass}_${powerType || 'Hybrid'}`;
  }
  return baseClass || 'Other';
};

const processDrives = (
  items: any[],
  localization: Record<string, string>,
  useCombatThrust: boolean,
  treeCostLookup: (projectName?: string) => number | undefined,
  unknownDriveLabel: string,
) => {
  const groups: Record<string, DrivePoint[]> = {};

  items.forEach((item) => {
    if (!item || item.disable) return;
    if (!item.thrust_N || !item.EV_kps || !item.driveClassification) return;

    const isX1 = (item.dataName && item.dataName.endsWith('x1')) || item.thrusters === 1;
    if (!isX1) return;

    const lookupKey = `TIDriveTemplate.displayName.${item.dataName}`;
    let driveName = localization[lookupKey] || item.dataName || unknownDriveLabel;
    if (driveName.endsWith(' x1')) {
      driveName = driveName.slice(0, -3);
    }

    const category = getDriveCategory(item.driveClassification, driveName, item.requiredPowerPlant);
    const baseThrust = Number(item.thrust_N);
    const thrust = useCombatThrust ? baseThrust * Number(item.thrustCap || 1) : baseThrust;
    const ev = Number(item.EV_kps);
    const treeCost = treeCostLookup(item.requiredProjectName as string | undefined);

    let cooling = item.cooling || 'Open';
    if (cooling === 'Calc') {
      const massFlow = baseThrust / (ev * 1000);
      const isPulsed = item.driveClassification === 'Fission_Pulse' || item.driveClassification === 'Fusion_Pulse';
      cooling = isPulsed || massFlow >= 3 ? 'Open' : 'Closed';
    }

    if (!groups[category]) groups[category] = [];
    groups[category].push({ ev, thrust, name: driveName, cooling, category, treeCost });
  });
  return groups;
};

const buildTraces = (
  groups: Record<string, DrivePoint[]>,
  showLabels: boolean,
  thrustLabel: string,
  driveLabel: string,
  markerLineColor: string,
  exhaustVelocityLabel: string,
  treeCostLabel: string,
  notAvailableLabel: string,
): Partial<Data>[] =>
  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, drives]) => {
      const text = showLabels ? drives.map((d) => `${coolingSymbols[d.cooling] || ''}${d.name}`) : undefined;
      const treeCostStrings = drives.map((d) => {
        if (d.treeCost === undefined || d.treeCost < 0) return notAvailableLabel;
        return d.treeCost.toLocaleString();
      });
      const customdata = drives.map((d, i) => [d.name, treeCostStrings[i]]);
      return {
        type: 'scatter',
        mode: showLabels ? 'markers+text' : 'markers',
        x: drives.map((d) => d.ev),
        y: drives.map((d) => d.thrust),
        text,
        textposition: 'top center',
        textfont: { size: 9 },
        customdata,
        marker: {
          color: colorMap[category] || '#4b5563',
          size: 11,
          line: { color: markerLineColor, width: 0.8 },
          symbol: drives.map((d) => markerSymbolForCooling(d.cooling)),
          opacity: 0.92,
        },
        name: category.replace(/_/g, ' '),
        hovertemplate:
          `%{customdata[0]}<br>` +
          `<br>${exhaustVelocityLabel}: %{x:.0f}` +
          `<br>${thrustLabel}: %{y:,.0f}` +
          `<br>${treeCostLabel}: %{customdata[1]}` +
          '<extra></extra>',
      } as Partial<Data>;
    });

const getInitialVersion = (): GameVersion => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('ver');
  return isGameVersionCode(code) ? GameVersions[code] : DefaultVersion;
};

const getInitialLanguage = (versionCode: GameVersionCode): Language => {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get('lang');
  const lang = candidate ? Languages[candidate] : null;
  if (lang && lang.availableVersions.includes(versionCode)) return lang;
  const fallback = Object.values(Languages).find((l) => l.availableVersions.includes(versionCode));
  return fallback || DefaultLanguage;
};

const fetchJson = async (url: string, label: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Unable to load ${label} (${res.status})`);
  }
  return res.json();
};

const fetchTextWithFallback = async (primary: string, fallback: string, label: string) => {
  const primaryRes = await fetch(primary);
  if (primaryRes.ok) return primaryRes.text();
  const fbRes = await fetch(fallback);
  if (fbRes.ok) return fbRes.text();
  throw new Error(`Unable to load ${label}`);
};

const buildLocalizedList = (
  items: any[],
  _localization: Record<string, string>,
  _templateKey: string,
  isProject: boolean,
) =>
  items
    .filter((entry) => !(entry && entry.disable))
    .map((entry) => ({
      ...entry,
      displayName: entry.dataName,
      prereqs: entry.prereqs || [],
      researchCost: entry.researchCost || 0,
      isProject,
    }));

type DrivesChartProps = {
  variant?: 'page' | 'overlay';
  onClose?: () => void;
};

const DrivesChart: React.FC<DrivesChartProps> = ({ variant = 'page', onClose }) => {
  const [version] = useState<GameVersion>(() => getInitialVersion());
  const [language] = useState<Language>(() => getInitialLanguage(getInitialVersion().code));
  const [thrustMode, setThrustMode] = useState<'combat' | 'cruise'>('cruise');
  const [showLabels, setShowLabels] = useState(true);
  const [traces, setTraces] = useState<Partial<Data>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();
  const { mode } = useContext(ColorModeContext);

  const thrustLabel = thrustMode === 'combat' ? language.uiTexts.combatThrust : language.uiTexts.cruiseThrust;
  const markerLineColor = useMemo(
    () => (mode === 'dark' ? theme.palette.grey[300] ?? '#e5e7eb' : theme.palette.text.primary),
    [mode, theme.palette.grey, theme.palette.text.primary]
  );
  const textColor = theme.palette.text.primary;
  const gridColor = theme.palette.divider;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const base = `gamefiles/${version.code}`;

        const [
          driveTemplate,
          techTemplate,
          projectTemplate,
          driveLocRaw,
          techLocRaw,
          projectLocRaw,
        ] = await Promise.all([
          fetchJson(`${base}/Templates/TIDriveTemplate.json`, 'drive template'),
          fetchJson(`${base}/Templates/TITechTemplate.json`, 'tech template'),
          fetchJson(`${base}/Templates/TIProjectTemplate.json`, 'project template'),
          fetchTextWithFallback(
            `${base}/Localization/${language.code}/TIDriveTemplate.${language.code}`,
            `${base}/Localization/en/TIDriveTemplate.en`,
            'drive localization',
          ),
          fetchTextWithFallback(
            `${base}/Localization/${language.code}/TITechTemplate.${language.code}`,
            `${base}/Localization/en/TITechTemplate.en`,
            'tech localization',
          ),
          fetchTextWithFallback(
            `${base}/Localization/${language.code}/TIProjectTemplate.${language.code}`,
            `${base}/Localization/en/TIProjectTemplate.en`,
            'project localization',
          ),
        ]);

        const driveLocalization = parseLocalization(driveLocRaw);
        const techLocalization = parseLocalization(techLocRaw);
        const projectLocalization = parseLocalization(projectLocRaw);

        const techs = buildLocalizedList(techTemplate, techLocalization, 'TITechTemplate', false);
        const projects = buildLocalizedList(projectTemplate, projectLocalization, 'TIProjectTemplate', true);

        const techDb = new TechDb([...techs, ...projects]);
        const treeCostCache: Record<string, number | undefined> = {};
        const treeCostLookup = (projectName?: string) => {
          if (!projectName) return undefined;
          if (projectName in treeCostCache) return treeCostCache[projectName];
          const node = techDb.getTechByDataName(projectName);
          if (!node) {
            treeCostCache[projectName] = undefined;
            return undefined;
          }
          const ancestors = getAncestorTechs(techDb, node) || [];
          const seen = new Set<string>();
          const total = ancestors
            .concat(node)
            .reduce((sum, tech) => {
              if (seen.has(tech.dataName)) return sum;
              seen.add(tech.dataName);
              return sum + (tech.researchCost || 0);
            }, 0);
          treeCostCache[projectName] = total;
          return total;
        };

        const grouped = processDrives(
          driveTemplate,
          driveLocalization,
          thrustMode === 'combat',
          treeCostLookup,
          language.uiTexts.unknownDrive,
        );
        if (!cancelled) {
          setTraces(
            buildTraces(
              grouped,
              showLabels,
              thrustLabel,
              language.uiTexts.driveColumnLabel,
              markerLineColor,
              language.uiTexts.exhaustVelocityLabel,
              language.uiTexts.totalTreeCost,
              language.uiTexts.notAvailable,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setTraces([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [language.code, markerLineColor, showLabels, thrustLabel, thrustMode, version.code]);

  const layout = useMemo<Partial<Layout>>(
    () => ({
      xaxis: {
        type: 'log',
        title: language.uiTexts.exhaustVelocityLabel,
        color: textColor,
        gridcolor: gridColor,
        zerolinecolor: gridColor,
      },
      yaxis: {
        type: 'log',
        title: `${thrustLabel} (N)`,
        color: textColor,
        gridcolor: gridColor,
        zerolinecolor: gridColor,
      },
      hovermode: 'closest',
      legend: {
        orientation: 'h',
        y: -0.2,
        yanchor: 'top',
        x: 0,
        xanchor: 'left',
        bgcolor: theme.palette.background.paper,
        bordercolor: theme.palette.divider,
        borderwidth: 1,
        font: { color: textColor },
      },
      margin: { l: 70, r: 30, t: 20, b: 110 },
      paper_bgcolor: theme.palette.background.paper,
      plot_bgcolor: theme.palette.background.paper,
      font: { color: textColor },
    }),
    [
      gridColor,
      language.uiTexts.exhaustVelocityLabel,
      textColor,
      theme.palette.background.default,
      theme.palette.background.paper,
      theme.palette.divider,
      thrustLabel,
    ]
  );

  const config = useMemo<Partial<Config>>(
    () => ({
      displaylogo: false,
      responsive: true,
      scrollZoom: true,
      toImageButtonOptions: { format: 'svg', filename: 'drive-chart' },
      modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    }),
    []
  );

  return (
    <div className="drives-page">
      {variant === 'page' ? (
        <div className="gamefiles-actions">
          <Link className="utility-link" to="/">← {language.uiTexts.backToTechTree}</Link>
        </div>
      ) : (
        <div className="drives-actions-row">
          <button className="drives-close-btn" onClick={onClose}>{language.uiTexts.closeLabel}</button>
        </div>
      )}

      <div className="drives-header">
        <div>
          <h2>{language.uiTexts.driveChartTitle}</h2>
          <p className="drives-subtitle">{language.uiTexts.driveChartSubtitle}</p>
        </div>
        <div className="drives-controls">
          <button
            className={thrustMode === 'cruise' ? 'drives-chip drives-chip--active' : 'drives-chip'}
            onClick={() => setThrustMode('cruise')}
          >
            {language.uiTexts.cruiseThrust}
          </button>
          <button
            className={thrustMode === 'combat' ? 'drives-chip drives-chip--active' : 'drives-chip'}
            onClick={() => setThrustMode('combat')}
          >
            {language.uiTexts.combatThrust}
          </button>
          <label className="drives-toggle">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            {language.uiTexts.showLabels}
          </label>
        </div>
      </div>

      {loading && <div className="gamefiles-status">{language.uiTexts.loadingDrives}</div>}
      {error && <div className="gamefiles-error">{error}</div>}
      {!loading && !error && (
        <div className="drives-chart">
          <Plot data={traces as Data[]} layout={layout} config={config} useResizeHandler style={{ width: '100%', height: '100%' }} />
        </div>
      )}
    </div>
  );
};

export default DrivesChart;
