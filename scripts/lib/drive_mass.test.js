import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { calculateDriveMassTons, hasDriveMass } = await jiti.import('../../src/utils/driveMass.ts');

test('drive mass includes the power-scaled mass used by the game', () => {
  const cases = [
    {
      name: 'Poseidon Lantern x1',
      drive: { flatMass_tons: 0, thrust_N: 12_900_000, EV_kps: 66, specificPower_kgMW: 0.77 },
      expected: 327.789,
    },
    {
      name: 'Poseidon Lantern x6',
      drive: { flatMass_tons: 0, thrust_N: 77_400_000, EV_kps: 66, specificPower_kgMW: 0.77 },
      expected: 1_966.734,
    },
    {
      name: 'Orion Drive x1',
      drive: { flatMass_tons: 0, thrust_N: 16_000_000, EV_kps: 42.1, specificPower_kgMW: 1.09 },
      expected: 367.112,
    },
    {
      name: 'Mass Driver x1',
      drive: { flatMass_tons: 0, thrust_N: 12_000, EV_kps: 9.81, specificPower_kgMW: 35 },
      expected: 2.0601,
    },
  ];

  for (const { name, drive, expected } of cases) {
    assert.ok(Math.abs(calculateDriveMassTons(drive) - expected) < 1e-9, name);
  }
});

test('drive mass retains direct flat mass', () => {
  assert.equal(calculateDriveMassTons({ flatMass_tons: 10 }), 10);
});

test('drive mass excludes external power plant and radiator mass', () => {
  const protiumConverterTorch = {
    flatMass_tons: 0,
    thrust_N: 9_760_000,
    EV_kps: 10_256,
    specificPower_kgMW: 0,
  };

  assert.equal(calculateDriveMassTons(protiumConverterTorch), 0);
});

test('mass column is omitted only when every drive has zero intrinsic mass', () => {
  const protiumConverterTorch = {
    flatMass_tons: 0,
    thrust_N: 9_760_000,
    EV_kps: 10_256,
    specificPower_kgMW: 0,
  };
  const poseidonLantern = {
    flatMass_tons: 0,
    thrust_N: 12_900_000,
    EV_kps: 66,
    specificPower_kgMW: 0.77,
  };

  assert.equal(hasDriveMass([protiumConverterTorch]), false);
  assert.equal(hasDriveMass([protiumConverterTorch, poseidonLantern]), true);
});

test('drive mass adds flat and power-scaled components', () => {
  assert.equal(calculateDriveMassTons({
    flatMass_tons: 2,
    thrust_N: 2_000_000,
    EV_kps: 10,
    specificPower_kgMW: 0.5,
  }), 7);
});

test('every stable drive produces a finite nonnegative intrinsic mass', () => {
  const drives = JSON.parse(fs.readFileSync(
    new URL('../../public/gamefiles/stable/Templates/TIDriveTemplate.json', import.meta.url),
    'utf8',
  ));

  assert.ok(drives.length > 0);
  for (const drive of drives) {
    const mass = calculateDriveMassTons(drive);
    assert.ok(Number.isFinite(mass), `${drive.dataName}: finite mass`);
    assert.ok(mass >= 0, `${drive.dataName}: nonnegative mass`);
  }
});
