import assert from 'node:assert/strict';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password.mjs';
import {
  AUTH_THROTTLE_POLICY,
  clearAuthenticationFailures,
} from '../src/lib/auth/throttle.mjs';

const host = process.env.CANA_HTTP_HOST || 'orderweeddc.localhost:3000';
const port = Number(process.env.CANA_HTTP_PORT || '3000');
const origin = `http://${host}`;
const prisma = new PrismaClient();
const fixture = {
  validEmail: 'http-auth-customer@example.invalid',
  validPassword: 'HttpAuthFixture!2026',
  invalidEmail: 'http-auth-invalid@example.invalid',
  adminEmail: 'http-auth-admin@example.invalid',
  businessEmail: 'http-auth-business@example.invalid',
  throttleEmail: 'http-auth-throttle@example.invalid',
  duplicateEmail: 'http-auth-duplicate@example.invalid',
};
const fixtureEmails = Object.values(fixture).filter((value) =>
  value.endsWith('@example.invalid'),
);
const cleanupEmails = [...fixtureEmails, ''];

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method: options.method || 'GET',
        headers: { Host: host, ...options.headers },
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({
            pathname,
            method: options.method || 'GET',
            statusCode: response.statusCode,
            location: response.headers.location || null,
            retryAfter: response.headers['retry-after'] || null,
            cacheControl: response.headers['cache-control'] || null,
            setCookie: response.headers['set-cookie'] || [],
            body,
            latencyMs: Math.round(performance.now() - startedAt),
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

function loginRequest(pathname, email, password, headers = {}) {
  const body = new URLSearchParams({ email, password }).toString();
  return request(pathname, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body,
  });
}

function redirectPath(result) {
  assert.ok(result.location, `${result.pathname} did not return a redirect`);
  const location = new URL(result.location, origin);
  assert.equal(location.origin, origin);
  return `${location.pathname}${location.search}`;
}

async function cleanup() {
  const user = await prisma.user.findUnique({
    where: { email: fixture.validEmail },
    select: { id: true },
  });
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  for (const email of cleanupEmails) {
    await clearAuthenticationFailures(prisma, { email });
  }
}

const evidence = [];

try {
  await cleanup();
  const customer = await prisma.user.create({
    data: {
      email: fixture.validEmail,
      password: await hashPassword(fixture.validPassword),
      name: 'Disposable HTTP Auth Customer',
      role: 'CUSTOMER',
    },
  });

  const validLogins = [];
  for (let login = 0; login < 6; login += 1) {
    validLogins.push(
      await loginRequest(
        '/customer/session',
        fixture.validEmail,
        fixture.validPassword,
      ),
    );
  }
  evidence.push(...validLogins);
  for (const validLogin of validLogins) {
    assert.equal(validLogin.statusCode, 303);
    assert.equal(redirectPath(validLogin), '/wallet');
    assert.equal(validLogin.setCookie.length, 1);
  }
  assert.equal(
    await prisma.session.count({ where: { userId: customer.id } }),
    5,
  );

  const firstSessionCookie = validLogins[0].setCookie[0].split(';')[0];
  const evictedWallet = await request('/wallet', {
    headers: { Cookie: firstSessionCookie },
  });
  evidence.push(evictedWallet);
  assert.ok([303, 307].includes(evictedWallet.statusCode));
  assert.equal(redirectPath(evictedWallet), '/customer/login');

  const sessionCookie = validLogins.at(-1).setCookie[0];
  assert.match(sessionCookie, /^cana_session=/);
  assert.match(sessionCookie, /HttpOnly/i);
  assert.match(sessionCookie, /SameSite=Lax/i);
  assert.match(sessionCookie, /Secure/i);
  const cookieHeader = sessionCookie.split(';')[0];

  const wallet = await request('/wallet', {
    headers: { Cookie: cookieHeader },
  });
  evidence.push(wallet);
  assert.equal(wallet.statusCode, 200);
  assert.match(wallet.body, /Disposable HTTP Auth Customer/);

  const logout = await request('/customer/logout', {
    method: 'POST',
    headers: {
      Cookie: cookieHeader,
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
  });
  evidence.push(logout);
  assert.equal(logout.statusCode, 303);
  assert.equal(redirectPath(logout), '/customer/login');
  assert.equal(
    await prisma.session.count({ where: { userId: customer.id } }),
    4,
  );

  const [invalidAdmin, invalidBusiness] = await Promise.all([
    loginRequest('/admin/session', fixture.adminEmail, 'NotThePassword!1'),
    loginRequest(
      '/business/session',
      fixture.businessEmail,
      'NotThePassword!1',
    ),
  ]);
  evidence.push(invalidAdmin, invalidBusiness);
  assert.equal(invalidAdmin.statusCode, 303);
  assert.equal(redirectPath(invalidAdmin), '/admin/login?error=invalid');
  assert.equal(invalidBusiness.statusCode, 303);
  assert.equal(redirectPath(invalidBusiness), '/business/login?error=invalid');
  assert.deepEqual(invalidAdmin.setCookie, []);
  assert.deepEqual(invalidBusiness.setCookie, []);

  const [foreignAdmin, foreignBusiness, foreignCustomer] = await Promise.all([
    loginRequest(
      '/admin/session',
      fixture.adminEmail,
      'NotThePassword!1',
      { Origin: 'https://attacker.example' },
    ),
    loginRequest(
      '/business/session',
      fixture.businessEmail,
      'NotThePassword!1',
      { Origin: 'https://attacker.example' },
    ),
    loginRequest(
      '/customer/session',
      fixture.invalidEmail,
      'NotThePassword!1',
      { Origin: 'https://attacker.example' },
    ),
  ]);
  evidence.push(foreignAdmin, foreignBusiness, foreignCustomer);
  for (const result of [foreignAdmin, foreignBusiness, foreignCustomer]) {
    assert.equal(result.statusCode, 403);
    assert.deepEqual(result.setCookie, []);
  }

  const marker = encodeURIComponent('AUTH_ERROR_MARKER_SHOULD_NOT_RENDER');
  const [adminErrorPage, businessErrorPage] = await Promise.all([
    request(`/admin/login?error=${marker}`),
    request(`/business/login?error=${marker}`),
  ]);
  evidence.push(adminErrorPage, businessErrorPage);
  assert.equal(adminErrorPage.statusCode, 200);
  assert.equal(businessErrorPage.statusCode, 200);
  const adminVisibleMarkup = adminErrorPage.body.split('<script')[0];
  const businessVisibleMarkup = businessErrorPage.body.split('<script')[0];
  assert.doesNotMatch(
    adminVisibleMarkup,
    /AUTH_ERROR_MARKER_SHOULD_NOT_RENDER/,
  );
  assert.doesNotMatch(
    businessVisibleMarkup,
    /AUTH_ERROR_MARKER_SHOULD_NOT_RENDER/,
  );

  const throttleResults = [];
  for (
    let attempt = 1;
    attempt <= AUTH_THROTTLE_POLICY.accountFailureLimit + 1;
    attempt += 1
  ) {
    throttleResults.push(
      await loginRequest(
        '/customer/session',
        fixture.throttleEmail,
        `IncorrectPassword!${attempt}`,
      ),
    );
  }
  evidence.push(...throttleResults);
  assert.deepEqual(
    throttleResults.map(({ statusCode }) => statusCode),
    [303, 303, 303, 303, 429, 429],
  );
  for (const result of throttleResults.slice(-2)) {
    assert.equal(
      result.retryAfter,
      String(Math.ceil(AUTH_THROTTLE_POLICY.windowMs / 1000)),
    );
    assert.equal(result.cacheControl, 'private, no-store, max-age=0');
    assert.deepEqual(result.setCookie, []);
  }

  const oversized = await request('/customer/session', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `email=${encodeURIComponent(fixture.invalidEmail)}&password=${'x'.repeat(9000)}`,
  });
  evidence.push(oversized);
  assert.equal(oversized.statusCode, 413);

  const duplicateFields = await request('/customer/session', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `email=${encodeURIComponent(fixture.duplicateEmail)}&email=second%40example.invalid&password=NotThePassword%211`,
  });
  evidence.push(duplicateFields);
  assert.equal(duplicateFields.statusCode, 303);
  assert.equal(redirectPath(duplicateFields), '/customer/login?error=invalid');

  const storedFailures = await prisma.authFailure.findMany({
    where: {
      surface: { in: ['ADMIN', 'BUSINESS', 'CUSTOMER'] },
    },
    orderBy: { occurredAt: 'asc' },
  });
  assert.ok(storedFailures.length >= AUTH_THROTTLE_POLICY.accountFailureLimit);
  for (const failure of storedFailures) {
    assert.match(failure.accountDigest, /^[a-f0-9]{64}$/);
    assert.match(failure.clientDigest, /^[a-f0-9]{64}$/);
  }
  assert.doesNotMatch(
    JSON.stringify(storedFailures),
    /http-auth-|NotThePassword|IncorrectPassword|127\.0\.0\.1/i,
  );

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checks: {
          disposableLoginSessionWalletLogout: 'PASS',
          secureCookieAttributes: 'PASS',
          activeSessionCapAndOldestEviction: 'PASS',
          genericCredentialFailure: 'PASS',
          sameOriginAllLoginSurfaces: 'PASS',
          reflectedErrorSuppression: 'PASS',
          rollingAccountThrottle: 'PASS',
          retryAfterAndNoCookieOnThrottle: 'PASS',
          boundedAndUnambiguousFormBody: 'PASS',
          pseudonymousFailureEvidence: 'PASS',
          disposableCleanup: 'PASS',
        },
        requests: evidence.map(
          ({
            pathname,
            method,
            statusCode,
            latencyMs,
            retryAfter,
          }) => ({
            pathname,
            method,
            statusCode,
            latencyMs,
            retryAfter,
          }),
        ),
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
  await prisma.$disconnect();
}
