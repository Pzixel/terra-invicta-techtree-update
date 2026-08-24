import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const jiti = createJiti(import.meta.url);
const { graphArtifactPath } = await jiti.import(path.join(ROOT, 'src', 'scenario.ts'));

test('the SPA shell preloads the default generated graph tuple', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(
    /<link rel="preload" href="([^"]*graph\/[^"]+)" as="fetch" crossorigin="anonymous"\s*\/?>/g
  )].map((match) => match[1]);

  assert.deepEqual(hrefs, [
    `/${graphArtifactPath('stable', 'standard', 'en')}`,
  ]);
});
