import assert from 'node:assert/strict';
import test from 'node:test';
import { createProvider } from '../src/provider-contract.mjs';
import { createGeminiProvider } from '../src/providers/gemini.mjs';
import { analyzeBrandLogo, buildBrandProfile } from '../src/brand-profile.mjs';
import { buildCreativeBrief, ALLOWED_CHANNELS } from '../src/creative-brief.mjs';
import { verifyCreative, assertPostable, FORBIDDEN_CLAIMS } from '../src/verification.mjs';
import { runAdCreativePipeline, POSTING_LAW } from '../src/pipeline.mjs';

const PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function mockProvider(overrides = {}) {
  return createProvider({
    name: 'mock',
    model: 'mock-image-1',
    async generateImage() {
      return {
        imageBase64: PIXEL,
        mimeType: 'image/png',
        receipt: { provider: 'mock', generatedAt: '2026-07-23T00:00:00.000Z' },
      };
    },
    async analyzeImage({ instruction }) {
      if (instruction.includes('auditing a business logo')) {
        return {
          dominantColorsHex: ['#0e9f5a', '#0a7443'],
          typographyStyle: 'geometric sans',
          iconography: 'leaf mark',
          tone: 'clean, professional',
          doNotAlter: ['leaf mark'],
          minorsAppealRisk: false,
          receipt: {},
          ...overrides.logoAnalysis,
        };
      }
      return {
        containsMinorsAppeal: false,
        containsHealthClaims: false,
        containsRenderedText: false,
        matchesBrand: true,
        summary: 'clean studio product scene',
        receipt: {},
        ...overrides.imageAnalysis,
      };
    },
  });
}

const BUSINESS = {
  name: 'Anacostia Organics',
  licenseNumber: 'ABCA-000042',
  licenseSource: 'DC ABCA Registry (DC GIS open data)',
};
const PRODUCTS = [
  { name: 'Blue Dream 3.5g', category: 'Flower', strainType: 'sativa', dataStatus: 'VERIFIED_CURRENT' },
  { name: 'Solar Gummies', category: 'Edibles', dataStatus: 'VERIFIED_CURRENT' },
  { name: 'Stale Beacon', category: 'Flower', dataStatus: 'STALE' },
];
const LOGO = { imageBase64: PIXEL, mimeType: 'image/png' };
const CAMPAIGN = { channel: 'featured-placement', aspectRatio: '1:1' };

test('provider contract rejects incomplete implementations', () => {
  assert.throws(() => createProvider({ name: 'x', model: 'y' }), TypeError);
  assert.throws(() => createProvider({ name: '', model: 'y', generateImage() {}, analyzeImage() {} }), TypeError);
});

test('gemini adapter refuses to construct without an API key', () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.throws(() => createGeminiProvider(), /GEMINI_API_KEY is not configured/);
  } finally {
    if (saved !== undefined) process.env.GEMINI_API_KEY = saved;
  }
});

test('gemini adapter never hardcodes a key and uses injected fetch', async () => {
  const calls = [];
  const provider = createGeminiProvider({
    apiKey: 'test-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ inlineData: { mimeType: 'image/png', data: PIXEL } }] } },
          ],
        }),
      };
    },
  });
  const image = await provider.generateImage({ prompt: 'studio scene', aspectRatio: '1:1' });
  assert.equal(image.imageBase64, PIXEL);
  assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);
  assert.match(calls[0].url, /key=test-key/);
});

test('brand profile requires logo analysis first and filters to verified products', async () => {
  const provider = mockProvider();
  const logoAnalysis = await analyzeBrandLogo({ provider, logoBase64: PIXEL, mimeType: 'image/png' });
  assert.deepEqual(logoAnalysis.dominantColorsHex, ['#0e9f5a', '#0a7443']);

  const profile = buildBrandProfile({ business: BUSINESS, logoAnalysis, products: PRODUCTS });
  assert.equal(profile.products.length, 2);
  assert.ok(profile.products.every((product) => product.dataStatus === 'VERIFIED_CURRENT'));

  assert.throws(
    () => buildBrandProfile({ business: BUSINESS, logoAnalysis: null, products: PRODUCTS }),
    /generation before brand analysis is forbidden/,
  );
  assert.throws(
    () =>
      buildBrandProfile({
        business: BUSINESS,
        logoAnalysis,
        products: [{ name: 'Demo', category: 'Flower', dataStatus: 'DEMONSTRATION_ONLY' }],
      }),
    /only feature products with a live evidence chain/,
  );
});

