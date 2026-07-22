import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hashPassword,
  isPasswordHash,
  verifyPassword,
} from '../src/lib/auth/password.mjs';
import {
  canAccessAdmin,
  canAccessCustomer,
  canManageRetailer,
} from '../src/lib/auth/policy.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');

test('passwords are stored as salted scrypt hashes and verified safely', async () => {
  const password = 'DemoOnly!2026-Local';
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);

  assert.notEqual(firstHash, password);
  assert.notEqual(firstHash, secondHash);
  assert.match(firstHash, /^scrypt\$/);
  assert.equal(isPasswordHash(firstHash), true);
  assert.equal(isPasswordHash('plaintext'), false);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword('wrong-password-value', firstHash), false);
  assert.equal(await verifyPassword(password, 'plaintext'), false);
});

test('admin access requires the admin role', () => {
  assert.equal(canAccessAdmin(null), false);
  assert.equal(canAccessAdmin({ role: 'CUSTOMER' }), false);
  assert.equal(canAccessAdmin({ role: 'RETAILER_MANAGER' }), false);
  assert.equal(canAccessAdmin({ role: 'ADMIN' }), true);
});

test('customer access rejects anonymous and privileged non-customer roles', () => {
  assert.equal(canAccessCustomer(null), false);
  assert.equal(canAccessCustomer({ role: 'ADMIN' }), false);
  assert.equal(canAccessCustomer({ role: 'RETAILER_MANAGER' }), false);
  assert.equal(canAccessCustomer({ role: 'CUSTOMER' }), true);
});

test('retailer managers cannot cross the ownership boundary', () => {
  const session = {
    role: 'RETAILER_MANAGER',
    managedRetailerId: 'retailer-alpha',
  };

  assert.equal(canManageRetailer(session, 'retailer-alpha'), true);
  assert.equal(canManageRetailer(session, 'retailer-beta'), false);
  assert.equal(canManageRetailer({ ...session, role: 'ADMIN' }, 'retailer-alpha'), false);
  assert.equal(canManageRetailer(null, 'retailer-alpha'), false);
});

test('session and seed source preserve the authentication invariants', () => {
  const sessionSource = fs.readFileSync(
    path.join(webRoot, 'src/lib/auth/session.ts'),
    'utf8',
  );
  const seedSource = fs.readFileSync(path.join(webRoot, 'prisma/seed.mjs'), 'utf8');

  assert.match(sessionSource, /httpOnly:\s*true/);
  assert.match(sessionSource, /sameSite:\s*'lax'/);
  assert.match(sessionSource, /secure:\s*process\.env\.NODE_ENV === 'production'/);
  assert.match(sessionSource, /randomBytes\(32\)/);
  assert.match(sessionSource, /MAX_ACTIVE_SESSIONS_PER_USER = 5/);
  assert.match(sessionSource, /expiresAt:\s*\{\s*lte:\s*now\s*\}/);
  assert.match(seedSource, /hashPassword/);
  assert.match(seedSource, /authFailure\.deleteMany/);
});

test('privileged pages and every privileged action re-check authorization', () => {
  const adminSource = fs.readFileSync(
    path.join(webRoot, 'src/app/admin/page.tsx'),
    'utf8',
  );
  const dashboardSource = fs.readFileSync(
    path.join(webRoot, 'src/app/business/dashboard/page.tsx'),
    'utf8',
  );

  assert.match(adminSource, /await requireAdmin\(\)/);
  assert.equal((adminSource.match(/await assertAdmin\(\)/g) || []).length, 6);
  assert.match(dashboardSource, /await requireRetailerManager\(\)/);
  assert.equal(
    (dashboardSource.match(/await assertRetailerManager\(retailerId\)/g) || []).length,
    5,
  );
  assert.ok(
    dashboardSource.indexOf('await requireRetailerManager()') <
      dashboardSource.indexOf('await searchParams'),
    'The manager session must be established before dashboard query parsing.',
  );
  assert.match(
    dashboardSource,
    /const retailerId = managerSession\.managedRetailerId/,
  );
  assert.doesNotMatch(dashboardSource, /searchParams[^;\n]*retailerId/);
  assert.doesNotMatch(dashboardSource, /name="retailerId"/);
});
