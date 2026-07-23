import assert from 'node:assert/strict';
import test from 'node:test';
import { auditLedger, loadLedger, VALID_SOURCES } from '../scripts/mind-audit.mjs';

test('the committed Mistake Ledger is sound and vicarious-dominant', () => {
  const result = auditLedger(loadLedger());
  assert.equal(result.ok, true, `ledger errors: ${result.errors.join('; ')}`);
  // The founder mandate: learn from others more than from ourselves.
  assert.ok(
    result.stats.vicarious > result.stats.own,
    'vicarious lessons must outnumber own-incident lessons',
  );
  assert.ok(result.stats.vicariousRatio >= 0.8, 'at least 80% of lessons are vicarious');
  // Every entry must be guarded (learned), and the vast majority already shipped.
  assert.ok(result.stats.guardedShippedRatio >= 0.9, 'nearly every lesson is guarded + shipped');
});

test('auditLedger rejects an unlearned lesson (mistake with no guard)', () => {
  const bad = {
    entries: [
      {
        id: 'X-1',
        source: 'competitor',
        actor: 'Rival',
        mistake: 'Shipped a broken signup funnel.',
        evidence: 'observed 2026',
        law: 'Funnels get synthetic checks.',
        // guard missing entirely -> unlearned
      },
    ],
  };
  const result = auditLedger(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /guard\.status/.test(e)));
});

test('auditLedger enforces the vicarious-dominance mandate', () => {
  const ownHeavy = {
    entries: [
      { id: 'O-1', source: 'own', actor: 'us', mistake: 'we broke a build', evidence: 'e', law: 'l', guard: { status: 'SHIPPED', reference: 'ref-here' } },
      { id: 'O-2', source: 'own', actor: 'us', mistake: 'we broke it again', evidence: 'e', law: 'l', guard: { status: 'SHIPPED', reference: 'ref-here' } },
      { id: 'V-1', source: 'competitor', actor: 'them', mistake: 'they erred', evidence: 'e', law: 'l', guard: { status: 'SHIPPED', reference: 'ref-here' } },
    ],
  };
  const result = auditLedger(ownHeavy);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /vicarious lessons/.test(e)));
});

test('auditLedger validates sources and duplicate ids', () => {
  const dup = {
    entries: [
      { id: 'D-1', source: 'wishful', actor: 'a', mistake: 'mmmm', evidence: 'e', law: 'l', guard: { status: 'SHIPPED', reference: 'refx' } },
      { id: 'D-1', source: 'competitor', actor: 'a', mistake: 'mmmm', evidence: 'e', law: 'l', guard: { status: 'SHIPPED', reference: 'refx' } },
    ],
  };
  const result = auditLedger(dup);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /duplicate id D-1/.test(e)));
  assert.ok(result.errors.some((e) => /source must be one of/.test(e)));
  assert.ok(VALID_SOURCES.includes('competitor'));
});
