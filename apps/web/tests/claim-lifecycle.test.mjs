import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdminMutationError,
  resolveRetailerClaim,
} from '../src/lib/admin-mutations.mjs';
import { hashPassword, verifyPassword } from '../src/lib/auth/password.mjs';

const NOW = new Date('2026-07-17T21:00:00.000Z');
const REQUESTED_PASSWORD = 'StrongClaim!2026';
const REQUESTED_PASSWORD_HASH = await hashPassword(REQUESTED_PASSWORD);

function createFakeDb(initialState, { failAudit = false } = {}) {
  let store = structuredClone({
    retailers: [],
    evidence: [],
    claims: [],
    users: [],
    audits: [],
    ...initialState,
  });

  function delegateFor(draft) {
    return {
      claimRequest: {
        async findUnique({ where }) {
          const claim = draft.claims.find((item) => item.id === where.id);
          if (!claim) return null;
          const retailer = draft.retailers.find(
            (item) => item.id === claim.retailerId,
          );
          const evidence = draft.evidence.filter(
            (item) =>
              item.retailerId === retailer.id &&
              item.verificationStatus === 'APPROVED' &&
              item.dataStatus === 'VERIFIED_CURRENT' &&
              item.isDemonstration === false &&
              item.verifiedAt !== null &&
              new Date(item.freshnessExpiresAt) > NOW,
          );
          return {
            ...structuredClone(claim),
            retailer: {
              ...structuredClone(retailer),
              evidence: structuredClone(evidence.slice(0, 1)),
            },
          };
        },
        async updateMany({ where, data }) {
          const matches = draft.claims.filter(
            (item) =>
              item.id === where.id &&
              (where.status === undefined || item.status === where.status),
          );
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
        },
      },
      user: {
        async findUnique({ where }) {
          return draft.users.find((item) => item.email === where.email) ?? null;
        },
        async create({ data }) {
          if (draft.users.some((item) => item.email === data.email)) {
            throw Object.assign(new Error('Unique constraint failed.'), {
              code: 'P2002',
            });
          }
          const user = { id: 'manager-new', ...data };
          draft.users.push(user);
          return user;
        },
      },
      auditLog: {
        async create({ data }) {
          if (failAudit) throw new Error('Injected audit failure.');
          const audit = { id: `audit-${draft.audits.length + 1}`, ...data };
          draft.audits.push(audit);
          return audit;
        },
      },
    };
  }

  return {
    async $transaction(callback) {
      const draft = structuredClone(store);
      const result = await callback(delegateFor(draft));
      store = draft;
      return result;
    },
    snapshot() {
      return structuredClone(store);
    },
  };
}

function currentRetailer(overrides = {}) {
  return {
    id: 'retailer-one',
    name: 'Approved Retailer',
    isDemonstration: false,
    dataStatus: 'VERIFIED_CURRENT',
    verifiedAt: new Date('2026-07-17T20:00:00.000Z'),
    freshnessExpiresAt: new Date('2026-08-16T20:00:00.000Z'),
    ...overrides,
  };
}

function currentEvidence(overrides = {}) {
  return {
    id: 'evidence-one',
    retailerId: 'retailer-one',
    verificationStatus: 'APPROVED',
    dataStatus: 'VERIFIED_CURRENT',
    isDemonstration: false,
    verifiedAt: new Date('2026-07-17T20:00:00.000Z'),
    freshnessExpiresAt: new Date('2026-08-16T20:00:00.000Z'),
    ...overrides,
  };
}

