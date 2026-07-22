import assert from 'node:assert/strict';
import http from 'node:http';
import { PrismaClient } from '@prisma/client';

const host = process.env.CANA_HTTP_HOST || 'orderweeddc.localhost:3000';
const port = Number(process.env.CANA_HTTP_PORT || '3000');
const prisma = new PrismaClient();
const fixture = {
  slug: 'http-education-truth-boundary-fixture',
  title: 'Disposable Education Truth Boundary Fixture',
  content:
    'Disposable evidence-boundary content that must never survive this test.',
};

function request(pathname, requestHost = host) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method: 'GET',
        headers: { Host: requestHost },
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
            body,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function cleanup() {
  await prisma.article.deleteMany({ where: { slug: fixture.slug } });
}

try {
  await cleanup();
  await prisma.article.create({
    data: {
      ...fixture,
      dataStatus: 'AWAITING_VERIFICATION',
      dataSource: 'Disposable HTTP evidence fixture',
      isDemonstration: false,
    },
  });

  const [pendingHub, pendingDetail, pendingSitemap] = await Promise.all([
    request('/education'),
    request(`/education/${fixture.slug}`),
    request('/sitemap.xml', 'orderweeddc.com'),
  ]);
  assert.equal(pendingHub.statusCode, 200);
  assert.doesNotMatch(pendingHub.body, new RegExp(fixture.title));
  assert.equal(pendingDetail.statusCode, 404);
  assert.doesNotMatch(pendingDetail.body, new RegExp(fixture.content));
  assert.equal(pendingSitemap.statusCode, 200);
  assert.doesNotMatch(pendingSitemap.body, new RegExp(fixture.slug));

  const verifiedAt = new Date();
  const freshnessExpiresAt = new Date(verifiedAt);
  freshnessExpiresAt.setUTCDate(freshnessExpiresAt.getUTCDate() + 30);
  await prisma.article.update({
    where: { slug: fixture.slug },
    data: {
      dataStatus: 'VERIFIED_CURRENT',
      retrievedAt: verifiedAt,
      verifiedAt,
      freshnessExpiresAt,
      sourceUrl: 'https://example.gov/evidence/article-fixture',
      confidence: 1,
      reviewedBy: 'http-education-check',
    },
  });

  const [currentHub, currentDetail, currentSitemap] = await Promise.all([
    request('/education'),
    request(`/education/${fixture.slug}`),
    request('/sitemap.xml', 'orderweeddc.com'),
  ]);
  assert.equal(currentHub.statusCode, 200);
  assert.match(currentHub.body, new RegExp(fixture.title));
  assert.equal(currentDetail.statusCode, 200);
  assert.match(currentDetail.body, new RegExp(fixture.content));
  assert.match(
    currentDetail.body,
    new RegExp(
      `<link rel="canonical" href="http://orderweeddc\\.localhost:${port}/education/${fixture.slug}"`,
    ),
  );
  assert.match(
    currentDetail.body,
    /<meta name="robots" content="index, follow"/,
  );
  assert.doesNotMatch(currentDetail.body, /\/logo\.png/);
  assert.equal(currentSitemap.statusCode, 200);
  assert.match(currentSitemap.body, new RegExp(fixture.slug));

  console.log(
    JSON.stringify(
      {
        status: 'PASS',
        checks: {
          awaitingArticleExcludedFromHubDetailAndSitemap: 'PASS',
          currentEvidenceCrossesAllThreeDiscoveryBoundaries: 'PASS',
          articleSelfCanonicalAndIndexPolicy: 'PASS',
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
