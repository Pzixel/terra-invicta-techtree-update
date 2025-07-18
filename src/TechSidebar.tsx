import React, { useState, useEffect } from "react";
import { Button, Paper, Accordion, AccordionDetails, AccordionSummary, Tooltip, IconButton } from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { findBlockingTechs, getAncestorTechs } from './utils';
import { getTechIconFile } from './techGraphRender';
import { TechSidebarProps } from './types/props';
import { TechTemplate, Claim, Adjacency, DataModule, TemplateType, ModuleTemplate, EffectTemplate } from './types';
import { TechDb } from './utils/TechDb';

// localStorage utility functions for research state persistence
// This feature allows the research progress to persist between page refreshes and app launches
const RESEARCH_STATE_KEY = 'terraInvictaResearchState';

/**
 * Saves the current research state to localStorage
 * Only stores technologies that have researchDone = true to minimize storage space
 */
function saveResearchState(techDb: TechDb) {
    try {
        const researchState: Record<string, boolean> = {};
        techDb.getAllTechs().forEach((tech: TechTemplate) => {
            if (tech.researchDone) {
                researchState[tech.dataName] = true;
            }
        });
        if (Object.keys(researchState).length > 0) {
            localStorage.setItem(RESEARCH_STATE_KEY, JSON.stringify(researchState));
        } else {
            localStorage.removeItem(RESEARCH_STATE_KEY);
        }
    } catch (error) {
        console.warn('Failed to save research state to localStorage:', error);
    }
}

/**
 * Loads research state from localStorage and applies it to the current techDb
 * Automatically handles cases where techs might not exist in the current view
 */
function loadResearchState(techDb: TechDb) {
    try {
        const savedState = localStorage.getItem(RESEARCH_STATE_KEY);
        if (savedState) {
            const researchState: Record<string, boolean> = JSON.parse(savedState);
            techDb.getAllTechs().forEach((tech: TechTemplate) => {
                tech.researchDone = !!researchState[tech.dataName];
            });
        }
    } catch (error) {
        console.warn('Failed to load research state from localStorage:', error);
    }
}

/**
 * Clears all research progress from localStorage
 * Useful for resetting research state completely
 */
function clearResearchState() {
    try {
        localStorage.removeItem(RESEARCH_STATE_KEY);
    } catch (error) {
        console.warn('Failed to clear research state from localStorage:', error);
    }
}

