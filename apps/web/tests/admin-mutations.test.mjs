import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdminMutationError,
  approveLicenseEvidence,
  rejectLicenseEvidence,
  refreshRetailerVerification,
  resolveCorrectionDispute,
} from '../src/lib/admin-mutations.mjs';
import {
  AdminValidationError,
  validateAdminIdentifier,
  validateDisputeDecision,
} from '../src/lib/admin-validation.mjs';

const NOW = new Date('2026-07-17T18:30:00.000Z');
const EXPIRES_AT = new Date('2026-08-16T18:30:00.000Z');

function createFakeDb(initialState, { failAudit = false } = {}) {
  let store = structuredClone({
    retailers: [],
    evidence: [],
    claims: [],
    disputes: [],
    audits: [],
    ...initialState,
  });
  let transactionCount = 0;

  function delegateFor(draft) {
    return {
      licenseEvidence: {
        async findUnique({ where }) {
          const evidence = draft.evidence.find((item) => item.id === where.id);
          if (!evidence) return null;
          const retailer = draft.retailers.find(
            (item) => item.id === evidence.retailerId,
          );
          return { ...evidence, retailer: structuredClone(retailer) };
        },
        async updateMany({ where, data }) {
          const matches = draft.evidence.filter(
            (item) =>
              item.id === where.id &&
              (where.retailerId === undefined ||
                item.retailerId === where.retailerId) &&
              (where.verificationStatus === undefined ||
                item.verificationStatus === where.verificationStatus) &&
              (where.isDemonstration === undefined ||
                item.isDemonstration === where.isDemonstration),
          );
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
        },
      },
      retailer: {
        async findUnique({ where, include }) {
          const retailer = draft.retailers.find((item) => item.id === where.id);
          if (!retailer) return null;
          if (!include?.evidence) return structuredClone(retailer);

          const approvedEvidence = draft.evidence
            .filter(
              (item) =>
                item.retailerId === retailer.id &&
                item.verificationStatus === 'APPROVED' &&
                item.isDemonstration === false,
            )
            .sort(
              (left, right) =>
                new Date(right.verifiedAt ?? right.submittedAt).getTime() -
                new Date(left.verifiedAt ?? left.submittedAt).getTime(),
            )
            .slice(0, 1);
          return {
            ...structuredClone(retailer),
            evidence: structuredClone(approvedEvidence),
          };
        },
        async update({ where, data }) {
          const target = draft.retailers.find((item) => item.id === where.id);
          if (!target) throw new Error('Retailer update target missing.');
          Object.assign(target, data);
          return target;
        },
      },
      claimRequest: {
        async updateMany({ where, data }) {
          const matches = draft.claims.filter(
            (item) =>
              (where.retailerId === undefined ||
                item.retailerId === where.retailerId) &&
              (where.status === undefined || item.status === where.status),
          );
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
        },
      },
      dispute: {
        async findUnique({ where }) {
          const dispute = draft.disputes.find((item) => item.id === where.id);
          if (!dispute) return null;
          const retailer = draft.retailers.find(
            (item) => item.id === dispute.retailerId,
          );
          return { ...dispute, retailer: structuredClone(retailer) };
        },
        async updateMany({ where, data }) {
          const matches = draft.disputes.filter(
            (item) =>
              item.id === where.id &&
              (where.status === undefined || item.status === where.status),
          );
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
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
      transactionCount += 1;
      const draft = structuredClone(store);
      const result = await callback(delegateFor(draft));
      store = draft;
      return result;
    },
    snapshot() {
      return structuredClone(store);
    },
    get transactionCount() {
      return transactionCount;
    },
  };
}

function verifiedEvidence(overrides = {}) {
  return {
    id: 'evidence-one',
    retailerId: 'retailer-one',
    documentUrl: 'https://evidence.example/license',
    verificationStatus: 'APPROVED',
    submittedAt: new Date('2026-07-01T00:00:00.000Z'),
    verifiedAt: new Date('2026-07-02T00:00:00.000Z'),
    dataStatus: 'VERIFIED_CURRENT',
    dataSource: 'Public license registry',
    sourceUrl: 'https://registry.example/license',
    retrievedAt: new Date('2026-07-01T00:00:00.000Z'),
    freshnessExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
    confidence: 0.95,
    reviewedBy: 'admin-old',
    isDemonstration: false,
    ...overrides,
  };
}

function correctionDispute(overrides = {}) {
  return {
    id: 'dispute-one',
    retailerId: 'retailer-one',
    fieldName: 'address',
    newValue: '200 Corrected Avenue NW',
    evidenceUrl: 'https://evidence.example/correction',
    status: 'PENDING',
    ...overrides,
  };
}

test('administrator mutation identifiers and decisions are strictly validated', () => {
  assert.equal(validateAdminIdentifier(' evidence-one ', 'Evidence ID'), 'evidence-one');
  assert.equal(validateDisputeDecision('APPROVE'), 'APPROVE');
  assert.equal(validateDisputeDecision('REJECT'), 'REJECT');

  for (const invalid of [null, '', '../evidence', 'evidence one', 'x'.repeat(65)]) {
    assert.throws(
      () => validateAdminIdentifier(invalid, 'Evidence ID'),
      AdminValidationError,
    );
  }
  for (const invalid of [null, '', 'approve', 'DELETE']) {
    assert.throws(() => validateDisputeDecision(invalid), AdminValidationError);
  }
});

test('license approval commits evidence, retailer truth state, actor, and audit atomically', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-one',
        isDemonstration: false,
        licenseStatus: 'PENDING',
        dataStatus: 'AWAITING_VERIFICATION',
      },
    ],
    evidence: [
      verifiedEvidence({
        verificationStatus: 'PENDING',
        dataStatus: 'AWAITING_VERIFICATION',
        verifiedAt: null,
        freshnessExpiresAt: null,
        reviewedBy: null,
      }),
    ],
  });

  const result = await approveLicenseEvidence(db, {
    evidenceId: 'evidence-one',
    actorUserId: 'admin-one',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(db.transactionCount, 1);
  assert.equal(result.outcome, 'APPROVED');
  assert.equal(state.evidence[0].verificationStatus, 'APPROVED');
  assert.equal(state.evidence[0].reviewedBy, 'admin-one');
  assert.deepEqual(state.evidence[0].freshnessExpiresAt, EXPIRES_AT);
  assert.equal(state.retailers[0].licenseStatus, 'VERIFIED');
  assert.equal(state.retailers[0].dataStatus, 'VERIFIED_CURRENT');
  assert.deepEqual(state.retailers[0].freshnessExpiresAt, EXPIRES_AT);
  assert.equal(state.retailers[0].reviewedBy, 'admin-one');
  assert.deepEqual(state.audits[0], {
    id: 'audit-1',
    userId: 'admin-one',
    action: 'APPROVE_RETAILER_LICENSE',
    details: 'evidenceId=evidence-one retailerId=retailer-one',
  });
});

