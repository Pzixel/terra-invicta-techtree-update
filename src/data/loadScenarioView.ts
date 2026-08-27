import type { Language } from '../language';
import JSON5 from 'json5';
import { OrderedScenarios, Scenarios, type ScenarioCode } from '../scenario';
import {
    getTemplateData,
    LocalizationDb,
    TemplateTypes,
    type LocalizationContentLayer,
    type TemplateData,
    type TemplateType,
    type TechTemplate,
} from '../types';
import type { AppStaticData } from '../types/props';
import { TechDb } from '../utils/TechDb';
import type { GameVersionCode } from '../version';
import {
    compileScenarioData,
    validatePrerequisiteReferences,
    type CompiledAliases,
    type TemplateCollections,
} from './scenarioCompiler';

export type ScenarioViewKey = {
    version: GameVersionCode;
    scenario: ScenarioCode;
    language: string;
};

export type ScenarioSource = {
    baseCollections: TemplateCollections;
    overlayCollections: TemplateCollections;
    localizationLayers: LocalizationContentLayer[];
};

export type LoadedScenarioView = {
    key: ScenarioViewKey;
    appStaticData: AppStaticData;
    techDb: TechDb;
    aliases: CompiledAliases;
    scenarioLabels: Record<ScenarioCode, string>;
    scenarioName: string;
};

export type ScenarioBundle = {
    schemaVersion: 1;
    key: ScenarioViewKey;
    snapshotId: string;
    effectiveCounts: { technologies: number; projects: number };
    collections: TemplateCollections;
    aliases: CompiledAliases;
    localizationLayers: LocalizationContentLayer[];
    scenarioLocalizationPostfix: string;
};

export type ReadScenarioText = (relativePath: string) => Promise<string>;

export const AppTemplateFiles = Object.freeze({
    ...TemplateTypes,
    bilateral: 'TIBilateralTemplate',
    starttime: 'TIStartTimeTemplate',
});
type AppTemplateCollection = keyof typeof AppTemplateFiles;

export const ScenarioOverlayCollections: Record<Exclude<ScenarioCode, 'standard'>, readonly AppTemplateCollection[]> = Object.freeze({
    '2003': Object.freeze([
        'bilateral', 'effect', 'habmodule', 'meta', 'nation', 'objective', 'org',
        'project', 'region', 'starttime', 'tech', 'trait',
    ] satisfies AppTemplateCollection[]),
    'broken-earth': Object.freeze([
        'bilateral', 'effect', 'meta', 'nation', 'org', 'project', 'region', 'starttime', 'tech',
    ] satisfies AppTemplateCollection[]),
});

type LocalizationLayer = { directory: string; postfix: string; collections: readonly AppTemplateCollection[] };
export const ScenarioLocalizationLayers: Record<Exclude<ScenarioCode, 'standard'>, readonly LocalizationLayer[]> = Object.freeze({
    '2003': Object.freeze([{
        directory: '2003 Scenario',
        postfix: '.2003',
        collections: Object.freeze(
            ['effect', 'habmodule', 'nation', 'objective', 'project', 'tech', 'trait'] satisfies AppTemplateCollection[]
        ),
    }]),
    'broken-earth': Object.freeze([
        {
            directory: '2003 Scenario',
            postfix: '.2003',
            collections: Object.freeze(['effect'] satisfies AppTemplateCollection[]),
        },
        {
            directory: 'Broken Earth Scenario',
            postfix: '.BrokenEarth',
            collections: Object.freeze(
                ['effect', 'nation', 'org', 'project', 'region', 'tech'] satisfies AppTemplateCollection[]
            ),
        },
    ]),
});

const readJson = async (readText: ReadScenarioText, relativePath: string): Promise<unknown[]> => {
    const value: unknown = JSON5.parse(await readText(relativePath));
    if (!Array.isArray(value)) throw new Error(`${relativePath} must contain a JSON array`);
    return value;
};

type UnknownRecord = Readonly<Record<string, unknown>>;
type DataNameRecord = UnknownRecord & { dataName: string };

const isUnknownRecord = (value: unknown): value is UnknownRecord =>
    !!value && typeof value === 'object';

const hasDataName = (value: unknown, dataName: string): value is DataNameRecord =>
    isUnknownRecord(value) && value.dataName === dataName;

const findByDataName = (
    entries: readonly unknown[] | undefined,
    dataName: string,
): DataNameRecord | undefined => entries?.find(
    (entry): entry is DataNameRecord => hasDataName(entry, dataName)
);

const isNonEmptyStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.length > 0 &&
    !value.some((entry: unknown) => typeof entry !== 'string' || !entry);

