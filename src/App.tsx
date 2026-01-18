import './App.css'
import { Searchbox } from './Searchbox'
import { TechGraph } from './TechGraph'
import { TechSidebar } from './TechSidebar'
import React, { useEffect, useState, useCallback } from 'react';
import { getAncestorTechs, getDescendentTechs } from './utils'
import { useNavigate, useParams } from "react-router";
import { TechDb } from './utils/TechDb';
import { AppStaticData } from './types/props';
import { getTemplateData, LocalizationDb, TemplateTypes, TechTemplate } from './types';
import { DefaultLanguage, Language, Languages } from './language';
import { DefaultVersion, GameVersion, GameVersionCode, GameVersions, isGameVersionCode } from './version';
import { useWindowSize } from './utils/useWindowSize';
import { SettingsMenu } from './SettingsMenu';
import { useTheme } from '@mui/material/styles';
import DrivesChart from './DrivesChart';

function App() {
    const [appStaticData, setAppStaticData] = useState<AppStaticData>({
        templateData: {},
        effects: [],
        techs: [],
        projects: [],
        localizationDb: new LocalizationDb([], DefaultLanguage.uiTexts),
    });

    const [techDb, setTechDb] = useState<TechDb | null>(null);
    const [navigatedToNode, setNavigatedToNode] = useState<TechTemplate | null>(null);
    const [isReady, setIsReady] = useState(false);
    const getInitialDrivesOpened = () => {
        const params = new URLSearchParams(window.location.search);
        const drives = params.get('drivesOpened');
        return drives === 'true' || drives === '1';
    };

    const [showDrivesOverlay, setShowDrivesOverlay] = useState<boolean>(() => getInitialDrivesOpened());
    const theme = useTheme();

    // Get window dimensions for responsive layout
    const { width } = useWindowSize();
    // Define breakpoint for mobile layout (sidebar below searchbox)
    const isMobileLayout = width < 900;

    // Get initial language from URL parameter
    const getInitialVersion = () => {
        const queryParams = new URLSearchParams(window.location.search);
        const versionParam = queryParams.get('ver');
        return isGameVersionCode(versionParam) ? GameVersions[versionParam] : DefaultVersion;
    };

    const getInitialLanguage = (versionCode: GameVersionCode) => {
        const queryParams = new URLSearchParams(window.location.search);
        const langParam = queryParams.get('lang');

        if (langParam && Languages[langParam]) {
            const candidate = Languages[langParam];
            if (candidate.availableVersions.includes(versionCode)) {
                return candidate;
            }
        }

        return Object.values(Languages).find((lang) => lang.availableVersions.includes(versionCode)) ?? DefaultLanguage;
    };

    const [version, setVersion] = useState<GameVersion>(() => getInitialVersion());
    const [language, setLanguage] = useState<Language>(() => {
        const initialVersion = getInitialVersion();
        return getInitialLanguage(initialVersion.code);
    });

    const navigate = useNavigate();
    const { id } = useParams();

    useEffect(() => {
        setIsReady(false);
        async function initialize() {
            try {
                await init(language, version, setTechDb, setAppStaticData);
            } catch (error) {
                console.error('Failed to initialize application data', error);
            } finally {
                setIsReady(true);
            }
        }
        initialize();
    }, [language, version, setTechDb, setAppStaticData]);

    const syncQueryParams = useCallback((drivesOpen: boolean) => {
        const url = new URL(window.location.href);
        const params = url.searchParams;
        params.set('lang', language.code);
        params.set('ver', version.code);
        if (drivesOpen) {
            params.set('drivesOpened', '1');
        } else {
            params.delete('drivesOpened');
        }
        const newQuery = params.toString();
        const newUrl = `${url.pathname}${newQuery ? `?${newQuery}` : ''}${url.hash}`;
        window.history.replaceState({}, '', newUrl);
    }, [language.code, version.code]);

    useEffect(() => {
        syncQueryParams(showDrivesOverlay);
    }, [language, version, showDrivesOverlay, syncQueryParams]);

    useEffect(() => {
        if (!language.availableVersions.includes(version.code)) {
            const fallbackLanguage = Object.values(Languages).find((lang) =>
                lang.availableVersions.includes(version.code)
            ) ?? DefaultLanguage;

            if (fallbackLanguage.code !== language.code) {
                setLanguage(fallbackLanguage);
            }
        }
    }, [language, version]);

    useEffect(() => {
        const handlePopState = () => {
            const poppedVersion = getInitialVersion();
            setVersion(poppedVersion);
            setLanguage(getInitialLanguage(poppedVersion.code));
            setShowDrivesOverlay(getInitialDrivesOpened());
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    useEffect(() => {
        if (id && techDb) {
            const node = techDb.getTechByDataName(id);
            if (node) {
                setNavigatedToNode(node);
            }
        }
    }, [id, techDb]);

    const onNavigatedToNode = useCallback((x: TechTemplate | null) => {
        setNavigatedToNode(x);
        if (x) {
            navigate(`/${x.dataName}`);
        } else {
            // navigate to / adds a lot of breaks in hostory - do not do it for now
            // navigate(`/`);
        }
    }, [setNavigatedToNode, navigate])

    const onShowProjects = useCallback((showToggle: boolean) => {
        setTechDb(new TechDb(showToggle ? appStaticData.techs.concat(appStaticData.projects) : appStaticData.techs));
    }, [appStaticData.techs, appStaticData.projects]);

    const handleIsolatedChanged = useCallback((isolated: boolean) => {
        if (isolated) {
            if (techDb && navigatedToNode) {
                const node = navigatedToNode;
                const isolatedTree = getAncestorTechs(techDb, node).concat(getDescendentTechs(techDb, node)).concat(node);
                const isolatedTreeSet = [...new Map(isolatedTree.map(v => [v.dataName, v])).values()];
                setTechDb(new TechDb(isolatedTreeSet));
            }
        } else {
            setTechDb(new TechDb(appStaticData.techs.concat(appStaticData.projects)));
        }
    }, [appStaticData.techs, appStaticData.projects, techDb, navigatedToNode]);

    return (
        <>
            {!isReady && <div id="loading">Loading</div>}
            {isReady && techDb && (
                <div id="responsive-container" className={isMobileLayout ? "mobile-layout" : "desktop-layout"}>
                    {/* Only load TechGraph on desktop layouts */}
                    {isReady && techDb && !isMobileLayout && (
                        <TechGraph
                            techDb={techDb}
                            templateData={appStaticData.templateData}
                            onNavigateToNode={onNavigatedToNode}
                            navigatedToNode={navigatedToNode}
                        />
                    )}

                    <div id="options" className={isMobileLayout ? "mobile" : ""}>
                        <>
                            <div className={isMobileLayout ? "loltainer mobile" : "loltainer"}>
                                <div className="searchbox-container">
                                    <Searchbox
                                        techDb={techDb}
                                        setShowProjects={onShowProjects}
                                        onNavigateToNode={onNavigatedToNode}
                                        localizationDb={appStaticData.localizationDb}
                                        templateData={appStaticData.templateData}
                                        language={language}
                                    />
                                </div>
                                <div className="settings-button-container">
                                    <SettingsMenu
                                        language={language}
                                        onLanguageChange={setLanguage}
                                        version={version}
                                        onVersionChange={setVersion}
                                        onOpenDrives={() => setShowDrivesOverlay(true)}
                                    />
                                </div>
                            </div>
                        </>
                    </div>

                    {/* Show TechSidebar in mobile view below search, or in desktop view on the right */}
                    {isReady && techDb && (
                        <TechSidebar
                            templateData={appStaticData.templateData}
                            localizationDb={appStaticData.localizationDb}
                            language={language}
                            onNavigateToNode={onNavigatedToNode}
                            navigatedToNode={navigatedToNode}
                            effects={appStaticData.effects}
                            techDb={techDb}
                            handleIsolatedChanged={handleIsolatedChanged}
                            isMobile={isMobileLayout}
                        />
                    )}
                </div>
            )}

            {showDrivesOverlay && (
                <div
                    className="drives-modal-backdrop"
                    onClick={() => setShowDrivesOverlay(false)}
                    style={{ color: theme.palette.text.primary }}
                >
                    <div
                        className="drives-modal"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: theme.palette.background.paper,
                            color: theme.palette.text.primary,
                            border: `1px solid ${theme.palette.divider}`,
                            '--drives-surface': theme.palette.background.paper,
                            '--drives-surface-alt': theme.palette.background.default,
                            '--drives-text': theme.palette.text.primary,
                            '--drives-border': theme.palette.divider,
                        } as React.CSSProperties}
                    >
                        <DrivesChart
                            variant="overlay"
                            onClose={() => setShowDrivesOverlay(false)}
                        />
                    </div>
                </div>
            )}
        </>
    )
}

export default App

async function init(language: Language, version: GameVersion, setTechDb: React.Dispatch<React.SetStateAction<TechDb | null>>, setAppStaticData: React.Dispatch<React.SetStateAction<AppStaticData>>) {
    const { localizationDb, templateData } = await loadTemplateData(language, version);

    const effects = (templateData.effects ?? []).concat(templateData.effect ?? []);
    const techs = templateData.tech ?? [];
    const projects = templateData.project ?? [];

    projects.forEach((project) => { project.isProject = true });

    const counts: { [key: string]: number } = {};
    const techTreeTmp = techs.concat(projects);
    techTreeTmp.forEach((tech, index) => {
        if (tech.isProject) {
            tech.displayName = localizationDb.getReadable("project", tech.dataName, "displayName");
        } else {
            tech.displayName = localizationDb.getReadable("tech", tech.dataName, "displayName");
        }
        tech.id = index;
        counts[tech.displayName] = (counts[tech.displayName] ?? 0) + 1;
    });

    for (const tech of techTreeTmp) {
        if (counts[tech.displayName] > 1) {
            tech.displayName += ` (${tech.friendlyName})`;
        }
    }

    setAppStaticData({
        templateData,
        effects,
        techs,
        projects,
        localizationDb,
    });
    setTechDb(new TechDb(techTreeTmp));
};

async function loadTemplateData(language: Language, version: GameVersion) {
    const basePath = `gamefiles/${version.code}`;
    const languageCode = language.code;

    const fetchText = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
        }
        return response.text();
    };

    const localizationFiles = Object.entries(TemplateTypes).map(([type, filename]) => ({
        url: `${basePath}/Localization/${languageCode}/${filename}.${languageCode}`,
        type
    }));

    const fetchLocalizationPromises = Promise.all(localizationFiles.map(localization => fetchText(localization.url)));

    const templateFiles = Object.entries(TemplateTypes).concat([["bilateral", "TIBilateralTemplate"]])
        .map(([type, filename]) => ({
            url: `${basePath}/Templates/${filename}.json`,
            type
        }));

    const fetchTemplatePromises = Promise.all(templateFiles.map(async template => {
        const text = await fetchText(template.url);
        return [template.type, JSON.parse(text)] as [string, unknown[]];
    }));
    const [localizationResults, templateResults] = await Promise.all([fetchLocalizationPromises, fetchTemplatePromises]);

    const localizationDb = new LocalizationDb(localizationResults, language.uiTexts);
    const templateData = getTemplateData(templateResults);

    // Remove alien master projects
    if (templateData.project) {
        const alienMasterIndex = templateData.project.findIndex((project: TechTemplate) => project.dataName === "Project_AlienMasterProject");
        if (alienMasterIndex !== -1) {
            templateData.project.splice(alienMasterIndex, 1);
        }
        
        const alienAdvancedMasterIndex = templateData.project.findIndex((project: TechTemplate) => project.dataName === "Project_AlienAdvancedMasterProject");
        if (alienAdvancedMasterIndex !== -1) {
            templateData.project.splice(alienAdvancedMasterIndex, 1);
        }
    }

    return {
        localizationDb,
        templateData,
    }
}
