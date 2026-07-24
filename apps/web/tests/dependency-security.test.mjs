import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rootPackage = JSON.parse(
  fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
);
const lockfile = JSON.parse(
  fs.readFileSync(new URL('../../../package-lock.json', import.meta.url), 'utf8'),
);

function isAtLeast(actual, minimum) {
  const actualParts = actual.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);

  for (let index = 0; index < 3; index += 1) {
    if (actualParts[index] > minimumParts[index]) return true;
    if (actualParts[index] < minimumParts[index]) return false;
  }

  return true;
}

test('Next transitive dependencies stay above the audited vulnerable ranges', () => {
  const overrides = rootPackage.overrides;
  const postcssVersions = Object.entries(lockfile.packages)
    .filter(([packagePath]) => packagePath.endsWith('node_modules/postcss'))
    .map(([, packageMetadata]) => packageMetadata.version);
  const sharp = lockfile.packages['node_modules/sharp']?.version;

  assert.equal(isAtLeast(overrides?.postcss, '8.5.12'), true);
  assert.equal(isAtLeast(overrides?.sharp, '0.35.0'), true);
  assert.equal(postcssVersions.length > 0, true);
  assert.equal(
    postcssVersions.every((version) => isAtLeast(version, '8.5.12')),
    true,
  );
  assert.equal(sharp, overrides?.sharp);
  assert.equal(isAtLeast(sharp, '0.35.0'), true);
});
