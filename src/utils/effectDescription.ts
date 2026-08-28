import type { Language } from "../language";
import {
    TemplateTypes,
    type EffectTemplate,
    type LocalizationDb,
    type TemplateData,
    type TemplateType,
} from "../types";

export type ReadableEffectResources = {
    effects: readonly EffectTemplate[];
    language: Language;
    localizationDb: LocalizationDb;
    templateData: TemplateData;
};

function isTemplateType(value: string): value is TemplateType {
    return Object.hasOwn(TemplateTypes, value);
}

const templateTypes = Object.keys(TemplateTypes).filter(isTemplateType);
const PRIMARY_STATE_NAME = "our faction";
const INLINE_SPRITE_LABELS = {
    mission_control: "Mission Control",
    water: "Water",
    volatiles: "Volatiles",
    metal: "Metals",
    metal_noble: "Noble Metals",
    radioactive: "Fissiles",
} as const;

function truncateFloat(value: number, decimalPlaces: number): number {
    const floatValue = Math.fround(value);
    const factor = Math.fround(10 ** Math.min(Math.max(decimalPlaces, 0), 9));
    return Math.fround(Math.trunc(Math.fround(factor * floatValue)) / factor);
}

function decimalPlaces(value: number, cap = 7): number {
    const magnitude = Math.abs(value);
    const integerMagnitude = Math.abs(Math.trunc(value));

    if (magnitude === 0 || magnitude === integerMagnitude || magnitude >= 1000) return 0;
    if (magnitude >= 1) return Math.min(1, cap);
    if (magnitude > 0.1) return Math.min(2, cap);
    if (magnitude > 0.01) return Math.min(3, cap);
    if (magnitude > 0.001) return Math.min(4, cap);
    if (magnitude > 0.0001) return Math.min(5, cap);
    if (magnitude > 0.00001) return Math.min(6, cap);
    return Math.min(7, cap);
}

type NumberScale = {
    divisor: number;
    fallbackSuffix: string;
    localizationKey: string;
};

function getNumberScale(magnitude: number): NumberScale {
    if (magnitude >= 1_000_000_000_000) {
        return {
            divisor: 999_999_995_904,
            fallbackSuffix: "T",
            localizationKey: "UI.Global.Trillions",
        };
    }
    if (magnitude >= 1_000_000_000) {
        return { divisor: 1_000_000_000, fallbackSuffix: "B", localizationKey: "UI.Global.Billions" };
    }
    if (magnitude >= 1_000_000) {
        return { divisor: 1_000_000, fallbackSuffix: "M", localizationKey: "UI.Global.Millions" };
    }
    return { divisor: 1_000, fallbackSuffix: "K", localizationKey: "UI.Global.Thousands" };
}

function formatSmallNumber(value: number, locale: string): string {
    const truncated = truncateFloat(value, 7);
    const places = decimalPlaces(truncated);
    return truncated.toLocaleString(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: places,
    });
}

function formatBigOrSmallNumber(
    value: number,
    locale: string,
    localizationDb: LocalizationDb,
): string {
    const floatValue = Math.fround(value);
    const magnitude = Math.abs(floatValue);
    if (magnitude < 1000) {
        return formatSmallNumber(floatValue, locale);
    }

    const { divisor, fallbackSuffix, localizationKey } = getNumberScale(magnitude);
    const formatted = (floatValue / divisor).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    const localizedFormat = localizationDb.localizationStrings.get(localizationKey);
    return (localizedFormat ?? `{0}${fallbackSuffix}`).replace(/\{0\}/g, formatted);
}

function formatPercent(value: number, locale: string, signed = false): string {
    const floatValue = Math.fround(value);
    return floatValue.toLocaleString(locale, {
        style: "percent",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        signDisplay: signed && floatValue !== 0 ? "always" : "auto",
    });
}

function resolveTemplateName(templateName: string, localizationDb: LocalizationDb): string {
    for (const type of templateTypes) {
        const readable = localizationDb.tryGetReadable(type, templateName, "displayName");
        if (readable) return readable;
    }
    return templateName;
}

