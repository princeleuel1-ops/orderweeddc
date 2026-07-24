import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { createReleaseChildEnvironment } from './release-environment.mjs';

test('release children resolve the verified parent Node before inherited PATH entries', () => {
  const environment = createReleaseChildEnvironment({
    baseEnvironment: {
      PATH: '/untrusted/bin:/usr/bin:/bin',
      RUST_LOG: 'warn',
    },
  });
  const observed = JSON.parse(
    execFileSync(
      'node',
      [
        '-e',
        'process.stdout.write(JSON.stringify({version:process.version,execPath:process.execPath}))',
      ],
      { encoding: 'utf8', env: environment },
    ),
  );

  assert.equal(observed.version, process.version);
  assert.equal(observed.execPath, process.execPath);
  assert.equal(environment.PATH.split(path.delimiter)[0], path.dirname(process.execPath));
  assert.equal('RUST_LOG' in environment, false);
});