test('license approval rolls back every write if its audit record fails', async () => {
  const db = createFakeDb(
    {
      retailers: [
        {
          id: 'retailer-one',
          isDemonstration: false,
          licenseStatus: 'PENDING',
        },
      ],
      evidence: [
        verifiedEvidence({
          verificationStatus: 'PENDING',
          verifiedAt: null,
        }),
      ],
    },
    { failAudit: true },
  );
  const before = db.snapshot();

  await assert.rejects(
    approveLicenseEvidence(db, {
      evidenceId: 'evidence-one',
      actorUserId: 'admin-one',
      now: NOW,
    }),
    /Injected audit failure/,
  );
  assert.deepEqual(db.snapshot(), before);
});

test('license rejection clears linked claim credentials and audits only identifiers', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-one',
        isDemonstration: false,
        licenseStatus: 'PENDING',
        dataStatus: 'AWAITING_VERIFICATION',
      },
    ],
    evidence: [
      verifiedEvidence({
        verificationStatus: 'PENDING',
        dataStatus: 'AWAITING_VERIFICATION',
        verifiedAt: null,
        freshnessExpiresAt: null,
        reviewedBy: null,
      }),
    ],
    claims: [
      {
        id: 'claim-one',
        retailerId: 'retailer-one',
        status: 'PENDING',
        requestedPasswordHash: 'scrypt$private-claim-hash',
        reviewedAt: null,
        reviewedBy: null,
      },
    ],
  });

  const result = await rejectLicenseEvidence(db, {
    evidenceId: 'evidence-one',
    actorUserId: 'admin-one',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'REJECTED');
  assert.equal(result.claimsRejected, 1);
  assert.equal(state.evidence[0].verificationStatus, 'REJECTED');
  assert.equal(state.evidence[0].dataStatus, 'DISPUTED');
  assert.equal(state.evidence[0].reviewedBy, 'admin-one');
  assert.equal(state.claims[0].status, 'REJECTED');
  assert.equal(state.claims[0].requestedPasswordHash, null);
  assert.deepEqual(state.claims[0].reviewedAt, NOW);
  assert.equal(state.claims[0].reviewedBy, 'admin-one');
  assert.equal(state.retailers[0].dataStatus, 'AWAITING_VERIFICATION');
  assert.deepEqual(state.audits[0], {
    id: 'audit-1',
    userId: 'admin-one',
    action: 'REJECT_RETAILER_LICENSE_EVIDENCE',
    details:
      'evidenceId=evidence-one retailerId=retailer-one claimsRejected=1',
  });
  assert.doesNotMatch(state.audits[0].details, /private|scrypt/);
});

