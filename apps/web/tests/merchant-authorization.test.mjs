import test from 'node:test';
import assert from 'node:assert/strict';

// Core Authorization Rules derived from actor role, requested slot, and merchant identity
function authorizeVisualAction(actor, targetSlotId, action) {
  // 1. PUBLIC can only resolve or query
  if (actor.role === 'PUBLIC') {
    if (action === 'resolveSlot' || action === 'queryVisualState') return { authorized: true };
    return { authorized: false, reason: 'PUBLIC_READ_ONLY' };
  }

  // 2. OWNER has network-wide authority over all slots
  if (actor.role === 'OWNER' || actor.role === 'SYSTEM') {
    return { authorized: true };
  }

  // 3. MERCHANT actor authorization rules
  if (actor.role === 'MERCHANT') {
    if (!actor.merchant_id) {
      return { authorized: false, reason: 'MISSING_MERCHANT_IDENTITY' };
    }

    // Prohibit modifying global homepage or customer slots
    if (!targetSlotId.startsWith('visual://merchant.')) {
      return { authorized: false, reason: 'PROHIBITED_GLOBAL_SLOT_MUTATION' };
    }

    // If slot has merchant ID qualifier, enforce exact match
    if (targetSlotId.includes(`visual://merchant.${actor.merchant_id}.`)) {
      return { authorized: true };
    }

    // Generic merchant template slots accessible by licensed merchants for their own previews
    if (targetSlotId === 'visual://merchant.dashboard.hero' || targetSlotId === 'visual://merchant.claim.hero' || targetSlotId === 'visual://merchant.campaign.creator.stage') {
      return { authorized: true };
    }

    // Prohibit accessing another merchant's slot
    if (targetSlotId.startsWith('visual://merchant.') && !targetSlotId.includes(actor.merchant_id)) {
      return { authorized: false, reason: 'CROSS_MERCHANT_MUTATION_DENIED' };
    }
  }

  return { authorized: false, reason: 'UNAUTHORIZED_ACTOR' };
}

test('merchant_A can modify merchant_A slot', () => {
  const actorA = { role: 'MERCHANT', merchant_id: 'merchant_alpha' };
  const slotA = 'visual://merchant.merchant_alpha.hero';
  const res = authorizeVisualAction(actorA, slotA, 'deployCandidate');
  assert.equal(res.authorized, true);
});

test('merchant_A cannot modify merchant_B slot', () => {
  const actorA = { role: 'MERCHANT', merchant_id: 'merchant_alpha' };
  const slotB = 'visual://merchant.merchant_beta.hero';
  const res = authorizeVisualAction(actorA, slotB, 'deployCandidate');
  assert.equal(res.authorized, false);
  assert.equal(res.reason, 'CROSS_MERCHANT_MUTATION_DENIED');
});

test('merchant cannot modify home hero', () => {
  const actor = { role: 'MERCHANT', merchant_id: 'merchant_alpha' };
  const homeSlot = 'visual://customer.home.hero.primary';
  const res = authorizeVisualAction(actor, homeSlot, 'deployCandidate');
  assert.equal(res.authorized, false);
  assert.equal(res.reason, 'PROHIBITED_GLOBAL_SLOT_MUTATION');
});

test('merchant cannot modify brand DNA or deals hero', () => {
  const actor = { role: 'MERCHANT', merchant_id: 'merchant_alpha' };
  const dealsSlot = 'visual://customer.deals.hero';
  const res = authorizeVisualAction(actor, dealsSlot, 'compileGenerationJob');
  assert.equal(res.authorized, false);
  assert.equal(res.reason, 'PROHIBITED_GLOBAL_SLOT_MUTATION');
});
