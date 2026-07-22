import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  executeParallelPrompts,
  getLocalQualityStageRegistry,
  getNextClient,
  LEGACY_EXTERNAL_GATEWAY_STATUS,
} from '../src/gateway.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDirectory, '..');

test('the local quality contract exposes the deterministic release stages', () => {
  const stages = getLocalQualityStageRegistry();
  assert.deepEqual(stages.map(({ id }) => id), [1, 2, 3, 4]);
  assert.deepEqual(
    stages.map(({ name }) => name),
    ['tests', 'lint', 'typecheck', 'build'],
  );
});

test('the legacy direct external gateway is fail-closed', () => {
  assert.equal(LEGACY_EXTERNAL_GATEWAY_STATUS.enabled, false);
  assert.throws(() => getNextClient(), /legacy direct model client is disabled/i);
});

test('local prompt execution is deterministic and discloses no external execution', async () => {
  const first = await executeParallelPrompts(['same prompt']);
  const second = await executeParallelPrompts(['same prompt']);
  assert.deepEqual(first, second);

  const receipt = JSON.parse(first[0]);
  assert.equal(receipt.mode, 'LOCAL_DETERMINISTIC');
  assert.equal(receipt.externalModelExecution, false);
  assert.equal(receipt.externallyVerified, false);
  assert.match(receipt.message, /No external model call/);
});

test('retired package code does not read provider credentials or execute generated commands', () => {
  const sourceFiles = [
    'src/gateway.mjs',
    'scripts/local-quality-loop.mjs',
  ];

  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(path.join(packageRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /OPENROUTER|ANTHROPIC_API_KEY|GOOGLE_API_KEY/);
    assert.doesNotMatch(source, /actionData\.command|actionData\.content/);
  }
});
