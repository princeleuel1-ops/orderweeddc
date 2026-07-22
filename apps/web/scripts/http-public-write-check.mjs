import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from '../src/lib/auth/password.mjs';

const host = process.env.CANA_HTTP_HOST || 'orderweeddc.localhost:3000';
const port = Number(process.env.CANA_HTTP_PORT || '3000');
const origin = `http://${host}`;
const prisma = new PrismaClient();
const runId = randomUUID();
const email = `http-public-${runId}@example.invalid`;
const licenseNumber = `HTTP-${runId}`;
const password = 'HttpPublicSubmission!2026';
let retailerId = null;
let correctionRetailerId = null;
let correctionOriginalStatus = null;
let disputeId = null;
let baselineReservationIds = new Set();
let baselineCounts = null;
let baselineCaptured = false;

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
            headers: response.headers,
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

try {
  baselineReservationIds = new Set(
    (
      await prisma.publicSubmissionEvent.findMany({
        select: { id: true },
      })
    ).map((event) => event.id),
  );
  baselineCaptured = true;
  baselineCounts = {
    retailers: await prisma.retailer.count(),
    claims: await prisma.claimRequest.count(),
    disputes: await prisma.dispute.count(),
    audits: await prisma.auditLog.count(),
    reservations: await prisma.publicSubmissionEvent.count(),
  };

  const forged = await request(
    '/business/claim?error=%3Cstrong%3EForged%20administrator%20warning%3C%2Fstrong%3E',
  );
  assert.equal(forged.statusCode, 200);
  assert.doesNotMatch(forged.body, /bg-red-500\/10/);

  const invalid = await request('/business/claim?error=invalid');
  assert.equal(invalid.statusCode, 200);
  assert.match(
    invalid.body,
    /Please review the submitted fields and try again\./,
  );
  assert.match(invalid.body, /bg-red-500\/10/);

  const oversizedBody = new URLSearchParams({
    name: 'x'.repeat(9 * 1024),
  }).toString();
  const oversized = await request('/business/claim/submission', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(oversizedBody),
    },
    body: oversizedBody,
  });
  assert.equal(oversized.statusCode, 413);

  const crossOrigin = await request('/business/claim/submission', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': 0,
    },
    body: '',
  });
  assert.equal(crossOrigin.statusCode, 403);

  const claimBody = new URLSearchParams({
    name: 'Disposable HTTP Public Retailer',
    address: '100 Disposable Public Avenue NW, Washington, DC',
    email,
    phone: '202-555-0196',
    licenseNumber,
    evidenceUrl: `https://records.example.gov/${runId}.pdf`,
    password,
    passwordConfirmation: password,
  }).toString();
  const accepted = await request('/business/claim/submission', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(claimBody),
      'X-Forwarded-For': '192.0.2.199',
    },
    body: claimBody,
  });
  assert.equal(accepted.statusCode, 303);
  assert.equal(
    new URL(accepted.headers.location, origin).pathname,
    '/business/claim',
  );
  assert.equal(
    new URL(accepted.headers.location, origin).searchParams.get('submitted'),
    '1',
  );

  const claim = await prisma.claimRequest.findFirst({
    where: { email },
    include: {
      retailer: {
        include: { evidence: true },
      },
    },
  });
  assert.ok(claim);
  retailerId = claim.retailerId;
  assert.equal(claim.status, 'PENDING');
  assert.notEqual(claim.requestedPasswordHash, password);
  assert.equal(
    await verifyPassword(password, claim.requestedPasswordHash),
    true,
  );
  assert.equal(claim.retailer.dataStatus, 'AWAITING_VERIFICATION');
  assert.equal(claim.retailer.isDemonstration, false);
  assert.equal(claim.retailer.evidence.length, 1);
  assert.equal(
    claim.retailer.evidence[0].verificationStatus,
    'PENDING',
  );

  const duplicate = await request('/business/claim/submission', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(claimBody),
      'X-Forwarded-For': '192.0.2.199',
    },
    body: claimBody,
  });
  assert.equal(duplicate.statusCode, 303);
  assert.equal(
    new URL(duplicate.headers.location, origin).searchParams.get('error'),
    'duplicate',
  );

  const afterAccepted = {
    retailers: await prisma.retailer.count(),
    claims: await prisma.claimRequest.count(),
    reservations: await prisma.publicSubmissionEvent.count(),
  };
  assert.deepEqual(afterAccepted, {
    retailers: baselineCounts.retailers + 1,
    claims: baselineCounts.claims + 1,
    reservations: baselineCounts.reservations + 1,
  });

  const brand = await prisma.brand.findUnique({
    where: { domain: host.split(':', 1)[0] },
    select: { id: true },
  });
  assert.ok(brand);
  const correctionRetailer = await prisma.retailer.findFirst({
    where: {
      isDemonstration: true,
      menus: {
        some: {
          brandMenus: {
            some: { brandId: brand.id },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  assert.ok(correctionRetailer);
  correctionRetailerId = correctionRetailer.id;
  correctionOriginalStatus = correctionRetailer.dataStatus;

  const correctionBody = new URLSearchParams({
    filedBy: `http-correction-${runId}@example.invalid`,
    fieldName: 'hours',
    newValue: '9:00 AM - 7:00 PM',
    evidenceUrl: `https://records.example.gov/${runId}-hours.pdf`,
    reason:
      'Disposable HTTP correction proving the tenant-bound review workflow.',
  }).toString();
  const correction = await request(
    `/retailer/${correctionRetailerId}/correction/submission`,
    {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(correctionBody),
        'X-Forwarded-For': '192.0.2.200',
      },
      body: correctionBody,
    },
  );
  assert.equal(correction.statusCode, 303);
  assert.equal(
    new URL(correction.headers.location, origin).searchParams.get(
      'submitted',
    ),
    '1',
  );

  const dispute = await prisma.dispute.findFirst({
    where: {
      retailerId: correctionRetailerId,
      filedBy: `http-correction-${runId}@example.invalid`,
    },
  });
  assert.ok(dispute);
  disputeId = dispute.id;
  assert.equal(dispute.status, 'PENDING');
  assert.equal(dispute.oldValue, correctionRetailer.hours);
  const correctionRetailerAfter = await prisma.retailer.findUnique({
    where: { id: correctionRetailerId },
    select: { dataStatus: true },
  });
  assert.equal(correctionRetailerAfter?.dataStatus, 'DEMONSTRATION_ONLY');

  const duplicateCorrection = await request(
    `/retailer/${correctionRetailerId}/correction/submission`,
    {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(correctionBody),
        'X-Forwarded-For': '192.0.2.200',
      },
      body: correctionBody,
    },
  );
  assert.equal(duplicateCorrection.statusCode, 303);
  assert.equal(
    new URL(
      duplicateCorrection.headers.location,
      origin,
    ).searchParams.get('error'),
    'duplicate',
  );
  assert.deepEqual(
    {
      disputes: await prisma.dispute.count(),
      reservations: await prisma.publicSubmissionEvent.count(),
    },
    {
      disputes: baselineCounts.disputes + 1,
      reservations: baselineCounts.reservations + 2,
    },
  );

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checks: {
          untrustedErrorQueryNotRendered: 'PASS',
          allowlistedErrorMessageRendered: 'PASS',
          oversizedPublicPostRejectedWith413: 'PASS',
          crossOriginPublicPostRejectedWith403: 'PASS',
          claimCreatedAtomicallyAndRemainsPrivate: 'PASS',
          duplicateClaimRejectedWithoutAdditionalRows: 'PASS',
          correctionCreatedInsideTenantBoundary: 'PASS',
          duplicateCorrectionRejectedWithoutAdditionalRows: 'PASS',
        },
      },
      null,
      2,
    ),
  );
} finally {
  if (!disputeId) {
    const disposableDispute = await prisma.dispute.findFirst({
      where: { filedBy: `http-correction-${runId}@example.invalid` },
      select: { id: true, retailerId: true },
    });
    disputeId = disposableDispute?.id ?? null;
    correctionRetailerId =
      correctionRetailerId ?? disposableDispute?.retailerId ?? null;
  }
  if (disputeId) {
    await prisma.auditLog.deleteMany({
      where: { details: { contains: disputeId } },
    });
    await prisma.dispute.deleteMany({ where: { id: disputeId } });
  }
  if (correctionRetailerId && correctionOriginalStatus) {
    await prisma.retailer.update({
      where: { id: correctionRetailerId },
      data: { dataStatus: correctionOriginalStatus },
    });
  }
  if (!retailerId) {
    const disposableClaim = await prisma.claimRequest.findFirst({
      where: { email },
      select: { retailerId: true },
    });
    retailerId = disposableClaim?.retailerId ?? null;
  }
  if (retailerId) {
    await prisma.auditLog.deleteMany({
      where: { details: { contains: retailerId } },
    });
    await prisma.retailer.deleteMany({ where: { id: retailerId } });
  }
  if (baselineCaptured) {
    const disposableReservations =
      await prisma.publicSubmissionEvent.findMany({
        where: {
          id: { notIn: [...baselineReservationIds] },
        },
        select: { id: true },
      });
    if (disposableReservations.length > 0) {
      await prisma.publicSubmissionEvent.deleteMany({
        where: {
          id: { in: disposableReservations.map((event) => event.id) },
        },
      });
    }
  }
  if (baselineCounts) {
    assert.deepEqual(
      {
        retailers: await prisma.retailer.count(),
        claims: await prisma.claimRequest.count(),
        disputes: await prisma.dispute.count(),
        audits: await prisma.auditLog.count(),
        reservations: await prisma.publicSubmissionEvent.count(),
      },
      baselineCounts,
      'Disposable HTTP public-write cleanup did not restore the baseline.',
    );
  }
  await prisma.$disconnect();
}
