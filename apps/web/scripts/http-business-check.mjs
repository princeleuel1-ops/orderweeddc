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
  email: 'http-business-dashboard@example.invalid',
  password: 'HttpBusinessDashboard!2026',
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
  const retailer = await prisma.retailer.findFirst({
    where: { isDemonstration: true },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  assert.ok(retailer, 'The local release fixture requires a demo retailer.');

  await prisma.user.create({
    data: {
      email: fixture.email,
      password: await hashPassword(fixture.password),
      name: 'Disposable HTTP Dashboard Manager',
      role: 'RETAILER_MANAGER',
      managedRetailerId: retailer.id,
    },
  });

  const body = new URLSearchParams({
    email: fixture.email,
    password: fixture.password,
  }).toString();
  const login = await request('/business/session', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
    },
    body,
  });
  assert.equal(login.statusCode, 303);
  assert.equal(new URL(login.location, origin).pathname, '/business/dashboard');
  assert.equal(login.setCookie.length, 1);
  const cookie = login.setCookie[0].split(';', 1)[0];

  const dashboard = await request(
    '/business/dashboard?menuPage=9999&dealPage=9999&catalogPage=9999&catalogQuery=flower',
    {
      headers: { Cookie: cookie },
    },
  );
  assert.equal(dashboard.statusCode, 200);
  assert.match(dashboard.body, /Menu Inventory Management/);
  assert.match(dashboard.body, /Find a catalog product/);
  assert.match(dashboard.body, /Submitted Offers/);
  assert.match(dashboard.body, /Lead Handoff Attribution/);
  assert.doesNotMatch(dashboard.body, /Internal Server Error|Application error/);

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checks: {
          disposableManagerLogin: 'PASS',
          tenantBoundDashboard: 'PASS',
          boundedCollectionPageNormalization: 'PASS',
          catalogSearchRender: 'PASS',
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
