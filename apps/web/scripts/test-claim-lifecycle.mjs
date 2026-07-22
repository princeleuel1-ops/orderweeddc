import { PrismaClient } from '@prisma/client';
import {
  approveLicenseEvidence,
  rejectLicenseEvidence,
  resolveRetailerClaim,
} from '../src/lib/admin-mutations.mjs';
import {
  hashPassword,
  verifyPassword,
} from '../src/lib/auth/password.mjs';
import { publicRetailerWhere } from '../src/lib/public-retailer.mjs';

const prisma = new PrismaClient();
const PASSWORD = 'DisposableClaim!2026';
const EMAIL = 'disposable-claim@example.invalid';
const REJECTED_EMAIL = 'disposable-rejected-claim@example.invalid';
const NOW = new Date('2026-07-17T22:00:00.000Z');

async function run() {
  console.log('RUNNING DISPOSABLE BUSINESS CLAIM LIFECYCLE TEST...\n');

  const baseline = {
    retailers: await prisma.retailer.count(),
    claims: await prisma.claimRequest.count(),
    users: await prisma.user.count(),
  };
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('Administrator test prerequisite is missing.');

  let retailerId = null;
  let rejectedRetailerId = null;

  try {
    const requestedPasswordHash = await hashPassword(PASSWORD);
    const created = await prisma.$transaction(async (transaction) => {
      const retailer = await transaction.retailer.create({
        data: {
          name: 'Disposable Claim Retailer',
          type: 'storefront',
          address: '999 Disposable Test Avenue NW',
          city: 'Washington',
          state: 'DC',
          zip: '20001',
          lat: 38.9072,
          lng: -77.0369,
          email: EMAIL,
          phone: '202-555-0198',
          hours: 'Not submitted',
          hoursSource: 'Disposable integration test',
          licenseStatus: 'PENDING',
          licenseSource: 'Disposable integration evidence',
          licenseNumber: 'DISPOSABLE-CLAIM-2026',
          dataStatus: 'AWAITING_VERIFICATION',
          dataSource: 'Disposable claim integration test',
          isDemonstration: false,
        },
      });
      const evidence = await transaction.licenseEvidence.create({
        data: {
          retailerId: retailer.id,
          documentUrl: 'https://evidence.example.invalid/disposable-license.pdf',
          verificationStatus: 'PENDING',
          dataStatus: 'AWAITING_VERIFICATION',
          dataSource: 'Disposable public evidence fixture',
          sourceUrl: 'https://evidence.example.invalid/disposable-license.pdf',
          isDemonstration: false,
        },
      });
      const claim = await transaction.claimRequest.create({
        data: {
          retailerId: retailer.id,
          email: EMAIL,
          phone: '202-555-0198',
          requestedPasswordHash,
          status: 'PENDING',
        },
      });
      return { retailer, evidence, claim };
    });
    retailerId = created.retailer.id;
    const privateBeforeReview = await prisma.retailer.count({
      where: {
        id: retailerId,
        ...publicRetailerWhere(NOW),
      },
    });
    if (privateBeforeReview !== 0) {
      throw new Error('An unreviewed claim became publicly discoverable.');
    }

    await approveLicenseEvidence(prisma, {
      evidenceId: created.evidence.id,
      actorUserId: admin.id,
      now: NOW,
    });
    const approval = await resolveRetailerClaim(prisma, {
      claimId: created.claim.id,
      actorUserId: admin.id,
      decision: 'APPROVE',
      now: new Date('2026-07-17T22:01:00.000Z'),
    });

    const [claim, manager, retailer] = await Promise.all([
      prisma.claimRequest.findUnique({ where: { id: created.claim.id } }),
      prisma.user.findUnique({ where: { email: EMAIL } }),
      prisma.retailer.findUnique({ where: { id: retailerId } }),
    ]);

    if (approval.outcome !== 'APPROVED') {
      throw new Error(`Claim approval returned ${approval.outcome}.`);
    }
    if (!claim || claim.status !== 'APPROVED' || claim.requestedPasswordHash !== null) {
      throw new Error('Approved claim did not clear its one-time password hash.');
    }
    if (
      !manager ||
      manager.role !== 'RETAILER_MANAGER' ||
      manager.managedRetailerId !== retailerId
    ) {
      throw new Error('Retailer manager account was not linked correctly.');
    }
    if (!(await verifyPassword(PASSWORD, manager.password))) {
      throw new Error('Approved manager password hash did not verify.');
    }
    if (
      !retailer ||
      retailer.dataStatus !== 'VERIFIED_CURRENT' ||
      retailer.licenseStatus !== 'VERIFIED'
    ) {
      throw new Error('Evidence approval did not establish current retailer truth state.');
    }
    const publicAfterReview = await prisma.retailer.count({
      where: {
        id: retailerId,
        ...publicRetailerWhere(new Date('2026-07-17T22:02:00.000Z')),
      },
    });
    if (publicAfterReview !== 1) {
      throw new Error('Approved evidence did not cross the discovery boundary.');
    }

    const rejectedPasswordHash = await hashPassword(PASSWORD);
    const rejected = await prisma.$transaction(async (transaction) => {
      const retailerRecord = await transaction.retailer.create({
        data: {
          name: 'Disposable Rejected Claim Retailer',
          type: 'storefront',
          address: '998 Disposable Test Avenue NW',
          city: 'Washington',
          state: 'DC',
          zip: '20001',
          lat: 38.9073,
          lng: -77.0368,
          email: REJECTED_EMAIL,
          phone: '202-555-0197',
          hours: 'Not submitted',
          hoursSource: 'Disposable integration test',
          licenseStatus: 'PENDING',
          licenseSource: 'Disposable integration evidence',
          licenseNumber: 'DISPOSABLE-REJECTED-2026',
          dataStatus: 'AWAITING_VERIFICATION',
          dataSource: 'Disposable claim integration test',
          isDemonstration: false,
        },
      });
      const evidenceRecord = await transaction.licenseEvidence.create({
        data: {
          retailerId: retailerRecord.id,
          documentUrl:
            'https://evidence.example.invalid/rejected-license.pdf',
          verificationStatus: 'PENDING',
          dataStatus: 'AWAITING_VERIFICATION',
          dataSource: 'Disposable rejected evidence fixture',
          sourceUrl:
            'https://evidence.example.invalid/rejected-license.pdf',
          isDemonstration: false,
        },
      });
      const claimRecord = await transaction.claimRequest.create({
        data: {
          retailerId: retailerRecord.id,
          email: REJECTED_EMAIL,
          phone: '202-555-0197',
          requestedPasswordHash: rejectedPasswordHash,
          status: 'PENDING',
        },
      });
      return {
        retailer: retailerRecord,
        evidence: evidenceRecord,
        claim: claimRecord,
      };
    });
    rejectedRetailerId = rejected.retailer.id;
    const rejection = await rejectLicenseEvidence(prisma, {
      evidenceId: rejected.evidence.id,
      actorUserId: admin.id,
      now: new Date('2026-07-17T22:03:00.000Z'),
    });
    const [rejectedEvidence, rejectedClaim, rejectedManager] =
      await Promise.all([
        prisma.licenseEvidence.findUnique({
          where: { id: rejected.evidence.id },
        }),
        prisma.claimRequest.findUnique({
          where: { id: rejected.claim.id },
        }),
        prisma.user.findUnique({ where: { email: REJECTED_EMAIL } }),
      ]);
    const rejectedPublicCount = await prisma.retailer.count({
      where: {
        id: rejectedRetailerId,
        ...publicRetailerWhere(new Date('2026-07-17T22:04:00.000Z')),
      },
    });
    if (
      rejection.outcome !== 'REJECTED' ||
      rejection.claimsRejected !== 1 ||
      rejectedEvidence?.verificationStatus !== 'REJECTED' ||
      rejectedClaim?.status !== 'REJECTED' ||
      rejectedClaim.requestedPasswordHash !== null ||
      rejectedManager !== null ||
      rejectedPublicCount !== 0
    ) {
      throw new Error('Rejected evidence did not close the claim safely.');
    }

    console.log('PASS: unreviewed claims remain outside public discovery.');
    console.log('PASS: evidence approval established current truth state.');
    console.log('PASS: approved evidence crossed the public discovery boundary.');
    console.log('PASS: claim approval atomically created the scoped manager.');
    console.log('PASS: one-time claim credential hash was erased.');
    console.log('PASS: approved manager password verifies through the login hash contract.');
    console.log('PASS: rejected evidence erased its claim hash and stayed private.');
  } finally {
    const manager = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (manager) {
      await prisma.session.deleteMany({ where: { userId: manager.id } });
    }
    for (const disposableRetailerId of [retailerId, rejectedRetailerId]) {
      if (!disposableRetailerId) continue;
      await prisma.auditLog.deleteMany({
        where: { details: { contains: disposableRetailerId } },
      });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [EMAIL, REJECTED_EMAIL] } },
    });
    const disposableRetailerIds = [retailerId, rejectedRetailerId].filter(
      Boolean,
    );
    if (disposableRetailerIds.length > 0) {
      await prisma.retailer.deleteMany({
        where: { id: { in: disposableRetailerIds } },
      });
    }

    const after = {
      retailers: await prisma.retailer.count(),
      claims: await prisma.claimRequest.count(),
      users: await prisma.user.count(),
    };
    if (JSON.stringify(after) !== JSON.stringify(baseline)) {
      throw new Error(
        `Disposable cleanup mismatch: baseline=${JSON.stringify(baseline)} after=${JSON.stringify(after)}`,
      );
    }
    console.log('PASS: disposable records and sessions were fully removed.');
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  console.error('CLAIM LIFECYCLE INTEGRATION TEST FAILED:', error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});
