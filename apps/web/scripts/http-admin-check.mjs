import assert from 'node:assert/strict';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password.mjs';
import { clearAuthenticationFailures } from '../src/lib/auth/throttle.mjs';

const host = process.env.CANA_HTTP_HOST || 'orderweeddc.localhost:3000';
const port = Number(process.env.CANA_HTTP_PORT || '3000');
const origin = `http://${host}`;
const prisma = new PrismaClient();
const fixture = {
  email: 'http-admin-dashboard@example.invalid',
  password: 'HttpAdminDashboard!2026',
};

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
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
            statusCode: response.statusCode,
            location: response.headers.location || null,
            setCookie: response.headers['set-cookie'] || [],
            cacheControl: response.headers['cache-control'] || null,
            body,
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

async function cleanup() {
  const user = await prisma.user.findUnique({
    where: { email: fixture.email },
    select: { id: true },
  });
  if (user) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await clearAuthenticationFailures(prisma, { email: fixture.email });
}

try {
  await cleanup();
  await prisma.user.create({
    data: {
      email: fixture.email,
      password: await hashPassword(fixture.password),
      name: 'Disposable HTTP Dashboard Administrator',
      role: 'ADMIN',
    },
  });

  const anonymousSiteBrain = await request('/admin/site-intelligence');
  assert.equal(anonymousSiteBrain.statusCode, 307);
  assert.equal(
    new URL(anonymousSiteBrain.location, origin).pathname,
    '/admin/login',
  );

  const body = new URLSearchParams({
    email: fixture.email,
    password: fixture.password,
  }).toString();
  const login = await request('/admin/session', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
  assert.equal(login.statusCode, 303);
  assert.equal(new URL(login.location, origin).pathname, '/admin');
  assert.equal(login.setCookie.length, 1);
  const cookie = login.setCookie[0].split(';', 1)[0];

  const dashboard = await request(
    '/admin?evidencePage=9999&claimPage=9999&disputePage=9999&stalePage=9999',
    {
      headers: { Cookie: cookie },
    },
  );
  assert.equal(dashboard.statusCode, 200);
  assert.match(dashboard.body, /Administrative Headquarters/);
  assert.match(dashboard.body, /License Verification Queue/);
  assert.match(dashboard.body, /Business Claim Queue/);
  assert.match(dashboard.body, /Listing Correction/);
  assert.match(dashboard.body, /Stale Information Warning List/);
  assert.doesNotMatch(dashboard.body, /Internal Server Error|Application error/);

  const siteBrain = await request('/admin/site-intelligence', {
    headers: { Cookie: cookie },
  });
  assert.equal(siteBrain.statusCode, 200);
  assert.match(siteBrain.body, /orderweeddc Site Intelligence/);
  assert.match(siteBrain.body, /Site intelligence with proof attached/);
  assert.match(siteBrain.body, /Search Console evidence is not connected/);
  assert.match(siteBrain.body, /Public HTTPS crawl is not proven/);
  assert.match(siteBrain.body, /Capture evidence snapshot/);
  assert.match(
    siteBrain.body,
    /<meta name="robots" content="noindex, nofollow, nocache"/,
  );
  assert.match(siteBrain.cacheControl, /private|no-store/);
  assert.doesNotMatch(siteBrain.body, /Internal Server Error|Application error/);

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checks: {
          disposableAdminLogin: 'PASS',
          boundedQueuePageNormalization: 'PASS',
          authenticatedDashboardRender: 'PASS',
          anonymousSiteBrainIsolation: 'PASS',
          evidenceBackedSiteBrainRender: 'PASS',
          disposableCleanup: 'PASS',
        },
      },
      null,
      2,
    ),
  );
} finally {
  await cleanup();
  await prisma.$disconnect();
}
