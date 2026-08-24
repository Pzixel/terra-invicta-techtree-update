import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ROOT_SEO,
  SEO_LIMITS,
  assertSeoMetadata,
  makeEntityDescription,
  makeEntityTitle,
  unicodeLength,
} from './seo_metadata.js';

test('approved root metadata satisfies the production guardrails', () => {
  assert.equal(ROOT_SEO.title, 'Terra Invicta Tech Tree — 1.0 + Dark Skies DLC');
  assert.equal(
    ROOT_SEO.description,
    'Latest Terra Invicta 1.0 tech tree with Dark Skies DLC. Explore technologies, projects, prerequisites, costs, effects, and unlocks.',
  );
  assert.doesNotThrow(() => assertSeoMetadata({ ...ROOT_SEO, label: 'root' }));
  assert.equal(unicodeLength(ROOT_SEO.description), 131);
});

test('entity titles shorten the suffix before truncating a Unicode name', () => {
  const suffixShortened = makeEntityTitle('A'.repeat(50));
  assert.equal(suffixShortened, `${'A'.repeat(50)} — TI Tech Tree`);

  const unicodeName = `🚀${'A'.repeat(90)}`;
  const truncated = makeEntityTitle(unicodeName);
  assert.equal(unicodeLength(truncated), SEO_LIMITS.title.max);
  assert.match(truncated, /… — TI Tech Tree$/u);
  assert.ok(truncated.startsWith('🚀'));
});

test('entity descriptions use the 155-character Unicode ceiling', () => {
  const description = makeEntityDescription({
    name: 'Advanced 🚀 Research',
    kind: 'Technology',
    summary: 'A'.repeat(300),
  });
  assert.equal(unicodeLength(description), SEO_LIMITS.description.max);
  assert.match(description, /…$/u);
  assert.doesNotThrow(() => assertSeoMetadata({ title: makeEntityTitle('Advanced 🚀 Research'), description }));
});
