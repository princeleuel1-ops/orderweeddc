import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertReleaseReproducible,
  evaluateReleaseReproducibility,
} from './release-preflight.mjs';

const FULL_SHA = '64c81128f1d866331512a9acd93f0cf40c6b1240';

test('clean + reachable + full SHA → OK', () => {
  const v = evaluateReleaseReproducibility({ workingTree: '', gitSha: FULL_SHA, remoteContains: true });
  assert.equal(v.ok, true);
  assert.deepEqual(v.problems, []);
});

test('the c1e8ac7 case: unreachable commit → FAIL', () => {
  const v = evaluateReleaseReproducibility({ workingTree: '', gitSha: FULL_SHA, remoteContains: false });
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => p.includes('not reachable on the remote')));
});

test('dirty working tree → FAIL unless ALLOW_DIRTY', () => {
  const dirty = ' M apps/web/src/proxy.ts';
  assert.equal(evaluateReleaseReproducibility({ workingTree: dirty, gitSha: FULL_SHA, remoteContains: true }).ok, false);
  assert.equal(evaluateReleaseReproducibility({ workingTree: dirty, gitSha: FULL_SHA, remoteContains: true, allowDirty: true }).ok, true);
});

test('short / non-hex SHA → FAIL', () => {
  assert.equal(evaluateReleaseReproducibility({ workingTree: '', gitSha: 'c1e8ac7', remoteContains: true }).ok, false);
  assert.equal(evaluateReleaseReproducibility({ workingTree: '', gitSha: '', remoteContains: true }).ok, false);
});

test('multiple problems are all reported', () => {
  const v = evaluateReleaseReproducibility({ workingTree: ' M x', gitSha: 'nope', remoteContains: false });
  assert.equal(v.ok, false);
  assert.equal(v.problems.length, 3);
});

test('live remote lookup passes the remote as an argv value without a shell', () => {
  const calls = [];
  const remote = 'origin; touch should-not-run';
  const result = assertReleaseReproducible({
    execFile(command, args, options) {
      calls.push({ command, args, options });
      return `${FULL_SHA}\trefs/heads/test\n`;
    },
    repoRoot: '/repo',
    remote,
    workingTree: '',
    gitSha: FULL_SHA,
  });

  assert.deepEqual(calls, [
    {
      command: 'git',
      args: ['ls-remote', remote],
      options: { cwd: '/repo' },
    },
  ]);
  assert.deepEqual(result, { remote, remoteReachable: true });
});

test('failed live remote lookup fails closed without stale local-ref fallback', () => {
  assert.throws(
    () =>
      assertReleaseReproducible({
        execFile() {
          throw new Error('remote unavailable');
        },
        repoRoot: '/repo',
        workingTree: '',
        gitSha: FULL_SHA,
      }),
    /not reachable on the remote/,
  );
});
