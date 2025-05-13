import './App.css'
import { Searchbox } from './Searchbox'
import { TechGraph } from './TechGraph'
import { TechSidebar } from './TechSidebar'
import React, { useEffect, useState, useCallback } from 'react';
import { getAncestorTechs, getDescendentTechs, parselocalization, getLocalizationString, getReadable, parseTemplate } from './utils'
import { useNavigate, useParams } from "react-router";
import LanguageSelector from './LanguageSelector';
import { TechDb } from './utils/TechDb';
import { AppStaticData } from './types/props';
import { LocalizationData, TemplateData } from './types';
import { DefaultLanguage, Language, Languages } from './language';

function App() {
  const [appStaticData, setAppStaticData] = useState<AppStaticData>({
    templateData: {},
    effects: [],
    techs: [],
    projects: [],
    getLocalizationString: () => undefined,
    getReadable: () => "",
  });

    const [techDb, setTechDb] = useState<TechDb | null>(null);
    const [navigatedToNode, setNavigatedToNode] = useState<any>(null);
    const [isReady, setIsReady] = useState(false);
    
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
            <title>Terra Invicta Tech Tree - Game Version 0.4.78</title>
            {!isReady && <div id="loading">Loading</div>}
            {isReady && techDb && (
                <div id="options"> 
                    <Searchbox
                        techDb={techDb}
                        setShowProjects={onShowProjects}
                        onNavigateToNode={onNavigatedToNode}
                        getLocalizationString={appStaticData.getLocalizationString}
                        getReadable={appStaticData.getReadable}
                        templateData={appStaticData.templateData}
                        language={language}
                    />
                    <LanguageSelector 
                        onLanguageChange={setLanguage}
                    />
                </div>
            )}
            {isReady && techDb && (
                    <TechGraph
                        techDb={techDb}
                        onNavigateToNode={onNavigatedToNode}
                        navigatedToNode={navigatedToNode}
                    />
                )}
            {isReady && techDb && (
                    <TechSidebar
                        templateData={appStaticData.templateData}
                        getLocalizationString={appStaticData.getLocalizationString}
                        getReadable={appStaticData.getReadable}
                        language={language}
                        onNavigateToNode={onNavigatedToNode}
                        navigatedToNode={navigatedToNode}
                        effects={appStaticData.effects}
                        techDb={techDb}
                        handleIsolatedChanged={handleIsolatedChanged}
                    />
                )}
        </>
    )
}

export default App

async function init(language: Language, setTechDb: React.Dispatch<React.SetStateAction<TechDb | null>>, setAppStaticData: React.Dispatch<React.SetStateAction<AppStaticData>>) {
    const { localizationStrings, templateData } = await getTemplateData(language.code);

    const effects = (templateData.effects ?? []).concat(templateData.effect ?? []);
    const techs = templateData.tech;
    const projects = templateData.project;

    projects.forEach(project => { project.isProject = true });

    const counts: { [key: string]: number } = {};
    const techTreeTmp = techs.concat(projects);
    techTreeTmp.forEach((tech, index) => {
        if (tech.isProject) {
            tech.displayName = getReadable(localizationStrings, "project", tech.dataName, "displayName");
        } else {
            tech.displayName = getReadable(localizationStrings, "tech", tech.dataName, "displayName");
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
        getLocalizationString: (a, b, c) => getLocalizationString(localizationStrings, a, b, c),
        getReadable: (a, b, c) => getReadable(localizationStrings, a, b, c),
    });
    setTechDb(new TechDb(techTreeTmp));
};

async function getTemplateData(language: string) {  
    // Fetch and parse localization files
    const templateTypes = {
        "TIBatteryTemplate": "battery",
        "TIDriveTemplate": "drive",
        "TIEffectTemplate": "effect",
        "TIFactionTemplate": "faction",
        "TIGunTemplate": "gun",
        "TIHabModuleTemplate": "habmodule",
        "TIHeatSinkTemplate": "heatsink",
        "TILaserWeaponTemplate": "laserweapon",
        "TIMagneticGunTemplate": "magneticgun",
        "TIMissileTemplate": "missile",
        "TINationTemplate": "nation",
        "TIObjectiveTemplate": "objective",
        "TIOrgTemplate": "org",
        "TIParticleWeaponTemplate": "particleweapon",
        "TIPlasmaWeaponTemplate": "plasmaweapon",
        "TIPowerPlantTemplate": "powerplant",
        "TIProjectTemplate": "project",
        "TIRadiatorTemplate": "radiator",
        "TIRegionTemplate": "region",
        "TIShipArmorTemplate": "shiparmor",
        "TIShipHullTemplate": "shiphull",
        "TITechTemplate": "tech",
        "TITraitTemplate": "trait",
        "TIUtilityModuleTemplate": "utilitymodule",
    };

    const localizationFiles = Object.entries(templateTypes).map(([filename, type]) => ({
        url: `gamefiles/Localization/${language}/${filename}.${language}`,
        type
    }));

    const localizationStrings: LocalizationData = {};
    const fetchLocalizationPromises = localizationFiles.map(localization => fetch(localization.url).then(res => res.text()).then(text => parselocalization(localizationStrings, text, localization.type)));

    const templateFiles = Object.entries(templateTypes).concat([["TIBilateralTemplate", "bilateral"]])
        .map(([filename, type]) => ({
            url: `gamefiles/Templates/${filename}.json`,
            type
        }));

    const templateData: TemplateData = {};
    const fetchTemplatePromises = templateFiles.map(template => fetch(template.url).then(res => res.text()).then(text => parseTemplate(templateData, text, template.type)));
    await Promise.all(fetchLocalizationPromises.concat(fetchTemplatePromises));

    templateData.project.splice(templateData.project.findIndex(project => project.dataName === "Project_AlienMasterProject"), 1);
    templateData.project.splice(templateData.project.findIndex(project => project.dataName === "Project_AlienAdvancedMasterProject"), 1);

    return {
        localizationStrings,
        templateData,
    }
}
