import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  isLoopbackHostname,
  isStaticAssetPath,
  parseAllowedRequestHost,
  parseRequestAuthority,
} from '../src/lib/host-policy.mjs';
import {
  canonicalOriginForRequestHost,
  originForRequestHost,
  tenantDomainForRequestHostname,
} from '../src/lib/tenant-host.mjs';
import { isAuthorizedTenantRewriteReentry } from '../src/lib/tenant-rewrite.mjs';
import {
  currentPublicRecordWhere,
  serializeStructuredData,
} from '../src/lib/seo-truth.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const AS_OF = new Date('2026-07-17T15:00:00.000Z');

test('request host policy accepts exact platform hosts and rejects authority tricks', () => {
  assert.deepEqual(parseAllowedRequestHost('orderweeddc.localhost:3000'), {
    hostname: 'orderweeddc.localhost',
    port: '3000',
    authority: 'orderweeddc.localhost:3000',
  });
  assert.deepEqual(
    parseAllowedRequestHost('CUSTOM.EXAMPLE:8443', 'custom.example'),
    {
      hostname: 'custom.example',
      port: '8443',
      authority: 'custom.example:8443',
    },
  );
  assert.deepEqual(
    parseAllowedRequestHost('custom.example:8443', 'custom.example'),
    {
      hostname: 'custom.example',
      port: '8443',
      authority: 'custom.example:8443',
    },
  );

  for (const authority of [
    null,
    '',
    'attacker.example',
    'orderweeddc.localhost.evil',
    'orderweeddc.localhost@attacker.example',
    'orderweeddc.localhost/attacker',
    'orderweeddc.localhost:0',
    'orderweeddc.localhost:65536',
    'orderweeddc.localhost:3000, attacker.example',
  ]) {
    assert.equal(parseAllowedRequestHost(authority), null, String(authority));
  }
});

test('public canonical and local development hosts resolve to one tenant', () => {
  assert.equal(
    tenantDomainForRequestHostname('orderweeddc.com'),
    'orderweeddc.localhost',
  );
  assert.equal(
    tenantDomainForRequestHostname('orderweeddc.localhost'),
    'orderweeddc.localhost',
  );
  assert.equal(
    originForRequestHost({
      hostname: 'orderweeddc.com',
      authority: 'orderweeddc.com',
      port: '',
    }).toString(),
    'https://orderweeddc.com/',
  );
  assert.equal(
    canonicalOriginForRequestHost({
      hostname: 'wellness.localhost',
      authority: 'wellness.localhost:3000',
      port: '3000',
    }).toString(),
    'http://orderweeddc.localhost:3000/',
  );
});

test('every route receives the release security header policy', () => {
  const configSource = fs.readFileSync(
    path.join(webRoot, 'next.config.ts'),
    'utf8',
  );
  for (const required of [
    /poweredByHeader:\s*false/,
    /Content-Security-Policy/,
    /default-src 'self'/,
    /script-src-attr 'none'/,
    /object-src 'none'/,
    /base-uri 'self'/,
    /form-action 'self'/,
    /frame-ancestors 'none'/,
    /Strict-Transport-Security/,
    /X-Content-Type-Options/,
    /X-Frame-Options/,
    /Referrer-Policy/,
    /Permissions-Policy/,
    /Cross-Origin-Opener-Policy/,
  ]) {
    assert.match(configSource, required);
  }
  assert.doesNotMatch(configSource, /upgrade-insecure-requests/);
  assert.match(configSource, /private, no-store, max-age=0/);
  assert.match(configSource, /X-Robots-Tag/);
  for (const privateSurface of [
    '/admin/:path*',
    '/business/:path*',
    '/customer/:path*',
    '/wallet/:path*',
  ]) {
    assert.ok(configSource.includes(privateSurface));
  }
});