const isTemplateType = (value: string): value is TemplateType =>
    Object.prototype.hasOwnProperty.call(TemplateTypes, value);

const scenarioTags = (
    baseCollections: TemplateCollections,
    overlayCollections: TemplateCollections,
    scenario: ScenarioCode,
): string[] => {
    const meta = scenario === 'standard' ? baseCollections.meta : overlayCollections.meta;
    const dataName = Scenarios[scenario].dataName;
    const record = findByDataName(meta, dataName);
    const tags = record?.scenarioTags;
    if (!isNonEmptyStringArray(tags)) {
        throw new Error(`${dataName}.scenarioTags must be a non-empty string array`);
    }
    return tags;
};

const scenarioLocalizationPostfix = (
    overlayCollections: TemplateCollections,
    scenario: ScenarioCode,
): string => {
    if (scenario === 'standard') return '';
    const dataName = Scenarios[scenario].dataName;
    const record = findByDataName(overlayCollections.meta, dataName);
    const postfix = record?.scenarioLocalizationPostfix;
    if (typeof postfix !== 'string' || !/^\.[A-Za-z0-9_-]+$/.test(postfix)) {
        throw new Error(`${dataName}.scenarioLocalizationPostfix is missing or invalid`);
    }
    return postfix;
};

const combineReferenceAliases = (aliases: CompiledAliases): Record<string, string> => {
    const combined: Record<string, string> = {};
    for (const collection of ['tech', 'project']) {
        for (const [canonical, scenarioName] of Object.entries(aliases.reference[collection] ?? {})) {
            const existing = combined[canonical];
            if (existing && existing !== scenarioName) {
                throw new Error(`Ambiguous technology/project referenceAlias ${canonical}`);
            }
            combined[canonical] = scenarioName;
        }
    }
    return combined;
};

export function compileScenarioBundle(
    key: ScenarioViewKey,
    source: ScenarioSource,
    snapshotId = 'unverified',
): ScenarioBundle {
    const recordCollections = Object.keys(AppTemplateFiles).filter((collection) => collection !== 'bilateral');
    const compiled = compileScenarioData(source.baseCollections, source.overlayCollections, {
        scenario: key.scenario,
        activeScenarioTags: scenarioTags(source.baseCollections, source.overlayCollections, key.scenario),
        recordCollections,
        annotatedCollections: ['tech', 'project'],
    });
    validatePrerequisiteReferences(compiled.collections);
    return {
        schemaVersion: 1,
        key,
        snapshotId,
        effectiveCounts: {
            technologies: compiled.collections.tech?.length ?? 0,
            projects: compiled.collections.project?.length ?? 0,
        },
        collections: compiled.collections,
        aliases: compiled.aliases,
        localizationLayers: source.localizationLayers,
        scenarioLocalizationPostfix: scenarioLocalizationPostfix(source.overlayCollections, key.scenario),
    };
}

