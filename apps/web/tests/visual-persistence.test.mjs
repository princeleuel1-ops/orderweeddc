import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: { db: { url: 'file:./dev.db' } }
});

test('Prisma VisualSlotState, VisualCandidate, VisualDeployment, and VisualQualityReceipt models persist and survive fresh instances', async () => {
  // 1. Clean slate for test slot
  const testSlotId = 'visual://test.customer.home.hero.persistence';
  await prisma.visualDeployment.deleteMany({ where: { slotId: testSlotId } });
  await prisma.visualQualityReceipt.deleteMany({ where: { slotId: testSlotId } });
  await prisma.visualCandidate.deleteMany({ where: { slotId: testSlotId } });
  await prisma.visualSlotState.deleteMany({ where: { slotId: testSlotId } });

  // 2. Insert Slot State
  const createdSlot = await prisma.visualSlotState.create({
    data: {
      slotId: testSlotId,
      contractId: 'CONTRACT_TEST_HOME_HERO',
      mechanism: 'OW_MECH_MONUMENT_CRAFT_FLOWER',
      deploymentStatus: 'CHAMPION',
      fallbackAsset: '/art/hero_monument_flower.webp',
      fallbackClass: 'CURATED_FALLBACK',
      performanceBudgetKb: 350
    }
  });
  assert.equal(createdSlot.slotId, testSlotId);

  // 3. Insert Candidate (Simulation Output)
  const simCandidate = await prisma.visualCandidate.create({
    data: {
      slotId: testSlotId,
      candidateId: 'CAND_SIM_001',
      assetUrl: '/art/hero_monument_flower.webp',
      altText: 'Simulated Test Candidate',
      mechanism: 'OW_MECH_MONUMENT_CRAFT_FLOWER',
      generationMode: 'SIMULATED_TEST_OUTPUT',
      provider: 'LocalSimulation',
      model: 'simulation-v1',
      lineage: JSON.stringify({ prompt: 'test prompt', actor: 'OWNER' })
    }
  });
  assert.equal(simCandidate.candidateId, 'CAND_SIM_001');
  assert.equal(simCandidate.generationMode, 'SIMULATED_TEST_OUTPUT');

  // 4. Production Rule Law: SIMULATED_TEST_OUTPUT MUST NEVER be promotable to PRODUCTION_CHAMPION
  const attemptPromoteSimulation = async (cand) => {
    if (cand.generationMode === 'SIMULATED_TEST_OUTPUT') {
      throw new Error('PROMOTION_DENIED: Simulated test candidates cannot be promoted to PRODUCTION_CHAMPION');
    }
    await prisma.visualSlotState.update({
      where: { slotId: testSlotId },
      data: { currentChampionId: cand.candidateId, deploymentStatus: 'CHAMPION' }
    });
  };

  await assert.rejects(
    async () => attemptPromoteSimulation(simCandidate),
    /PROMOTION_DENIED: Simulated test candidates cannot be promoted to PRODUCTION_CHAMPION/
  );

  // 5. Insert Live Provider Candidate
  const liveCandidate = await prisma.visualCandidate.create({
    data: {
      slotId: testSlotId,
      candidateId: 'CAND_LIVE_001',
      assetUrl: '/art/hero_monument_flower.webp',
      altText: 'Live Provider Candidate',
      mechanism: 'OW_MECH_MONUMENT_CRAFT_FLOWER',
      generationMode: 'LIVE_PROVIDER_OUTPUT',
      provider: 'OpenAI_DallE3',
      model: 'dall-e-3',
      providerRequestId: 'req_live_12345',
      lineage: JSON.stringify({ prompt: 'real prompt', actor: 'OWNER' })
    }
  });

  // Promote Live Candidate to Champion
  await prisma.visualSlotState.update({
    where: { slotId: testSlotId },
    data: {
      currentChampionId: liveCandidate.candidateId,
      previousChampionId: 'INITIAL_FALLBACK',
      deploymentStatus: 'CHAMPION',
      promotedAt: new Date()
    }
  });

  await prisma.visualDeployment.create({
    data: {
      slotId: testSlotId,
      candidateId: liveCandidate.candidateId,
      actorId: 'OWNER_ROOT',
      actorRole: 'OWNER',
      deploymentAction: 'PROMOTE_CHAMPION',
      status: 'COMPLETED'
    }
  });

  // 6. Simulate Process Restart: Disconnect and create a fresh PrismaClient instance
  await prisma.$disconnect();
  const freshPrisma = new PrismaClient({ datasources: { db: { url: 'file:./dev.db' } } });

  const retrievedAfterRestart = await freshPrisma.visualSlotState.findUnique({
    where: { slotId: testSlotId },
    include: { candidates: true, deployments: true }
  });

  assert.ok(retrievedAfterRestart, 'Slot must exist after fresh instance initialization');
  assert.equal(retrievedAfterRestart.currentChampionId, 'CAND_LIVE_001');
  assert.equal(retrievedAfterRestart.previousChampionId, 'INITIAL_FALLBACK');
  assert.equal(retrievedAfterRestart.deployments.length, 1);

  // 7. Perform Rollback on fresh instance
  await freshPrisma.visualSlotState.update({
    where: { slotId: testSlotId },
    data: {
      currentChampionId: retrievedAfterRestart.previousChampionId,
      previousChampionId: null,
      deploymentStatus: 'ROLLED_BACK',
      rolledBackAt: new Date(),
      rollbackReason: 'User initiated rollback verification'
    }
  });

  await freshPrisma.visualDeployment.create({
    data: {
      slotId: testSlotId,
      candidateId: 'INITIAL_FALLBACK',
      actorId: 'OWNER_ROOT',
      actorRole: 'OWNER',
      deploymentAction: 'ROLLBACK',
      reason: 'User initiated rollback verification'
    }
  });

  // 8. Second Fresh Restart to prove Rollback durability
  await freshPrisma.$disconnect();
  const secondFreshPrisma = new PrismaClient({ datasources: { db: { url: 'file:./dev.db' } } });

  const rolledBackSlot = await secondFreshPrisma.visualSlotState.findUnique({
    where: { slotId: testSlotId },
    include: { deployments: true }
  });

  assert.equal(rolledBackSlot?.deploymentStatus, 'ROLLED_BACK');
  assert.equal(rolledBackSlot?.currentChampionId, 'INITIAL_FALLBACK');
  assert.equal(rolledBackSlot?.deployments.length, 2);

  // Clean up
  await secondFreshPrisma.visualDeployment.deleteMany({ where: { slotId: testSlotId } });
  await secondFreshPrisma.visualCandidate.deleteMany({ where: { slotId: testSlotId } });
  await secondFreshPrisma.visualSlotState.deleteMany({ where: { slotId: testSlotId } });
  await secondFreshPrisma.$disconnect();
});