function pendingClaim(overrides = {}) {
  return {
    id: 'claim-one',
    retailerId: 'retailer-one',
    email: 'owner@example.com',
    phone: '202-555-0100',
    requestedPasswordHash: REQUESTED_PASSWORD_HASH,
    status: 'PENDING',
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

test('approved evidence gates atomic manager-account creation', async () => {
  const db = createFakeDb({
    retailers: [currentRetailer()],
    evidence: [currentEvidence()],
    claims: [pendingClaim()],
  });

  const result = await resolveRetailerClaim(db, {
    claimId: 'claim-one',
    actorUserId: 'admin-one',
    decision: 'APPROVE',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'APPROVED');
  assert.equal(state.claims[0].status, 'APPROVED');
  assert.equal(state.claims[0].requestedPasswordHash, null);
  assert.deepEqual(state.claims[0].reviewedAt, NOW);
  assert.equal(state.claims[0].reviewedBy, 'admin-one');
  assert.equal(state.users.length, 1);
  assert.equal(state.users[0].email, 'owner@example.com');
  assert.equal(state.users[0].role, 'RETAILER_MANAGER');
  assert.equal(state.users[0].managedRetailerId, 'retailer-one');
  assert.equal(
    await verifyPassword(REQUESTED_PASSWORD, state.users[0].password),
    true,
  );
  assert.deepEqual(state.audits[0], {
    id: 'audit-1',
    userId: 'admin-one',
    action: 'APPROVE_RETAILER_CLAIM',
    details:
      'claimId=claim-one retailerId=retailer-one managerId=manager-new',
  });
  assert.doesNotMatch(
    state.audits[0].details,
    /owner@example|StrongClaim|scrypt/,
  );
});

test('unverified retailer claims remain pending and cannot create managers', async () => {
  const db = createFakeDb({
    retailers: [
      currentRetailer({
        dataStatus: 'AWAITING_VERIFICATION',
        verifiedAt: null,
        freshnessExpiresAt: null,
      }),
    ],
    evidence: [
      currentEvidence({
        verificationStatus: 'PENDING',
        dataStatus: 'AWAITING_VERIFICATION',
        verifiedAt: null,
        freshnessExpiresAt: null,
      }),
    ],
    claims: [pendingClaim()],
  });

  const result = await resolveRetailerClaim(db, {
    claimId: 'claim-one',
    actorUserId: 'admin-one',
    decision: 'APPROVE',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'BLOCKED_UNVERIFIED_RETAILER');
  assert.equal(state.claims[0].status, 'PENDING');
  assert.equal(state.users.length, 0);
  assert.equal(state.audits[0].action, 'BLOCK_UNVERIFIED_RETAILER_CLAIM');
});

test('claim rejection clears the stored credential hash', async () => {
  const db = createFakeDb({
    retailers: [currentRetailer()],
    evidence: [currentEvidence()],
    claims: [pendingClaim()],
  });

  const result = await resolveRetailerClaim(db, {
    claimId: 'claim-one',
    actorUserId: 'admin-one',
    decision: 'REJECT',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(state.claims[0].status, 'REJECTED');
  assert.equal(state.claims[0].requestedPasswordHash, null);
  assert.equal(state.users.length, 0);
  assert.equal(state.audits[0].action, 'REJECT_RETAILER_CLAIM');
});

test('plaintext legacy claim credentials are blocked before account creation', async () => {
  const db = createFakeDb({
    retailers: [currentRetailer()],
    evidence: [currentEvidence()],
    claims: [pendingClaim({ requestedPasswordHash: 'plaintext-password' })],
  });

  const result = await resolveRetailerClaim(db, {
    claimId: 'claim-one',
    actorUserId: 'admin-one',
    decision: 'APPROVE',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'BLOCKED_INVALID_CREDENTIAL');
  assert.equal(state.claims[0].status, 'PENDING');
  assert.equal(state.users.length, 0);
  assert.equal(state.audits[0].action, 'BLOCK_INVALID_CLAIM_CREDENTIAL');
});

test('existing account conflicts are blocked without changing the claim', async () => {
  const db = createFakeDb({
    retailers: [currentRetailer()],
    evidence: [currentEvidence()],
    claims: [pendingClaim()],
    users: [{ id: 'existing-user', email: 'owner@example.com' }],
  });

  const result = await resolveRetailerClaim(db, {
    claimId: 'claim-one',
    actorUserId: 'admin-one',
    decision: 'APPROVE',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'BLOCKED_ACCOUNT_CONFLICT');
  assert.equal(state.claims[0].status, 'PENDING');
  assert.equal(state.users.length, 1);
  assert.equal(state.audits[0].action, 'BLOCK_CLAIM_ACCOUNT_CONFLICT');
});

test('claim approval rolls back account and claim if audit persistence fails', async () => {
  const db = createFakeDb(
    {
      retailers: [currentRetailer()],
      evidence: [currentEvidence()],
      claims: [pendingClaim()],
    },
    { failAudit: true },
  );
  const before = db.snapshot();

  await assert.rejects(
    resolveRetailerClaim(db, {
      claimId: 'claim-one',
      actorUserId: 'admin-one',
      decision: 'APPROVE',
      now: NOW,
    }),
    /Injected audit failure/,
  );
  assert.deepEqual(db.snapshot(), before);
});

test('review replay is rejected deterministically', async () => {
  const db = createFakeDb({
    retailers: [currentRetailer()],
    evidence: [currentEvidence()],
    claims: [pendingClaim({ status: 'APPROVED' })],
  });

  await assert.rejects(
    resolveRetailerClaim(db, {
      claimId: 'claim-one',
      actorUserId: 'admin-one',
      decision: 'APPROVE',
      now: NOW,
    }),
    (error) =>
      error instanceof AdminMutationError &&
      error.code === 'CLAIM_ALREADY_REVIEWED',
  );
});
