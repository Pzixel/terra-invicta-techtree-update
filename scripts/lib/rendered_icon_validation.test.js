import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { validateRenderedIcons } from './rendered_icon_validation.js';

const writeIcon = (root, relative) => {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, 'png');
};

const fixtureBundle = () => ({
  key: { version: 'stable', scenario: 'standard', language: 'en' },
  collections: {
    tech: [{ dataName: 'TechA', techCategory: 'Energy' }],
    project: [{
      dataName: 'ProjectA',
      techCategory: 'MilitaryScience',
      factionAlways: 'ResistCouncil',
      factionPrereq: ['', 'EscapeCouncil'],
    }],
    drive: [{
      dataName: 'DriveA',
      requiredProjectName: 'ProjectA',
      iconResource: 'shipbuildericons/DriveA',
    }, {
      dataName: 'InactiveDrive',
      requiredProjectName: 'InactiveProject',
      iconResource: 'shipbuildericons/NotRendered',
    }],
    habmodule: [{
      dataName: 'HabA',
      requiredProjectName: 'ProjectA',
      baseIconResource: 'habmodules/base_HabA',
      stationIconResource: 'habmodules/station_HabA',
    }],
    // The application does not render organization logos.
    org: [{ dataName: 'OrgA', iconResource: 'orgicons/NotPublished' }],
  },
});

test('rendered icon gate covers UI references without requiring unused assets', (context) => {
  const iconsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-rendered-icons-'));
  context.after(() => fs.rmSync(iconsRoot, { recursive: true, force: true }));
  for (const relative of [
    'tech_energy_icon.png',
    'tech_military_icon.png',
    'ICO_projects.png',
    'ICO_projects_Invert.png',
    'FAC_ResistCouncil_128.png',
    'FAC_EscapeCouncil_128.png',
    'shipbuildericons/DriveA.png',
    'habmodules/base_HabA.png',
  ]) writeIcon(iconsRoot, relative);

  assert.deepEqual(validateRenderedIcons(fixtureBundle(), iconsRoot), []);

  const rawBundle = fixtureBundle();
  rawBundle.collections.project.push({
    dataName: 'HiddenProject',
    techCategory: 'Energy',
    factionAlways: 'MissingHiddenFaction',
  });
  const loadedView = {
    appStaticData: {
      templateData: fixtureBundle().collections,
    },
  };
  assert.deepEqual(validateRenderedIcons(rawBundle, iconsRoot, loadedView), []);

  fs.rmSync(path.join(iconsRoot, 'habmodules', 'base_HabA.png'));
  assert.deepEqual(validateRenderedIcons(fixtureBundle(), iconsRoot), [
    'habmodules/base_HabA.png: missing rendered icon referenced by habmodule.HabA.baseIconResource',
  ]);
});

test('rendered icon gate rejects an unsupported node category and unsafe module resource', (context) => {
  const iconsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ti-rendered-icons-invalid-'));
  context.after(() => fs.rmSync(iconsRoot, { recursive: true, force: true }));
  const bundle = fixtureBundle();
  bundle.collections.tech[0].techCategory = 'UnknownCategory';
  bundle.collections.drive[0].iconResource = '../outside';

  const failures = validateRenderedIcons(bundle, iconsRoot);
  assert.ok(failures.includes('TechA: unsupported rendered techCategory UnknownCategory'));
  assert.ok(failures.includes('drive.DriveA.iconResource: invalid icon resource ../outside'));
});
