import type { ScenarioCode } from '../scenario';

export type JsonRecord = Record<string, unknown> & {
    dataName: string;
    disable?: boolean;
    scenarioTags?: string[];
    referenceAlias?: string | null;
    scenarioAlias?: string | null;
    localizationAlias?: string | null;
    prereqs?: string[];
};

export type TemplateCollections = Record<string, unknown[]>;

export interface ScenarioCompileOptions {
    scenario: ScenarioCode;
    activeScenarioTags: string[];
    recordCollections: string[];
    annotatedCollections?: string[];
}

export interface CompiledAliases {
    reference: Record<string, Record<string, string>>;
    localization: Record<string, Record<string, string>>;
    scenario: Record<string, Record<string, string>>;
}

export interface CompiledScenarioData {
    collections: TemplateCollections;
    aliases: CompiledAliases;
}

const DEFAULT_ANNOTATED_COLLECTIONS = ['tech', 'project'];
const ALIAS_FIELDS = ['referenceAlias', 'localizationAlias', 'scenarioAlias'] as const;
type AliasField = typeof ALIAS_FIELDS[number];

function cloneJson<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((entry) => cloneJson(entry)) as T;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, cloneJson(entry)])
        ) as T;
    }
    return value;
}

function isJsonRecord(value: unknown): value is JsonRecord {
    return !!value && typeof value === 'object' &&
        typeof (value as Record<string, unknown>).dataName === 'string' &&
        (value as Record<string, unknown>).dataName !== '';
}

function isScenarioEligible(record: JsonRecord, activeScenarioTags: Set<string>): boolean {
    const tags = record.scenarioTags;
    return !Array.isArray(tags) || tags.length === 0 || tags.some((tag) => activeScenarioTags.has(tag));
}

export function prerequisiteSlots(record: { prereqs?: string[] } & object): string[][] {
    const fields = record as Record<string, unknown>;
    const primary = Array.isArray(record.prereqs) ? record.prereqs : [];
    const alternateIndexes = Object.keys(fields)
        .map((key) => /^altPrereq(\d+)$/.exec(key)?.[1])
        .filter((index): index is string => index !== undefined)
        .map(Number);
    const outOfRange = alternateIndexes.find((index) => index >= primary.length);
    if (outOfRange !== undefined) {
        throw new Error(`altPrereq${outOfRange} is outside prereqs for ${String(fields.dataName ?? 'record')}`);
    }

    return Array.from({ length: primary.length }, (_, index) => {
        const alternate = fields[`altPrereq${index}`];
        const alternatives = Array.isArray(alternate) ? alternate : [alternate];
        return [primary[index], ...alternatives]
            .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
            .filter((entry, position, entries) => entries.indexOf(entry) === position);
    });
}

export function mergeRecordCollection(
    baseEntries: JsonRecord[],
    overlayEntries: JsonRecord[],
    options: ScenarioCompileOptions,
    annotate: boolean,
): JsonRecord[] {
    const activeScenarioTags = new Set(options.activeScenarioTags);
    for (const [label, entries] of [['base', baseEntries], ['overlay', overlayEntries]] as const) {
        const seen = new Set<string>();
        for (const entry of entries) {
            if (seen.has(entry.dataName)) {
                throw new Error(`Duplicate ${label} dataName: ${entry.dataName}`);
            }
            seen.add(entry.dataName);
        }
    }
    const baseByName = new Map(baseEntries.map((entry) => [entry.dataName, entry]));
    const enabledOverlayNames = new Set(
        overlayEntries.filter((entry) => !entry.disable).map((entry) => entry.dataName)
    );
    const merged = new Map<string, JsonRecord>();

    for (const entry of baseEntries) {
        if (!entry.disable) {
            merged.set(entry.dataName, cloneJson(entry));
        }
    }

    for (const entry of overlayEntries) {
        if (entry.disable) {
            merged.delete(entry.dataName);
            continue;
        }
        merged.set(entry.dataName, cloneJson(entry));
    }

    return [...merged.values()]
        .filter((entry) => isScenarioEligible(entry, activeScenarioTags))
        .map((entry) => {
            if (!annotate) {
                return entry;
            }
            const cameFromOverlay = enabledOverlayNames.has(entry.dataName);
            const compiled: JsonRecord = {
                ...entry,
                scenarioCode: options.scenario,
                dlcOnly: cameFromOverlay && !baseByName.has(entry.dataName),
                scenarioVariant: cameFromOverlay && baseByName.has(entry.dataName),
            };
            const slots = prerequisiteSlots(compiled);
            if (slots.length > 0) {
                compiled.prerequisiteSlots = slots;
            }
            return compiled;
        });
}

