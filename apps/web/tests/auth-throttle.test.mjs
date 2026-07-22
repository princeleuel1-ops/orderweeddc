import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AUTH_THROTTLE_POLICY,
  checkAuthenticationThrottle,
  clearAuthenticationFailures,
  recordAuthenticationFailure,
} from '../src/lib/auth/throttle.mjs';
import {
  authenticationClientIdentity,
} from '../src/lib/auth/request-policy.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const NOW = new Date('2026-07-17T14:00:00.000Z');

function createFakeDb(initialFailures = []) {
  let failures = structuredClone(initialFailures);

  function delegate(draft) {
    return {
      authFailure: {
        async count({ where }) {
          return draft.filter((failure) => {
            if (
              where.accountDigest &&
              failure.accountDigest !== where.accountDigest
            ) {
              return false;
            }
            if (
              where.clientDigest &&
              failure.clientDigest !== where.clientDigest
            ) {
              return false;
            }
            if (
              where.occurredAt?.gte &&
              new Date(failure.occurredAt) < where.occurredAt.gte
            ) {
              return false;
            }
            return true;
          }).length;
        },
        async create({ data }) {
          const failure = {
            id: `failure-${draft.length + 1}`,
            ...structuredClone(data),
          };
          draft.push(failure);
          return failure;
        },
        async deleteMany({ where }) {
          const before = draft.length;
          const shouldDelete = (failure) => {
            if (
              where.accountDigest &&
              failure.accountDigest === where.accountDigest
            ) {
              return true;
            }
            if (
              where.expiresAt?.lte &&
              new Date(failure.expiresAt) <= where.expiresAt.lte
            ) {
              return true;
            }
            return false;
          };
          const retained = draft.filter((failure) => !shouldDelete(failure));
          draft.splice(0, draft.length, ...retained);
          return { count: before - draft.length };
        },
      },
    };
  }

  return {
    get authFailure() {
      return delegate(failures).authFailure;
    },
    async $transaction(callback) {
      const draft = structuredClone(failures);
      const result = await callback(delegate(draft));
      failures = draft;
      return result;
    },
    snapshot() {
      return structuredClone(failures);
    },
  };
}

function requestHeaders(values = {}) {
  return {
    headers: new Headers(values),
  };
}

test('authentication failure evidence stores digests, never raw identifiers', async () => {
  const db = createFakeDb();
  const email = 'Owner@Example.com';
  const clientIdentity = '203.0.113.42';

  const state = await recordAuthenticationFailure(db, {
    email,
    clientIdentity,
    surface: 'BUSINESS',
    now: NOW,
  });

  assert.equal(state.allowed, true);
  const [failure] = db.snapshot();
  assert.match(failure.accountDigest, /^[a-f0-9]{64}$/);
  assert.match(failure.clientDigest, /^[a-f0-9]{64}$/);
  assert.equal(failure.surface, 'BUSINESS');
  assert.doesNotMatch(JSON.stringify(failure), /owner@example|203\.0\.113\.42/i);
});

test('the fifth recent account failure blocks across login surfaces', async () => {
  const db = createFakeDb();

  for (
    let attempt = 1;
    attempt <= AUTH_THROTTLE_POLICY.accountFailureLimit;
    attempt += 1
  ) {
    const state = await recordAuthenticationFailure(db, {
      email: 'target@example.com',
      clientIdentity: `203.0.113.${attempt}`,
      surface: attempt % 2 === 0 ? 'ADMIN' : 'CUSTOMER',
      now: new Date(NOW.getTime() + attempt * 1000),
    });
    assert.equal(
      state.allowed,
      attempt < AUTH_THROTTLE_POLICY.accountFailureLimit,
    );
  }

  const persisted = await checkAuthenticationThrottle(db, {
    email: 'TARGET@example.com',
    clientIdentity: '198.51.100.10',
    now: new Date(NOW.getTime() + 10_000),
  });
  assert.equal(persisted.allowed, false);
  assert.equal(persisted.accountBlocked, true);
  assert.equal(persisted.clientBlocked, false);
});