test('host validation runs before infrastructure and privileged route bypasses', () => {
  const proxySource = fs.readFileSync(
    path.join(webRoot, 'src/proxy.ts'),
    'utf8',
  );
  const hostValidation = proxySource.indexOf(
    'parseAllowedRequestHost(hostnameHeader)',
  );
  const routeBypass = proxySource.indexOf(
    "url.pathname.startsWith('/_next')",
  );
  assert.ok(hostValidation >= 0);
  assert.ok(routeBypass > hostValidation);
  assert.match(proxySource, /status:\s*421/);
  assert.match(proxySource, /X-Robots-Tag/);
  assert.match(proxySource, /noindex, nofollow, noarchive/);
  assert.match(proxySource, /tenantDomainForRequestHostname\(host\)/);
  assert.match(proxySource, /isCanonicalPlatformHostname\(host\)/);
  assert.match(proxySource, /dmvweeddelivery\.com': '\/\?type=delivery'/);
  assert.doesNotMatch(proxySource, /['"]\/(?:delivery|near-me)['"]/);
  assert.match(
    proxySource,
    /\/\(\(\?!_next\/static\|_next\/image\|assets\|favicon\.ico\)\.\*\)/,
  );
});

test('SEO eligibility requires non-demo evidence inside its freshness window', () => {
  assert.deepEqual(currentPublicRecordWhere(AS_OF), {
    isDemonstration: false,
    dataStatus: 'VERIFIED_CURRENT',
    verifiedAt: { not: null },
    freshnessExpiresAt: { gt: AS_OF },
  });
  assert.throws(() => currentPublicRecordWhere(new Date('invalid')));

  const sitemapSource = fs.readFileSync(
    path.join(webRoot, 'src/app/sitemap.ts'),
    'utf8',
  );
  const retailerSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/retailer/[id]/page.tsx'),
    'utf8',
  );
  const articleSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/education/[slug]/page.tsx'),
    'utf8',
  );
  const neighborhoodSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/neighborhoods/[slug]/page.tsx'),
    'utf8',
  );
  assert.match(sitemapSource, /currentPublicRecordWhere\(asOf\)/);
  assert.match(sitemapSource, /CANONICAL_PUBLIC_HOSTNAME/);
  assert.match(sitemapSource, /CANONICAL_TENANT_DOMAIN/);
  assert.doesNotMatch(sitemapSource, /https:\/\/\$\{brand\.domain\}/);
  assert.match(retailerSource, /const indexable = isPubliclyVerified\(retailer\)/);
  assert.match(articleSource, /const indexable = isPubliclyVerified\(article\)/);
  assert.match(articleSource, /\{indexable && \(/);
  assert.match(
    neighborhoodSource,
    /robots:\s*\{\s*index:\s*false,\s*follow:\s*false,\s*nocache:\s*true\s*\}/,
  );
});

test('structured data serialization neutralizes script termination payloads', () => {
  const serialized = serializeStructuredData({
    title: '</script><script>alert(1)</script>',
    ampersand: 'A&B',
  });
  assert.doesNotMatch(serialized, /<|>|&/);
  assert.match(serialized, /\\u003c\/script\\u003e/);
  assert.match(serialized, /A\\u0026B/);
});

test('www.orderweeddc.com is an allowed host that permanently redirects to the apex', () => {
  // Parse: www must be inside the host allowlist (otherwise it would 421).
  assert.deepEqual(parseAllowedRequestHost('www.orderweeddc.com'), {
    hostname: 'www.orderweeddc.com',
    port: '',
    authority: 'www.orderweeddc.com',
  });

  // Behavior contract: the proxy consolidates www onto the canonical apex
  // with a path-and-query-preserving 308 before any tenant routing.
  const proxySource = fs.readFileSync(
    path.join(webRoot, 'src/proxy.ts'),
    'utf8',
  );
  const wwwRedirect = proxySource.indexOf("host === 'www.orderweeddc.com'");
  const tenantRewrite = proxySource.indexOf(
    'tenantDomainForRequestHostname(host)',
  );
  assert.ok(wwwRedirect >= 0, 'www redirect must exist in the proxy');
  assert.ok(
    wwwRedirect < tenantRewrite,
    'www consolidation must run before tenant routing',
  );
  assert.match(proxySource, /url\.pathname \+ url\.search, 'https:\/\/orderweeddc\.com'/);
  assert.match(proxySource, /308/);
});

test('standalone loopback re-entry also requires the process-local marker', () => {
  // Loopback triage helpers behave exactly as the proxy relies on.
  assert.equal(isLoopbackHostname('localhost'), true);
  assert.equal(isLoopbackHostname('127.0.0.1'), true);
  assert.equal(isLoopbackHostname('orderweeddc.com'), false);
  assert.deepEqual(parseRequestAuthority('localhost:3000'), {
    hostname: 'localhost',
    port: '3000',
  });

  // Plain localhost still fails the public allowlist: the re-entry branch
  // is the ONLY path a loopback request can take, and it requires the
  // rewritten tenant prefix to itself be an allowlisted hostname.
  assert.equal(parseAllowedRequestHost('localhost:3000'), null);

  const proxySource = fs.readFileSync(
    path.join(webRoot, 'src/proxy.ts'),
    'utf8',
  );
  const reentry = proxySource.indexOf('isLoopbackHostname(rawAuthority.hostname)');
  const hostValidation = proxySource.indexOf(
    'parseAllowedRequestHost(hostnameHeader)',
  );
  assert.ok(reentry >= 0, 'loopback re-entry branch must exist');
  assert.ok(
    reentry < hostValidation,
    're-entry triage must run before the public host gate',
  );
  assert.match(
    proxySource,
    /parseAllowedRequestHost\(tenantPrefix\)/,
    'the tenant prefix of a loopback re-entry must be allowlist-validated',
  );
  assert.match(proxySource, /TENANT_REWRITE_MARKER_HEADER/);
  assert.equal(
    isAuthorizedTenantRewriteReentry({
      loopbackHostname: 'localhost',
      tenantAllowed: true,
      presentedToken: null,
      expectedToken: 'a'.repeat(32),
    }),
    false,
  );
});

test('static-asset passthrough is extension-scoped, not any-dot: hostname paths are tenant-routed', () => {
  // Real root static files / file-routes pass through.
  for (const asset of [
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
    '/og-default.jpg',
    '/icon-192.png',
    '/manifest.webmanifest',
    '/fonts/inter-var-latin.woff2',
  ]) {
    assert.equal(isStaticAssetPath(asset), true, asset);
  }
  // Hostname-shaped and ordinary content paths do NOT pass through, so the
  // proxy tenant-routes them instead of exposing the [domain] route.
  for (const contentPath of [
    '/wellness.localhost',
    '/luxury.localhost',
    '/orderweeddc.com',
    '/',
    '/pricing',
    '/products',
  ]) {
    assert.equal(isStaticAssetPath(contentPath), false, contentPath);
  }

  const proxySource = fs.readFileSync(
    path.join(webRoot, 'src/proxy.ts'),
    'utf8',
  );
  assert.match(proxySource, /isStaticAssetPath\(url\.pathname\)/);
  assert.doesNotMatch(
    proxySource,
    /url\.pathname\.includes\('\.'\)/,
    'the broad any-dot passthrough must be gone',
  );
});
