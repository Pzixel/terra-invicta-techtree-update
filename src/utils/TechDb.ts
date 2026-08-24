import { TechTemplate } from '../types';
import { prerequisiteSlots } from '../data/scenarioCompiler';

export class TechDb {
    private tree: TechTemplate[];
    private techsByDataName: Record<string, TechTemplate>;
    private techsByDisplayName: Record<string, TechTemplate>;
    private blockingTechs: Record<string, TechTemplate[]>;
    private referenceAliases: Record<string, string>;

    constructor(
        tree: TechTemplate[],
        referenceAliases: Record<string, string> = {},
    ) {
        this.tree = tree;
        this.referenceAliases = referenceAliases;
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
            prerequisiteSlots(tech).flat().forEach(prereq => {
                const resolvedPrereq = this.referenceAliases[prereq] ?? prereq;
                if (!acc[resolvedPrereq]) {
                    acc[resolvedPrereq] = [];
                }
                acc[resolvedPrereq].push(tech);
            });
            return acc;
        }, {});
    }

    getTechByDataName(dataName: string | null | undefined) {
        if (!dataName) {
            return null;
        }
        return this.techsByDataName[this.referenceAliases[dataName] ?? dataName];
    }
    getTechByDisplayName(displayName: string | null | undefined) {
        if (!displayName) {
            return null;
        }
        return this.techsByDisplayName[displayName];
    }
    getAllTechs() {
        return this.tree;
    }
    getBlockingTechs(tech: TechTemplate | null | undefined) {
        if (!tech) {
            return [];
        }
        return this.blockingTechs[tech.dataName] ?? [];
    }
}
