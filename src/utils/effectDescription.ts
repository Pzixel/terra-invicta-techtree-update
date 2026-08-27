import type { EffectTemplate } from "../types";

type EffectDescriptionContext = {
    locale: string;
    primaryStateName: string;
    localizeUi: (key: string) => string | undefined;
    resolveTemplateName: (dataName: string) => string;
    resolveTraitGroupNames: (grouping: number) => string[];
};

function truncateFloat(value: number, decimalPlaces: number): number {
    const floatValue = Math.fround(value);
    const factor = Math.fround(10 ** Math.min(Math.max(decimalPlaces, 0), 9));
    return Math.fround(Math.trunc(Math.fround(factor * floatValue)) / factor);
}

function decimalPlaces(value: number, cap = 7): number {
    const magnitude = Math.abs(value);
    const integerMagnitude = Math.abs(Math.trunc(value));
    const places = magnitude === 0 || magnitude === integerMagnitude || magnitude >= 1000
        ? 0
        : magnitude >= 1
            ? 1
            : magnitude > 0.1
                ? 2
                : magnitude > 0.01
                    ? 3
                    : magnitude > 0.001
                        ? 4
                        : magnitude > 0.0001
                            ? 5
                            : magnitude > 0.00001
                                ? 6
                                : 7;
    return Math.min(places, cap);
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
    localizeUi: EffectDescriptionContext["localizeUi"],
): string {
    const floatValue = Math.fround(value);
    const magnitude = Math.abs(floatValue);
    if (magnitude < 1000) {
        return formatSmallNumber(floatValue, locale);
    }

    const [key, divisor, fallbackSuffix] = magnitude >= 1_000_000_000_000
        ? ["UI.Global.Trillions", 999_999_995_904, "T"]
        : magnitude >= 1_000_000_000
            ? ["UI.Global.Billions", 1_000_000_000, "B"]
            : magnitude >= 1_000_000
                ? ["UI.Global.Millions", 1_000_000, "M"]
                : ["UI.Global.Thousands", 1_000, "K"];
    const formatted = (floatValue / divisor).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
    return (localizeUi(key) ?? `{0}${fallbackSuffix}`).replace(/\{0\}/g, formatted);
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

/**
 * Mirrors the positional arguments passed to Loc.T by
 * TIEffectTemplate.description(state1, state2) in Steam build 24479907.
 */
export function formatEffectDescription(
    description: string,
    effect: EffectTemplate,
    context: EffectDescriptionContext,
): string {
    const value = Math.fround(effect.value ?? 0);
    const durationMonths = Math.fround(effect.duration_months ?? 0);
    const primaryStateName = context.primaryStateName;
    const secondaryStateName = "";
    const strValue = effect.strValue ?? "";
    const traitNames = context.resolveTraitGroupNames(Math.trunc(value)).join(", ");
    const scaledValue = Math.min(2 * Math.abs(value), Math.max(-2 * Math.abs(value), 1));
    const attributeName = context.localizeUi(`UI.Global.${strValue || "None"}`) ?? strValue;

    const values = [
        formatBigOrSmallNumber(value, context.locale, context.localizeUi),
        primaryStateName,
        secondaryStateName,
        formatPercent(value, context.locale),
        formatPercent(Math.fround(1 - value), context.locale),
        "",
        "",
        formatBigOrSmallNumber(durationMonths, context.locale, context.localizeUi),
        formatPercent(Math.fround(value - 1), context.locale),
        primaryStateName,
        primaryStateName,
        secondaryStateName,
        secondaryStateName,
        context.resolveTemplateName(strValue),
        primaryStateName,
        secondaryStateName,
        traitNames,
        "",
        formatPercent(Math.fround(1 / value - 1), context.locale),
        formatBigOrSmallNumber(Math.fround(-value), context.locale, context.localizeUi),
        attributeName,
        primaryStateName,
        secondaryStateName,
        formatSmallNumber(scaledValue, context.locale),
        formatSmallNumber(scaledValue, context.locale),
        formatPercent(Math.abs(value), context.locale),
        "",
        formatPercent(Math.fround(1 - 1 / value), context.locale),
        formatPercent(Math.fround(value - 1), context.locale, true),
        formatPercent(value, context.locale, true),
    ] as const;

    return description.replace(/\{(\d+)\}/g, (match, rawIndex: string) =>
        values[Number(rawIndex)] ?? match
    );
}
