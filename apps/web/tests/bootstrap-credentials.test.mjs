import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  BootstrapCredentialError,
  createBootstrapCredentials,
  DEMONSTRATION_ACCOUNTS,
  writeBootstrapCredentialFile,
} from '../src/lib/auth/bootstrap-credentials.mjs';

function deterministicBytes() {
  let invocation = 0;
  return (length) => {
    invocation += 1;
    return Buffer.alloc(length, invocation);
  };
}

test('missing bootstrap passwords become distinct high-entropy credentials', () => {
  const credentials = createBootstrapCredentials({}, deterministicBytes());
  const passwords = DEMONSTRATION_ACCOUNTS.map(
    (account) => credentials[account.key].password,
  );

  assert.equal(new Set(passwords).size, DEMONSTRATION_ACCOUNTS.length);
  for (const password of passwords) {
    assert.match(password, /[A-Z]/);
    assert.match(password, /[a-z]/);
    assert.match(password, /[0-9]/);
    assert.match(password, /[^A-Za-z0-9]/);
    assert.ok(password.length >= 32);
  }
});

test('configured bootstrap passwords must be strong and distinct', () => {
  assert.throws(
    () =>
      createBootstrapCredentials({
        CANA_DEMO_ADMIN_PASSWORD: 'weak-password',
        CANA_DEMO_RETAILER_PASSWORD: 'RetailerStrong!2026',
        CANA_DEMO_CUSTOMER_PASSWORD: 'CustomerStrong!2026',
      }),
    (error) =>
      error instanceof BootstrapCredentialError &&
      error.code === 'WEAK_BOOTSTRAP_PASSWORD',
  );

  assert.throws(
    () =>
      createBootstrapCredentials({
        CANA_DEMO_ADMIN_PASSWORD: 'SharedStrong!2026',
        CANA_DEMO_RETAILER_PASSWORD: 'SharedStrong!2026',
        CANA_DEMO_CUSTOMER_PASSWORD: 'CustomerStrong!2026',
      }),
    (error) =>
      error instanceof BootstrapCredentialError &&
      error.code === 'DUPLICATE_BOOTSTRAP_PASSWORD',
  );
});

test('the local credential document omits environment-supplied passwords', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cana-bootstrap-'),
  );
  const credentialPath = path.join(temporaryDirectory, 'credentials.json');
  const credentials = createBootstrapCredentials(
    {
      CANA_DEMO_ADMIN_PASSWORD: 'AdminConfigured!2026',
      CANA_DEMO_RETAILER_PASSWORD: 'RetailerConfigured!2026',
      CANA_DEMO_CUSTOMER_PASSWORD: 'CustomerConfigured!2026',
    },
    deterministicBytes(),
  );

  try {
    writeBootstrapCredentialFile(credentials, {
      credentialPath,
      generatedAt: new Date('2026-07-17T16:00:00.000Z'),
    });
    const document = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
    assert.equal(document.accounts.length, 3);
    assert.ok(document.accounts.every((account) => account.password === null));
    assert.doesNotMatch(
      fs.readFileSync(credentialPath, 'utf8'),
      /AdminConfigured|RetailerConfigured|CustomerConfigured/,
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('seed and rotation source contain no predictable password fallback', () => {
  const seedSource = fs.readFileSync(
    new URL('../prisma/seed.mjs', import.meta.url),
    'utf8',
  );
  const rotationSource = fs.readFileSync(
    new URL('../prisma/rotate-demo-credentials.mjs', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(seedSource, /Demo(?:Admin|Retailer|Customer)!/);
  assert.doesNotMatch(rotationSource, /Demo(?:Admin|Retailer|Customer)!/);
  assert.match(rotationSource, /nonDemonstrationRecords !== 0/);
  assert.match(rotationSource, /session\.deleteMany/);
});
