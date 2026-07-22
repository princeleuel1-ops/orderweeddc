import assert from 'node:assert/strict';
import http from 'node:http';

const host = process.env.CANA_HTTP_HOST || 'orderweeddc.localhost:3000';
const crossTenantHost =
  process.env.CANA_CROSS_TENANT_HOST || 'wellness.localhost:3000';
const port = Number(process.env.CANA_HTTP_PORT || '3000');

function request(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const requestStartedAt = performance.now();
    const method = options.method || 'GET';
    const requestHost = options.host || host;
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path: pathname,
        method,
        headers: { Host: requestHost, ...options.headers },
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
            host: requestHost,
            method,
            statusCode: response.statusCode,
            location: response.headers.location || null,
            cacheControl: response.headers['cache-control'] || null,
            robotsTag: response.headers['x-robots-tag'] || null,
            contentSecurityPolicy:
              response.headers['content-security-policy'] || null,
            strictTransportSecurity:
              response.headers['strict-transport-security'] || null,
            contentTypeOptions:
              response.headers['x-content-type-options'] || null,
            frameOptions: response.headers['x-frame-options'] || null,
            referrerPolicy: response.headers['referrer-policy'] || null,
            permissionsPolicy: response.headers['permissions-policy'] || null,
            openerPolicy:
              response.headers['cross-origin-opener-policy'] || null,
            poweredBy: response.headers['x-powered-by'] || null,
            body,
            latencyMs: Math.round(performance.now() - requestStartedAt),
          });
        });
      },
    );

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function assertTruthfulHtml(result) {
  assert.equal(result.statusCode, 200, `${result.pathname} returned ${result.statusCode}`);
  assert.match(
    result.body,
    /Demonstration (?:only|environment)|synthetic development data/i,
    `${result.pathname} did not expose a demonstration label`,
  );

  const forbiddenClaims = [
    /Verified Reviews/i,
    /verified results/i,
    /Map Integration Active/i,
    /Retailers are strictly verified/i,
    /All listed medical dispensaries are compliant/i,
    /real-time product menus/i,
    /Open Now/i,
  ];

  for (const forbiddenClaim of forbiddenClaims) {
    assert.doesNotMatch(
      result.body,
      forbiddenClaim,
      `${result.pathname} rendered unsupported claim ${forbiddenClaim}`,
    );
  }
  assert.doesNotMatch(
    result.body,
    /(?:Ã|Â|ðŸ|ï¸|â(?:€|†|€¢))/u,
    `${result.pathname} rendered double-encoded text`,
  );
}

const directory = await request('/');
assertTruthfulHtml(directory);

const retailerMatch = directory.body.match(/href="\/retailer\/([^"?]+)"/);
assert.ok(retailerMatch, 'Directory did not render a retailer detail link');
const retailerPath = `/retailer/${retailerMatch[1]}`;
const comparisonRetailerIds = [
  ...new Set(
    [...directory.body.matchAll(/href="\/retailer\/([^"?]+)"/g)].map(
      (match) => match[1],
    ),
  ),
].slice(0, 4);
assert.ok(
  comparisonRetailerIds.length >= 2,
  'Directory did not render enough public retailer records to compare',
);
const comparisonParams = new URLSearchParams();
for (const id of comparisonRetailerIds.slice(0, 2)) {
  comparisonParams.append('retailer', id);
}
const comparisonPath = `/compare?${comparisonParams.toString()}`;
const oversizedComparisonParams = new URLSearchParams();
for (const id of comparisonRetailerIds) {
  oversizedComparisonParams.append('retailer', id);
}
oversizedComparisonParams.append('retailer', '../private');
const oversizedComparisonPath =
  `/compare?${oversizedComparisonParams.toString()}`;
const oversizedQuery = encodeURIComponent('x'.repeat(256));

