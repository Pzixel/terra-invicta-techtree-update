#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReleaseReady, validateSourceHashes } from './lib/release_metadata.js';
import {
  validateCompiledScenarioData,
  validateImportedSourceDocuments,
} from './lib/release_data_validation.js';
import { createRenderedIconGate } from './lib/rendered_icon_validation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const releaseFile = path.join(root, 'public', 'gamefiles', 'release.json');
if (!fs.existsSync(releaseFile)) {
  throw new Error(`Release data validation failed: ${releaseFile} is missing`);
}

const metadata = JSON.parse(fs.readFileSync(releaseFile, 'utf8'));
assertReleaseReady(metadata);
const hashFailures = validateSourceHashes(metadata, path.dirname(releaseFile));
if (hashFailures.length > 0) {
  throw new Error(`Release source validation failed:\n- ${hashFailures.join('\n- ')}`);
}
const sourceFailures = validateImportedSourceDocuments(path.dirname(releaseFile));
if (sourceFailures.length > 0) {
  throw new Error(`Release source document validation failed:\n- ${sourceFailures.join('\n- ')}`);
}
const iconGate = createRenderedIconGate(path.join(root, 'public', 'icons'));
const compilerFailures = await validateCompiledScenarioData(path.dirname(releaseFile), metadata, {
  onBundle: (bundle, _language, view) => iconGate.validate(bundle, view),
});
if (compilerFailures.length > 0) {
  throw new Error(`Release compiler validation failed:\n- ${compilerFailures.join('\n- ')}`);
}
const iconFailures = iconGate.failures();
if (iconFailures.length > 0) {
  throw new Error(`Release rendered-icon validation failed:\n- ${iconFailures.join('\n- ')}`);
}
console.log(`Verified release ${metadata.marketingVersion}, Steam build ${metadata.steam.buildId}`);
