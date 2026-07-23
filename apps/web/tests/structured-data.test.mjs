import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_PRODUCT_DESCRIPTION,
  PUBLIC_PRODUCT_DOMAIN,
  PUBLIC_PRODUCT_NAME,
} from '../src/lib/product-brand.mjs';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  dealItemListJsonLd,
  dealOfferJsonLd,
  faqJsonLd,
  jsonLdScriptProps,
  organizationJsonLd,
  retailerItemListJsonLd,
  retailerJsonLd,
  strainProductJsonLd,
  webSiteJsonLd,
} from '../src/lib/structured-data.mjs';

const ORIGIN = 'https://orderweeddc.com';

function verifiedRetailer(overrides = {}) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    id: 'retailer-1',
    name: 'Verified Dispensary',
    address: '100 Example Ave NW',
    city: 'Washington',
    state: 'DC',
    zip: '20001',
    lat: 38.9,
    lng: -77.03,
    phone: '202-555-0100',
    dataStatus: 'VERIFIED_CURRENT',
    isDemonstration: false,
    verifiedAt: new Date('2026-07-01T00:00:00Z'),
    freshnessExpiresAt: future,
    ...overrides,
  };
}

test('retailerJsonLd emits Store facts only for publicly verified records', () => {
  const jsonLd = retailerJsonLd({ retailer: verifiedRetailer(), origin: ORIGIN });
  assert.equal(jsonLd['@type'], 'Store');
  assert.equal(jsonLd.name, 'Verified Dispensary');
  assert.equal(jsonLd.address.addressRegion, 'DC');
  assert.equal(jsonLd.geo.latitude, 38.9);
  assert.equal(jsonLd.url, `${ORIGIN}/retailer/retailer-1`);
});

test('retailerJsonLd refuses demonstration and unverified records', () => {
  assert.equal(
    retailerJsonLd({
      retailer: verifiedRetailer({ isDemonstration: true, dataStatus: 'DEMONSTRATION_ONLY' }),
      origin: ORIGIN,
    }),
    null,
  );
  assert.equal(
    retailerJsonLd({
      retailer: verifiedRetailer({ dataStatus: 'AWAITING_VERIFICATION' }),
      origin: ORIGIN,
    }),
    null,
  );
  assert.equal(
    retailerJsonLd({
      retailer: verifiedRetailer({ freshnessExpiresAt: new Date('2020-01-01') }),
      origin: ORIGIN,
    }),
    null,
  );
  assert.equal(retailerJsonLd({ retailer: null, origin: ORIGIN }), null);
});

test('retailerItemListJsonLd silently excludes non-verified records', () => {
  const jsonLd = retailerItemListJsonLd({
    retailers: [
      verifiedRetailer(),
      verifiedRetailer({ id: 'demo-1', isDemonstration: true, dataStatus: 'DEMONSTRATION_ONLY' }),
    ],
    origin: ORIGIN,
  });
  assert.equal(jsonLd.itemListElement.length, 1);
  assert.equal(jsonLd.itemListElement[0].url, `${ORIGIN}/retailer/retailer-1`);
});

test('retailerItemListJsonLd returns null when nothing is verified', () => {
  assert.equal(
    retailerItemListJsonLd({
      retailers: [verifiedRetailer({ dataStatus: 'STALE' })],
      origin: ORIGIN,
    }),
    null,
  );
  assert.equal(retailerItemListJsonLd({ retailers: [], origin: ORIGIN }), null);
});

test('articleJsonLd honors the evidence boundary', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const article = {
    slug: 'understanding-terpenes',
    title: 'Understanding Terpenes',
    author: 'Editorial Staff',
    dataStatus: 'VERIFIED_CURRENT',
    isDemonstration: false,
    verifiedAt: new Date('2026-07-01T00:00:00Z'),
    freshnessExpiresAt: future,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };
  const jsonLd = articleJsonLd({ article, origin: ORIGIN });
  assert.equal(jsonLd['@type'], 'Article');
  assert.equal(jsonLd.headline, 'Understanding Terpenes');
  assert.match(jsonLd.url, /education\/understanding-terpenes$/);
  assert.equal(
    articleJsonLd({
      article: { ...article, dataStatus: 'AWAITING_VERIFICATION' },
      origin: ORIGIN,
    }),
    null,
  );
});

test('breadcrumb and faq builders validate their inputs', () => {
  assert.equal(breadcrumbJsonLd([]), null);
  assert.equal(faqJsonLd([]), null);
  const crumb = breadcrumbJsonLd([
    { name: 'Home', url: `${ORIGIN}/` },
    { name: 'Legal', url: `${ORIGIN}/legal` },
  ]);
  assert.equal(crumb.itemListElement.length, 2);
  assert.equal(crumb.itemListElement[1].position, 2);
  const faq = faqJsonLd([{ question: 'Q?', answer: 'A.' }]);
  assert.equal(faq.mainEntity[0].acceptedAnswer.text, 'A.');
});

test('organization and website graph nodes share stable identifiers', () => {
  const organization = organizationJsonLd({ origin: ORIGIN });
  const site = webSiteJsonLd({ origin: ORIGIN });
  assert.equal(organization['@id'], `${ORIGIN}#organization`);
  assert.equal(site.publisher['@id'], `${ORIGIN}#organization`);
  assert.match(
    site.potentialAction.target.urlTemplate,
    /query=\{search_term_string\}$/,
  );
});

