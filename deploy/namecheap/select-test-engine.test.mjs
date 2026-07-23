import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTestPrismaEngine } from './select-test-engine.mjs';

const DARWIN = 'libquery_engine-darwin-arm64.dylib.node';
const RHEL = 'libquery_engine-rhel-openssl-1.1.x.so.node';
const DEBIAN = 'libquery_engine-debian-openssl-1.1.x.so.node';

test('macOS ARM64 isolation chooses the Darwin ARM64 engine', () => {
  assert.equal(selectTestPrismaEngine([DARWIN, RHEL], 'darwin', 'arm64'), DARWIN);
});

test('Linux x64 chooses the RHEL/Linux .so.node engine (production runner)', () => {
  assert.equal(selectTestPrismaEngine([RHEL], 'linux', 'x64'), RHEL);
});

test('the exact reported bug: macOS with ONLY the Linux engine fails closed', () => {
  assert.throws(
    () => selectTestPrismaEngine([RHEL], 'darwin', 'arm64'),
    /No bundled Prisma engine compatible with 'darwin:arm64'/,
  );
});

test('unknown platform fails closed', () => {
  assert.throws(() => selectTestPrismaEngine([DARWIN], 'sunos', 'sparc'), /No Prisma test-engine matcher/);
});

test('ambiguous match (more than one) fails closed', () => {
  assert.throws(
    () => selectTestPrismaEngine([RHEL, DEBIAN], 'linux', 'x64'),
    /Ambiguous Prisma test engine/,
  );
});

test('Darwin matcher does not select the Linux engine (arch isolation)', () => {
  // Only RHEL present but asking for darwin → must NOT return RHEL.
  assert.throws(() => selectTestPrismaEngine([RHEL], 'darwin', 'arm64'));
  // darwin-arm64 present but asking for linux → must NOT return darwin.
  assert.throws(() => selectTestPrismaEngine([DARWIN], 'linux', 'x64'));
});