const [
  neighborhood,
  comparison,
  crossTenantComparison,
  boundedComparison,
  products,
  filteredProducts,
  verifiedProducts,
  crossTenantProducts,
  boundedProducts,
  education,
  retailer,
  health,
  crossTenantRetailer,
  crossTenantCorrection,
  hostileHost,
  publicCanonical,
  mappedBrand,
  mappedDelivery,
  mappedNear,
  productionMappedDelivery,
  gatedBrand,
  gatedHealth,
  isolatedBrand,
  nonCanonicalAdmin,
  publicSitemap,
  verifiedDirectory,
  boundedDirectory,
  boundedRetailer,
] = await Promise.all([
  request('/neighborhoods/georgetown'),
  request(comparisonPath),
  request(comparisonPath, { host: crossTenantHost }),
  request(oversizedComparisonPath),
  request('/products'),
  request(
    '/products?query=Blue+Dream&category=flower&strainType=hybrid&serviceType=delivery&evidence=DEMONSTRATION_ONLY&stock=IN_STOCK&priceBand=25_TO_50&sort=PRICE_ASC',
  ),
  request('/products?evidence=VERIFIED_CURRENT'),
  request('/products', { host: crossTenantHost }),
  request(
    `/products?query=${oversizedQuery}&category=private&strainType=magic&serviceType=drone&evidence=VERIFIED_FOREVER&stock=LIVE&priceBand=FREE&sort=SPONSORED&page=99999`,
  ),
  request('/education'),
  request(retailerPath),
  request('/api/health'),
  request(retailerPath, { host: crossTenantHost }),
  request(`${retailerPath}/correction`, { host: crossTenantHost }),
  request('/api/health', { host: 'attacker.example' }),
  request('/', { host: 'orderweeddc.com' }),
  request('/', { host: `georgetowndispensarydc.localhost:${port}` }),
  request('/', { host: `dmvweeddelivery.localhost:${port}` }),
  request('/', { host: `weedneardc.localhost:${port}` }),
  request('/', { host: 'dmvweeddelivery.com' }),
  request('/', { host: `districtweed.localhost:${port}` }),
  request('/api/health', { host: `districtweed.localhost:${port}` }),
  request('/', { host: `weeddmv.localhost:${port}` }),
  request('/admin/login', { host: `wellness.localhost:${port}` }),
  request('/sitemap.xml', { host: 'orderweeddc.com' }),
  request('/?status=VERIFIED_CURRENT'),
  request(
    `/?query=${oversizedQuery}&type=unsupported&status=VERIFIED_FOREVER&sort=SPONSORED&page=99999`,
  ),
  request(`${retailerPath}?menuPage=9999&dealPage=9999`),
]);

for (const result of [
  neighborhood,
  comparison,
  products,
  filteredProducts,
  education,
  retailer,
]) {
  assertTruthfulHtml(result);
}
assert.match(
  directory.body,
  new RegExp(
    `<link rel="canonical" href="http://orderweeddc\\.localhost:${port}/?"`,
  ),
);
assert.match(
  education.body,
  new RegExp(
    `<link rel="canonical" href="http://orderweeddc\\.localhost:${port}/education"`,
  ),
);
assert.match(
  retailer.body,
  new RegExp(
    `<link rel="canonical" href="http://orderweeddc\\.localhost:${port}${retailerPath}"`,
  ),
);
assert.match(
  products.body,
  new RegExp(
    `<link rel="canonical" href="http://orderweeddc\\.localhost:${port}/products"`,
  ),
);
assert.doesNotMatch(
  education.body,
  new RegExp(
    `<link rel="canonical" href="http://orderweeddc\\.localhost:${port}/?"`,
  ),
);
assert.match(
  neighborhood.body,
  /<meta name="robots" content="noindex, nofollow, nocache"/,
);
assert.match(
  comparison.body,
  /<meta name="robots" content="noindex, nofollow, nocache"/,
);
assert.match(comparison.body, /Compare records, not hype/i);
assert.match(comparison.body, /Evidence-eligible menu/i);
assert.match(comparison.body, /Paid placement/i);
assert.equal(crossTenantComparison.statusCode, 200);
assert.doesNotMatch(
  crossTenantComparison.body,
  new RegExp(`/retailer/${comparisonRetailerIds[0]}`),
);
assert.match(
  crossTenantComparison.body,
  /could not be displayed inside this tenant/i,
);
assert.match(
  boundedComparison.body,
  /duplicate, malformed, or excess selection/i,
);
assert.match(
  boundedComparison.body,
  /evaluates no more than/i,
);
assert.match(boundedComparison.body, /records at once/i);
assert.match(products.body, /Products with a provenance trail/i);
assert.match(
  products.body,
  /Default order does not use sponsorship, popularity, reviews/i,
);
assert.match(products.body, /Inspect evidence chain/i);
assert.match(filteredProducts.body, /Blue Dream/i);
assert.match(filteredProducts.body, /Sample price/i);
assert.equal(verifiedProducts.statusCode, 200);
assert.match(
  verifiedProducts.body,
  /No product evidence chains match these controls/i,
);
assert.doesNotMatch(
  verifiedProducts.body,
  /Blue Dream|Sour Diesel|Wana Sour Gummies/,
  'Demonstration products leaked through the verified-current evidence filter',
);
assert.equal(crossTenantProducts.statusCode, 200);
assert.doesNotMatch(
  crossTenantProducts.body,
  /Blue Dream|Sour Diesel|Wana Sour Gummies/,
  'Main-tenant products leaked through the cross-tenant product route',
);
assert.equal(boundedProducts.statusCode, 200);
assert.doesNotMatch(
  boundedProducts.body,
  /Internal Server Error|Application error/,
);
assert.match(
  products.body,
  /<meta name="robots" content="noindex, nofollow"/,
);
assertTruthfulHtml(publicCanonical);
assert.match(
  publicCanonical.body,
  /rel="canonical" href="https:\/\/orderweeddc\.com\/?"/,
);

