import './App.css'
import React, {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { CircularProgress, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Searchbox } from './Searchbox';
import { TechGraph } from './TechGraph';
import { TechSidebar } from './TechSidebar';
import { SettingsMenu } from './SettingsMenu';
import { assetUrl, BASE_PATH, getAncestorTechs, getDescendentTechs } from './utils';
import { TechDb } from './utils/TechDb';
import type { AppStaticData } from './types/props';
import { LocalizationDb, type TechTemplate } from './types';
import { DefaultLanguage, Languages, type Language } from './language';
import {
    DefaultVersion,
    GameVersions,
    isGameVersionCode,
    type GameVersion,
    type GameVersionCode,
} from './version';
import { useWindowSize } from './utils/useWindowSize';
import type { GraphBundle, NodePositions } from './techGraphRender';
import {
    applyScenarioQuery,
    canonicalUrlForScenario,
    entityDataNameFromPath,
    graphArtifactPath,
    interpolateScenarioText,
    layoutArtifactPath,
    scenarioDisplayName,
    scenarioMarkerPresentation,
    scenarioBundlePath,
    scenarioFromLocation,
    scenarioStatusText,
    selectScenarioLoadErrorTemplate,
    Scenarios,
    type ScenarioCode,
} from './scenario';
import {
    hydrateScenarioBundle,
    type LoadedScenarioView,
    type ScenarioBundle,
    type ScenarioViewKey,
} from './data/loadScenarioView';
import { LatestRequestCoordinator } from './data/latestRequestCoordinator';
import { graphRenderSource } from './graphArtifactState';

const DrivesChart = lazy(() => import('./DrivesChart'));

declare module 'react' {
    interface CSSProperties {
        '--drives-surface'?: string;
        '--drives-surface-alt'?: string;
        '--drives-text'?: string;
        '--drives-border'?: string;
    }
}

const EMPTY_STATIC_DATA: AppStaticData = {
    templateData: {},
    effects: [],
    techs: [],
    projects: [],
    localizationDb: new LocalizationDb([], DefaultLanguage.uiTexts),
};

function versionFromSearch(search = window.location.search): GameVersion {
    const code = new URLSearchParams(search).get('ver');
    return isGameVersionCode(code) ? GameVersions[code] : DefaultVersion;
}

function languageFromSearch(versionCode: GameVersionCode, search = window.location.search): Language {
    const code = new URLSearchParams(search).get('lang');
    const candidate = code ? Languages[code] : undefined;
    if (candidate?.availableVersions.includes(versionCode)) return candidate;
    return Object.values(Languages).find((language) => language.availableVersions.includes(versionCode)) ?? DefaultLanguage;
}

function drivesOpenedFromSearch(search = window.location.search): boolean {
    const value = new URLSearchParams(search).get('drivesOpened');
    return value === 'true' || value === '1';
}

function sameViewKey(left: ScenarioViewKey, right: ScenarioViewKey): boolean {
    return left.version === right.version && left.scenario === right.scenario && left.language === right.language;
}

function combinedReferenceAliases(view: LoadedScenarioView): Record<string, string> {
    return Object.assign({}, view.aliases.reference.tech ?? {}, view.aliases.reference.project ?? {});
}

function canonicalDataName(view: LoadedScenarioView | null, dataName: string | null): string | null {
    if (!view || !dataName) return dataName;
    for (const collection of ['tech', 'project']) {
        const aliases = view.aliases.reference[collection] ?? {};
        const canonical = Object.entries(aliases).find(([, scenarioName]) => scenarioName === dataName)?.[0];
        if (canonical) return canonical;
    }
    return dataName;
}

function visibleTechDb(view: LoadedScenarioView, showProjects: boolean): TechDb {
    const { techs, projects } = view.appStaticData;
    return new TechDb(
        showProjects ? techs.concat(projects) : techs,
        combinedReferenceAliases(view),
    );
}

function scenarioLabelsForUi(
    view: LoadedScenarioView | null,
    language: Language,
): Record<ScenarioCode, string> {
    return {
        standard: language.uiTexts.scenarioStandard,
        '2003': view?.scenarioLabels['2003'] ?? language.uiTexts.scenario2003Fallback,
        'broken-earth': view?.scenarioLabels['broken-earth'] ?? language.uiTexts.scenarioBrokenEarthFallback,
    };
}

function appPathFromBrowserPath(pathname: string): string {
    const base = BASE_PATH === '/' ? '/' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}/`;
    const baseWithoutTrailingSlash = base.replace(/\/$/, '');
    const normalizedPath = `/${pathname.replace(/^\/+/, '')}`;
    const relative = base !== '/' && normalizedPath === baseWithoutTrailingSlash
        ? ''
        : base !== '/' && normalizedPath.startsWith(base)
            ? normalizedPath.slice(base.length)
            : normalizedPath.slice(1);
    return `/${relative}`.replace(/\/{2,}/g, '/');
}

function browserPathFromAppPath(appPath: string): string {
    const normalizedAppPath = `/${appPath.replace(/^\/+/, '')}`;
    const base = BASE_PATH === '/' ? '' : `/${BASE_PATH.replace(/^\/+|\/+$/g, '')}`;
    return `${base}${normalizedAppPath}` || '/';
}

function scenarioLandingAppPath(scenario: ScenarioCode): string {
    const landingPath = Scenarios[scenario].landingPath;
    return landingPath ? `/${landingPath}` : '/';
}

function isScenarioLandingPath(appPath: string, scenario: ScenarioCode): boolean {
    return appPath.replace(/\/+$/, '') === scenarioLandingAppPath(scenario).replace(/\/+$/, '');
}

function queryForView(
    search: string,
    key: ScenarioViewKey,
    appPath: string,
    drivesOpen: boolean,
): string {
    const params = new URLSearchParams(search);
    // Defaults stay out of the URL: the address bar is what people copy into
    // Reddit and wikis, and a link carrying ?lang=en&ver=stable is a duplicate
    // of the canonical one. Omitted params resolve back to these same defaults,
    // so a stripped link still opens the view it was copied from.
    if (key.language === languageFromSearch(key.version, '').code) params.delete('lang');
    else params.set('lang', key.language);
    if (key.version === DefaultVersion.code) params.delete('ver');
    else params.set('ver', key.version);
    if (isScenarioLandingPath(appPath, key.scenario)) params.delete('scenario');
    else applyScenarioQuery(params, key.scenario);
    if (drivesOpen) params.set('drivesOpened', '1');
    else params.delete('drivesOpened');
    const query = params.toString();
    return query ? `?${query}` : '';
}

function App() {
    const initialVersion = useMemo(() => versionFromSearch(), []);
    const initialLanguage = useMemo(() => languageFromSearch(initialVersion.code), [initialVersion.code]);
    const initialScenario = useMemo(
        () => scenarioFromLocation(window.location.pathname, window.location.search, BASE_PATH),
        [],
    );

    const [version, setVersion] = useState<GameVersion>(initialVersion);
    const [language, setLanguage] = useState<Language>(initialLanguage);
    const [targetScenario, setTargetScenario] = useState<ScenarioCode>(initialScenario.code);
    const [activeView, setActiveView] = useState<LoadedScenarioView | null>(null);
    const [techDb, setTechDb] = useState<TechDb | null>(null);
    const [navigatedToNode, setNavigatedToNode] = useState<TechTemplate | null>(null);
    const [showProjects, setShowProjects] = useState(true);
    const [isGraphIsolated, setIsGraphIsolated] = useState(false);
    const [isLoadingView, setIsLoadingView] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showDrivesOverlay, setShowDrivesOverlay] = useState(drivesOpenedFromSearch);

    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const theme = useTheme();
    const { width } = useWindowSize();
    const isMobileLayout = width < 900;
    const requestedBySelectorRef = useRef<ScenarioCode | null>(null);
    const requestCoordinatorRef = useRef(new LatestRequestCoordinator<{
        previousView: LoadedScenarioView | null;
        committedUrl: string;
    }>());
    const selectedDataNameRef = useRef<string | null>(id ?? null);
    const lastCommittedUrlRef = useRef(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );

    selectedDataNameRef.current = navigatedToNode?.dataName ?? id ?? null;

    const activeStaticData = activeView?.appStaticData ?? EMPTY_STATIC_DATA;
    const activeLanguage = activeView ? Languages[activeView.key.language] ?? language : language;
    const displayedKey: ScenarioViewKey = activeView?.key ?? {
        version: version.code,
        scenario: targetScenario,
        language: language.code,
    };

    useEffect(() => {
        const requestedKey: ScenarioViewKey = {
            version: version.code,
            scenario: targetScenario,
            language: language.code,
        };
        if (activeView && sameViewKey(activeView.key, requestedKey)) {
            setIsLoadingView(false);
            return;
        }

        const coordinator = requestCoordinatorRef.current;
        const request = coordinator.begin({
            previousView: activeView,
            committedUrl: lastCommittedUrlRef.current,
        });
        const selectedCanonicalName = canonicalDataName(request.context.previousView, selectedDataNameRef.current);
        setIsLoadingView(true);
        setLoadError(null);

        async function loadView() {
            const response = await fetch(
                assetUrl(scenarioBundlePath(requestedKey.version, requestedKey.scenario, requestedKey.language)),
                { signal: request.controller.signal },
            );
            if (!response.ok) {
                throw new Error(`Scenario bundle request failed with HTTP ${response.status}`);
            }
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Removing this boundary requires full runtime validation of the generated bundle schema.
            const bundle = await response.json() as ScenarioBundle;
            if (!sameViewKey(bundle.key, requestedKey)) {
                throw new Error('Scenario bundle key does not match the requested tuple');
            }
            const nextView = hydrateScenarioBundle(bundle, language);
            const nextTechDb = visibleTechDb(nextView, showProjects);
            const nextNode = nextTechDb.getTechByDataName(selectedCanonicalName);
            if (!coordinator.accept(request)) return;

            const selectedByUser = requestedBySelectorRef.current === requestedKey.scenario;
            if (selectedByUser) requestedBySelectorRef.current = null;
            setActiveView(nextView);
            setTechDb(nextTechDb);
            setNavigatedToNode(nextNode ?? null);
            setIsGraphIsolated(false);
            setIsLoadingView(false);

            let appPath = appPathFromBrowserPath(window.location.pathname);
            if (selectedByUser) {
                const currentEntity = entityDataNameFromPath(window.location.pathname, BASE_PATH);
                appPath = currentEntity && nextNode && selectedCanonicalName
                    ? `/${encodeURIComponent(selectedCanonicalName)}`
                    : scenarioLandingAppPath(requestedKey.scenario);
            }
            const search = queryForView(
                window.location.search,
                requestedKey,
                appPath,
                showDrivesOverlay,
            );
            const browserPath = browserPathFromAppPath(appPath);
            const committedUrl = `${browserPath}${search}${window.location.hash}`;
            lastCommittedUrlRef.current = committedUrl;
            if (selectedByUser) {
                navigate({ pathname: appPath, search, hash: window.location.hash });
            } else {
                window.history.replaceState({}, '', committedUrl);
            }
        }

        loadView().catch((error: unknown) => {
            const rollback = coordinator.reject(request);
            if (!rollback) return;
            console.error('Failed to load scenario view', error);
            requestedBySelectorRef.current = null;
            setIsLoadingView(false);
            const errorLanguage = activeView
                ? Languages[activeView.key.language] ?? language
                : language;
            const requestedScenarioName = scenarioDisplayName(
                Scenarios[requestedKey.scenario],
                scenarioLabelsForUi(activeView, errorLanguage),
                errorLanguage.uiTexts.darkSkiesDlc,
            );
            const errorTemplate = selectScenarioLoadErrorTemplate(!!rollback.previousView, {
                scenarioLoadError: errorLanguage.uiTexts.scenarioLoadError,
                scenarioInitialLoadError: errorLanguage.uiTexts.scenarioInitialLoadError,
            });
            setLoadError(interpolateScenarioText(errorTemplate, {
                scenario: requestedScenarioName,
            }));
            if (rollback.previousView) {
                setVersion(GameVersions[rollback.previousView.key.version]);
                setLanguage(Languages[rollback.previousView.key.language]);
                setTargetScenario(rollback.previousView.key.scenario);
                const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                if (currentUrl !== rollback.committedUrl) {
                    const committed = new URL(rollback.committedUrl, window.location.origin);
                    navigate({
                        pathname: appPathFromBrowserPath(committed.pathname),
                        search: committed.search,
                        hash: committed.hash,
                    }, { replace: true });
                }
            }
        });

        return () => coordinator.cancel(request);
    }, [activeView, language, navigate, showDrivesOverlay, showProjects, targetScenario, version]);

    useEffect(() => {
        const scenarioCode = activeView?.key.scenario ?? targetScenario;
        const scenarioCanonical = canonicalUrlForScenario(scenarioCode, window.location.origin, BASE_PATH);
        const pathname = window.location.pathname.endsWith('/')
            ? window.location.pathname
            : `${window.location.pathname}/`;
        const canonical = scenarioCanonical ?? new URL(pathname, window.location.origin).href;
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
        document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', canonical);
    }, [activeView?.key.scenario, location.pathname, targetScenario]);

    useEffect(() => {
        document.documentElement.lang = activeLanguage.locale;
    }, [activeLanguage.locale]);

    useEffect(() => {
        if (!activeView) return;
        const appPath = appPathFromBrowserPath(window.location.pathname);
        const search = queryForView(window.location.search, activeView.key, appPath, showDrivesOverlay);
        const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
        lastCommittedUrlRef.current = nextUrl;
    }, [activeView, showDrivesOverlay]);

    useEffect(() => {
        const handlePopState = () => {
            const poppedVersion = versionFromSearch();
            const poppedLanguage = languageFromSearch(poppedVersion.code);
            const poppedScenario = scenarioFromLocation(window.location.pathname, window.location.search, BASE_PATH);
            requestedBySelectorRef.current = null;
            setVersion(poppedVersion);
            setLanguage(poppedLanguage);
            setTargetScenario(poppedScenario.code);
            setShowDrivesOverlay(drivesOpenedFromSearch());
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (!techDb) return;
        const routeDataName = entityDataNameFromPath(location.pathname, BASE_PATH);
        setNavigatedToNode(routeDataName ? techDb.getTechByDataName(routeDataName) : null);
    }, [location.pathname, techDb]);

    useEffect(() => {
        if (!activeView) return;
        const routeVersion = versionFromSearch(location.search);
        const routeLanguage = languageFromSearch(routeVersion.code, location.search);
        const routeScenario = scenarioFromLocation(location.pathname, location.search, BASE_PATH);
        if (sameViewKey(activeView.key, {
            version: routeVersion.code,
            scenario: routeScenario.code,
            language: routeLanguage.code,
        })) {
            lastCommittedUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        }
    }, [activeView, location.pathname, location.search]);

    const layoutKey = `${displayedKey.version}.${displayedKey.scenario}`;
    const [layoutCache, setLayoutCache] = useState<{ key: string; positions: NodePositions | null } | null>(null);
    useEffect(() => {
        let cancelled = false;
        setLayoutCache(null);
        fetch(assetUrl(layoutArtifactPath(displayedKey.version, displayedKey.scenario)))
            .then((response) => response.ok ? response.json() : null)
            .catch(() => null)
            .then((positions) => {
                if (!cancelled) setLayoutCache({ key: layoutKey, positions });
            });
        return () => { cancelled = true; };
    }, [displayedKey.scenario, displayedKey.version, layoutKey]);

    const bundleKey = `${displayedKey.version}.${displayedKey.scenario}.${displayedKey.language}`;
    const [graphBundle, setGraphBundle] = useState<{ key: string; bundle: GraphBundle | null } | null>(null);
    useEffect(() => {
        let cancelled = false;
        const boot = window.__graphBoot;
        if (boot?.key === bundleKey) {
            boot.bundlePromise.then((bundle) => {
                if (!cancelled) setGraphBundle({ key: bundleKey, bundle });
            });
            return () => { cancelled = true; };
        }
        if (boot && !boot.adopted) {
            boot.network?.destroy();
            boot.container.remove();
            window.__graphBoot = undefined;
        }
        performance.mark('graph:bundle-fetch-start');
        fetch(assetUrl(graphArtifactPath(displayedKey.version, displayedKey.scenario, displayedKey.language)))
            .then((response) => response.ok ? response.json() : null)
            .catch(() => null)
            .then((bundle) => {
                if (!cancelled) {
                    performance.measure('graph:bundle-fetch', 'graph:bundle-fetch-start');
                    setGraphBundle({ key: bundleKey, bundle });
                }
            });
        return () => { cancelled = true; };
    }, [bundleKey, displayedKey.language, displayedKey.scenario, displayedKey.version]);

    const dataReady = !!activeView && !!techDb;
    const renderSource = graphRenderSource({
        key: bundleKey,
        artifact: graphBundle,
        forceLive: !showProjects || isGraphIsolated,
        dataReady,
        layoutReady: layoutCache?.key === layoutKey,
    });
    const activeBundle = renderSource.bundle;

    const navigateToNodePath = useCallback((node: TechTemplate) => {
        if (!activeView) return;
        const canonicalName = canonicalDataName(activeView, node.dataName) ?? node.dataName;
        const appPath = `/${encodeURIComponent(canonicalName)}`;
        const search = queryForView(window.location.search, activeView.key, appPath, showDrivesOverlay);
        const browserPath = browserPathFromAppPath(appPath);
        lastCommittedUrlRef.current = `${browserPath}${search}`;
        navigate({ pathname: appPath, search });
    }, [activeView, navigate, showDrivesOverlay]);

    const onGraphNavigate = useCallback((dataName: string | null) => {
        if (!dataName) {
            setNavigatedToNode(null);
            return;
        }
        const node = techDb?.getTechByDataName(dataName) ?? null;
        setNavigatedToNode(node);
        if (node) navigateToNodePath(node);
    }, [navigateToNodePath, techDb]);

    const onNavigatedToNode = useCallback((node: TechTemplate | null) => {
        setNavigatedToNode(node);
        if (node) navigateToNodePath(node);
    }, [navigateToNodePath]);

    const onShowProjects = useCallback((nextShowProjects: boolean) => {
        setShowProjects(nextShowProjects);
        if (!activeView) return;
        const nextDb = visibleTechDb(activeView, nextShowProjects);
        setTechDb(nextDb);
        setNavigatedToNode((selected) => selected
            ? nextDb.getTechByDataName(canonicalDataName(activeView, selected.dataName))
            : null);
    }, [activeView]);

    const handleIsolatedChanged = useCallback((isolated: boolean) => {
        setIsGraphIsolated(isolated);
        if (!activeView) return;
        if (isolated && techDb && navigatedToNode) {
            const isolatedTree = getAncestorTechs(techDb, navigatedToNode)
                .concat(getDescendentTechs(techDb, navigatedToNode), navigatedToNode);
            const uniqueTree = [...new Map(isolatedTree.map((tech) => [tech.dataName, tech])).values()];
            setTechDb(new TechDb(uniqueTree, combinedReferenceAliases(activeView)));
        } else {
            setTechDb(visibleTechDb(activeView, showProjects));
        }
    }, [activeView, navigatedToNode, showProjects, techDb]);

    const handleScenarioChange = useCallback((scenario: { code: ScenarioCode }) => {
        if (scenario.code === (activeView?.key.scenario ?? targetScenario)) return;
        requestedBySelectorRef.current = scenario.code;
        setTargetScenario(scenario.code);
    }, [activeView?.key.scenario, targetScenario]);

    const handleVersionChange = useCallback((nextVersion: GameVersion) => {
        const nextLanguage = language.availableVersions.includes(nextVersion.code)
            ? language
            : languageFromSearch(nextVersion.code, '');
        setVersion(nextVersion);
        setLanguage(nextLanguage);
    }, [language]);

    const dlcOnlyDataNames = useMemo(() => activeView
        ? activeView.appStaticData.techs.concat(activeView.appStaticData.projects)
            .filter((node) => scenarioMarkerPresentation(node)?.graphDiamond)
            .map((node) => node.dataName)
        : [], [activeView]);
    const selectorValue = activeView?.key.scenario ?? targetScenario;
    const compactScenarioLabels: Record<ScenarioCode, string> = {
        standard: activeLanguage.uiTexts.scenarioStandard,
        '2003': activeLanguage.uiTexts.scenario2003Short,
        'broken-earth': activeLanguage.uiTexts.scenarioBrokenEarthShort,
    };
    const activeScenarioCode = activeView?.key.scenario ?? null;
    const activeScenarioDisplayName = activeScenarioCode
        ? scenarioDisplayName(
            Scenarios[activeScenarioCode],
            compactScenarioLabels,
            activeLanguage.uiTexts.darkSkiesName,
        )
        : null;
    const targetScenarioDisplayName = scenarioDisplayName(
        Scenarios[targetScenario],
        compactScenarioLabels,
        activeLanguage.uiTexts.darkSkiesName,
    );
    const scenarioStatus = scenarioStatusText({
        activeScenario: activeScenarioCode,
        targetScenario,
        activeLabel: activeScenarioDisplayName,
        targetLabel: targetScenarioDisplayName,
        loading: isLoadingView,
        templates: {
            tree: activeLanguage.uiTexts.scenarioTreeStatus,
            viewingLoading: activeLanguage.uiTexts.scenarioViewingStatus,
            loading: activeLanguage.uiTexts.scenarioLoadingStatus,
        },
    });
    const graphAccessibleLabel = interpolateScenarioText(
        activeLanguage.uiTexts.technologyGraphAccessible,
        { scenario: activeScenarioDisplayName ?? targetScenarioDisplayName },
    );
    const graphDrawable = !isMobileLayout && (!!activeBundle || renderSource.drawLive);
    return (
        <>
            <h1 className="visually-hidden">Terra Invicta Tech Tree — 1.0 + Dark Skies DLC</h1>
            {!dataReady && !graphDrawable && <div id="loading">{loadError ?? scenarioStatus}</div>}
            <div id="responsive-container" className={isMobileLayout ? 'mobile-layout' : 'desktop-layout'}>
                {graphDrawable && (
                    <TechGraph
                        techDb={activeBundle ? null : techDb}
                        templateData={activeBundle ? undefined : activeStaticData.templateData}
                        onNavigateToNode={onGraphNavigate}
                        selectedDataName={navigatedToNode?.dataName ?? id ?? null}
                        precomputedPositions={activeBundle ? null : layoutCache?.positions}
                        bundle={activeBundle}
                        dlcOnlyDataNames={dlcOnlyDataNames}
                        accessibleLabel={graphAccessibleLabel}
                    />
                )}

                <div id="options" className={isMobileLayout ? 'mobile' : ''}>
                    <div className={isMobileLayout ? 'loltainer mobile' : 'loltainer'}>
                        <div className="searchbox-container">
                            <Searchbox
                                techDb={techDb}
                                setShowProjects={onShowProjects}
                                onNavigateToNode={onNavigatedToNode}
                                localizationDb={activeStaticData.localizationDb}
                                templateData={activeStaticData.templateData}
                                language={activeLanguage}
                            />
                        </div>
                        <div className="settings-button-container">
                            <SettingsMenu
                                language={language}
                                onLanguageChange={setLanguage}
                                version={version}
                                onVersionChange={handleVersionChange}
                                scenario={selectorValue}
                                onScenarioChange={handleScenarioChange}
                                scenarioLabels={compactScenarioLabels}
                                scenarioLabel={activeLanguage.uiTexts.scenarioLabel}
                                dlcLabel={activeLanguage.uiTexts.darkSkiesName}
                                isScenarioLoading={isLoadingView}
                                onOpenDrives={() => setShowDrivesOverlay(true)}
                            />
                        </div>
                    </div>
                </div>

                {!dataReady && id && (
                    <div id="sidebar" className={isMobileLayout ? 'mobile' : ''}>
                        <Paper elevation={3} id="sidebar-react" className={isMobileLayout ? 'mobile' : ''}>
                            <div className="sidebar-loading"><CircularProgress /></div>
                        </Paper>
                    </div>
                )}
                {dataReady && techDb && activeView && (
                    <TechSidebar
                        key={`${activeView.key.version}.${activeView.key.scenario}.${activeView.key.language}`}
                        templateData={activeStaticData.templateData}
                        localizationDb={activeStaticData.localizationDb}
                        language={activeLanguage}
                        onNavigateToNode={onNavigatedToNode}
                        navigatedToNode={navigatedToNode}
                        effects={activeStaticData.effects}
                        techDb={techDb}
                        handleIsolatedChanged={handleIsolatedChanged}
                        isMobile={isMobileLayout}
                        versionCode={activeView.key.version}
                        scenarioCode={activeView.key.scenario}
                        activeScenarioLabel={compactScenarioLabels[activeView.key.scenario]}
                    />
                )}
            </div>

            {loadError && dataReady && (
                <Paper
                    role="alert"
                    elevation={4}
                    sx={{
                        position: 'fixed',
                        left: '50%',
                        bottom: 16,
                        zIndex: 1400,
                        maxWidth: 'calc(100vw - 32px)',
                        px: 1.5,
                        py: 1,
                        color: 'error.main',
                        transform: 'translateX(-50%)',
                    }}
                >
                    {loadError}
                </Paper>
            )}

            {showDrivesOverlay && (
                <div
                    className="drives-modal-backdrop"
                    onClick={() => setShowDrivesOverlay(false)}
                    style={{ color: theme.palette.text.primary }}
                >
                    <div
                        className="drives-modal"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                            background: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            border: `1px solid ${theme.palette.divider}`,
                            '--drives-surface': theme.palette.background.paper,
                            '--drives-surface-alt': theme.palette.background.default,
                            '--drives-text': theme.palette.text.primary,
                            '--drives-border': theme.palette.divider,
                        }}
                    >
                        <Suspense fallback={null}>
                            <DrivesChart variant="overlay" onClose={() => setShowDrivesOverlay(false)} />
                        </Suspense>
                    </div>
                </div>
            )}
        </>
    );
}

export default App;
