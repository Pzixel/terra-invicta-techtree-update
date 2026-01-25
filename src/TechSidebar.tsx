import React, { useState, useEffect } from "react";
import { Button, Paper, Accordion, AccordionDetails, AccordionSummary, Tooltip, IconButton, useTheme } from "@mui/material";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { findBlockingTechs, getAncestorTechs } from './utils';
import { getTechIconFile } from './techGraphRender';
import { TechSidebarProps } from './types/props';
import { TechTemplate, Claim, Adjacency, DataModule, TemplateType, ModuleTemplate, EffectTemplate, TemplateTypes } from './types';
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

const templates = Object.keys(TemplateTypes) as (keyof typeof TemplateTypes)[];

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
    const theme = useTheme();
    const locale = language.locale;
    const effects = (templateData.effects ?? []).concat(templateData.effect ?? []);
    const [isolated, setIsolated] = useState(false);
    const [_researchStateLoaded, setResearchStateLoaded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copyButtonHovered, setCopyButtonHovered] = useState(false);
    const [accordionTooltipOpen, setAccordionTooltipOpen] = useState(false);
    const [copyTooltipOpen, setCopyTooltipOpen] = useState(false);
    const projectIconSrc = theme.palette.mode === 'dark' ? "icons/ICO_projects.png" : "icons/ICO_projects_Invert.png";

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
                    console.log(effectStr, match);
                    for (let type of templates) {
                        const readable = localizationDb.getReadable(type, effectStr, "displayName");
                        if (readable) {
                            return readable;
                        }
                    }
                    return effectStr;
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

    function formatModuleDescription(description: string | undefined, templateValue?: number): React.ReactNode | undefined {
        if (!description) {
            return description;
        }

        const formatNumber = (value: number) => value.toLocaleString(locale);
        const formatPercent = (value: number) => {
            const percentBase = value > 1 ? value - 1 : value;
            return percentBase.toLocaleString(locale, { style: "percent" });
        };

        const resolvedNumbers = description.replace(/\{(\d+)\}/g, (match, tag) => {
            if (templateValue == null || Number.isNaN(templateValue)) {
                return match;
            }

            switch (tag) {
                case "0":
                case "3":
                case "12":
                case "13":
                    return formatNumber(templateValue);
                case "1":
                case "2":
                case "5":
                case "6":
                case "8":
                case "10":
                case "14":
                    return formatPercent(templateValue);
                default:
                    return match;
            }
        });

        const tokenRegex = /<color=[^>]*><sprite name="([^"]+)"><\/color>|<h>(.*?)<\/h>|<br\s*\/?>/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(resolvedNumbers)) !== null) {
            const before = resolvedNumbers.slice(lastIndex, match.index);
            if (before) {
                parts.push(before);
            }

            const spriteName = match[1];
            const highlightText = match[2];

            if (spriteName) {
                if (spriteName === "army_level") {
                    parts.push(
                        <img
                            key={`sprite-${parts.length}`}
                            className="inline-sprite"
                            src="./icons/ICO_space_assault_score.png"
                            alt="Assault value icon"
                        />
                    );
                } else if (spriteName === "water") {
                    parts.push(
                        <img
                            key={`sprite-${parts.length}`}
                            className="inline-sprite"
                            src="./icons/ICO_water.png"
                            alt="Water icon"
                        />
                    );
                } else {
                    parts.push(match[0]);
                }
            } else if (typeof highlightText === "string") {
                parts.push(
                    <span key={`highlight-${parts.length}`} className="inline-highlight">{highlightText}</span>
                );
            } else {
                parts.push(<br key={`br-${parts.length}`} />);
            }

            lastIndex = match.index + match[0].length;
        }

        const trailingText = resolvedNumbers.slice(lastIndex);
        if (trailingText) {
            parts.push(trailingText);
        }

        if (parts.length === 0) {
            return resolvedNumbers;
        }

        if (parts.length === 1) {
            return parts[0];
        }

        return <>{parts}</>;
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

        return formatTemplate(language.uiTexts.claimGained, {
            nation: nationName,
            region: regionName,
        });
    }

    function getReadableAdjacency(adjacency: Adjacency) {
        const region1Name = localizationDb.getReadable("region", adjacency.region1, "displayName");
        const region2Name = localizationDb.getReadable("region", adjacency.region2, "displayName");
        const template = adjacency.friendlyOnly ? language.uiTexts.adjacencyFriendly : language.uiTexts.adjacencyGeneral;
        return formatTemplate(template, { region1: region1Name, region2: region2Name });
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

    const getDriveFamilyKey = (drive: ModuleTemplate) => {
        const baseName = drive.dataName.replace(/x\d+$/, "");
        const projectKey = drive.requiredProjectName ?? "unknown";
        return `${projectKey}:${baseName}`;
    };

    const groupDrivesByFamily = (modules: DataModule[]) => {
        const groups = new Map<string, DataModule[]>();

        modules.forEach(module => {
            const familyKey = getDriveFamilyKey(module.data);
            const existing = groups.get(familyKey);
            if (existing) {
                existing.push(module);
            } else {
                groups.set(familyKey, [module]);
            }
        });

        return Array.from(groups.entries()).map(([key, groupModules]) => ({
            key,
            modules: [...groupModules].sort((a, b) => (a.data.thrusters ?? 0) - (b.data.thrusters ?? 0)),
        }));
    };

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

    function getFactionIconPath(faction: string): string {
        const iconPath = `./icons/FAC_${faction}_128.png`;
        return iconPath;
    }

    function getFactionIcon(faction: string) {
        const iconPath = getFactionIconPath(faction);
        return <img className="faction-icon" src={iconPath} alt={`${name} icon`} />;
    }

    function formatTemplate(template: string, values: Record<string, string>) {
        return Object.entries(values).reduce((acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), value), template);
    }

    function renderFactionWithIcon(faction: string | undefined) {
        if (!faction) {
            return null;
        }
        const name = localizationDb.getReadable("faction", faction, "displayName") ?? faction;
        return (
            <span className="faction-label">
                {getFactionIcon(faction)}
                <span className="faction-name">{name}</span>
            </span>
        );
    }

    const BUILD_MATERIAL_ICONS = {
        antimatter: { label: "Antimatter", icon: "ICO_antimatter" },
        water: { label: "Water", icon: "ICO_water" },
        volatiles: { label: "Volatiles", icon: "ICO_volatiles" },
        metals: { label: "Metals", icon: "ICO_metal" },
        nobleMetals: { label: "Noble Metals", icon: "ICO_metal_noble" },
        fissiles: { label: "Fissiles", icon: "ICO_fissile" },
        exotics: { label: "Exotics", icon: "ICO_exotics" },
    } as const;

    type BuildMaterialKey = keyof typeof BUILD_MATERIAL_ICONS;

    type ModuleCostItem = {
        key: BuildMaterialKey;
        amount: number;
        label: string;
        icon: string;
    };

    function calculateHabModuleCost(module: ModuleTemplate): ModuleCostItem[] {
        if (module.baseMass_tons == null || module.weightedBuildMaterials == null) {
            return [];
        }

        const baseMass = module.baseMass_tons;

        return Object.entries(module.weightedBuildMaterials)
            .flatMap(([key, weight]) => {
                if (!weight || weight <= 0) {
                    return [] as ModuleCostItem[];
                }

                const material = BUILD_MATERIAL_ICONS[key as BuildMaterialKey];
                if (!material) {
                    return [] as ModuleCostItem[];
                }

                const amount = (baseMass * weight) / 10;

                return [{
                    key: key as BuildMaterialKey,
                    amount,
                    label: material.label,
                    icon: material.icon,
                }];
            });
    }

    function calculateDriveFuelCost(module: ModuleTemplate): ModuleCostItem[] {
        if (!module.perTankPropellantMaterials) {
            return [];
        }

        return Object.entries(module.perTankPropellantMaterials)
            .flatMap(([key, amount]) => {
                if (!amount || amount <= 0) {
                    return [] as ModuleCostItem[];
                }

                const material = BUILD_MATERIAL_ICONS[key as BuildMaterialKey];
                if (!material) {
                    return [] as ModuleCostItem[];
                }

                return [{
                    key: key as BuildMaterialKey,
                    amount: amount * 10,
                    label: material.label,
                    icon: material.icon,
                }];
            });
    }

    function calculateWeightedBuildMaterialsRaw(module: ModuleTemplate): ModuleCostItem[] {
        if (!module.weightedBuildMaterials) {
            return [];
        }

        return Object.entries(module.weightedBuildMaterials)
            .flatMap(([key, amount]) => {
                if (!amount || amount <= 0) {
                    return [] as ModuleCostItem[];
                }

                const material = BUILD_MATERIAL_ICONS[key as BuildMaterialKey];
                if (!material) {
                    return [] as ModuleCostItem[];
                }

                return [{
                    key: key as BuildMaterialKey,
                    amount,
                    label: material.label,
                    icon: material.icon,
                }];
            });
    }

    const renderCostItems = (cost: ModuleCostItem[], label?: string) => {
        if (cost.length === 0) {
            return null;
        }

        return (
            <div className="module-cost">
                {label && <div className="module-cost-label">{label}</div>}
                <div className="module-cost-items">
                    {cost.map(costItem => (
                        <div
                            className="module-cost-item"
                            key={`${label ?? "cost"}-${costItem.key}-${costItem.amount}`}
                            title={costItem.label}
                        >
                            <img className="module-cost-icon" src={`./icons/${costItem.icon}.png`} alt={`${costItem.label} icon`} />
                            <span className="module-cost-value">{costItem.amount.toLocaleString(locale, { maximumFractionDigits: 10, minimumFractionDigits: 0 })}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const buildModuleDisplay = (dataModule: DataModule, options?: { showDriveFuelCost?: boolean }) => {
        const icon = getIcon(dataModule.data);
        const buildCost = dataModule.type === "habmodule" ? calculateHabModuleCost(dataModule.data) : [];
        const fuelCost = options?.showDriveFuelCost && dataModule.type === "drive" ? calculateDriveFuelCost(dataModule.data) : [];
        const rawDescription = localizationDb.getLocalizationString(dataModule.type, dataModule.data.dataName, "description");
        const moduleDescription = formatModuleDescription(rawDescription, dataModule.data.specialModuleValue);
        return (
            <div className="module-display">
                {icon && <img className="module-icon" src={`./icons/${icon}.png`} alt={`${dataModule.data.dataName} icon`} />}
                {renderCostItems(fuelCost, language.uiTexts.fuelPerTank)}
                {moduleDescription && <p className="module-description">{moduleDescription}</p>}
                {renderCostItems(buildCost)}
                <pre>{JSON.stringify(dataModule.data, null, 2)}</pre>
            </div>
        );
    };

    const normalizeValue = (value: unknown): unknown => {
        if (Array.isArray(value)) {
            return value.map(normalizeValue);
        }
        if (value && typeof value === "object") {
            return Object.keys(value as Record<string, unknown>)
                .sort()
                .reduce<Record<string, unknown>>((acc, key) => {
                    acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
                    return acc;
                }, {});
        }
        return value;
    };

    const renderDriveGroup = (driveModules: DataModule[]) => {
        if (driveModules.length === 0) {
            return null;
        }

        const allowedDiffKeys = new Set([
            "dataName",
            "friendlyName",
            "notes",
            "thrusters",
            "thrust_N",
            "thrustRating_GW",
            "req power",
            "iconResource",
            "baseIconResource",
            "stationIconResource",
            "flatMass_tons",
        ]);

        const drives = driveModules.map(mod => mod.data);
        const referenceDrive = drives[0];

        const fuelDrive = drives.find(d => d.thrusters === 1) ?? referenceDrive;
        const fuelCost = calculateDriveFuelCost(fuelDrive);
        const weightedBuildMaterialsCost = calculateWeightedBuildMaterialsRaw(referenceDrive);
        const sharedDriveIcon = getIcon(referenceDrive);

        const commonEntries = Object.entries(referenceDrive)
            .filter(([key, value]) => {
                if (allowedDiffKeys.has(key) || key === "perTankPropellantMaterials" || key === "weightedBuildMaterials") {
                    return false;
                }

                const normalizedReference = normalizeValue(value);
                return drives.every(drive => JSON.stringify(normalizeValue((drive as unknown as Record<string, unknown>)[key])) === JSON.stringify(normalizedReference));
            })
            .map(([key, value]) => [key, value] as const);

        const allVaryFields: { key: keyof ModuleTemplate; label: string }[] = [
            { key: "friendlyName", label: language.uiTexts.driveColumnLabel },
            { key: "thrust_N", label: language.uiTexts.thrustNLabel },
            { key: "thrustRating_GW", label: language.uiTexts.thrustRatingGWLabel },
            { key: "req power", label: language.uiTexts.requiredPowerLabel },
            { key: "flatMass_tons", label: language.uiTexts.flatMassLabel },
        ];

        // Filter out flatMass_tons if all drives have zero or undefined values
        const varyFields = allVaryFields.filter(field => {
            if (field.key === "flatMass_tons") {
                return drives.some(d => d.flatMass_tons && d.flatMass_tons !== 0);
            }
            return true;
        });

        const getDriveLabel = (drive: ModuleTemplate) => localizationDb.getLocalizationString("drive", drive.dataName, "displayName") ?? drive.friendlyName ?? drive.dataName;
        const getDriveIcon = (drive: ModuleTemplate) => getIcon(drive);
        const driveDescription = localizationDb.getLocalizationString("drive", referenceDrive.dataName, "description");

        // Generate grid template: first column (Drive name) gets most space, others share remaining space equally
        const numOtherCols = varyFields.length - 1;
        const gridTemplateColumns = `minmax(180px, 3fr) repeat(${numOtherCols}, 1fr)`;

        return (
            <div className="module-display">
                {sharedDriveIcon && <img className="module-icon" src={`./icons/${sharedDriveIcon}.png`} alt={`${referenceDrive.dataName} icon`} />}
                {driveDescription && <p className="module-description">{driveDescription}</p>}

                <table className="module-drive-table">
                    <thead>
                        <tr>
                            <th colSpan={2}>{language.uiTexts.driveSpecsShared}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th>{language.uiTexts.fuelPerTank}</th>
                            <td>{renderCostItems(fuelCost)}</td>
                        </tr>
                        <tr>
                            <th>{language.uiTexts.weightedBuildMaterialsLabel}</th>
                            <td>{renderCostItems(weightedBuildMaterialsCost)}</td>
                        </tr>
                        {commonEntries.map(([key, value]) => (
                            <tr key={`common-${key}`}>
                                <th>{key}</th>
                                <td>{typeof value === "object" ? JSON.stringify(value) : String(value)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="module-drive-matrix-container">
                    <div className="module-drive-matrix-header module-drive-matrix-grid" style={{ gridTemplateColumns, backgroundColor: theme.palette.mode === 'dark' ? '#1a1a2e' : '#c5d8e8' }}>
                        {varyFields.map(field => (
                            <div key={`head-${field.key}`} className="module-drive-matrix-cell">
                                {field.label}
                            </div>
                        ))}
                    </div>

                    {drives.map(drive => (
                        <Accordion key={`drive-acc-${drive.dataName}`} disableGutters>
                            <AccordionSummary
                                sx={{
                                    minHeight: 'auto',
                                    padding: 0,
                                    '& .MuiAccordionSummary-content': { margin: 0, width: '100%' },
                                }}
                            >
                                <div className="module-drive-matrix-grid" style={{ gridTemplateColumns }}>
                                    {varyFields.map(field => {
                                        if (field.key === "friendlyName") {
                                            const icon = getDriveIcon(drive);
                                            return (
                                                <div key={`cell-${drive.dataName}-${field.key}`} className="module-drive-matrix-cell">
                                                    <span className="module-drive-name">
                                                        {icon && <img className="module-drive-icon" src={`./icons/${icon}.png`} alt={`${drive.dataName} icon`} />}
                                                        {getDriveLabel(drive)}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        const value = (drive as unknown as Record<string, unknown>)[field.key as string];
                                        return (
                                            <div key={`cell-${drive.dataName}-${field.key}`} className="module-drive-matrix-cell">
                                                {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
                                            </div>
                                        );
                                    })}
                                </div>
                            </AccordionSummary>
                            <AccordionDetails>
                                <pre>{JSON.stringify(drive, null, 2)}</pre>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </div>
            </div>
        );
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
        const factions = tech.factionPrereq?.map(faction => getFactionIcon(faction)!) ?? [];
        const projectTitle = tech.isProject ? language.uiTexts.factionProjectTitle : language.uiTexts.globalResearchTitle;
        return (
            <Button
                key={`${tech.displayName}`}
                onClick={() => onNavigateToNode(tech)}
                variant="contained"
                className={`prereqButton${tech.researchDone ? " researchDone" : ""}`}
                size="small"
                title={projectTitle}
                aria-label={tech ? `${tech.displayName} ${projectTitle}` : ""}
                color={tech.isProject ? canFailToRoll ? "warning" : "success" : "primary"}
            >
                {factions} {tech.displayName} {canFailToRoll ? `${tech.factionAvailableChance}%` : ""}
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

            const orText = <b key={"or"} className="prereqButton">{language.uiTexts.orLabel}</b>;
            const breakElement = <br key={"br"} />;
            const andText = <b key={"and"} className="prereqButton">{language.uiTexts.andLabel}</b>;

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

        const driveModules = modules.filter(m => m.type === "drive");
        const nonDriveModules = modules.filter(m => m.type !== "drive");

        const moduleElements: React.ReactElement[] = [];

        if (driveModules.length > 0) {
            const groupedDrives = groupDrivesByFamily(driveModules);
            moduleElements.push(
                <div key="drive-group" className="module-wrapper">
                    <div className="module-name">{language.uiTexts.drivesHeading}</div>
                    {groupedDrives.map(group => (
                        <React.Fragment key={group.key}>
                            {renderDriveGroup(group.modules)}
                        </React.Fragment>
                    ))}
                </div>
            );
        }

        nonDriveModules.forEach(module => {
            const displayName = localizationDb.getLocalizationString(module.type, module.data.dataName, "displayName");
            moduleElements.push(
                <div key={`mod-${module.data.dataName}`} className="module-wrapper">
                    <div className="module-name">{displayName ? displayName : module.data.dataName}</div>
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
                <h2>{node.displayName} {node.isProject ? <img src={projectIconSrc} alt="faction project" style={{ width: "24px", height: "24px" }} /> : null}</h2>

                {/* Cost information */}
                <Accordion disableGutters>
                    <Tooltip 
                        title={language.uiTexts.costBreakdownTooltip} 
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
                                        title={copied ? language.uiTexts.copiedLabel : language.uiTexts.copyToClipboard} 
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
                                                {"\t\t\t"}(<img src={projectIconSrc} alt={key} style={{ width: "16px", height: "16px" }} />
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
                    <h5>
                        {language.uiTexts.factionAlways} {renderFactionWithIcon(node.factionAlways)}
                    </h5>
                )}

                {node.isProject && node.factionPrereq && node.factionPrereq.filter(faction => faction !== "").length > 0 && (
                    <h5>
                        {language.uiTexts.factionPrereq}:{" "}
                        {node.factionPrereq
                            .filter(faction => faction !== "")
                            .map((faction, index) => (
                                <span key={`faction-${faction}`}>
                                    {index > 0 ? " " : null}
                                    {renderFactionWithIcon(faction)}
                                </span>
                            ))}
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