assert.equal(health.statusCode, 200, `/api/health returned ${health.statusCode}`);
const healthBody = JSON.parse(health.body);
assert.equal(healthBody.status, 'HEALTHY');
assert.equal(healthBody.services.runtime?.status, 'DIRECT_LOCAL');
assert.equal(
  healthBody.services.runtime?.details?.externalModelExecution,
  false,
);
assert.equal(
  healthBody.services.runtime?.details?.externalModelCredentialInspection,
  false,
);
assert.equal(healthBody.services.openrouter, undefined);
assert.doesNotMatch(
  health.body,
  /fingerprint|OPENROUTER_API_KEY|activeKeysCount/i,
  'Health response exposed retired provider credential metadata',
);
assert.equal(
  crossTenantRetailer.statusCode,
  404,
  `${retailerPath} leaked through ${crossTenantHost}`,
);
assert.equal(
  crossTenantCorrection.statusCode,
  404,
  `${retailerPath}/correction leaked through ${crossTenantHost}`,
);
assert.equal(hostileHost.statusCode, 421);
assert.equal(hostileHost.cacheControl, 'no-store');
assert.doesNotMatch(hostileHost.body, /brandCount|database|runtime/i);
assert.ok([307, 308].includes(mappedBrand.statusCode));
assert.equal(
  mappedBrand.location,
  `http://orderweeddc.localhost:${port}/neighborhoods/georgetown`,
);
assert.ok([307, 308].includes(mappedDelivery.statusCode));
assert.equal(
  mappedDelivery.location,
  `http://orderweeddc.localhost:${port}/?type=delivery`,
);
assert.ok([307, 308].includes(mappedNear.statusCode));
assert.equal(
  mappedNear.location,
  `http://orderweeddc.localhost:${port}/`,
);
assert.ok([307, 308].includes(productionMappedDelivery.statusCode));
assert.equal(
  productionMappedDelivery.location,
  'https://orderweeddc.com/?type=delivery',
);
assert.equal(gatedBrand.statusCode, 403);
assert.equal(gatedBrand.cacheControl, 'no-store');
assert.equal(gatedBrand.robotsTag, 'noindex, nofollow, noarchive');
assert.match(gatedBrand.body, /parked pending brand clearance/i);
assert.match(gatedBrand.body, /name="robots" content="noindex, nofollow, noarchive"/);
assert.doesNotMatch(gatedBrand.body, /database|runtime|brandCount/i);
assert.equal(gatedHealth.statusCode, 403);
assert.equal(gatedHealth.cacheControl, 'no-store');
assert.equal(gatedHealth.robotsTag, 'noindex, nofollow, noarchive');
assert.equal(isolatedBrand.statusCode, 403);
assert.equal(isolatedBrand.cacheControl, 'no-store');
assert.equal(isolatedBrand.robotsTag, 'noindex, nofollow, noarchive');
assert.match(isolatedBrand.body, /isolated pending infrastructure/i);
assert.doesNotMatch(isolatedBrand.body, /database|runtime|brandCount/i);
assert.equal(nonCanonicalAdmin.statusCode, 421);
assert.equal(nonCanonicalAdmin.cacheControl, 'no-store');
assert.equal(publicSitemap.statusCode, 200);
assert.match(publicSitemap.body, /https:\/\/orderweeddc\.com/);
assert.doesNotMatch(publicSitemap.body, /\.localhost/);

