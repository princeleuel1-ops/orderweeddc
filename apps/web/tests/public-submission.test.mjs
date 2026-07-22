import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  checkPublicSubmissionThrottle,
  PUBLIC_SUBMISSION_POLICY,
  PUBLIC_SUBMISSION_SURFACES,
  PublicSubmissionDuplicateError,
  PublicSubmissionThrottleError,
  publicSubmissionErrorMessage,
  reservePublicSubmission,
} from '../src/lib/public-submission.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const NOW = new Date('2026-07-17T20:00:00.000Z');

function createFakeDb(initialEvents = []) {
  let events = structuredClone(initialEvents);

  function delegate(draft) {
    return {
      publicSubmissionEvent: {
        async count({ where }) {
          return draft.filter((event) => {
            if (where.surface && event.surface !== where.surface) return false;
            if (
              where.clientDigest &&
              event.clientDigest !== where.clientDigest
            ) {
              return false;
            }
            if (
              where.occurredAt?.gte &&
              new Date(event.occurredAt) < where.occurredAt.gte
            ) {
              return false;
            }
            return true;
          }).length;
        },
        async create({ data }) {
          if (
            draft.some(
              (event) =>
                event.surface === data.surface &&
                event.subjectDigest === data.subjectDigest,
            )
          ) {
            throw Object.assign(new Error('Unique constraint failed.'), {
              code: 'P2002',
            });
          }
          const event = {
            id: `submission-${draft.length + 1}`,
            ...structuredClone(data),
          };
          draft.push(event);
          return event;
        },
        async deleteMany({ where }) {
          const before = draft.length;
          const retained = draft.filter(
            (event) =>
              !(
                where.expiresAt?.lte &&
                new Date(event.expiresAt) <= where.expiresAt.lte
              ),
          );
          draft.splice(0, draft.length, ...retained);
          return { count: before - draft.length };
        },
      },
    };
  }

  return {
    get publicSubmissionEvent() {
      return delegate(events).publicSubmissionEvent;
    },
    async $transaction(callback) {
      const draft = structuredClone(events);
      const result = await callback(delegate(draft));
      events = draft;
      return result;
    },
    snapshot() {
      return structuredClone(events);
    },
  };
}

async function reserve(db, input) {
  return db.$transaction((transaction) =>
    reservePublicSubmission(transaction, input),
  );
}

test('accepted public submissions persist only pseudonymous identifiers', async () => {
  const db = createFakeDb();
  await reserve(db, {
    clientIdentity: '203.0.113.42',
    subject: 'owner@example.com\nABCA-12345',
    surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
    now: NOW,
  });

  const [event] = db.snapshot();
  assert.match(event.clientDigest, /^[a-f0-9]{64}$/);
  assert.match(event.subjectDigest, /^[a-f0-9]{64}$/);
  assert.equal(event.surface, 'CLAIM');
  assert.doesNotMatch(
    JSON.stringify(event),
    /owner@example|ABCA-12345|203\.0\.113\.42/i,
  );
});

test('the client limit accepts exactly the policy maximum and rolls back excess', async () => {
  const db = createFakeDb();
  for (
    let attempt = 1;
    attempt <= PUBLIC_SUBMISSION_POLICY.clientLimit;
    attempt += 1
  ) {
    await reserve(db, {
      clientIdentity: '198.51.100.8',
      subject: `claim-${attempt}`,
      surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
      now: new Date(NOW.getTime() + attempt),
    });
  }

  const preflight = await checkPublicSubmissionThrottle(db, {
    clientIdentity: '198.51.100.8',
    surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
    now: new Date(NOW.getTime() + 1000),
  });
  assert.equal(preflight.allowed, false);

  await assert.rejects(
    reserve(db, {
      clientIdentity: '198.51.100.8',
      subject: 'claim-over-limit',
      surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
      now: new Date(NOW.getTime() + 1001),
    }),
    PublicSubmissionThrottleError,
  );
  assert.equal(db.snapshot().length, PUBLIC_SUBMISSION_POLICY.clientLimit);
});

test('surface-wide limits prevent unbounded writes across distinct clients', async () => {
  const db = createFakeDb();
  for (
    let attempt = 1;
    attempt <= PUBLIC_SUBMISSION_POLICY.surfaceLimit;
    attempt += 1
  ) {
    await reserve(db, {
      clientIdentity: `2001:db8::${attempt}`,
      subject: `correction-${attempt}`,
      surface: PUBLIC_SUBMISSION_SURFACES.CORRECTION,
      now: new Date(NOW.getTime() + attempt),
    });
  }

  await assert.rejects(
    reserve(db, {
      clientIdentity: '2001:db8::ffff',
      subject: 'correction-over-limit',
      surface: PUBLIC_SUBMISSION_SURFACES.CORRECTION,
      now: new Date(NOW.getTime() + 1000),
    }),
    PublicSubmissionThrottleError,
  );
  assert.equal(db.snapshot().length, PUBLIC_SUBMISSION_POLICY.surfaceLimit);
});

