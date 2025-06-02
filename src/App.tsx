import './App.css'
import { Searchbox } from './Searchbox'
import { TechGraph } from './TechGraph'
import { TechSidebar } from './TechSidebar'
import React, { useEffect, useState, useCallback } from 'react';
import { getAncestorTechs, getDescendentTechs } from './utils'
import { useNavigate, useParams } from "react-router";
import LanguageSelector from './LanguageSelector';
import { TechDb } from './utils/TechDb';
import { AppStaticData } from './types/props';
import { getTemplateData, LocalizationDb, TemplateTypes } from './types';
import { DefaultLanguage, Language, Languages } from './language';
import { useWindowSize } from './utils/useWindowSize';

function App() {
    const [appStaticData, setAppStaticData] = useState<AppStaticData>({
        templateData: {},
        effects: [],
        techs: [],
        projects: [],
        localizationDb: new LocalizationDb([]),
    });

    const [techDb, setTechDb] = useState<TechDb | null>(null);
    const [navigatedToNode, setNavigatedToNode] = useState<any>(null);
    const [isReady, setIsReady] = useState(false);

    // Get window dimensions for responsive layout
    const { width } = useWindowSize();
    // Define breakpoint for mobile layout (sidebar below searchbox)
    const isMobileLayout = width < 900;

    // Get initial language from URL parameter
    const getInitialLanguage = () => {
        const queryParams = new URLSearchParams(window.location.search);
        const langParam = queryParams.get('lang');
        return langParam && Languages[langParam] ? Languages[langParam] : DefaultLanguage;
    };

    const [language, setLanguage] = useState(getInitialLanguage());

    const navigate = useNavigate();
    const { id } = useParams();

    useEffect(() => {
        async function initialize() {
            await init(language, setTechDb, setAppStaticData);
            setIsReady(true);
        }
        initialize();
    }, [language, setTechDb, setAppStaticData]);

    useEffect(() => {
        if (id && techDb) {
            const node = techDb.getTechByDataName(id);
            if (node) {
                setNavigatedToNode(node);
            }
        }
    }, [id, techDb]);

    const onNavigatedToNode = useCallback((x: any) => {
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
            if (techDb) {
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
                                <div className="language-container">
                                    <LanguageSelector
                                        onLanguageChange={setLanguage}
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
        </>
    )
}

export default App

async function init(language: Language, setTechDb: React.Dispatch<React.SetStateAction<TechDb | null>>, setAppStaticData: React.Dispatch<React.SetStateAction<AppStaticData>>) {
    const { localizationDb, templateData } = await loadTemplateData(language.code);

    const effects = (templateData.effects ?? []).concat(templateData.effect ?? []);
    const techs = templateData.tech;
    const projects = templateData.project;

    projects.forEach(project => { project.isProject = true });

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

async function loadTemplateData(language: string) {
    const localizationFiles = Object.entries(TemplateTypes).map(([type, filename]) => ({
        url: `gamefiles/Localization/${language}/${filename}.${language}`,
        type
    }));

    const fetchLocalizationPromises = Promise.all(localizationFiles.map(localization => fetch(localization.url).then(res => res.text())));

    const templateFiles = Object.entries(TemplateTypes).concat([["bilateral", "TIBilateralTemplate"]])
        .map(([type, filename]) => ({
            url: `gamefiles/Templates/${filename}.json`,
            type
        }));

    const fetchTemplatePromises = Promise.all(templateFiles.map(template => fetch(template.url).then(async res => [template.type, JSON.parse(await res.text())] satisfies [string, any[]])));
    const [localizationResults, templateResults] = await Promise.all([fetchLocalizationPromises, fetchTemplatePromises]);

    const localizationDb = new LocalizationDb(localizationResults);
    const templateData = getTemplateData(templateResults);

    templateData.project.splice(templateData.project.findIndex(project => project.dataName === "Project_AlienMasterProject"), 1);
    templateData.project.splice(templateData.project.findIndex(project => project.dataName === "Project_AlienAdvancedMasterProject"), 1);

    return {
        localizationDb,
        templateData,
    }
}