function resolveAliasTargets(
    entries: JsonRecord[],
    field: AliasField,
    allowExternalTarget?: (record: JsonRecord, target: string) => boolean,
): Record<string, string> {
    const byName = new Map(entries.map((entry) => [entry.dataName, entry]));
    const resolved: Record<string, string> = {};
    const resolving = new Set<string>();

    const resolve = (dataName: string): string => {
        if (resolved[dataName]) {
            return resolved[dataName];
        }
        if (resolving.has(dataName)) {
            throw new Error(`${field} cycle includes ${dataName}`);
        }
        const record = byName.get(dataName);
        if (!record) {
            throw new Error(`${field} target is missing: ${dataName}`);
        }
        const target = record[field];
        if (target == null || target === '') {
            resolved[dataName] = dataName;
            return dataName;
        }
        if (typeof target !== 'string') {
            throw new Error(`${field} must be a string on ${dataName}`);
        }
        if (target === dataName) {
            resolved[dataName] = dataName;
            return dataName;
        }
        if (!byName.has(target)) {
            if (allowExternalTarget?.(record, target)) {
                resolved[dataName] = target;
                return target;
            }
            throw new Error(`${field} target ${target} is missing for ${dataName}`);
        }
        resolving.add(dataName);
        const terminal = resolve(target);
        resolving.delete(dataName);
        resolved[dataName] = terminal;
        return terminal;
    };

    for (const entry of entries) {
        resolve(entry.dataName);
    }
    return resolved;
}

function compileAliases(
    collections: TemplateCollections,
    recordCollections: Set<string>,
    reverseReferenceCollections: Set<string>,
): CompiledAliases {
    const aliases: CompiledAliases = { reference: {}, localization: {}, scenario: {} };
    for (const collectionName of recordCollections) {
        const values = collections[collectionName] ?? [];
        const entries = values as JsonRecord[];
        const reverseReferences = reverseReferenceCollections.has(collectionName);
        const referenceTargets = resolveAliasTargets(
            entries,
            'referenceAlias',
            reverseReferences
                ? undefined
                : (record, target) => record.localizationAlias === target,
        );
        const reference: Record<string, string> = {};
        if (reverseReferences) {
            for (const entry of entries) {
                if (typeof entry.referenceAlias !== 'string' || entry.referenceAlias.length === 0 ||
                    entry.referenceAlias === entry.dataName) {
                    continue;
                }
                const canonicalName = referenceTargets[entry.dataName];
                if (reference[canonicalName] && reference[canonicalName] !== entry.dataName) {
                    throw new Error(`referenceAlias ${canonicalName} is ambiguous in ${collectionName}`);
                }
                reference[canonicalName] = entry.dataName;
            }
        }
        aliases.reference[collectionName] = reference;
        // A localizationAlias is a localization key stem. It may point at a
        // record, but first-party scenario data also points at stems with no
        // active template record; the localization layer validates those.
        const localizationTargets = resolveAliasTargets(entries, 'localizationAlias', () => true);
        aliases.localization[collectionName] = Object.fromEntries(
            entries
                .filter((entry) => typeof entry.localizationAlias === 'string' &&
                    entry.localizationAlias.length > 0 && entry.localizationAlias !== entry.dataName)
                .map((entry) => [entry.dataName, localizationTargets[entry.dataName]])
        );
        const scenarioTargets = resolveAliasTargets(entries, 'scenarioAlias');
        aliases.scenario[collectionName] = Object.fromEntries(
            entries
                .filter((entry) => typeof entry.scenarioAlias === 'string' &&
                    entry.scenarioAlias.length > 0 && entry.scenarioAlias !== entry.dataName)
                .map((entry) => [entry.dataName, scenarioTargets[entry.dataName]])
        );
    }
    return aliases;
}

export function compileScenarioData(
    baseCollections: TemplateCollections,
    overlayCollections: TemplateCollections,
    options: ScenarioCompileOptions,
): CompiledScenarioData {
    const collections: TemplateCollections = {};
    const annotated = new Set(options.annotatedCollections ?? DEFAULT_ANNOTATED_COLLECTIONS);
    const recordCollections = new Set(options.recordCollections);
    const collectionNames = new Set([...Object.keys(baseCollections), ...Object.keys(overlayCollections)]);

    for (const collectionName of collectionNames) {
        const base = baseCollections[collectionName] ?? [];
        const hasOverlay = Object.prototype.hasOwnProperty.call(overlayCollections, collectionName);
        const overlay = overlayCollections[collectionName] ?? [];
        if (recordCollections.has(collectionName)) {
            for (const [label, entries] of [['base', base], ['overlay', overlay]] as const) {
                const invalidIndex = entries.findIndex((entry) => !isJsonRecord(entry));
                if (invalidIndex >= 0) {
                    throw new Error(`${collectionName} ${label} record ${invalidIndex} has a missing or empty dataName`);
                }
            }
            collections[collectionName] = mergeRecordCollection(
                base as JsonRecord[],
                overlay as JsonRecord[],
                options,
                annotated.has(collectionName),
            );
        } else {
            collections[collectionName] = cloneJson(hasOverlay ? overlay : base);
        }
    }

    return { collections, aliases: compileAliases(collections, recordCollections, annotated) };
}

export function validatePrerequisiteReferences(collections: TemplateCollections): void {
    const nodes = [...(collections.tech ?? []), ...(collections.project ?? [])].filter(isJsonRecord);
    const names = new Set(nodes.map((node) => node.dataName));
    for (const node of nodes) {
        for (const slot of prerequisiteSlots(node)) {
            for (const prerequisite of slot) {
                if (!names.has(prerequisite)) {
                    throw new Error(`Missing prerequisite ${prerequisite} referenced by ${node.dataName}`);
                }
            }
        }
    }
}
