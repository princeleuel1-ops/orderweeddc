import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_QUEUE_MAX_PAGE,
  ADMIN_QUEUE_PAGE_SIZE,
  adminQueueHref,
  clampQueuePage,
  parseAdminDashboardSearch,
  queuePageCount,
  queuePageOffset,
} from '../src/lib/admin-dashboard.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');

test('administrator queue pages are normalized, bounded, and independently preserved', () => {
  assert.deepEqual(
    parseAdminDashboardSearch({
      evidencePage: '2',
      claimPage: ['3', '900'],
      disputePage: '-1',
      stalePage: '9999',
    }),
    {
      evidencePage: 2,
      claimPage: 3,
      disputePage: 1,
      stalePage: ADMIN_QUEUE_MAX_PAGE,
    },
  );

  assert.equal(
    adminQueueHref(
      {
        evidencePage: 2,
        claimPage: 3,
        disputePage: 1,
        stalePage: 1,
      },
      'evidencePage',
      1,
    ),
    '/admin?claimPage=3',
  );
  assert.throws(
    () => adminQueueHref({}, 'unknownPage', 2),
    /Unknown administrator queue/,
  );
});

test('queue offsets and page counts use the fixed release bound', () => {
  assert.equal(ADMIN_QUEUE_PAGE_SIZE, 25);
  assert.equal(queuePageCount(0), 1);
  assert.equal(queuePageCount(25), 1);
  assert.equal(queuePageCount(26), 2);
  assert.equal(clampQueuePage(99, 26), 2);
  assert.equal(queuePageOffset(2), 25);
  assert.throws(() => queuePageCount(-1), TypeError);
});

test('the administrator dashboard uses counts, minimal queue projections, and bounded reads', () => {
  const source = fs.readFileSync(
    path.join(webRoot, 'src/app/admin/page.tsx'),
    'utf8',
  );

  assert.doesNotMatch(
    source,
    /prisma\.retailer\.findMany\(\{\s*include:\s*\{\s*evidence:\s*true,\s*leads:\s*true/,
  );
  assert.match(source, /prisma\.retailer\.count\(\)/);
  assert.match(source, /prisma\.licenseEvidence\.count/);
  assert.match(source, /prisma\.dispute\.count/);
  assert.match(source, /prisma\.claimRequest\.count/);
  assert.match(source, /take: ADMIN_QUEUE_PAGE_SIZE/g);
  assert.match(source, /skip: queuePageOffset\(/g);
  assert.match(source, /evidence:\s*\{[\s\S]*?take: 1/);
  assert.match(source, /<QueuePagination/g);
});
