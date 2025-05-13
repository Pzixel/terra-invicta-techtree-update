import React, { useState, useRef, useEffect } from 'react';
import { Paper, Autocomplete, TextField, FormControlLabel, Switch } from '@mui/material';
import FlexSearch from 'flexsearch';
import { SearchboxProps } from './types/props';
import { TechDb } from './utils/TechDb';

type SearchEntry = {
    id: string;
    displayName: string;
    fullText: string;
};

type CachedProperties = ["displayName", "fullText"];

export function Searchbox({
    techDb,
    setShowProjects,
    onNavigateToNode,
    localizationDb,
    templateData,
    language
}: SearchboxProps) {
    const [results, setResults] = useState<string[]>([]);
    const [documentSearchIndex, setDocumentSearchIndex] = useState<FlexSearch.Document<SearchEntry, CachedProperties> | null>(null);
    const [fullText, setFullText] = useState(false);

    const updateDocumentSearchIndex = (techDb: TechDb) => {
        const documentSearchIndex = new FlexSearch.Document<SearchEntry, CachedProperties>({
            document: {
                index: ["displayName", "fullText"],
                store: ["displayName", "fullText"],
                "id": "id",
            },
            tokenize: "full"
        });

        techDb.getAllTechs().forEach((node) => {
            let searchData = {
                "id": node.id!.toString(),
                "displayName": node.displayName,
                "fullText": "",
            };

            let summaryText;
            if (node.isProject) {
                summaryText = localizationDb.getLocalizationString("project", node.dataName, "summary");
            } else {
                summaryText = localizationDb.getLocalizationString("tech", node.dataName, "summary");
            }

            let effectsText;
            if (node.effects && node.effects.filter(effect => effect !== "").length > 0) {
                effectsText = node.effects.filter(effect => effect !== "").map(effect => localizationDb.getLocalizationString("effect", effect, "description"));
            }

            const modulesText: string[] = [];
            if (node.isProject) {
                const modTypes = ["battery", "drive", "gun", "habmodule", "heatsink", "laserweapon", "magneticgun", "missile", "particleweapon", "plasmaweapon", "powerplant", "radiator", "shiparmor", "shiphull", "utilitymodule"] as const;
                modTypes.forEach(modType => {
                    templateData[modType].forEach(module => {
                        if (module.requiredProjectName === node.dataName) {
                            const description = localizationDb.getLocalizationString(modType, module.dataName, "description");
                            modulesText.push(`${localizationDb.getLocalizationString(modType, module.dataName, "displayName")}/${description}`);
                        }
                    });
                });
            }

            const claimsText = [];
            if (node.isProject) {
                let claimsList = templateData["bilateral"].filter(claim => claim.projectUnlockName == node.dataName && claim.relationType == "Claim");
                if (claimsList.length > 0) {
                    claimsText.push("gains a claim on");

                    claimsList.map(claim => {
                        claimsText.push(localizationDb.getLocalizationString("nation", claim.nation1, "displayName"));
                        claimsText.push(localizationDb.getLocalizationString("region", claim.region1, "displayName"));
                    });
                }
            }

            searchData.fullText = [node.displayName, summaryText, effectsText, modulesText, claimsText].join(" ");
            documentSearchIndex.add(searchData);
        });

        setDocumentSearchIndex(documentSearchIndex);
    };

    useEffect(() => {
        updateDocumentSearchIndex(techDb);
    }, [techDb]);

    const searchInputRef = useRef<HTMLInputElement | null>(null);

    const handleInputChange = (_: React.SyntheticEvent, value: string | null) => {
        if (!value || !documentSearchIndex) {
            setResults([]);
            return;
        }

        const isQuoted = value.startsWith('"') && value.endsWith('"');
        const query = isQuoted ? value.slice(1, -1) : value;

        // Search on all relevant fields
        const rawResults = documentSearchIndex.search(query, {
            pluck: (fullText ? "fullText" : "displayName"),
            enrich: true
        } as any); // It doesn't know about the pluck (despite https://github.com/nextapps-de/flexsearch/issues/436 )

        let searchResults;

        if (isQuoted) {
            const field = fullText ? "fullText" : "displayName";
            const regex = new RegExp(query, "i");
            // Simulate exact match
            searchResults = rawResults
                .filter(entry => (entry as any).doc[field].match(regex))
                .map(entry => (entry as any).doc.displayName);
        } else {
            searchResults = rawResults.map(entry => (entry as any).doc.displayName);
        }

        setResults(searchResults);
    };

    const navigateToTech = (value: string) => {
        const navigateToNode = techDb.getTechByDisplayName(value);

        if (navigateToNode) {
            onNavigateToNode(navigateToNode);
        }
    };

    const handleChange = (_: any, value: string | null) => {
        if (!value) return;

        navigateToTech(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key !== "Enter") {
            return;
        }
        navigateToTech((e.target as any).value);
    };

    // TODO: handle autocomplete on toggle
    const handleProjectsToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
        const showToggle = event.target.checked;
        setShowProjects(showToggle);
    };

    const handleClick = (e: any) => {
        navigateToTech((e.target as any).value);
    };

    return (
        <div>
            <Paper elevation={3} id="searchBox">
                <Autocomplete
                    options={results}
                    freeSolo
                    onInputChange={handleInputChange}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    filterOptions={x => x}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label={language.uiTexts.search}
                            inputRef={searchInputRef}
                            autoFocus
                            onClick={handleClick} />
                    )} />
                <FormControlLabel
                    id="showProjects"
                    label={language.uiTexts.showProjects}
                    control={<Switch
                        defaultChecked
                        onChange={handleProjectsToggle} />} />
                <FormControlLabel
                    id="fullText"
                    label={language.uiTexts.fullTextSearch}
                    control={<Switch
                        onChange={(e) => {
                            setFullText(e.target.checked);
                            searchInputRef.current?.focus();
                        } } />} />
            </Paper>
        </div>
    );
}
