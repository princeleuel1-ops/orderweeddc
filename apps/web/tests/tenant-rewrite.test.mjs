import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import {
  buildTenantRewriteUrl,
  isAuthorizedTenantRewriteReentry,
  rewriteUsesUnboundDefaultPort,
  TENANT_REWRITE_MARKER_HEADER,
} from '../src/lib/tenant-rewrite.mjs';

const TENANT = 'orderweeddc.localhost';
const BAD_NEXT_ORIGIN = 'https://localhost:3000/';
const PASSENGER_PORT = '41234';

function passengerRewrite(overrides = {}) {
  return buildTenantRewriteUrl({
    tenantDomain: TENANT,
    pathname: '/',
    search: '',
    runtimePort: PASSENGER_PORT,
    runtimeHostname: '127.0.0.1',
    rawRequestUrl: BAD_NEXT_ORIGIN,
    production: true,
    ...overrides,
  });
}

test('production rewrite uses Passenger runtime PORT, not Next default :3000', () => {
  const target = passengerRewrite();
  assert.equal(target.toString(), 'http://127.0.0.1:41234/orderweeddc.localhost');
  assert.equal(rewriteUsesUnboundDefaultPort(target), false);
});

test('root rewrite avoids a public trailing-slash redirect to the tenant path', () => {
  const target = passengerRewrite();
  assert.equal(target.pathname, '/orderweeddc.localhost');
  assert.equal(target.pathname.endsWith('/'), false);
});

test('runtime target reaches the active Passenger-style loopback listener', async (t) => {
  const observed = {};
  const server = http.createServer((request, response) => {
    observed.url = request.url;
    observed.host = request.headers.host;
    response.writeHead(204);
    response.end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const target = passengerRewrite({
    runtimePort: String(address.port),
    pathname: '/deals',
    search: '?page=2',
  });
  const response = await fetch(target);

  assert.equal(response.status, 204);
  assert.equal(observed.url, '/orderweeddc.localhost/deals?page=2');
  assert.equal(observed.host, `127.0.0.1:${address.port}`);
});

test('the exact old Passenger failure is detected', () => {
  assert.equal(
    rewriteUsesUnboundDefaultPort(
      'https://localhost:3000/orderweeddc.localhost',
    ),
    true,
  );
});

test('request.url cannot override the production Passenger destination', () => {
  const target = passengerRewrite({
    rawRequestUrl: 'https://attacker.example:3000/stolen',
  });
  assert.equal(target.origin, 'http://127.0.0.1:41234');
  assert.equal(target.pathname, '/orderweeddc.localhost');
});

test('an unsafe HOSTNAME value is ignored and pinned to loopback', () => {
  const target = passengerRewrite({ runtimeHostname: 'attacker.example' });
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, PASSENGER_PORT);
});

test('IPv6 loopback is formatted correctly when explicitly configured', () => {
  const target = passengerRewrite({ runtimeHostname: '::1' });
  assert.equal(target.hostname, '[::1]');
  assert.equal(target.port, PASSENGER_PORT);
});

test('production fails closed when Passenger PORT is absent', () => {
  assert.throws(
    () => passengerRewrite({ runtimePort: undefined }),
    /valid Passenger PORT is required/i,
  );
});

test('production rejects malformed or out-of-range ports', () => {
  for (const runtimePort of ['0', '65536', 'abc', '12x', '-1']) {
    assert.throws(
      () => passengerRewrite({ runtimePort }),
      /valid Passenger PORT is required/i,
      runtimePort,
    );
  }
});

test('development can fall back to the actual request origin', () => {
  const target = passengerRewrite({
    production: false,
    runtimePort: undefined,
    rawRequestUrl: 'http://orderweeddc.localhost:3000/deals?page=2',
    pathname: '/deals',
    search: '?page=2',
  });
  assert.equal(
    target.toString(),
    'http://orderweeddc.localhost:3000/orderweeddc.localhost/deals?page=2',
  );
});

test('query parameters survive the Passenger rewrite', () => {
  const target = passengerRewrite({ search: '?type=delivery&page=2' });
  assert.equal(target.search, '?type=delivery&page=2');
});

test('nested routes preserve the tenant prefix and path', () => {
  assert.equal(
    passengerRewrite({ pathname: '/deals' }).pathname,
    '/orderweeddc.localhost/deals',
  );
  assert.equal(
    passengerRewrite({ pathname: '/neighborhoods/georgetown' }).pathname,
    '/orderweeddc.localhost/neighborhoods/georgetown',
  );
});

test('unsafe tenant path injection is rejected', () => {
  for (const tenantDomain of ['', '../admin', 'tenant/escape', 'a?b', 'a#b']) {
    assert.throws(
      () => passengerRewrite({ tenantDomain }),
      /safe tenantDomain is required/i,
      tenantDomain,
    );
  }
});

test('external loopback Host cannot impersonate an internal tenant rewrite', () => {
  const expectedToken = 'a'.repeat(32);
  const shared = {
    tenantAllowed: true,
    expectedToken,
  };

  for (const loopbackHostname of ['localhost', '127.0.0.1', '::1']) {
    assert.equal(
      isAuthorizedTenantRewriteReentry({
        ...shared,
        loopbackHostname,
        presentedToken: null,
      }),
      false,
    );
    assert.equal(
      isAuthorizedTenantRewriteReentry({
        ...shared,
        loopbackHostname,
        presentedToken: 'attacker-controlled',
      }),
      false,
    );
  }
});

test('only the process-local marker authorizes an allowlisted loopback re-entry', () => {
  const expectedToken = 'b'.repeat(32);
  assert.equal(
    isAuthorizedTenantRewriteReentry({
      loopbackHostname: '127.0.0.1',
      tenantAllowed: true,
      presentedToken: expectedToken,
      expectedToken,
    }),
    true,
  );
  assert.equal(
    isAuthorizedTenantRewriteReentry({
      loopbackHostname: '127.0.0.1',
      tenantAllowed: false,
      presentedToken: expectedToken,
      expectedToken,
    }),
    false,
  );
  assert.equal(
    TENANT_REWRITE_MARKER_HEADER,
    'x-orderweeddc-internal-tenant-rewrite',
  );
});
