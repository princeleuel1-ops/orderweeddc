import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SHADOW_TARGETS,
  diffSnapshots,
  extractJsonLdTypes,
  extractSitemapChildren,
  extractTitle,
  normalizeBody,
  sha256,
} from '../scripts/competitor-shadow.mjs';

test('shadow targets cover all three incumbents on public surfaces only', () => {
  const competitors = new Set(SHADOW_TARGETS.map((t) => t.competitor));
  assert.deepEqual([...competitors].sort(), ['leafly', 'weedmaps', 'wheresweed']);
  // Every target is a public, robots-class surface — never an auth/API wall.
  for (const t of SHADOW_TARGETS) {
    assert.match(t.url, /^https:\/\//, `${t.surface} must be https`);
    assert.doesNotMatch(t.url, /\/(login|auth|account|api-g)\b/, `${t.surface} must not be an auth/API surface`);
  }
});

test('normalizeBody strips volatile tokens so hashes track real content', () => {
  const a = normalizeBody('foo 2026-07-23T10:00:00Z cf-rayABC nonce="x1"  bar');
  const b = normalizeBody('foo 2026-07-24T11:22:33Z cf-rayZZZ nonce="q9"    bar');
  assert.equal(a, b, 'timestamps/rays/nonces/whitespace must not change the hash');
  assert.notEqual(sha256('a'), sha256('b'));
});

test('extractors read title, sitemap children, and JSON-LD types', () => {
  assert.equal(extractTitle('<html><title> Hi There </title></html>'), 'Hi There');
  assert.equal(extractTitle('<html>no title</html>'), null);
  const kids = extractSitemapChildren(
    '<loc>https://x.com/b.xml</loc><loc>https://x.com/a.xml</loc>',
  );
  assert.deepEqual(kids, ['/a.xml', '/b.xml']); // host-stripped, sorted
  assert.deepEqual(
    extractJsonLdTypes('"@type":"Offer" ... "@type":"ItemList" ... "@type":"Offer"'),
    ['ItemList', 'Offer'],
  );
});

test('diffSnapshots flags every material change as triage-required', () => {
  const previous = {
    results: [
      { competitor: 'leafly', surface: 'robots', hash: 'h1', status: 200 },
      { competitor: 'weedmaps', surface: 'dc-listing-status', status: 200 },
      { competitor: 'wheresweed', surface: 'add-business', status: 404 },
    ],
  };
  const current = {
    results: [
      // leafly robots changed -> a shipped policy move we must triage
      { competitor: 'leafly', surface: 'robots', hash: 'h2', status: 200 },
      // weedmaps DC unchanged -> no delta
      { competitor: 'weedmaps', surface: 'dc-listing-status', status: 200 },
      // wheresweed fixed their signup (404 -> 200): competitive move
      { competitor: 'wheresweed', surface: 'add-business', status: 200 },
      // brand-new surface appeared
      { competitor: 'leafly', surface: 'llms-txt', hash: 'new', status: 200 },
    ],
  };
  const deltas = diffSnapshots(previous, current);
  const keys = deltas.map((d) => `${d.key}:${d.change}`);
  assert.ok(keys.includes('leafly:robots:hash-changed'));
  assert.ok(keys.includes('wheresweed:add-business:status-changed'));
  assert.ok(keys.includes('leafly:llms-txt:surface-added'));
  assert.ok(!keys.some((k) => k.startsWith('weedmaps:dc-listing-status')));
  // Field-level changes carry the triage marker for the doctrine.
  const robots = deltas.find((d) => d.key === 'leafly:robots' && d.change === 'hash-changed');
  assert.equal(robots.triage, 'TRIAGE_REQUIRED');
  assert.equal(robots.before, 'h1');
  assert.equal(robots.after, 'h2');
});

test('diffSnapshots detases a removed surface', () => {
  const deltas = diffSnapshots(
    { results: [{ competitor: 'x', surface: 'gone', status: 200 }] },
    { results: [] },
  );
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].change, 'surface-removed');
});
