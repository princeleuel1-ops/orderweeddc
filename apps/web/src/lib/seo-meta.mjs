import {
  PUBLIC_PRODUCT_DESCRIPTION,
  PUBLIC_PRODUCT_NAME,
} from './product-brand.mjs';

const TITLE_LIMIT = 65;
const DESCRIPTION_LIMIT = 160;

export function clampSeoText(value, limit) {
  if (typeof value !== 'string') return '';
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= limit) return collapsed;
  return `${collapsed.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Builds a complete Next.js Metadata object for a public page: title,
 * description, canonical, Open Graph, and Twitter card in one call so every
 * route ships consistent, fully-populated social/search metadata.
 *
 * `canonicalPath` must be the path portion only (e.g. "/products").
 */
export function buildPublicMetadata({
  title,
  description,
  canonicalPath = '/',
  ogImagePath = '/og-default.jpg',
  siteName = PUBLIC_PRODUCT_NAME,
  type = 'website',
}) {
  const resolvedTitle = clampSeoText(title || PUBLIC_PRODUCT_NAME, TITLE_LIMIT);
  const resolvedDescription = clampSeoText(
    description || PUBLIC_PRODUCT_DESCRIPTION,
    DESCRIPTION_LIMIT,
  );
  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      siteName,
      type,
      locale: 'en_US',
      url: canonicalPath,
      images: [
        {
          url: ogImagePath,
          width: 1200,
          height: 630,
          alt: `${siteName} — evidence-aware cannabis discovery for Washington, D.C.`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      images: [ogImagePath],
    },
  };
}