test('duplicate subjects are rejected atomically within each surface', async () => {
  const db = createFakeDb();
  const input = {
    clientIdentity: '192.0.2.10',
    subject: 'same-subject',
    surface: PUBLIC_SUBMISSION_SURFACES.CORRECTION,
    now: NOW,
  };
  await reserve(db, input);
  await assert.rejects(
    reserve(db, {
      ...input,
      clientIdentity: '192.0.2.11',
      now: new Date(NOW.getTime() + 1000),
    }),
    PublicSubmissionDuplicateError,
  );
  assert.equal(db.snapshot().length, 1);
});

test('expired reservations are pruned and may be submitted again', async () => {
  const db = createFakeDb();
  const input = {
    clientIdentity: '192.0.2.20',
    subject: 'renewable-subject',
    surface: PUBLIC_SUBMISSION_SURFACES.CLAIM,
  };
  await reserve(db, { ...input, now: NOW });
  await reserve(db, {
    ...input,
    now: new Date(NOW.getTime() + PUBLIC_SUBMISSION_POLICY.retentionMs + 1),
  });
  assert.equal(db.snapshot().length, 1);
});

test('public error query values resolve only through an allowlist', () => {
  assert.match(publicSubmissionErrorMessage('invalid'), /review/i);
  assert.match(publicSubmissionErrorMessage('duplicate'), /matching/i);
  assert.match(publicSubmissionErrorMessage('rate'), /too many/i);
  assert.equal(
    publicSubmissionErrorMessage('<strong>trusted-looking injection</strong>'),
    null,
  );
  assert.equal(publicSubmissionErrorMessage(undefined), null);
});

test('both public POST handlers use origin, body, throttle, and atomic mutation boundaries', () => {
  const claimPage = fs.readFileSync(
    path.join(webRoot, 'src/app/business/claim/page.tsx'),
    'utf8',
  );
  const correctionPage = fs.readFileSync(
    path.join(
      webRoot,
      'src/app/[domain]/retailer/[id]/correction/page.tsx',
    ),
    'utf8',
  );
  const claimRoute = fs.readFileSync(
    path.join(
      webRoot,
      'src/app/business/claim/submission/route.ts',
    ),
    'utf8',
  );
  const correctionRoute = fs.readFileSync(
    path.join(
      webRoot,
      'src/app/[domain]/retailer/[id]/correction/submission/route.ts',
    ),
    'utf8',
  );
  const mutations = fs.readFileSync(
    path.join(webRoot, 'src/lib/public-submission-mutations.mjs'),
    'utf8',
  );
  const writePolicy = fs.readFileSync(
    path.join(webRoot, 'src/lib/public-write-policy.ts'),
    'utf8',
  );
  const nextConfig = fs.readFileSync(
    path.join(webRoot, 'next.config.ts'),
    'utf8',
  );
  const schema = fs.readFileSync(
    path.join(webRoot, 'prisma/schema.prisma'),
    'utf8',
  );

  for (const [page, action] of [
    [claimPage, '/business/claim/submission'],
    [correctionPage, '/correction/submission'],
  ]) {
    assert.match(page, new RegExp(`action=.*${action.replaceAll('/', '\\/')}`));
    assert.match(page, /method="post"/);
    assert.match(page, /publicSubmissionErrorMessage/);
    assert.doesNotMatch(page, /Error: \{error\}/);
    assert.doesNotMatch(page, /'use server'/);
  }
  for (const route of [claimRoute, correctionRoute]) {
    assert.match(route, /isSameOriginFormRequest/);
    assert.match(route, /readBoundedPublicForm/);
    assert.match(route, /checkPublicSubmissionThrottle/);
  }
  assert.match(mutations, /reservePublicSubmission\(transaction/);
  assert.match(writePolicy, /MAX_PUBLIC_WRITE_BODY_BYTES = 8 \* 1024/);
  assert.match(writePolicy, /status:\s*413/);
  assert.match(writePolicy, /status:\s*415/);
  assert.match(nextConfig, /bodySizeLimit:\s*"32kb"/);
  assert.match(schema, /@@unique\(\[surface, subjectDigest\]\)/);
  assert.match(
    schema,
    /@@index\(\[surface, clientDigest, occurredAt\]\)/,
  );
});
