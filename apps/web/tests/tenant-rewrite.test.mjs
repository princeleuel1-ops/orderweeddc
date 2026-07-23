import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTenantRewriteUrl,
  rewriteTargetIsSelfProxy,
} from '../src/lib/tenant-rewrite.mjs';

// The origin the Node standalone server ACTUALLY serves under Passenger (loopback, http, real port).
const INTERNAL = 'http://localhost:41234/';
const TENANT = 'orderweeddc.localhost';

test('1. apex "/" resolves internally to the ORDERWEEDDC tenant page', () => {
  const u = buildTenantRewriteUrl(INTERNAL, TENANT, '/', '');
  assert.equal(u.pathname, '/orderweeddc.localhost/');
});

test('2. rewrite target does NOT contain localhost:3000', () => {
  const u = buildTenantRewriteUrl(INTERNAL, TENANT, '/', '');
  assert.ok(!u.toString().includes('localhost:3000'), u.toString());
});

test('3. rewrite stays same-origin → no HTTP self-proxy', () => {
  const u = buildTenantRewriteUrl(INTERNAL, TENANT, '/', '');
  assert.equal(rewriteTargetIsSelfProxy(u.toString(), INTERNAL), false);
});

test('3b. reproduces the OLD bug: the forwarded absolute origin WOULD self-proxy', () => {
  // Pre-fix behavior: rewriting request.nextUrl (https + localhost:3000).
  const forwarded = new URL('https://localhost:3000/');
  forwarded.pathname = `/${TENANT}/`;
  assert.equal(rewriteTargetIsSelfProxy(forwarded.toString(), INTERNAL), true);
  assert.ok(forwarded.toString().includes('localhost:3000'));
});

test('4. forwarded production request still yields a same-origin internal target', () => {
  // Even given a production-looking raw url, the target must match its own origin.
  const prodInternal = 'http://127.0.0.1:8080/';
  const u = buildTenantRewriteUrl(prodInternal, TENANT, '/', '');
  assert.equal(new URL(u).origin, new URL(prodInternal).origin);
  assert.equal(rewriteTargetIsSelfProxy(u.toString(), prodInternal), false);
});

test('5. unknown/empty tenant is rejected (defensive)', () => {
  assert.throws(() => buildTenantRewriteUrl(INTERNAL, '', '/', ''), TypeError);
});

test('10. query parameters survive the internal rewrite', () => {
  const u = buildTenantRewriteUrl(INTERNAL, TENANT, '/', '?type=delivery&page=2');
  assert.equal(u.pathname, '/orderweeddc.localhost/');
  assert.equal(u.search, '?type=delivery&page=2');
});

test('nested paths keep the tenant prefix + path (deals, strains, neighborhoods)', () => {
  assert.equal(buildTenantRewriteUrl(INTERNAL, TENANT, '/deals', '').pathname, '/orderweeddc.localhost/deals');
  assert.equal(buildTenantRewriteUrl(INTERNAL, TENANT, '/neighborhoods/georgetown', '').pathname,
    '/orderweeddc.localhost/neighborhoods/georgetown');
});
