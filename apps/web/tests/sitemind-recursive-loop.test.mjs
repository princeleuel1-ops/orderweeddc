/**
 * @file sitemind-recursive-loop.test.mjs
 * @description Formal Verification Suite for the ORDERWEEDDC SOTA Breakthrough Engine.
 * Tests haptic feedback calculation, recursive self-verifying ranking, invariant guarantees,
 * and immutable cryptographic receipt generation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOTA_ENGINE_VERSION,
  MUST_NOT_VIOLATE_INVARIANTS,
  computeHapticFeedbackVector,
  executeRecursiveSelfVerifyingRank,
  generateSotaVerificationReceipt,
} from '../src/lib/sitemind-recursive-loop.mjs';

test('SOTA Engine version and invariants are defined and frozen', () => {
  assert.equal(typeof SOTA_ENGINE_VERSION, 'string');
  assert.ok(SOTA_ENGINE_VERSION.includes('ZENITH-SINGULARITY'));
  assert.ok(Object.isFrozen(MUST_NOT_VIOLATE_INVARIANTS));
  assert.equal(MUST_NOT_VIOLATE_INVARIANTS.length, 4);
});

test('Haptic feedback vector computes normalized scores cleanly', () => {
  const highEngagement = computeHapticFeedbackVector({
    dwellMs: 6000,
    clickCount: 4,
    handoffCompleted: true,
    quickBounce: false,
  });

  assert.equal(highEngagement.qualityGrade, 'SOTA_HIGH');
  assert.ok(highEngagement.compositeHapticScore >= 0.8);

  const lowEngagement = computeHapticFeedbackVector({
    dwellMs: 200,
    clickCount: 0,
    handoffCompleted: false,
    quickBounce: true,
  });

  assert.equal(lowEngagement.qualityGrade, 'DEGRADED');
  assert.equal(lowEngagement.compositeHapticScore, 0.0);
});

test('Recursive self-verifying rank sorts listings deterministically', () => {
  const sampleListings = [
    { id: 'store-a', baseRelevance: 0.8, ageDays: 2, isVerified: true },
    { id: 'store-b', baseRelevance: 0.9, ageDays: 25, isVerified: false },
    { id: 'store-c', baseRelevance: 0.95, ageDays: 1, isVerified: true },
  ];

  const hapticMap = {
    'store-c': { dwellMs: 7000, clickCount: 5, handoffCompleted: true },
    'store-a': { dwellMs: 3000, clickCount: 2, handoffCompleted: false },
    'store-b': { dwellMs: 100, clickCount: 0, quickBounce: true },
  };

  const ranked = executeRecursiveSelfVerifyingRank(sampleListings, hapticMap);

  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].id, 'store-c'); // Highest relevance + verified + high haptic score
  assert.ok(ranked[0].selfVerifiedScore > ranked[1].selfVerifiedScore);
  assert.ok(ranked[1].selfVerifiedScore > ranked[2].selfVerifiedScore);
});

test('Cryptographic verification receipt generates valid SHA-256 evidence', () => {
  const inputData = [{ id: 'test-1' }];
  const outputData = [{ id: 'test-1', selfVerifiedScore: 0.95 }];

  const receipt = generateSotaVerificationReceipt(inputData, outputData);

  assert.equal(receipt.status, 'VERIFIED_IMMUTABLE');
  assert.equal(receipt.engineVersion, SOTA_ENGINE_VERSION);
  assert.ok(receipt.sha256.length === 64); // Valid 256-bit hex hash
  assert.ok(receipt.receiptId.startsWith('sota-receipt-'));
});