test('license rejection cannot be replayed', async () => {
  const db = createFakeDb({
    retailers: [{ id: 'retailer-one', isDemonstration: true }],
    evidence: [
      verifiedEvidence({
        verificationStatus: 'PENDING',
        isDemonstration: true,
      }),
    ],
  });

  await rejectLicenseEvidence(db, {
    evidenceId: 'evidence-one',
    actorUserId: 'admin-one',
    now: NOW,
  });
  await assert.rejects(
    rejectLicenseEvidence(db, {
      evidenceId: 'evidence-one',
      actorUserId: 'admin-one',
      now: NOW,
    }),
    (error) =>
      error instanceof AdminMutationError &&
      error.code === 'EVIDENCE_ALREADY_REVIEWED',
  );

  const state = db.snapshot();
  assert.equal(state.evidence[0].verificationStatus, 'REJECTED');
  assert.equal(state.evidence[0].dataStatus, 'DEMONSTRATION_ONLY');
  assert.equal(state.audits.length, 1);
});

test('license rejection rolls back evidence and claims if audit persistence fails', async () => {
  const db = createFakeDb(
    {
      retailers: [{ id: 'retailer-one', isDemonstration: false }],
      evidence: [
        verifiedEvidence({
          verificationStatus: 'PENDING',
          verifiedAt: null,
        }),
      ],
      claims: [
        {
          id: 'claim-one',
          retailerId: 'retailer-one',
          status: 'PENDING',
          requestedPasswordHash: 'scrypt$private-claim-hash',
        },
      ],
    },
    { failAudit: true },
  );
  const before = db.snapshot();

  await assert.rejects(
    rejectLicenseEvidence(db, {
      evidenceId: 'evidence-one',
      actorUserId: 'admin-one',
      now: NOW,
    }),
    /Injected audit failure/,
  );
  assert.deepEqual(db.snapshot(), before);
});

test('demonstration evidence is locally blocked without changing truth state', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-one',
        isDemonstration: true,
        licenseStatus: 'PENDING',
      },
    ],
    evidence: [
      verifiedEvidence({
        verificationStatus: 'PENDING',
        isDemonstration: true,
      }),
    ],
  });

  const result = await approveLicenseEvidence(db, {
    evidenceId: 'evidence-one',
    actorUserId: 'admin-one',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'BLOCKED_DEMONSTRATION');
  assert.equal(state.evidence[0].verificationStatus, 'PENDING');
  assert.equal(state.retailers[0].licenseStatus, 'PENDING');
  assert.equal(state.audits[0].action, 'BLOCK_DEMONSTRATION_LICENSE_APPROVAL');
  assert.equal(state.audits[0].userId, 'admin-one');
});

test('verification refresh advances evidence and retailer together from approved evidence', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-one',
        isDemonstration: false,
        dataStatus: 'STALE',
        licenseStatus: 'EXPIRED',
      },
    ],
    evidence: [verifiedEvidence({ dataStatus: 'STALE' })],
  });

  const result = await refreshRetailerVerification(db, {
    retailerId: 'retailer-one',
    actorUserId: 'admin-one',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'REFRESHED');
  assert.equal(state.evidence[0].dataStatus, 'VERIFIED_CURRENT');
  assert.deepEqual(state.evidence[0].verifiedAt, NOW);
  assert.deepEqual(state.evidence[0].freshnessExpiresAt, EXPIRES_AT);
  assert.equal(state.retailers[0].licenseStatus, 'VERIFIED');
  assert.equal(state.retailers[0].dataSource, 'Public license registry');
  assert.equal(state.retailers[0].sourceUrl, 'https://registry.example/license');
  assert.deepEqual(state.retailers[0].freshnessExpiresAt, EXPIRES_AT);
  assert.deepEqual(state.audits[0], {
    id: 'audit-1',
    userId: 'admin-one',
    action: 'MARK_INFO_FRESH',
    details: 'evidenceId=evidence-one retailerId=retailer-one',
  });
});

