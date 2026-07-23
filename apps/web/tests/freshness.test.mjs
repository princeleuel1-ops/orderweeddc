import assert from 'node:assert/strict';
import test from 'node:test';
import { relativeFreshnessLabel } from '../src/lib/freshness.mjs';

const ASOF = new Date('2026-07-23T12:00:00.000Z');
const days = (n) => new Date(ASOF.getTime() + n * 24 * 60 * 60 * 1000);

test('relativeFreshnessLabel speaks only from recorded evidence', () => {
  // No verification ever recorded -> nothing rendered, never a fake claim.
  assert.equal(relativeFreshnessLabel({ verifiedAt: null, asOf: ASOF }), null);
  assert.equal(relativeFreshnessLabel({ asOf: ASOF }), null);
  // Future verifiedAt is invalid evidence -> null.
  assert.equal(
    relativeFreshnessLabel({ verifiedAt: days(2), asOf: ASOF }),
    null,
  );
});

test('relativeFreshnessLabel formats age and remaining freshness honestly', () => {
  assert.equal(
    relativeFreshnessLabel({ verifiedAt: days(0), freshnessExpiresAt: days(29), asOf: ASOF }),
    'Verified today · fresh for 29 more days',
  );
  assert.equal(
    relativeFreshnessLabel({ verifiedAt: days(-1), freshnessExpiresAt: days(1), asOf: ASOF }),
    'Verified yesterday · fresh for 1 more day',
  );
  assert.equal(
    relativeFreshnessLabel({ verifiedAt: days(-3), asOf: ASOF }),
    'Verified 3 days ago',
  );
  assert.equal(
    relativeFreshnessLabel({ verifiedAt: days(-45), freshnessExpiresAt: days(-15), asOf: ASOF }),
    'Verified 45 days ago · freshness expired',
  );
  assert.equal(
    relativeFreshnessLabel({ verifiedAt: days(-2), freshnessExpiresAt: days(0), asOf: ASOF }),
    'Verified 2 days ago · freshness expires today',
  );
});
