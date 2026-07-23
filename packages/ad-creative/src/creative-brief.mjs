/**
 * Creative brief: one brief per product — every advertisement features a
 * different verified product, so a campaign for a retailer with N eligible
 * products yields N distinct, brand-consistent variants.
 *
 * Text policy (research-driven): every 2026 frontier model nets NEGATIVE
 * typography sentiment in blind creative evals. So the generated image
 * NEVER carries marketing or compliance text. Exact text — the 21+ marker,
 * the license line, and the "Sponsored" label — is composed as a
 * deterministic overlay layer where it is pixel-exact and auditable.
 */

export const REQUIRED_OVERLAY = Object.freeze({
  ageMarker: '21+ only',
  sponsoredLabel: 'Sponsored',
});

export const ALLOWED_CHANNELS = Object.freeze([
  'featured-placement', // labeled Featured slot on orderweeddc (never organic order)
  'merchant-website',
  'merchant-email',
  'merchant-in-store',
]);

export const ALLOWED_ASPECT_RATIOS = Object.freeze([
  '1:1',
  '4:5',
  '9:16',
  '16:9',
]);

/**
 * @param {{
 *   brandProfile: ReturnType<typeof import('./brand-profile.mjs').buildBrandProfile>,
 *   product: { name: string, category: string, strainType?: string|null, dataStatus: string },
 *   campaign: { channel: string, aspectRatio?: string, sceneDirection?: string },
 * }} input
 */
export function buildCreativeBrief({ brandProfile, product, campaign }) {
  if (!brandProfile?.business?.licenseNumber) {
    throw new TypeError('buildCreativeBrief requires a completed brand profile');
  }
  if (!product || product.dataStatus !== 'VERIFIED_CURRENT') {
    throw new Error(
      'buildCreativeBrief refuses non-verified products — the truth chain reaches the ad layer',
    );
  }
  if (!ALLOWED_CHANNELS.includes(campaign?.channel)) {
    throw new Error(
      `campaign.channel must be one of ${ALLOWED_CHANNELS.join(', ')} — organic directory placement is never an ad channel`,
    );
  }
  const aspectRatio = campaign.aspectRatio ?? '1:1';
  if (!ALLOWED_ASPECT_RATIOS.includes(aspectRatio)) {
    throw new Error(`aspectRatio must be one of ${ALLOWED_ASPECT_RATIOS.join(', ')}`);
  }

  const palette = brandProfile.logo.dominantColorsHex.join(', ');
  const prompt = [
    `Professional product photograph for a licensed Washington, D.C. cannabis retailer named "${brandProfile.business.name}".`,
    `Featured product: ${product.name} (${product.category}${product.strainType ? `, ${product.strainType}` : ''}).`,
    `Brand palette: ${palette || 'neutral studio tones'}.`,
    `Brand tone: ${brandProfile.logo.tone || 'clean, professional, trustworthy'}.`,
    campaign.sceneDirection ?? 'Clean studio scene, soft directional lighting, shallow depth of field, premium retail presentation.',
    'Adults-only professional context. Absolutely no people under 40 apparent age, no cartoon characters, no candy imagery, no medical or pharmaceutical props, no imagery appealing to minors.',
    'Do not render any text, letters, numbers, or logos inside the image — all text is composed separately.',
  ].join(' ');

  return Object.freeze({
    business: brandProfile.business,
    product: Object.freeze({ ...product }),
    channel: campaign.channel,
    aspectRatio,
    prompt,
    overlayText: Object.freeze({
      ageMarker: REQUIRED_OVERLAY.ageMarker,
      sponsoredLabel: REQUIRED_OVERLAY.sponsoredLabel,
      licenseLine: `${brandProfile.business.name} · License ${brandProfile.business.licenseNumber} (${brandProfile.business.licenseSource})`,
      headline: campaign.headline ?? product.name,
    }),
  });
}
