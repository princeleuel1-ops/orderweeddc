import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EDUCATION_PAGE_SIZE,
  EDUCATION_QUERY_MAX_LENGTH,
  clampEducationPage,
  educationHubHref,
  educationPageCount,
  educationPageOffset,
  parseEducationHubSearch,
  parseEducationSearch,
} from '../src/lib/education-search.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');

test('education search is scalar, normalized, and bounded', () => {
  assert.equal(parseEducationSearch('  Sour   Diesel  '), 'Sour Diesel');
  assert.equal(parseEducationSearch(['first', 'second']), 'first');
  assert.equal(parseEducationSearch({}), '');
  assert.equal(
    parseEducationSearch(`A\u0000${'b'.repeat(200)}`).length,
    EDUCATION_QUERY_MAX_LENGTH,
  );
});

test('education collection pages are normalized, clamped, and preserved', () => {
  assert.deepEqual(
    parseEducationHubSearch({
      strain: ['  Sour   Diesel ', 'ignored'],
      articlePage: '0002',
      strainPage: '9999',
    }),
    {
      strain: 'Sour Diesel',
      articlePage: 1,
      strainPage: 1_000,
    },
  );
  assert.equal(educationPageCount(EDUCATION_PAGE_SIZE * 2 + 1), 3);
  assert.equal(clampEducationPage(99, EDUCATION_PAGE_SIZE + 1), 2);
  assert.equal(educationPageOffset(3), EDUCATION_PAGE_SIZE * 2);
  assert.equal(
    educationHubHref(
      { strain: 'Sour Diesel', articlePage: 2, strainPage: 3 },
      'articlePage',
      4,
    ),
    '/education?strain=Sour+Diesel&articlePage=4&strainPage=3',
  );
  assert.throws(
    () =>
      educationHubHref(
        { strain: '', articlePage: 1, strainPage: 1 },
        'unknownPage',
        2,
      ),
    /Unknown education collection/,
  );
});

test('education discovery and detail routes use the public evidence boundary', () => {
  const hubSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/education/page.tsx'),
    'utf8',
  );
  const articleSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/education/[slug]/page.tsx'),
    'utf8',
  );

  assert.match(hubSource, /publicCatalogRecordWhere\(asOf\)/);
  assert.match(hubSource, /article\.findMany\(\{\s*where: publicRecordWhere/);
  assert.match(hubSource, /product\.findMany\(\{\s*where:\s*strainWhere/);
  assert.match(hubSource, /parseEducationHubSearch/);
  assert.match(hubSource, /maxLength=\{EDUCATION_QUERY_MAX_LENGTH\}/);
  assert.match(hubSource, /prisma\.article\.count/);
  assert.match(hubSource, /prisma\.product\.count/);
  assert.match(hubSource, /skip: educationPageOffset\(search\.articlePage\)/);
  assert.match(hubSource, /skip: educationPageOffset\(search\.strainPage\)/);
  assert.equal(
    (hubSource.match(/take: EDUCATION_PAGE_SIZE/g) ?? []).length,
    2,
  );
  assert.match(articleSource, /publicCatalogRecordWhere\(asOf\)/);
  assert.match(articleSource, /article\.findFirst/);
  assert.doesNotMatch(articleSource, /article\.findUnique/);
  assert.doesNotMatch(articleSource, /brand\.logo|\/logo\.png/);
  assert.match(articleSource, /article\.verifiedAt\.toISOString\(\)/);
});

test('each indexable public surface owns its canonical URL', () => {
  const tenantLayout = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/layout.tsx'),
    'utf8',
  );
  const homeSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/page.tsx'),
    'utf8',
  );
  const hubSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/education/page.tsx'),
    'utf8',
  );
  const articleSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/education/[slug]/page.tsx'),
    'utf8',
  );
  const retailerSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/retailer/[id]/page.tsx'),
    'utf8',
  );

  assert.doesNotMatch(tenantLayout, /alternates:/);
  assert.match(homeSource, /canonical:\s*['"]\/['"]/);
  assert.match(hubSource, /canonical:\s*['"]\/education['"]/);
  assert.match(
    articleSource,
    /canonical:\s*`\/education\/\$\{encodeURIComponent\(slug\)\}`/,
  );
  assert.match(
    retailerSource,
    /canonical:\s*`\/retailer\/\$\{encodeURIComponent\(id\)\}`/,
  );
});

test('the database-backed sitemap stays fresh between releases', () => {
  const sitemapSource = fs.readFileSync(
    path.join(webRoot, 'src/app/sitemap.ts'),
    'utf8',
  );
  const packageSource = fs.readFileSync(
    path.join(webRoot, 'package.json'),
    'utf8',
  );

  assert.match(sitemapSource, /export const dynamic = ['"]force-dynamic['"]/);
  assert.match(packageSource, /http-education-check\.mjs/);
});
