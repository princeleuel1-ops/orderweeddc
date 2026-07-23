import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicMetadata, clampSeoText } from '../src/lib/seo-meta.mjs';

test('clampSeoText collapses whitespace and truncates with an ellipsis', () => {
  assert.equal(clampSeoText('  hello   world  ', 30), 'hello world');
  const long = 'a'.repeat(200);
  const clamped = clampSeoText(long, 65);
  assert.equal(clamped.length, 65);
  assert.ok(clamped.endsWith('…'));
  assert.equal(clampSeoText(undefined, 10), '');
});

test('buildPublicMetadata produces complete search and social metadata', () => {
  const metadata = buildPublicMetadata({
    title: 'D.C. Cannabis Deals',
    description: 'Verified, time-bounded offers.',
    canonicalPath: '/deals',
  });
  assert.equal(metadata.title, 'D.C. Cannabis Deals');
  assert.equal(metadata.alternates.canonical, '/deals');
  assert.equal(metadata.openGraph.url, '/deals');
  assert.equal(metadata.openGraph.locale, 'en_US');
  assert.equal(metadata.openGraph.images[0].width, 1200);
  assert.equal(metadata.twitter.card, 'summary_large_image');
  assert.equal(metadata.twitter.images[0], '/og-default.jpg');
});

test('buildPublicMetadata clamps oversized titles and descriptions', () => {
  const metadata = buildPublicMetadata({
    title: 'T'.repeat(120),
    description: 'D'.repeat(400),
    canonicalPath: '/',
  });
  assert.ok(metadata.title.length <= 65);
  assert.ok(metadata.description.length <= 160);
});

test('buildPublicMetadata falls back to brand defaults', () => {
  const metadata = buildPublicMetadata({ canonicalPath: '/' });
  assert.equal(typeof metadata.title, 'string');
  assert.ok(metadata.title.length > 0);
  assert.ok(metadata.description.length > 0);
});