test('unsupported legacy correction fields remain pending and are audited without payload data', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-one',
        isDemonstration: false,
        address: '100 Original Avenue',
      },
    ],
    disputes: [
      correctionDispute({
        fieldName: 'internalSecret',
        newValue: 'private submitted payload',
      }),
    ],
  });

  const result = await resolveCorrectionDispute(db, {
    disputeId: 'dispute-one',
    actorUserId: 'admin-one',
    decision: 'APPROVE',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(result.outcome, 'BLOCKED_UNSUPPORTED_FIELD');
  assert.equal(state.disputes[0].status, 'PENDING');
  assert.equal(state.retailers[0].address, '100 Original Avenue');
  assert.equal(state.audits[0].action, 'RESOLVE_DISPUTE_BLOCKED');
  assert.doesNotMatch(state.audits[0].details, /internalSecret|private|payload/);
});

test('approved corrections reset verification provenance and keep submitted values out of logs', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-one',
        isDemonstration: false,
        address: '100 Original Avenue',
        dataStatus: 'VERIFIED_CURRENT',
        dataSource: 'Prior registry',
        sourceUrl: 'https://registry.example/old',
        verifiedAt: new Date('2026-07-01T00:00:00.000Z'),
        freshnessExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
        confidence: 0.99,
        reviewedBy: 'admin-old',
      },
    ],
    disputes: [correctionDispute()],
  });

  await resolveCorrectionDispute(db, {
    disputeId: 'dispute-one',
    actorUserId: 'admin-one',
    decision: 'APPROVE',
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(state.disputes[0].status, 'RESOLVED');
  assert.equal(state.retailers[0].address, '200 Corrected Avenue NW');
  assert.equal(state.retailers[0].dataStatus, 'AWAITING_VERIFICATION');
  assert.equal(
    state.retailers[0].dataSource,
    'Approved correction awaiting verification',
  );
  assert.equal(state.retailers[0].sourceUrl, 'https://evidence.example/correction');
  assert.deepEqual(state.retailers[0].retrievedAt, NOW);
  assert.equal(state.retailers[0].verifiedAt, null);
  assert.equal(state.retailers[0].freshnessExpiresAt, null);
  assert.equal(state.retailers[0].confidence, null);
  assert.equal(state.retailers[0].reviewedBy, null);
  assert.deepEqual(state.audits[0], {
    id: 'audit-1',
    userId: 'admin-one',
    action: 'RESOLVE_DISPUTE_APPROVED',
    details: 'disputeId=dispute-one retailerId=retailer-one',
  });
  assert.doesNotMatch(state.audits[0].details, /Corrected|Avenue|evidence\.example/);
});

test('disputes reject deterministically and cannot be replayed', async () => {
  const db = createFakeDb({
    retailers: [{ id: 'retailer-one', isDemonstration: false }],
    disputes: [correctionDispute()],
  });

  await resolveCorrectionDispute(db, {
    disputeId: 'dispute-one',
    actorUserId: 'admin-one',
    decision: 'REJECT',
    now: NOW,
  });
  await assert.rejects(
    resolveCorrectionDispute(db, {
      disputeId: 'dispute-one',
      actorUserId: 'admin-one',
      decision: 'REJECT',
      now: NOW,
    }),
    (error) =>
      error instanceof AdminMutationError &&
      error.code === 'DISPUTE_ALREADY_REVIEWED',
  );

  const state = db.snapshot();
  assert.equal(state.disputes[0].status, 'REJECTED');
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, 'RESOLVE_DISPUTE_REJECTED');
});

test('correction approval rolls back dispute and retailer if audit evidence fails', async () => {
  const db = createFakeDb(
    {
      retailers: [
        {
          id: 'retailer-one',
          isDemonstration: false,
          address: '100 Original Avenue',
        },
      ],
      disputes: [correctionDispute()],
    },
    { failAudit: true },
  );
  const before = db.snapshot();

  await assert.rejects(
    resolveCorrectionDispute(db, {
      disputeId: 'dispute-one',
      actorUserId: 'admin-one',
      decision: 'APPROVE',
      now: NOW,
    }),
    /Injected audit failure/,
  );
  assert.deepEqual(db.snapshot(), before);
});