function resolveTraitGroupNames(
    grouping: number,
    templateData: TemplateData,
    localizationDb: LocalizationDb,
): string {
    return (templateData.trait ?? [])
        .filter((trait) => trait.grouping === grouping)
        .map((trait) => localizationDb.getReadable("trait", trait.dataName, "displayName"))
        .join(", ");
}

function replaceInlineSpriteLabels(description: string): string {
    return Object.entries(INLINE_SPRITE_LABELS).reduce(
        (text, [spriteName, label]) => text.replace(
            `<color=#FFFFFFFF><sprite name="${spriteName}"></color>`,
            label,
        ),
        description,
    );
}

/**
 * Mirrors the positional arguments passed to Loc.T by
 * TIEffectTemplate.description(state1, state2) in Steam build 24479907.
 */
function formatEffectDescription(
    description: string,
    effect: EffectTemplate,
    resources: ReadableEffectResources,
): string {
    const { language, localizationDb, templateData } = resources;
    const locale = language.locale;
    const value = Math.fround(effect.value ?? 0);
    const durationMonths = Math.fround(effect.duration_months ?? 0);
    const secondaryStateName = "";
    const strValue = effect.strValue ?? "";
    const traitNames = resolveTraitGroupNames(Math.trunc(value), templateData, localizationDb);
    const scaledValue = Math.min(2 * Math.abs(value), Math.max(-2 * Math.abs(value), 1));
    const attributeName = localizationDb.localizationStrings.get(`UI.Global.${strValue || "None"}`) ?? strValue;

    const resolveTemplateValue = (placeholder: string): string | undefined => {
        switch (placeholder) {
            case "{0}":
                return formatBigOrSmallNumber(value, locale, localizationDb);
            case "{1}":
            case "{9}":
            case "{10}":
            case "{14}":
            case "{21}":
                return PRIMARY_STATE_NAME;
            case "{2}":
            case "{11}":
            case "{12}":
            case "{15}":
            case "{22}":
                return secondaryStateName;
            case "{3}":
                return formatPercent(value, locale);
            case "{4}":
                return formatPercent(Math.fround(1 - value), locale);
            case "{5}":
            case "{6}":
            case "{17}":
            case "{26}":
                return "";
            case "{7}":
                return formatBigOrSmallNumber(durationMonths, locale, localizationDb);
            case "{8}":
                return formatPercent(Math.fround(value - 1), locale);
            case "{13}":
                return resolveTemplateName(strValue, localizationDb);
            case "{16}":
                return traitNames;
            case "{18}":
                return formatPercent(Math.fround(1 / value - 1), locale);
            case "{19}":
                return formatBigOrSmallNumber(Math.fround(-value), locale, localizationDb);
            case "{20}":
                return attributeName;
            case "{23}":
            case "{24}":
                return formatSmallNumber(scaledValue, locale);
            case "{25}":
                return formatPercent(Math.abs(value), locale);
            case "{27}":
                return formatPercent(Math.fround(1 - 1 / value), locale);
            case "{28}":
                return formatPercent(Math.fround(value - 1), locale, true);
            case "{29}":
                return formatPercent(value, locale, true);
            default:
                return undefined;
        }
    };

    return description.replace(/\{\d+\}/g, (placeholder) => {
        const result = resolveTemplateValue(placeholder);
        if (result) {
            return result;
        }
        console.error(`Failed to resolve template value for placeholder: ${placeholder}`);
        return placeholder;
    });
}

export function getReadableEffect(
    dataName: string,
    resources: ReadableEffectResources,
): string {
    const { effects, language, localizationDb } = resources;
    const description = localizationDb.getLocalizationString("effect", dataName, "description");

    if (!description) {
        return `effect.${dataName}.description`;
    }

    if (/<skip.*>/.test(description)) {
        return `${language.uiTexts.hiddenEffect}: ${dataName}`;
    }

    const effect = effects.find((candidate) => candidate.dataName === dataName);
    if (!effect) {
        return description.replace(/^-/g, "");
    }

    const formattedDescription = formatEffectDescription(description, effect, resources)
        .replace(/^-/, "");
    return replaceInlineSpriteLabels(formattedDescription);
}