export function hydrateScenarioBundle(bundle: ScenarioBundle, language: Language): LoadedScenarioView {
    if (bundle.schemaVersion !== 1) throw new Error(`Unsupported scenario bundle schema ${bundle.schemaVersion}`);
    const { key } = bundle;
    const localizationDb = new LocalizationDb(bundle.localizationLayers, language.uiTexts, {
        ...bundle.aliases,
        scenarioLocalizationPostfix: bundle.scenarioLocalizationPostfix,
    });
    for (const [collection, aliases] of Object.entries(bundle.aliases.localization)) {
        if (!isTemplateType(collection)) continue;
        for (const dataName of Object.keys(aliases)) {
            if (!localizationDb.hasAnyLocalization(collection, dataName)) {
                throw new Error(`Missing localizationAlias target for ${collection}.${dataName} (${key.language})`);
            }
        }
    }
    const templateData: TemplateData = getTemplateData(Object.entries(bundle.collections));
    if (templateData.project) {
        templateData.project = templateData.project.filter(
            (project) => project.dataName !== 'Project_AlienMasterProject' &&
                project.dataName !== 'Project_AlienAdvancedMasterProject'
        );
    }

    const techs = templateData.tech ?? [];
    const projects = templateData.project ?? [];
    projects.forEach((project) => { project.isProject = true; });
    const displayNameGroups: Record<string, TechTemplate[]> = {};
    const techTree = techs.concat(projects);
    techTree.forEach((tech, index) => {
        const type = tech.isProject ? 'project' : 'tech';
        const displayName = localizationDb.tryGetReadable(type, tech.dataName, 'displayName');
        if (!displayName) {
            throw new Error(`Missing ${type}.displayName.${tech.dataName} localization (${key.language})`);
        }
        tech.displayName = displayName;
        tech.id = index;
        (displayNameGroups[tech.displayName] ??= []).push(tech);
    });
    for (const [displayName, group] of Object.entries(displayNameGroups)) {
        if (group.length <= 1) continue;
        const suffixCounts: Record<string, number> = {};
        for (const tech of group) {
            const suffix = tech.friendlyName || tech.dataName;
            suffixCounts[suffix] = (suffixCounts[suffix] ?? 0) + 1;
        }
        for (const tech of group) {
            const preferredSuffix = tech.friendlyName || tech.dataName;
            const uniqueSuffix = suffixCounts[preferredSuffix] > 1 ? tech.dataName : preferredSuffix;
            tech.displayName = `${displayName} (${uniqueSuffix})`;
        }
    }

    for (const record of techTree) {
        const type = record.isProject ? 'project' : 'tech';
        if (!localizationDb.tryGetReadable(type, record.dataName, 'summary')) {
            throw new Error(`Missing ${type}.summary.${record.dataName} localization (${key.language})`);
        }
        for (const effect of record.effects ?? []) {
            if (effect && !localizationDb.tryGetReadable('effect', effect, 'description')) {
                throw new Error(`Missing effect.description.${effect} localization (${key.language})`);
            }
        }
    }

    const effects = (templateData.effects ?? []).concat(templateData.effect ?? []);
    const appStaticData: AppStaticData = { templateData, effects, techs, projects, localizationDb };
    const scenarioLabels = {
        standard: '',
        '2003': '',
        'broken-earth': '',
    } satisfies Record<ScenarioCode, string>;
    for (const scenario of OrderedScenarios) {
        scenarioLabels[scenario.code] =
            localizationDb.tryGetReadable('meta', scenario.dataName, 'displayName') ?? scenario.fallbackName;
    }
    return {
        key,
        appStaticData,
        techDb: new TechDb(techTree, combineReferenceAliases(bundle.aliases)),
        aliases: bundle.aliases,
        scenarioLabels,
        scenarioName: scenarioLabels[key.scenario],
    };
}

export function prepareScenarioView(
    key: ScenarioViewKey,
    language: Language,
    source: ScenarioSource,
): LoadedScenarioView {
    return hydrateScenarioBundle(compileScenarioBundle(key, source), language);
}

export async function loadScenarioBundle(
    key: ScenarioViewKey,
    readText: ReadScenarioText,
    snapshotId = 'unverified',
): Promise<ScenarioBundle> {
    const baseRoot = `gamefiles/${key.version}`;
    const baseEntries = await Promise.all(Object.entries(AppTemplateFiles).map(async ([collection, filename]) => [
        collection,
        await readJson(readText, `${baseRoot}/Templates/${filename}.json`),
    ] as const));
    const baseCollections = Object.fromEntries(baseEntries);

    const overlayCollections: TemplateCollections = {};
    if (key.scenario !== 'standard') {
        const overlayRoot = `gamefiles/dark-skies/${key.scenario}`;
        await Promise.all(ScenarioOverlayCollections[key.scenario].map(async (collection) => {
            const filename = AppTemplateFiles[collection];
            overlayCollections[collection] = await readJson(readText, `${overlayRoot}/Templates/${filename}.json`);
        }));
    }

    const [baseLocalization, sharedScenarioLocalization] = await Promise.all([
        Promise.all(Object.values(TemplateTypes).map((filename) =>
            readText(`${baseRoot}/Localization/${key.language}/${filename}.${key.language}`)
        )),
        readText(
            `gamefiles/dark-skies/localization/${key.language}/2003 Scenario/` +
            `${AppTemplateFiles.meta}.${key.language}`
        ),
    ]);
    const overlayLocalization = key.scenario === 'standard'
        ? []
        : await Promise.all(ScenarioLocalizationLayers[key.scenario].map(async (layer) => ({
            postfix: layer.postfix,
            files: await Promise.all(layer.collections.map(async (collection) => {
                const filename = AppTemplateFiles[collection];
                return readText(
                    `gamefiles/dark-skies/localization/${key.language}/${layer.directory}/${filename}.${key.language}`
                );
            })),
        })));

    return compileScenarioBundle(key, {
        baseCollections,
        overlayCollections,
        localizationLayers: [
            { files: baseLocalization, postfix: '' },
            { files: [sharedScenarioLocalization], postfix: '' },
            ...overlayLocalization,
        ],
    }, snapshotId);
}

export async function loadScenarioView(
    key: ScenarioViewKey,
    language: Language,
    readText: ReadScenarioText,
): Promise<LoadedScenarioView> {
    return hydrateScenarioBundle(await loadScenarioBundle(key, readText), language);
}