test('creative brief is per-product, bans in-image text, and rejects organic channel', async () => {
  const provider = mockProvider();
  const logoAnalysis = await analyzeBrandLogo({ provider, logoBase64: PIXEL, mimeType: 'image/png' });
  const profile = buildBrandProfile({ business: BUSINESS, logoAnalysis, products: PRODUCTS });

  const brief = buildCreativeBrief({ brandProfile: profile, product: profile.products[0], campaign: CAMPAIGN });
  assert.match(brief.prompt, /Blue Dream 3\.5g/);
  assert.match(brief.prompt, /Do not render any text/);
  assert.equal(brief.overlayText.ageMarker, '21+ only');
  assert.equal(brief.overlayText.sponsoredLabel, 'Sponsored');
  assert.match(brief.overlayText.licenseLine, /ABCA-000042/);

  assert.throws(
    () => buildCreativeBrief({ brandProfile: profile, product: profile.products[0], campaign: { channel: 'organic-directory' } }),
    /organic directory placement is never an ad channel/,
  );
  assert.ok(!ALLOWED_CHANNELS.includes('organic-directory'));
});

test('full pipeline produces one verified creative per eligible product', async () => {
  const provider = mockProvider();
  const result = await runAdCreativePipeline({
    provider,
    business: BUSINESS,
    logo: LOGO,
    products: PRODUCTS,
    campaign: CAMPAIGN,
  });
  assert.equal(result.creatives.length, 2); // stale product excluded
  for (const creative of result.creatives) {
    assert.equal(creative.verification.status, 'PASS');
    assert.equal(creative.postable, false);
    assert.equal(creative.verification.receipt.imageSha256.length, 64);
  }
  assert.equal(result.postingLaw, POSTING_LAW);
});

test('verification fails on health claims, rendered text, and minors appeal', async () => {
  const healthy = await runAdCreativePipeline({
    provider: mockProvider(),
    business: BUSINESS,
    logo: LOGO,
    products: PRODUCTS,
    campaign: { ...CAMPAIGN, headline: 'Pain relief guaranteed' },
    productName: 'Blue Dream 3.5g',
  });
  assert.equal(healthy.creatives[0].verification.status, 'FAIL');
  assert.ok(healthy.creatives[0].verification.receipt.failedChecks.includes('no-health-claims'));
  assert.ok(FORBIDDEN_CLAIMS.includes('pain relief'));

  const renderedText = await runAdCreativePipeline({
    provider: mockProvider({ imageAnalysis: { containsRenderedText: true } }),
    business: BUSINESS,
    logo: LOGO,
    products: PRODUCTS,
    campaign: CAMPAIGN,
    productName: 'Blue Dream 3.5g',
  });
  assert.ok(renderedText.creatives[0].verification.receipt.failedChecks.includes('no-rendered-text'));

  const minors = await runAdCreativePipeline({
    provider: mockProvider({ imageAnalysis: { containsMinorsAppeal: true } }),
    business: BUSINESS,
    logo: LOGO,
    products: PRODUCTS,
    campaign: CAMPAIGN,
    productName: 'Blue Dream 3.5g',
  });
  assert.ok(minors.creatives[0].verification.receipt.failedChecks.includes('image-safety'));
});

test('logo flagged for minors appeal halts the pipeline before generation', async () => {
  await assert.rejects(
    () =>
      runAdCreativePipeline({
        provider: mockProvider({ logoAnalysis: { minorsAppealRisk: true } }),
        business: BUSINESS,
        logo: LOGO,
        products: PRODUCTS,
        campaign: CAMPAIGN,
      }),
    /minors-appeal risk/,
  );
});

test('assertPostable requires machine PASS AND a named human approval', async () => {
  const result = await runAdCreativePipeline({
    provider: mockProvider(),
    business: BUSINESS,
    logo: LOGO,
    products: PRODUCTS,
    campaign: CAMPAIGN,
    productName: 'Blue Dream 3.5g',
  });
  const { verification } = result.creatives[0];

  assert.throws(
    () => assertPostable({ verification, humanApproval: null }),
    /named human approval/,
  );
  assert.throws(
    () => assertPostable({ verification: { status: 'FAIL', receipt: { failedChecks: ['x'] } }, humanApproval: { approvedBy: 'founder', approvedAt: '2026-07-23T00:00:00.000Z' } }),
    /posting is forbidden/,
  );
  const postable = assertPostable({
    verification,
    humanApproval: { approvedBy: 'founder', approvedAt: '2026-07-23T00:00:00.000Z' },
  });
  assert.equal(postable.postable, true);
  assert.equal(postable.imageSha256, verification.receipt.imageSha256);
});
