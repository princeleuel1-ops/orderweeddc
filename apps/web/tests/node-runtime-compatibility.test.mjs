import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspacePackages = [
  new URL('../package.json', import.meta.url),
  new URL('../../../packages/ad-creative/package.json', import.meta.url),
  new URL('../../../packages/ai/package.json', import.meta.url),
];

test('workspace test commands use Node 20-compatible test discovery', () => {
  for (const packageUrl of workspacePackages) {
    const packageMetadata = JSON.parse(fs.readFileSync(packageUrl, 'utf8'));

    assert.equal(
      packageMetadata.scripts?.test,
      'node --test tests/*.test.mjs',
      `${packageMetadata.name} must not pass a quoted glob to Node 20`,
    );
  }
});
