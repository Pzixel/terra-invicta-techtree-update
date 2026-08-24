export const SEO_LIMITS = Object.freeze({
  title: Object.freeze({ min: 15, max: 69 }),
  description: Object.freeze({ min: 50, max: 155 }),
});

export const ROOT_SEO = Object.freeze({
  title: 'Terra Invicta Tech Tree — 1.0 + Dark Skies DLC',
  description: 'Latest Terra Invicta 1.0 tech tree with Dark Skies DLC. Explore technologies, projects, prerequisites, costs, effects, and unlocks.',
});

export const DLC_LANDING_SEO = Object.freeze({
  '2003': Object.freeze({
    title: 'Terra Invicta 2003 Scenario — Dark Skies DLC',
    description: 'Explore the Terra Invicta 2003 Scenario tech tree from the Dark Skies DLC, including technologies, projects, prerequisites, and unlocks.',
  }),
  'broken-earth': Object.freeze({
    title: 'Terra Invicta Broken Earth — Dark Skies DLC',
    description: 'Explore the Terra Invicta Broken Earth tech tree from the Dark Skies DLC, including technologies, projects, prerequisites, and unlocks.',
  }),
});

export const unicodeLength = (value) => Array.from(value).length;

export const truncateUnicode = (value, maxLength) => {
  const chars = Array.from(value);
  if (chars.length <= maxLength) return value;
  if (maxLength < 1) return '';
  return `${chars.slice(0, maxLength - 1).join('').trimEnd()}…`;
};

export function makeEntityTitle(entityName, kindQualifier = '') {
  const qualifiedName = kindQualifier ? `${entityName} (${kindQualifier})` : entityName;
  const fullSuffix = ' — Terra Invicta Tech Tree';
  const shortSuffix = ' — TI Tech Tree';
  const fullTitle = `${qualifiedName}${fullSuffix}`;
  if (unicodeLength(fullTitle) <= SEO_LIMITS.title.max) return fullTitle;

  const shortTitle = `${qualifiedName}${shortSuffix}`;
  if (unicodeLength(shortTitle) <= SEO_LIMITS.title.max) return shortTitle;

  const entityLimit = SEO_LIMITS.title.max - unicodeLength(shortSuffix);
  return `${truncateUnicode(qualifiedName, entityLimit)}${shortSuffix}`;
}

export function makeEntityDescription({ name, kind, summary = '' }) {
  const cleanSummary = summary.trim();
  const fallback = 'Explore its prerequisites, research cost, effects, and unlocks.';
  const description = `${name} — Terra Invicta ${kind.toLowerCase()}. ${cleanSummary || fallback}`;
  return truncateUnicode(description, SEO_LIMITS.description.max);
}

export function assertSeoMetadata({ title, description, label = 'page' }) {
  const titleLength = unicodeLength(title);
  const descriptionLength = unicodeLength(description);
  if (titleLength < SEO_LIMITS.title.min || titleLength > SEO_LIMITS.title.max) {
    throw new Error(`${label}: title length ${titleLength} is outside ${SEO_LIMITS.title.min}-${SEO_LIMITS.title.max}`);
  }
  if (descriptionLength < SEO_LIMITS.description.min || descriptionLength > SEO_LIMITS.description.max) {
    throw new Error(`${label}: description length ${descriptionLength} is outside ${SEO_LIMITS.description.min}-${SEO_LIMITS.description.max}`);
  }
}
