import { TechTemplate } from '../types';

export class TechDb {
    private tree: TechTemplate[];
    private techsByDataName: Record<string, TechTemplate>;
    private techsByDisplayName: Record<string, TechTemplate>;
    private blockingTechs: Record<string, TechTemplate[]>;
    private isTechOnly: boolean;

    constructor(
        tree: TechTemplate[],
        isTechOnly: boolean = false
    ) {
        this.isTechOnly = isTechOnly;
        this.tree = tree;
        this.techsByDataName = tree.reduce<Record<string, TechTemplate>>((acc, tech) => {
            acc[tech.dataName] = tech;
            return acc;
        }, {});
        this.techsByDisplayName = tree.reduce<Record<string, TechTemplate>>((acc, tech) => {
            if (acc[tech.displayName]) {
                throw new Error(`Duplicate displayName found: ${tech.displayName}`);
            }
            acc[tech.displayName] = tech;
            return acc;
        }, {});
        this.blockingTechs = tree.reduce<Record<string, TechTemplate[]>>((acc, tech) => {
            (tech.prereqs ?? []).concat(tech.altPrereq0 ?? []).forEach(prereq => {
                if (!acc[prereq]) {
                    acc[prereq] = [];
                }
                acc[prereq].push(tech);
            });
            return acc;
        }, {});
    }

    getTechByDataName(dataName: string | null | undefined) {
        if (!dataName) {
            return null;
        }
        const tech = this.techsByDataName[dataName];
        if (tech && this.isTechOnly && tech.isProject) {
            return null;
        }
        return tech;
    }
    
    getTechByDataNameIncludingProjects(dataName: string | null | undefined) {
        if (!dataName) {
            return null;
        }
        return this.techsByDataName[dataName];
    }
    
    getTechByDisplayName(displayName: string | null | undefined) {
        if (!displayName) {
            return null;
        }
        const tech = this.techsByDisplayName[displayName];
        if (tech && this.isTechOnly && tech.isProject) {
            return null;
        }
        return tech;
    }
    
    getTechByDisplayNameIncludingProjects(displayName: string | null | undefined) {
        if (!displayName) {
            return null;
        }
        return this.techsByDisplayName[displayName];
    }
    getAllTechs() {
        if (this.isTechOnly) {
            return this.tree.filter(tech => !tech.isProject);
        }
        return this.tree;
    }
    
    getAllTechsIncludingProjects() {
        return this.tree;
    }
    
    getIsTechOnly() {
        return this.isTechOnly;
    }
    
    setIsTechOnly(isTechOnly: boolean) {
        this.isTechOnly = isTechOnly;
    }
    
    getBlockingTechs(tech: TechTemplate | null | undefined) {
        if (!tech) {
            return [];
        }
        return this.blockingTechs[tech.dataName] ?? [];
    }
}