for (const result of [directory, health]) {
  assert.match(result.contentSecurityPolicy, /default-src 'self'/);
  assert.match(result.contentSecurityPolicy, /script-src-attr 'none'/);
  assert.match(result.contentSecurityPolicy, /object-src 'none'/);
  assert.match(result.contentSecurityPolicy, /frame-ancestors 'none'/);
  assert.doesNotMatch(
    result.contentSecurityPolicy,
    /upgrade-insecure-requests/,
  );
  assert.equal(
    result.strictTransportSecurity,
    'max-age=63072000; includeSubDomains',
  );
  assert.equal(result.contentTypeOptions, 'nosniff');
  assert.equal(result.frameOptions, 'DENY');
  assert.equal(result.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.match(result.permissionsPolicy, /camera=\(\)/);
  assert.equal(result.openerPolicy, 'same-origin');
  assert.equal(result.poweredBy, null);
}
assert.equal(verifiedDirectory.statusCode, 200);
const verifiedDirectoryText = verifiedDirectory.body.replace(/<!-- -->/g, '');
assert.match(
  verifiedDirectoryText,
  /0-0[\s\S]*of[\s\S]*0[\s\S]*labeled results/i,
);
assert.doesNotMatch(
  verifiedDirectory.body,
  /Demo Retailer (?:Alpha|Beta|Gamma|Delta|Epsilon)/,
  'Demonstration records leaked through the verified-current filter',
);
assert.equal(
  boundedDirectory.statusCode,
  200,
  'Bounded directory input handling returned an error',
);
assert.equal(
  boundedRetailer.statusCode,
  200,
  'Bounded retailer collection input handling returned an error',
);
assert.doesNotMatch(
  boundedRetailer.body,
  /Internal Server Error|Application error/,
);
assert.match(
  directory.body,
  /Sponsorship is labeled and never changes directory order/i,
);
assert.doesNotMatch(
  boundedDirectory.body,
  /<option value="SPONSORED" selected/i,
);

const [
  adminLogin,
  businessLogin,
  businessClaim,
  customerLogin,
  adminProtected,
  businessProtected,
  walletProtected,
  customerInvalidLogin,
  customerForeignOrigin,
] = await Promise.all([
  request('/admin/login'),
  request('/business/login'),
  request('/business/claim'),
  request('/customer/login'),
  request('/admin'),
  request('/business/dashboard'),
  request('/wallet'),
  request('/customer/session', {
    method: 'POST',
    headers: {
      Origin: `http://${host}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'email=http-auth-invalid%40example.invalid&password=invalid',
  }),
  request('/customer/session', {
    method: 'POST',
    headers: {
      Origin: 'https://attacker.example',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'email=http-auth-invalid%40example.invalid&password=invalid',
  }),
]);

assert.equal(adminLogin.statusCode, 200);
assert.match(
  adminLogin.body,
  /<meta name="robots" content="noindex, nofollow, nocache"/,
);
assert.equal(businessLogin.statusCode, 200);
assert.match(
  businessLogin.body,
  /<meta name="robots" content="noindex, nofollow, nocache"/,
);
assert.equal(
  businessLogin.cacheControl,
  'private, no-store, max-age=0',
);
assert.equal(businessLogin.robotsTag, 'noindex, nofollow, noarchive');
assert.equal(businessClaim.statusCode, 200);
assert.match(
  businessClaim.body,
  /<meta name="robots" content="noindex, nofollow, nocache"/,
);
assert.equal(
  businessClaim.cacheControl,
  'private, no-store, max-age=0',
);
assert.equal(businessClaim.robotsTag, 'noindex, nofollow, noarchive');
assert.match(businessClaim.body, /name="password"/);
assert.match(businessClaim.body, /name="passwordConfirmation"/);
assert.match(businessClaim.body, /one-way hash/i);
assert.doesNotMatch(
  businessClaim.body,
  /requestedPasswordHash|scrypt\$/,
  'Public claim form exposed an internal credential representation',
);
assert.equal(customerLogin.statusCode, 200);
assert.match(
  customerLogin.body,
  /<meta name="robots" content="noindex, nofollow, nocache"/,
);
assert.equal(
  customerLogin.cacheControl,
  'private, no-store, max-age=0',
);
assert.equal(customerLogin.robotsTag, 'noindex, nofollow, noarchive');
assert.ok([303, 307].includes(adminProtected.statusCode));
assert.equal(adminProtected.location, '/admin/login');
assert.ok([303, 307].includes(businessProtected.statusCode));
assert.equal(businessProtected.location, '/business/login');
assert.ok([303, 307].includes(walletProtected.statusCode));
assert.equal(walletProtected.location, '/customer/login');
assert.doesNotMatch(
  walletProtected.body,
  /Jane Doe|Total Holdings Balance|SignUp Welcome Reward|Route Handoff Order Reward/,
  'Anonymous wallet response exposed seeded customer data',
);
assert.equal(customerInvalidLogin.statusCode, 303);
const invalidLoginLocation = new URL(
  customerInvalidLogin.location,
  `http://${host}`,
);
assert.equal(invalidLoginLocation.origin, `http://${host}`);
assert.equal(
  `${invalidLoginLocation.pathname}${invalidLoginLocation.search}`,
  '/customer/login?error=invalid',
);
assert.equal(customerForeignOrigin.statusCode, 403);

console.log(
  JSON.stringify(
    {
      host,
      routes: [
        directory,
        neighborhood,
        comparison,
        crossTenantComparison,
        boundedComparison,
        products,
        filteredProducts,
        verifiedProducts,
        crossTenantProducts,
        boundedProducts,
        education,
        retailer,
        health,
        crossTenantRetailer,
        crossTenantCorrection,
        hostileHost,
        publicCanonical,
        mappedBrand,
        mappedDelivery,
        mappedNear,
        productionMappedDelivery,
        gatedBrand,
        gatedHealth,
        isolatedBrand,
        nonCanonicalAdmin,
        publicSitemap,
        verifiedDirectory,
        boundedDirectory,
        boundedRetailer,
        adminLogin,
        businessLogin,
        businessClaim,
        customerLogin,
        adminProtected,
        businessProtected,
        walletProtected,
        customerInvalidLogin,
        customerForeignOrigin,
      ].map(
        ({ pathname, host: requestHost, method, statusCode, latencyMs }) => ({
          pathname,
          host: requestHost,
          method,
          statusCode,
          latencyMs,
        }),
      ),
      truthLabels: 'PASS',
      unsupportedClaims: 'PASS',
      authorizationRedirects: 'PASS',
      customerWalletIsolation: 'PASS',
      customerFormOriginPolicy: 'PASS',
      tenantRetailerIsolation: 'PASS',
      providerFreeRuntime: 'PASS',
      freshnessAwareVerifiedFilter: 'PASS',
      boundedDirectorySearch: 'PASS',
      sponsorshipNeutralDirectoryOrder: 'PASS',
      boundedRetailerCollections: 'PASS',
      boundedTenantSafeComparison: 'PASS',
      boundedTenantSafeProductDiscovery: 'PASS',
      businessClaimCredentialPrivacy: 'PASS',
      exactHostBoundary: 'PASS',
      mappedAndGatedHostRouting: 'PASS',
      canonicalProductionAlias: 'PASS',
      canonicalSitemap: 'PASS',
      selfCanonicalPublicRoutes: 'PASS',
      demonstrationAndAdminNoindex: 'PASS',
      privateAndClosedSurfaceNoindex: 'PASS',
      mojibakeFreeHtml: 'PASS',
      responseSecurityHeaders: 'PASS',
    },
    null,
    2,
  ),
);