test('client throttling aggregates failures across distinct account names', async () => {
  const db = createFakeDb();
  let finalState;

  for (
    let attempt = 1;
    attempt <= AUTH_THROTTLE_POLICY.clientFailureLimit;
    attempt += 1
  ) {
    finalState = await recordAuthenticationFailure(db, {
      email: `unknown-${attempt}@example.invalid`,
      clientIdentity: '198.51.100.8',
      surface: 'CUSTOMER',
      now: new Date(NOW.getTime() + attempt * 100),
    });
  }

  assert.equal(finalState.allowed, false);
  assert.equal(finalState.accountBlocked, false);
  assert.equal(finalState.clientBlocked, true);
});

test('successful authentication cleanup clears only the matching account evidence', async () => {
  const db = createFakeDb();
  await recordAuthenticationFailure(db, {
    email: 'first@example.com',
    clientIdentity: '203.0.113.5',
    surface: 'ADMIN',
    now: NOW,
  });
  await recordAuthenticationFailure(db, {
    email: 'second@example.com',
    clientIdentity: '203.0.113.5',
    surface: 'ADMIN',
    now: NOW,
  });

  const result = await clearAuthenticationFailures(db, {
    email: 'FIRST@example.com',
  });
  assert.equal(result.count, 1);
  assert.equal(db.snapshot().length, 1);
});

test('expired evidence is pruned and no longer contributes to the rolling window', async () => {
  const db = createFakeDb();
  const oldNow = new Date(
    NOW.getTime() - AUTH_THROTTLE_POLICY.retentionMs - 1000,
  );
  await recordAuthenticationFailure(db, {
    email: 'old@example.com',
    clientIdentity: '192.0.2.1',
    surface: 'CUSTOMER',
    now: oldNow,
  });
  await recordAuthenticationFailure(db, {
    email: 'new@example.com',
    clientIdentity: '192.0.2.2',
    surface: 'CUSTOMER',
    now: NOW,
  });

  const failures = db.snapshot();
  assert.equal(failures.length, 1);
  assert.equal(failures[0].surface, 'CUSTOMER');
});

test('client identity accepts only network addresses from forwarding headers', () => {
  assert.equal(
    authenticationClientIdentity(
      requestHeaders({ 'cf-connecting-ip': '203.0.113.10' }),
    ),
    '203.0.113.10',
  );
  assert.equal(
    authenticationClientIdentity(
      requestHeaders({ 'x-forwarded-for': '2001:db8::1, 198.51.100.2' }),
    ),
    '2001:db8::1',
  );
  assert.equal(
    authenticationClientIdentity(
      requestHeaders({ 'x-forwarded-for': 'attacker-controlled-value' }),
    ),
    'unresolved',
  );
});

test('all login forms use the bounded shared POST handler and generic errors', () => {
  const adminLogin = fs.readFileSync(
    path.join(webRoot, 'src/app/admin/login/page.tsx'),
    'utf8',
  );
  const businessLogin = fs.readFileSync(
    path.join(webRoot, 'src/app/business/login/page.tsx'),
    'utf8',
  );
  const customerSession = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/customer/session/route.ts'),
    'utf8',
  );
  const handler = fs.readFileSync(
    path.join(webRoot, 'src/lib/auth/login-handler.ts'),
    'utf8',
  );
  const credentialSource = fs.readFileSync(
    path.join(webRoot, 'src/lib/auth/credentials.ts'),
    'utf8',
  );

  assert.match(adminLogin, /action="\/admin\/session" method="post"/);
  assert.match(businessLogin, /action="\/business\/session" method="post"/);
  assert.doesNotMatch(adminLogin, /'use server'/);
  assert.doesNotMatch(businessLogin, /'use server'/);
  assert.doesNotMatch(adminLogin, /\{error\}/);
  assert.doesNotMatch(businessLogin, /\{resolvedSearchParams\.error\}/);
  assert.match(customerSession, /handleCredentialLogin/);
  assert.match(handler, /MAX_LOGIN_BODY_BYTES/);
  assert.match(handler, /checkAuthenticationThrottle/);
  assert.match(handler, /recordAuthenticationFailure/);
  assert.match(handler, /status:\s*429/);
  assert.match(handler, /'Retry-After'/);
  assert.match(credentialSource, /DUMMY_PASSWORD_HASH/);
  assert.match(credentialSource, /user\?\.password \?\? DUMMY_PASSWORD_HASH/);
});
