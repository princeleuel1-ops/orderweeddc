import { PrismaClient } from '@prisma/client';
import { resolveCorrectionDispute } from '../src/lib/admin-mutations.mjs';

const prisma = new PrismaClient();
const NEW_ADDRESS = '101 Demo Avenue NW';

async function runDisputeTest() {
  console.log('RUNNING CORRECTION DISPUTE MUTATION INTEGRATION TESTS...\n');

  let originalRetailer = null;
  let disputeId = null;

  try {
    const [retailer, admin] = await Promise.all([
      prisma.retailer.findFirst({
        where: { isDemonstration: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findFirst({
        where: { role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!retailer) {
      throw new Error('Test baseline failure: demonstration retailer not found.');
    }
    if (!admin) {
      throw new Error('Test baseline failure: administrator account not found.');
    }
    originalRetailer = retailer;

    const dispute = await prisma.dispute.create({
      data: {
        retailerId: retailer.id,
        filedBy: 'integration-test@example.invalid',
        fieldName: 'address',
        oldValue: retailer.address,
        newValue: NEW_ADDRESS,
        evidenceUrl: 'https://evidence.example.invalid/correction',
        reason: 'Disposable administrator mutation integration test.',
        status: 'PENDING',
      },
    });
    disputeId = dispute.id;

    const result = await resolveCorrectionDispute(prisma, {
      disputeId,
      actorUserId: admin.id,
      decision: 'APPROVE',
      now: new Date('2026-07-17T19:00:00.000Z'),
    });

    const [resolvedDispute, updatedRetailer, audit] = await Promise.all([
      prisma.dispute.findUnique({ where: { id: disputeId } }),
      prisma.retailer.findUnique({ where: { id: retailer.id } }),
      prisma.auditLog.findFirst({
        where: {
          userId: admin.id,
          action: 'RESOLVE_DISPUTE_APPROVED',
          details: { contains: disputeId },
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    if (result.outcome !== 'APPROVED' || resolvedDispute?.status !== 'RESOLVED') {
      throw new Error('Assertion failed: dispute was not atomically resolved.');
    }
    if (updatedRetailer?.address !== NEW_ADDRESS) {
      throw new Error('Assertion failed: approved correction was not applied.');
    }
    if (updatedRetailer.dataStatus !== 'DEMONSTRATION_ONLY') {
      throw new Error('Assertion failed: demonstration truth label was not preserved.');
    }
    if (
      updatedRetailer.verifiedAt !== null ||
      updatedRetailer.freshnessExpiresAt !== null ||
      updatedRetailer.reviewedBy !== null
    ) {
      throw new Error('Assertion failed: correction retained stale verification claims.');
    }
    if (!audit || audit.details.includes(NEW_ADDRESS)) {
      throw new Error('Assertion failed: minimal administrator audit was not recorded.');
    }

    console.log('PASS: actual administrator mutation resolved the dispute.');
    console.log('PASS: correction value and demonstration truth state were persisted.');
    console.log('PASS: prior verification provenance was cleared.');
    console.log('PASS: actor-linked audit contains identifiers only.');
  } finally {
    if (originalRetailer) {
      await prisma.retailer.update({
        where: { id: originalRetailer.id },
        data: {
          address: originalRetailer.address,
          dataStatus: originalRetailer.dataStatus,
          dataSource: originalRetailer.dataSource,
          sourceUrl: originalRetailer.sourceUrl,
          retrievedAt: originalRetailer.retrievedAt,
          verifiedAt: originalRetailer.verifiedAt,
          freshnessExpiresAt: originalRetailer.freshnessExpiresAt,
          confidence: originalRetailer.confidence,
          reviewedBy: originalRetailer.reviewedBy,
          lastInfoCheck: originalRetailer.lastInfoCheck,
        },
      });
    }
    if (disputeId) {
      await prisma.auditLog.deleteMany({
        where: { details: { contains: disputeId } },
      });
      await prisma.dispute.deleteMany({
        where: { id: disputeId },
      });
    }
    await prisma.$disconnect();
  }
}

runDisputeTest().catch((error) => {
  console.error('DISPUTE MUTATION INTEGRATION TEST FAILED:', error.message);
  process.exitCode = 1;
});