test('jsonLdScriptProps escapes HTML-significant characters', () => {
  const props = jsonLdScriptProps({ name: '</script><img src=x>' });
  assert.equal(props.type, 'application/ld+json');
  assert.ok(!props.dangerouslySetInnerHTML.__html.includes('</script>'));
  assert.ok(props.dangerouslySetInnerHTML.__html.includes('\\u003c'));
});

test('product-brand.ts and product-brand.mjs stay literally identical', () => {
  const webRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  );
  const tsSource = fs.readFileSync(
    path.join(webRoot, 'src/lib/product-brand.ts'),
    'utf8',
  );
  assert.ok(tsSource.includes(`PUBLIC_PRODUCT_NAME = '${PUBLIC_PRODUCT_NAME}'`));
  assert.ok(
    tsSource.includes(`PUBLIC_PRODUCT_DOMAIN = '${PUBLIC_PRODUCT_DOMAIN}'`),
  );
  assert.ok(tsSource.includes(PUBLIC_PRODUCT_DESCRIPTION));
});

test('retailerJsonLd emits verification provenance for verified records', () => {
  const retailer = verifiedRetailer({
    dataSource: 'DC ABCA Registry',
    licenseNumber: 'ABCA-123',
  });
  const jsonLd = retailerJsonLd({ retailer, origin: ORIGIN });
  const names = jsonLd.additionalProperty.map((property) => property.name);
  assert.deepEqual(names, ['verificationSource', 'verifiedDate', 'licenseNumber']);
  assert.equal(jsonLd.additionalProperty[0].value, 'DC ABCA Registry');
  assert.equal(jsonLd.additionalProperty[2].value, 'ABCA-123');
});

test('strainProductJsonLd states only observed facts and never ratings', () => {
  const strain = { name: 'Sativa', summary: 'An industry label.' };
  const jsonLd = strainProductJsonLd({
    strain,
    slug: 'sativa',
    recordCount: 7,
    origin: ORIGIN,
  });
  assert.equal(jsonLd['@type'], 'Product');
  assert.equal(jsonLd.offers.offerCount, 7);
  assert.equal(jsonLd.aggregateRating, undefined);
  assert.equal(jsonLd.review, undefined);
  const zero = strainProductJsonLd({ strain, slug: 'sativa', recordCount: 0, origin: ORIGIN });
  assert.equal(zero.offers, undefined);
  assert.equal(strainProductJsonLd({ strain: null, slug: 'sativa', recordCount: 1, origin: ORIGIN }), null);
});

test('dealOfferJsonLd requires both deal and retailer to pass verification', () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const deal = {
    title: '20% off first order',
    description: 'Verified current offer.',
    expiryDate: future,
    dataStatus: 'VERIFIED_CURRENT',
    isDemonstration: false,
    verifiedAt: new Date('2026-07-01T00:00:00Z'),
    freshnessExpiresAt: future,
  };
  const retailer = verifiedRetailer();
  const jsonLd = dealOfferJsonLd({ deal, retailer, origin: ORIGIN });
  assert.equal(jsonLd['@type'], 'Offer');
  assert.equal(jsonLd.validThrough, future.toISOString());
  assert.equal(jsonLd.price, undefined);
  assert.equal(
    dealOfferJsonLd({
      deal: { ...deal, isDemonstration: true, dataStatus: 'DEMONSTRATION_ONLY' },
      retailer,
      origin: ORIGIN,
    }),
    null,
  );
  assert.equal(
    dealOfferJsonLd({
      deal,
      retailer: verifiedRetailer({ dataStatus: 'STALE' }),
      origin: ORIGIN,
    }),
    null,
  );
});

test('dealItemListJsonLd emits a machine-readable collection of only verified deals', () => {
  const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const base = {
    dataStatus: 'VERIFIED_CURRENT',
    isDemonstration: false,
    verifiedAt: new Date('2026-07-01T00:00:00Z'),
    freshnessExpiresAt: future,
  };
  const verifiedDeal = {
    ...base,
    title: '20% off first order',
    expiryDate: future,
    retailer: verifiedRetailer(),
  };
  const demoDeal = {
    ...base,
    dataStatus: 'DEMONSTRATION_ONLY',
    isDemonstration: true,
    title: 'Demo offer',
    expiryDate: future,
    retailer: verifiedRetailer(),
  };
  const staleRetailerDeal = {
    ...base,
    title: 'Verified deal, stale store',
    expiryDate: future,
    retailer: verifiedRetailer({ dataStatus: 'STALE' }),
  };

  const list = dealItemListJsonLd({
    deals: [verifiedDeal, demoDeal, staleRetailerDeal],
    origin: ORIGIN,
  });
  assert.equal(list['@type'], 'ItemList');
  assert.equal(list.numberOfItems, 1); // only the fully-verified deal
  assert.equal(list.itemListElement.length, 1);
  assert.equal(list.itemListElement[0].position, 1);
  assert.equal(list.itemListElement[0].item['@type'], 'Offer');
  assert.equal(list.itemListElement[0].item.validThrough, future.toISOString());
  // No price is ever invented on a deal offer.
  assert.equal(list.itemListElement[0].item.price, undefined);

  // Empty/unverified inputs yield null, never an empty ItemList.
  assert.equal(dealItemListJsonLd({ deals: [], origin: ORIGIN }), null);
  assert.equal(dealItemListJsonLd({ deals: [demoDeal], origin: ORIGIN }), null);
});
