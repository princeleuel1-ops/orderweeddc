import { serializeStructuredData } from './seo-truth.mjs';
import { isPubliclyVerified } from './data-status.mjs';
import {
  PUBLIC_PRODUCT_DESCRIPTION,
  PUBLIC_PRODUCT_NAME,
} from './product-brand.mjs';

/**
 * Truth-aware structured data.
 *
 * Search engines and AI answer engines treat JSON-LD as factual claims made
 * by the site. To honor the platform's evidence boundary, builders in this
 * module refuse to emit machine-readable claims for records that have not
 * passed public verification (demonstration, stale, disputed, or pending
 * records return null). Rendering code simply skips null values, so the
 * boundary is enforced in one place.
 */

export function jsonLdScriptProps(value) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: serializeStructuredData(value) },
  };
}

export function organizationJsonLd({ origin }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}#organization`,
    name: PUBLIC_PRODUCT_NAME,
    url: `${origin}/`,
    description: PUBLIC_PRODUCT_DESCRIPTION,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/icon-512.png`,
      width: 512,
      height: 512,
    },
    knowsAbout: [
      'Cannabis retailers in Washington, D.C.',
      'D.C. Initiative 71',
      'Medical cannabis dispensaries',
      'Cannabis product verification',
    ],
  };
}

export function webSiteJsonLd({ origin }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}#website`,
    name: PUBLIC_PRODUCT_NAME,
    url: `${origin}/`,
    description: PUBLIC_PRODUCT_DESCRIPTION,
    publisher: { '@id': `${origin}#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Emits a schema.org Store for a retailer ONLY when the record passes the
 * public evidence boundary. Demonstration/stale/disputed records return null
 * so no synthetic business facts ever reach search engines.
 */
export function retailerJsonLd({ retailer, origin }) {
  if (!retailer || !isPubliclyVerified(retailer)) return null;
  const url = `${origin}/retailer/${retailer.id}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${url}#store`,
    name: retailer.name,
    url,
    address: {
      '@type': 'PostalAddress',
      streetAddress: retailer.address,
      addressLocality: retailer.city || 'Washington',
      addressRegion: retailer.state || 'DC',
      ...(retailer.zip ? { postalCode: retailer.zip } : {}),
      addressCountry: 'US',
    },
  };
  if (Number.isFinite(retailer.lat) && Number.isFinite(retailer.lng)) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: retailer.lat,
      longitude: retailer.lng,
    };
  }
  if (retailer.phone) jsonLd.telephone = retailer.phone;
  // Verification provenance: no major competitor emits machine-readable
  // trust signals. Only reached for records past the evidence boundary, so
  // every property states an observed fact.
  const provenance = [];
  if (retailer.dataSource) {
    provenance.push({
      '@type': 'PropertyValue',
      name: 'verificationSource',
      value: retailer.dataSource,
    });
  }
  if (retailer.verifiedAt?.toISOString) {
    provenance.push({
      '@type': 'PropertyValue',
      name: 'verifiedDate',
      value: retailer.verifiedAt.toISOString(),
    });
  }
  if (retailer.licenseNumber) {
    provenance.push({
      '@type': 'PropertyValue',
      name: 'licenseNumber',
      value: retailer.licenseNumber,
    });
  }
  if (provenance.length > 0) jsonLd.additionalProperty = provenance;
  return jsonLd;
}

export function articleJsonLd({ article, origin }) {
  if (!article || !isPubliclyVerified(article)) return null;
  const url = `${origin}/education/${encodeURIComponent(article.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.title,
    url,
    author: {
      '@type': 'Organization',
      name: article.author || PUBLIC_PRODUCT_NAME,
    },
    publisher: { '@id': `${origin}#organization` },
    datePublished: article.createdAt?.toISOString?.() ?? undefined,
    dateModified: article.updatedAt?.toISOString?.() ?? undefined,
  };
}

export function faqJsonLd(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
}

/**
 * ItemList of publicly verified retailers for directory surfaces. Records
 * failing the evidence boundary are silently excluded.
 */
export function retailerItemListJsonLd({ retailers, origin }) {
  const eligible = (retailers || []).filter((retailer) =>
    isPubliclyVerified(retailer),
  );
  if (eligible.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: eligible.map((retailer, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: retailer.name,
      url: `${origin}/retailer/${retailer.id}`,
    })),
  };
}

/**
 * Honest Product schema for strain-type guide pages. Emits only observed
 * facts: name, category, description, and a count-backed offer pointer into
 * the evidence-eligible product listing. Deliberately NO aggregateRating —
 * synthetic ratings are forbidden by this platform's truth laws.
 */
export function strainProductJsonLd({ strain, slug, recordCount, origin }) {
  if (!strain || typeof slug !== 'string' || slug.length === 0) return null;
  const url = `${origin}/strains/${encodeURIComponent(slug)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}#product`,
    name: `${strain.name} cannabis (category guide)`,
    url,
    description: strain.summary,
    category: 'Cannabis',
  };
  if (Number.isInteger(recordCount) && recordCount > 0) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      offerCount: recordCount,
      availability: 'https://schema.org/InStoreOnly',
      url: `${origin}/products?strainType=${encodeURIComponent(slug)}`,
    };
  }
  return jsonLd;
}

/**
 * Offer schema for a verified, current deal. Demonstration/unverified deals
 * return null. No price is invented: deals carry discount descriptions, so
 * the Offer states name/description/validity/seller only.
 */
export function dealOfferJsonLd({ deal, retailer, origin }) {
  if (!deal || !isPubliclyVerified(deal)) return null;
  if (!retailer || !isPubliclyVerified(retailer)) return null;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    name: deal.title,
    url: `${origin}/retailer/${retailer.id}`,
    seller: { '@id': `${origin}/retailer/${retailer.id}#store` },
    availability: 'https://schema.org/InStoreOnly',
  };
  if (deal.description) jsonLd.description = deal.description;
  if (deal.expiryDate?.toISOString) {
    jsonLd.validThrough = deal.expiryDate.toISOString();
  }
  return jsonLd;
}