export function TechSidebar({
  templateData,
  localizationDb,
  language,
  techDb,
  onNavigateToNode,
  navigatedToNode,
  handleIsolatedChanged,
  isMobile,
}: TechSidebarProps) {
    const locale = language.locale;
    const effects = (templateData.effects ?? []).concat(templateData.effect ?? []);
    const [isolated, setIsolated] = useState(false);
    const [_researchStateLoaded, setResearchStateLoaded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyButtonHovered, setCopyButtonHovered] = useState(false);
    const [accordionTooltipOpen, setAccordionTooltipOpen] = useState(false);
    const [copyTooltipOpen, setCopyTooltipOpen] = useState(false);

    // Load research state from localStorage when techDb changes
    useEffect(() => {
        if (techDb) {
            loadResearchState(techDb);
            setResearchStateLoaded(true);
        }
    }, [techDb]);

    // Copy to clipboard handler
    const handleCopyTreeCost = async (treeCostString: string) => {
        try {
            await navigator.clipboard.writeText(treeCostString);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    function getReadableEffect(dataName: string) {
        const description = localizationDb.getLocalizationString("effect", dataName, "description");

        if (!description) {
            return "effect." + dataName + ".description";
        }

        if (description.match(/<skip.*>/)) {
            return `${language.uiTexts.hiddenEffect}: ${dataName}`;
        }

        const effectObj = findEffectByName(dataName);
        const effectVal = effectObj?.value ?? 0;
        const effectStr = effectObj?.strValue ?? "";

        var replaceEffectTag = function (match: string) {
            switch (match) {
                case "{0}":
                    return effectVal.toString();

                case "{3}":
                    return effectVal.toLocaleString(locale, { style: "percent" });

                case "{4}":
                    return Math.abs((effectVal - 1.0)).toLocaleString(locale, { style: "percent" });

                case "{8}":
                    return Math.abs((effectVal - 1.0)).toLocaleString(locale, { style: "percent" });

                case "{13}":
                    return localizationDb.getReadable("region", effectStr, "displayName");

                case "{14}":
                    return "our faction";

                case "{18}":
                    return Math.abs((1.0 / effectVal - 1.0)).toLocaleString(locale, { style: "percent" });

                case "{19}":
                    return (-effectVal).toString();

                default:
                    return match;
            }
        };

        const effectTemplateString = description
            .replace(/^-/g, "")
            .replace('<color=#FFFFFFFF><sprite name="mission_control"></color>', "Mission Control")
            .replace('<color=#FFFFFFFF><sprite name="water"></color>', "Water")
            .replace('<color=#FFFFFFFF><sprite name="volatiles"></color>', "Volatiles")
            .replace('<color=#FFFFFFFF><sprite name="metal"></color>', "Metals")
            .replace('<color=#FFFFFFFF><sprite name="metal_noble"></color>', "Noble Metals")
            .replace('<color=#FFFFFFFF><sprite name="radioactive"></color>', "Fissiles")
            .replace(/\{[0-9]*\}/g, replaceEffectTag);

        return effectTemplateString;
    }

    function getReadableSummary(node: TechTemplate) {
        let summary;

        if (node.isProject) {
            summary = localizationDb.getLocalizationString("project", node.dataName, "summary");

        } else {
            summary = localizationDb.getLocalizationString("tech", node.dataName, "summary");
        }

        if (!summary) {
            if (node.isProject) {
                return "project." + node.dataName + ".summary";
            } else {
                return "tech." + node.dataName + ".summary";
            }
        }

        if (summary.match(/<.*module>/)) {
            return language.uiTexts.unblocksOneOrMoreModules;
        } else {
            return React.createElement(
                'p',
                null,
                summary
            );
        }
    }

    function getReadableClaim(claim: Claim) {
        const nationName = localizationDb.getReadable("nation", claim.nation1, "displayName");
        const regionName = localizationDb.getReadable("region", claim.region1, "displayName");

        if (!nationName || !regionName) {
            return null;
        }

        return `${nationName} gains a claim on ${regionName}`;
    }

    function getReadableAdjacency(adjacency: Adjacency) {
        const region1Name = localizationDb.getReadable("region", adjacency.region1, "displayName");
        const region2Name = localizationDb.getReadable("region", adjacency.region2, "displayName");
        if (adjacency.friendlyOnly) {
            return `${region1Name} and ${region2Name} are now considered to be adjacent for friendly traffic`;
        } else {
            return `${region1Name} and ${region2Name} are now considered to be adjacent`;
        }
    }

    // not used
    // function getObjectiveNames(objectiveName) {
    //     let objString;
    //     const objLocStrings = localizationDb.getReadable("objective", objectiveName, "displayName");

    //     if (typeof objLocStrings === "string") {
    //         objString = objLocStrings;
    //     } else {
    //         const objStrings = [];
    //         Object.entries(objLocStrings).forEach(x => {
    //             objStrings.push(x[1] + " (" + localizationDb.getReadable("faction", x[0], "displayName") + ")");
    //         });
    //         objString = objStrings.join(", ");
    //     }

    //     return objString;
    // }

    function findModules(projectName: string): { data: ModuleTemplate, type: TemplateType }[] {
        const results: { data: ModuleTemplate, type: TemplateType }[] = [];
        const modTypes = ["battery", "drive", "gun", "habmodule", "heatsink", "laserweapon", "magneticgun", "missile", "particleweapon", "plasmaweapon", "powerplant", "radiator", "shiparmor", "shiphull", "utilitymodule"] as const;
        modTypes.forEach(modType => {
            templateData[modType]?.forEach(module => {
                if (module.requiredProjectName === projectName) {
                    results.push({ "data": module, "type": modType });
                }
            });
        });
        return results;
    }

    function getIcon(dataModule: { iconResource?: string, baseIconResource?: string, stationIconResource?: string }) {
        if (dataModule.iconResource) {
            return dataModule.iconResource;
        }
        else if (dataModule.baseIconResource) {
            return dataModule.baseIconResource;
        }
        else if (dataModule.stationIconResource) {
            return dataModule.stationIconResource;
        }
        else {
            return undefined;
        }
    }

    function findTechByName(techName: string) {
        return techDb.getTechByDataName(techName);
    }

    function findEffectByName(effectName: string): EffectTemplate | undefined {
        return effects.find(effect => effect.dataName === effectName);
    }

    function getLeaderName(string: string): string {
        let faction = string.slice(1, -1);
        faction = faction.replace("Leader", "Council");
        faction = faction[0].toUpperCase() + faction.slice(1);
        return localizationDb.getLocalizationString("faction", faction, "fullLeader")!;
    }

    const buildModuleDisplay = (dataModule: DataModule) => {
        const icon = getIcon(dataModule.data);
        return <div>
            {icon && <img src={"./icons/" + icon + ".png"} />}
            <p>{localizationDb.getLocalizationString(dataModule.type, dataModule.data.dataName, "description")}</p>
            <pre>{JSON.stringify(dataModule.data, null, 2)}</pre>
        </div>
    };

    const node = navigatedToNode;

    if (!node) {
        return <div></div>
    }

    // Calculate costs and research status
    const researchCost = node.researchCost || 0;
    const ancestorTree = getAncestorTechs(techDb, node);
    if (!ancestorTree || ancestorTree.some(tech => !tech)) {
        // we are in tech only mode but sidebar is opened on a project
        return <div></div>
    }

    const ancestorTreeIds = ancestorTree.map(o => o.id);
    const uniqueAncestorTreeAndSelf = ancestorTree.filter(({ id }, index) => !ancestorTreeIds.includes(id, index + 1)).concat(node);
    const ancestorTreeProcessedAndSelf = uniqueAncestorTreeAndSelf.filter(tech => !tech.researchDone);

    const calculateTechCost = (tree: TechTemplate[]) => {
        return tree.reduce((acc, curr) => { 
            acc[curr.techCategory] ??= {
                tech: 0,
                project: 0,
            };
            if (curr.isProject) {
                acc[curr.techCategory].project += curr.researchCost;
            } else {
                acc[curr.techCategory].tech += curr.researchCost;
            }
            return acc;
        }, {} as Record<string, { tech: number, project: number }>);
    };

    const treeCostBreakdownTotal = calculateTechCost(uniqueAncestorTreeAndSelf);
    const treeCostBreakdownRemaining = calculateTechCost(ancestorTreeProcessedAndSelf);

    const treeCostTotal = Object.values(treeCostBreakdownTotal).reduce((acc, curr) => acc + curr.tech + curr.project, 0);
    const treeCostRemaining = Object.values(treeCostBreakdownRemaining).reduce((acc, curr) => acc + curr.tech + curr.project, 0);

    const treeCostString = treeCostTotal === treeCostRemaining ?
        treeCostTotal.toLocaleString() :
        `${treeCostRemaining.toLocaleString()}/${treeCostTotal.toLocaleString()}`;


    const treeCostBreakdownArr = Object.entries(treeCostBreakdownRemaining);
    treeCostBreakdownArr.sort((a, b) => {
        const aValue = a[1].tech + a[1].project;
        const bValue = b[1].tech + b[1].project;

        if (aValue > bValue) {
            return -1;
        }
        if (aValue < bValue) {
            return 1;
        }
        return 0;
    });

    const techSorter = (a: TechTemplate, b: TechTemplate) => {
        // non-project techs first
        if (a.isProject && !b.isProject) {
            return 1;
        }
        if (!a.isProject && b.isProject) {
            return -1;
        }
        // sort by display name
        return a.displayName.localeCompare(b.displayName);
    };
    
    const handleResearchToggle = () => {
        if (node.researchDone) {
            node.researchDone = false;
            techDb.getTechByDataName(node.dataName)!.researchDone = false;
        } else {
            node.researchDone = true;
            techDb.getTechByDataName(node.dataName)!.researchDone = true;
            getAncestorTechs(techDb, node).forEach(tech => tech.researchDone = true);
        }
        
        // Save the updated research state to localStorage
        saveResearchState(techDb);
        
        onNavigateToNode({
            ...node
        });
    };

    const handleClearAllProgress = () => {
        // Clear all research progress from localStorage
        clearResearchState();
        
        // Reload the page to reset all research states
        window.location.reload();
    };

    const hasAnyResearchProgress = () => {
        if (!techDb) return false;
        return techDb.getAllTechs().some((tech: TechTemplate) => tech.researchDone);
    };

    const renderProjectButton = (tech: TechTemplate) => {
        const canFailToRoll = tech.factionAvailableChance !== undefined && tech.factionAvailableChance < 100;
        return (
            <Button
                key={`${tech.displayName}`}
                onClick={() => onNavigateToNode(tech)}
                variant="contained"
                className={`prereqButton${tech.researchDone ? " researchDone" : ""}`}
                size="small"
                title={tech.isProject ? "Faction Project" : "Global Research"}
                aria-label={tech ? `${tech.displayName} ${tech.isProject ? "Faction Project" : "Global Research"}` : ""}
                color={tech.isProject ? canFailToRoll ? "warning" : "success" : "primary"}
            >
                {tech.displayName} {canFailToRoll ? `${tech.factionAvailableChance}%` : ""}
            </Button>
        )
    }

    // Render prerequisites section
    const renderPrerequisites = () => {
        const prereqNames = node.prereqs?.filter(prereq => prereq !== "") || [];

        if (prereqNames.length === 0) {
            return null;
        }

        const prereqElements = prereqNames
            .map(prereq => {
                const tech = findTechByName(prereq);
                if (!tech) {
                    return null;
                }
                return renderProjectButton(tech);
            });

        // Handle alternate prerequisites
        if (node.altPrereq0 && node.altPrereq0 !== "") {
            const prereq = node.altPrereq0;
            const tech = findTechByName(prereq);
            if (!tech) {
                return null;
            }
            const altButton = renderProjectButton(tech);

            const orText = <b key={"or"} className="prereqButton">or</b>;
            const breakElement = <br key={"br"} />;
            const andText = <b key={"and"} className="prereqButton">and</b>;

            if (prereqElements.length > 1) {
                prereqElements.splice(1, 0, orText, altButton, breakElement, andText);
            } else {
                prereqElements.splice(1, 0, orText, altButton);
            }
        }

        return (
            <>
                <h4>{language.uiTexts.requiredResearch}</h4>
                <div className="hideBullets">{prereqElements}</div>
            </>
        );
    };

    // Render blocking techs section
    const renderBlockingTechs = () => {
        const blockingTechs = findBlockingTechs(techDb, node);
        if (blockingTechs.length === 0) {
            return null;
        }

        blockingTechs.sort(techSorter);

        const blockerElements = blockingTechs.map(blocked => renderProjectButton(blocked));

        return (
            <>
                <h4>{language.uiTexts.unblocksResearch}</h4>
                <div className="hideBullets">{blockerElements}</div>
            </>
        );
    };

    const renderAdjacencies = () => {
        const adjacencies = (templateData["bilateral"] ?? []).filter((adjaceny): adjaceny is Adjacency => 
            adjaceny.projectUnlockName == node.dataName && adjaceny.relationType == "PhysicalAdjacency");
        if (adjacencies.length === 0) {
            return null;
        }
        const adjacencyElements = adjacencies.map(adjacency => (
            <li key={`adj-${adjacency.dataName}`}>{getReadableAdjacency(adjacency)}</li>
        ));
        return (
            <>
                <h4>{language.uiTexts.adjacencies}</h4>
                <ul>{adjacencyElements}</ul>
            </>
        );
    };

    const renderResources = () => {
        const resourcesGranted = node.resourcesGranted?.filter(resource => resource.resource !== "") ?? [];
        if (resourcesGranted.length === 0) {
            return null;
        }

        const resourceElements = resourcesGranted
            .map(resource => (
                <li key={`res-${resource.resource}`}>{resource.resource} {resource.value}</li>
            ));
        return (
            <>
                <h4>{language.uiTexts.resourcesGranted}</h4>
                <ul>{resourceElements}</ul>
            </>
        );
    };

    const renderOrg = () => {
        if (!node.orgGranted) {
            return null;
        }
        const org = node.orgGranted;
        const displayName = localizationDb.getLocalizationString("org", org, "displayName");
        return (
            <>
                <h4>{language.uiTexts.orgGranted}</h4>
                <p>{displayName ? displayName : org}</p>
            </>
        );
    };

    const renderOrgsMarket = () => {
        const orgMarket = templateData["org"]?.filter(org => org.requiredTechName == node.dataName) ?? [];
        if (orgMarket.length === 0) {
            return null;
        }
        const orgMarketElements = orgMarket.map(org => {
            const displayName = localizationDb.getLocalizationString("org", org.dataName, "displayName") ?? org.dataName;
            const displayText = `${displayName} ${'⭐'.repeat(org.tier)}`;
            return (
                <li key={`org-${org.dataName}`}>
                    <Accordion disableGutters>  
                        <AccordionSummary>
                            {displayText}
                        </AccordionSummary>
                        <AccordionDetails>
                           <pre>{JSON.stringify(org, null, 2)}</pre>
                        </AccordionDetails>
                    </Accordion>
                </li>
            );
        });
        return (
            <>
                <h4>{language.uiTexts.orgsAddedToMarket}</h4>
                <ul className="hideBullets">{orgMarketElements}</ul>
            </>
        );
    };

    const renderEffects = () => {
        if (!node.effects || node.effects.filter(effect => effect !== "").length === 0) {
            return null;
        }

        const effectElements = node.effects
            .filter(effect => effect !== "")
            .map(effect => (
                <li key={`eff-${effect}`}>{getReadableEffect(effect)}</li>
            ));

        return (
            <>
                <h4>{language.uiTexts.effects}</h4>
                <ul>{effectElements}</ul>
            </>
        );
    };
    
    const renderTraits = () => {
        const traits = templateData["trait"]?.filter(aug => aug.projectDataName == node.dataName) ?? [];
        if (traits.length === 0) {
            return null;
        }
        const traitElements = traits.map(trait => {
            const displayName = localizationDb.getLocalizationString("trait", trait.dataName, "displayName");
            return (
                <li key={`trait-${trait.dataName}`}>{displayName ? displayName : trait.dataName}</li>
            );
        });
        return (
            <>
                <h4>{language.uiTexts.traits}</h4>
                <ul>{traitElements}</ul>
            </>
        );
    };

    const renderModules = () => {
        const modules = node.isProject ? findModules(node.dataName) : [];
        if (modules.length === 0) {
            return null;
        }
        const moduleElements = modules.map(module => {
            const displayName = localizationDb.getLocalizationString(module.type, module.data.dataName, "displayName");
            return (
                <div key={`mod-${module.data.dataName}`}>
                    <br />
                    {displayName ? displayName : module.data.dataName}
                    {buildModuleDisplay(module)}
                </div>
            );
        });
        return (
            <>
                <h4>{language.uiTexts.modulesUnlocked}</h4>
                {moduleElements}
            </>
        );
    };

    // Render claims section
    const renderClaims = () => {
        if (!node.isProject) return null;

        const claims = (templateData["bilateral"] ?? []).filter(
            (claim): claim is Claim => claim.projectUnlockName === node.dataName && claim.relationType === "Claim"
        );

        if (claims.length === 0) return null;

        // deduplicate claims by dataName
        const uniqueClaims = Array.from(new Set(claims.map(claim => claim.dataName)))
            .map(dataName => claims.find(claim => claim.dataName === dataName)!);

        const claimsElements = uniqueClaims.flatMap(claim => {
            const text = getReadableClaim(claim);
            if (!text) {
                return [];
            }
            return [
                <li key={`claim-${claim.dataName}`}>{text}</li>
            ];
        });

        return (
            <>
                <h4>{language.uiTexts.claims}</h4>
                <ul>{claimsElements}</ul>
            </>
        );
    };

    // Main render
    return (
        <div id="sidebar" className={isMobile ? "mobile" : ""}>
            <Paper elevation={3} id="sidebar-react" className={isMobile ? "mobile" : ""}>
                {/* Controls */}
                {!isMobile && (
                    <Button
                        variant="contained"
                        onClick={() => {
                            setIsolated(!isolated);
                            handleIsolatedChanged(!isolated);
                        }}
                        className="topTechbarButton"
                    >
                        {/* See tree for this node */}
                        {/* (!isolated ? "See tree for this node" : "See entire tree") */}
                        {/* {isolated ? "See entire tree" : "See tree for this node"} */}
                        {isolated ? language.uiTexts.seeEntireTree : language.uiTexts.seeTreeForThisNode}
                    </Button>
                )}

                <Button
                    variant="contained"
                    onClick={handleResearchToggle}
                    className="topTechbarButton"
                    color={node.researchDone ? "error" : "success"}
                >
                    {node.researchDone ? language.uiTexts.markUndone : language.uiTexts.markDone}
                </Button>
                {hasAnyResearchProgress() && (
                    <Tooltip title={language.uiTexts.clearAllProgressTooltip} arrow placement="top">
                        <Button
                            variant="contained"
                            onClick={handleClearAllProgress}
                            className="topTechbarButton"
                            color="secondary"
                        >
                            {language.uiTexts.clearAllProgress}
                        </Button>
                    </Tooltip>
                )}

                {/* Heading */}
                <h2>{node.displayName} {node.isProject ? <img src="icons/ICO_projects_Invert.png" alt="faction project" style={{ width: "24px", height: "24px" }} /> : null}</h2>

                {/* Cost information */}
                <Accordion disableGutters>
                    <Tooltip 
                        title="Click to see technology cost breakdown" 
                        arrow 
                        placement="top" 
                        enterDelay={300}
                        open={accordionTooltipOpen && !copyButtonHovered}
                        disableHoverListener={true}
                    >
                        <AccordionSummary
                            onMouseEnter={() => setAccordionTooltipOpen(true)}
                            onMouseLeave={() => setAccordionTooltipOpen(false)}
                        >
                            <div id="costInfo">
                                {language.uiTexts.cost}: {researchCost.toLocaleString()}
                                <br />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{language.uiTexts.totalTreeCost}: {treeCostString}</span>
                                    <Tooltip 
                                        title={copied ? "Copied!" : "Copy to clipboard"} 
                                        arrow 
                                        placement="right" 
                                        enterDelay={100}
                                        open={copyTooltipOpen}
                                        disableHoverListener={true}
                                    >
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyTreeCost(treeCostString);
                                            }}
                                            onMouseEnter={(e) => {
                                                setCopyButtonHovered(true);
                                                setCopyTooltipOpen(true);
                                                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                                            }}
                                            onMouseLeave={(e) => {
                                                setCopyButtonHovered(false);
                                                setCopyTooltipOpen(false);
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }}
                                            style={{
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                minWidth: '24px',
                                                padding: '4px',
                                                borderRadius: '4px',
                                                color: copied ? '#4caf50' : '#666',
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            <ContentCopyIcon sx={{ fontSize: '16px' }} />
                                        </span>
                                    </Tooltip>
                                </div>
                            </div>
                        </AccordionSummary>
                    </Tooltip>
                    <AccordionDetails id="costBreakdown">
                        <ul>
                            {treeCostBreakdownArr.map(([key, {tech, project}]) => (
                                <li key={key}>
                                    <img src={getTechIconFile(key)} alt={key} style={{ width: "16px", height: "16px" }} /> 
                                    {(tech + project).toLocaleString()}
                                    {
                                        project > 0 && 
                                        (
                                            <span>
                                                {"\t\t\t"}(<img src="icons/ICO_projects_Invert.png" alt={key} style={{ width: "16px", height: "16px" }} />
                                                {"\t\t"}{project.toLocaleString()})
                                            </span>
                                        )
                                    }
                                </li>
                            ))}
                        </ul>
                    </AccordionDetails>
                </Accordion>

                {/* Project-specific probabilities */}
                {node.isProject && (
                    <>
                        <h4>{language.uiTexts.baseAvailabilityChance}: {(node.factionAvailableChance! / 100).toLocaleString(locale, { style: "percent" })}</h4>
                        <h5>{language.uiTexts.initialUnlockChance}: {(node.initialUnlockChance! / 100).toLocaleString(locale, { style: "percent" })}</h5>
                        <h5>{language.uiTexts.monthlyUnlockChanceIncrease}: {(node.deltaUnlockChance! / 100).toLocaleString(locale, { style: "percent" })}</h5>
                        <h5>{language.uiTexts.maximumUnlockChance}: {(node.maxUnlockChance! / 100).toLocaleString(locale, { style: "percent" })}</h5>
                    </>
                )}

                {/* Faction requirements */}
                {node.isProject && node.factionAlways && (
                    <h5>{language.uiTexts.factionAlways} {localizationDb.getReadable("faction", node.factionAlways, "displayName")}</h5>
                )}

                {node.isProject && node.factionPrereq && node.factionPrereq.filter(faction => faction !== "").length > 0 && (
                    <h5>
                        {language.uiTexts.factionPrereq}: {
                            node.factionPrereq
                                .filter(faction => faction !== "")
                                .map(faction => localizationDb.getReadable("faction", faction, "displayName"))
                                .join(", ")
                        }
                    </h5>
                )}

                {/* Requirements */}
                {renderPrerequisites()}
                {renderBlockingTechs()}

                {/* Other requirements */}
                {node.isProject && node.requiredMilestone && node.requiredMilestone !== "" && (
                    <h4>{language.uiTexts.milestoneNeeded}: {localizationDb.getReadable("objective", node.requiredMilestone, "MilestoneFulfilled")}</h4>
                )}

                {/* Special flags */}
                {!node.isProject && node.endGameTech && <h4>{language.uiTexts.endgameTech}</h4>}
                {node.isProject && node.oneTimeGlobally && <h4>{language.uiTexts.completableOnceGlobally}</h4>}
                {node.isProject && node.repeatable && <h4>{language.uiTexts.repeatable}</h4>}

                <h4>{language.uiTexts.summary}</h4>
                {getReadableSummary(node)}

                {/* Rewards */}
                {renderClaims()}
                {renderAdjacencies()}
                {renderResources()}
                {renderOrg()}
                {renderOrgsMarket()}
                {renderEffects()}
                {renderTraits()}
                {renderModules()}

                {/* Completion text */}
                {node.isProject ? (
                    <>
                        {localizationDb.getLocalizationString("project", node.dataName, "description") && (
                            <>
                                <h4>{language.uiTexts.completionText}</h4>
                                <p dangerouslySetInnerHTML={{ __html: localizationDb.getLocalizationString("project", node.dataName, "description")! }} />
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {localizationDb.getLocalizationString("tech", node.dataName, "quote") && (
                            <>
                                <h4>{language.uiTexts.completionQuote}</h4>
                                <p dangerouslySetInnerHTML={{
                                    __html: localizationDb.getLocalizationString("tech", node.dataName, "quote")!.replace(/\{(.*?)\}/g, getLeaderName)
                                }} />
                            </>
                        )}
                        {localizationDb.getLocalizationString("tech", node.dataName, "description") && (
                            <>
                                <h4>{language.uiTexts.completionText}</h4>
                                <p dangerouslySetInnerHTML={{ __html: localizationDb.getLocalizationString("tech", node.dataName, "description")! }} />
                            </>
                        )}
                    </>
                )}
            </Paper>
        </div>
    );
}