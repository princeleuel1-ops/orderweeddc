import { DataStatusBadge } from '@/components/data-status-badge';
import { getDataStatusPresentation } from '@/lib/data-status.mjs';
import { safePublicReferenceUrl } from '@/lib/handoff.mjs';
import {
  PRODUCT_DISCOVERY_CATEGORIES,
  PRODUCT_DISCOVERY_EVIDENCE_STATES,
  PRODUCT_DISCOVERY_PAGE_SIZE,
  PRODUCT_DISCOVERY_PRICE_BANDS,
  PRODUCT_DISCOVERY_QUERY_MAX_LENGTH,
  PRODUCT_DISCOVERY_SERVICE_TYPES,
  PRODUCT_DISCOVERY_SORTS,
  PRODUCT_DISCOVERY_STOCK_STATES,
  PRODUCT_DISCOVERY_STRAIN_TYPES,
  clampProductDiscoveryPage,
  parseProductDiscoverySearch,
  productDiscoveryHref,
  productDiscoveryOrderBy,
  productDiscoveryPageCount,
  productDiscoveryPageOffset,
  productDiscoveryWhere,
} from '@/lib/product-discovery.mjs';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{
    query?: string | string[];
    category?: string | string[];
    strainType?: string | string[];
    serviceType?: string | string[];
    evidence?: string | string[];
    stock?: string | string[];
    priceBand?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const CATEGORY_LABELS: Record<string, string> = {
  flower: 'Flower',
  edibles: 'Edibles',
  concentrates: 'Concentrates',
  vapes: 'Vapes',
  'pre-rolls': 'Pre-rolls',
  topicals: 'Topicals',
  accessories: 'Accessories',
};

const STRAIN_LABELS: Record<string, string> = {
  sativa: 'Sativa',
  indica: 'Indica',
  hybrid: 'Hybrid',
  cbd: 'CBD',
};

const EVIDENCE_LABELS: Record<string, string> = {
  VERIFIED_CURRENT: 'Verified current chain',
  DEMONSTRATION_ONLY: 'Includes demonstration data',
};

const PRICE_LABELS: Record<string, string> = {
  UNDER_25: 'Under $25',
  '25_TO_50': '$25 to under $50',
  '50_TO_100': '$50 to under $100',
  '100_PLUS': '$100+',
};

const SORT_LABELS: Record<string, string> = {
  TRUTH_FIRST: 'Truth-first',
  PRICE_ASC: 'Price: low to high',
  PRICE_DESC: 'Price: high to low',
  RECENTLY_UPDATED: 'Recently updated',
};

const getProductDiscoveryBrand = cache((domain: string) =>
  prisma.brand.findUnique({
    where: { domain },
    select: { id: true, name: true },
  }),
);

function formatDate(value: Date | null | undefined) {
  return value ? DATE_FORMAT.format(value) : 'Not recorded';
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined
    ? null
    : `${value.toFixed(1)}%`;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { domain } = await params;
  const brand = await getProductDiscoveryBrand(domain);
  if (!brand) {
    return {
      title: 'Products Not Found | Order Weed DC',
      robots: { index: false, follow: false },
    };
  }

  const asOf = new Date();
  const verifiedProductCount = await prisma.menuEntry.count({
    where: productDiscoveryWhere({
      brandId: brand.id,
      filters: { evidence: 'VERIFIED_CURRENT' },
      asOf,
    }),
  });
  const indexable = verifiedProductCount > 0;

  return {
    title: `Evidence-aware product discovery | ${brand.name}`,
    description:
      'Search tenant-scoped product records with explicit retailer, menu, product, source, and freshness evidence.',
    alternates: {
      canonical: '/products',
    },
    robots: {
      index: indexable,
      follow: indexable,
    },
  };
}

export default async function ProductDiscoveryPage({
  params,
  searchParams,
}: Props) {
  const [{ domain }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const brand = await getProductDiscoveryBrand(domain);
  if (!brand) return notFound();

  const filters = parseProductDiscoverySearch(resolvedSearchParams);
  const asOf = new Date();
  const where = productDiscoveryWhere({
    brandId: brand.id,
    filters,
    asOf,
  });
  const totalResults = await prisma.menuEntry.count({ where });
  const currentPage = clampProductDiscoveryPage(
    filters.page,
    totalResults,
  );
  const totalPages = productDiscoveryPageCount(totalResults);
  const entries = await prisma.menuEntry.findMany({
    where,
    select: {
      id: true,
      price: true,
      quantity: true,
      inStock: true,
      dataStatus: true,
      dataSource: true,
      sourceUrl: true,
      retrievedAt: true,
      verifiedAt: true,
      freshnessExpiresAt: true,
      isDemonstration: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          strainType: true,
          thcPercent: true,
          cbdPercent: true,
          dataStatus: true,
          dataSource: true,
          sourceUrl: true,
          retrievedAt: true,
          verifiedAt: true,
          freshnessExpiresAt: true,
          isDemonstration: true,
        },
      },
      retailer: {
        select: {
          id: true,
          name: true,
          type: true,
          dataStatus: true,
          verifiedAt: true,
          freshnessExpiresAt: true,
          isDemonstration: true,
          isSponsored: true,
        },
      },
    },
    orderBy: [...productDiscoveryOrderBy(filters.sort)],
    skip: productDiscoveryPageOffset(currentPage),
    take: PRODUCT_DISCOVERY_PAGE_SIZE,
  });

  const hasFilters = Boolean(
    filters.query ||
      filters.category ||
      filters.strainType ||
      filters.serviceType ||
      filters.evidence ||
      filters.stock ||
      filters.priceBand ||
      filters.sort !== 'TRUTH_FIRST',
  );
  const firstResult =
    totalResults === 0
      ? 0
      : productDiscoveryPageOffset(currentPage) + 1;
  const lastResult = Math.min(
    currentPage * PRODUCT_DISCOVERY_PAGE_SIZE,
    totalResults,
  );
  const productCatalogLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Washington D.C. Medical Cannabis Catalog',
    numberOfItems: entries.length,
    itemListElement: entries.slice(0, 10).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.product.name,
      description: item.product.description || undefined,
    })),
  };

  return (
    <div className="flex-grow animate-fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productCatalogLd) }}
      />
      <section className="border-b border-brand-border bg-brand-surface px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="text-xs font-bold text-slate-600 transition-colors hover:text-brand-primary"
          >
            ← Back to retailer directory
          </Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-primary">
                orderweeddc Evidence Explorer
              </p>
              <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight text-brand-text sm:text-5xl">
                Products with a provenance trail.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Search only tenant-visible records whose retailer, menu entry,
                and catalog product each pass a public evidence boundary.
                Demonstration prices and availability remain visibly synthetic.
              </p>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">
                21+ only · Not medical advice · Confirm current law and
                retailer eligibility
              </p>
            </div>
            <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 text-xs leading-5 text-slate-700">
              <p className="font-black uppercase tracking-wider text-brand-primary">
                Transparent ranking
              </p>
              <p className="mt-1">
                Default order does not use sponsorship, popularity, reviews,
                inferred preferences, or behavioral profiles. Current
                non-demonstration evidence ranks before labeled samples.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-xl border border-brand-border bg-brand-surface p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black text-brand-text">Discovery controls</h2>
            {hasFilters && (
              <Link
                href="/products"
                className="text-[10px] font-bold uppercase tracking-wider text-brand-primary hover:underline"
              >
                Clear
              </Link>
            )}
          </div>
          <form method="GET" action="/products" className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="product-query"
                className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500"
              >
                Product or retailer
              </label>
              <input
                id="product-query"
                name="query"
                type="search"
                maxLength={PRODUCT_DISCOVERY_QUERY_MAX_LENGTH}
                defaultValue={filters.query}
                placeholder="Search records"
                className="w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-sm text-brand-text outline-none transition-colors focus:border-brand-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Category
                <select
                  name="category"
                  defaultValue={filters.category}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-brand-text outline-none focus:border-brand-primary"
                >
                  <option value="">All categories</option>
                  {PRODUCT_DISCOVERY_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Strain type
                <select
                  name="strainType"
                  defaultValue={filters.strainType}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-brand-text outline-none focus:border-brand-primary"
                >
                  <option value="">All types</option>
                  {PRODUCT_DISCOVERY_STRAIN_TYPES.map((strainType) => (
                    <option key={strainType} value={strainType}>
                      {STRAIN_LABELS[strainType]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Service
                <select
                  name="serviceType"
                  defaultValue={filters.serviceType}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-brand-text outline-none focus:border-brand-primary"
                >
                  <option value="">All services</option>
                  {PRODUCT_DISCOVERY_SERVICE_TYPES.map((serviceType) => (
                    <option key={serviceType} value={serviceType}>
                      {serviceType === 'delivery'
                        ? 'Delivery'
                        : 'Storefront'}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Evidence chain
                <select
                  name="evidence"
                  defaultValue={filters.evidence}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-brand-text outline-none focus:border-brand-primary"
                >
                  <option value="">All eligible records</option>
                  {PRODUCT_DISCOVERY_EVIDENCE_STATES.map((evidence) => (
                    <option key={evidence} value={evidence}>
                      {EVIDENCE_LABELS[evidence]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Price
                <select
                  name="priceBand"
                  defaultValue={filters.priceBand}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-brand-text outline-none focus:border-brand-primary"
                >
                  <option value="">Any listed price</option>
                  {PRODUCT_DISCOVERY_PRICE_BANDS.map((priceBand) => (
                    <option key={priceBand} value={priceBand}>
                      {PRICE_LABELS[priceBand]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Sort
                <select
                  name="sort"
                  defaultValue={filters.sort}
                  className="mt-1.5 w-full rounded-md border border-brand-border bg-brand-background px-3 py-2.5 text-xs font-medium normal-case tracking-normal text-brand-text outline-none focus:border-brand-primary"
                >
                  {PRODUCT_DISCOVERY_SORTS.map((sort) => (
                    <option key={sort} value={sort}>
                      {SORT_LABELS[sort]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-brand-border bg-brand-background/60 p-3 text-xs text-slate-700">
              <input
                name="stock"
                value={PRODUCT_DISCOVERY_STOCK_STATES[0]}
                type="checkbox"
                defaultChecked={filters.stock === 'IN_STOCK'}
                className="mt-0.5 h-4 w-4 accent-[var(--brand-primary)]"
              />
              <span>
                Reported in stock
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                  A report, not a real-time inventory promise. Samples remain
                  labeled.
                </span>
              </span>
            </label>

            <button
              type="submit"
              className="w-full rounded-md bg-black px-4 py-2.5 text-xs font-black text-white transition-colors hover:bg-slate-800 cursor-pointer shadow"
            >
              Apply evidence filters
            </button>
          </form>
        </aside>

        <section aria-labelledby="product-results-heading" className="min-w-0">
          <div className="flex flex-col gap-4 border-b border-brand-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2
                id="product-results-heading"
                className="text-xl font-black text-brand-text"
              >
                Evidence-eligible product records
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing {firstResult}-{lastResult} of {totalResults}. Each card
                represents one retailer-menu-product evidence chain.
              </p>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Page {currentPage} of {totalPages}
            </p>
          </div>

          <nav
            aria-label="Product category shortcuts"
            className="mt-5 flex gap-2 overflow-x-auto pb-2"
          >
            {PRODUCT_DISCOVERY_CATEGORIES.map((category) => (
              <Link
                key={category}
                href={productDiscoveryHref(
                  { ...filters, category },
                  1,
                )}
                aria-current={
                  filters.category === category ? 'page' : undefined
                }
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  filters.category === category
                    ? 'border-black bg-black text-white'
                    : 'border-brand-border bg-brand-surface text-slate-600 hover:border-black hover:text-brand-text'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </Link>
            ))}
          </nav>

          {entries.length === 0 ? (
            <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface p-10 text-center">
              <p className="text-sm font-bold text-brand-text">
                No product evidence chains match these controls.
              </p>
              <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-slate-500">
                orderweeddc does not broaden the query to unverified or cross-tenant
                records. Clear a filter or wait for evidence review.
              </p>
              <Link
                href="/products"
                className="mt-4 inline-block text-xs font-black text-brand-primary hover:underline"
              >
                Reset discovery controls
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
              {entries.map((entry) => {
                const demonstrationChain =
                  entry.isDemonstration ||
                  entry.product.isDemonstration ||
                  entry.retailer.isDemonstration;
                const menuStatus = getDataStatusPresentation(entry, asOf);
                const productStatus = getDataStatusPresentation(
                  entry.product,
                  asOf,
                );
                const retailerStatus = getDataStatusPresentation(
                  entry.retailer,
                  asOf,
                );
                const sourceUrl =
                  safePublicReferenceUrl(entry.sourceUrl) ??
                  safePublicReferenceUrl(entry.product.sourceUrl);
                const sourceLabel =
                  entry.dataSource !== 'Unspecified'
                    ? entry.dataSource
                    : entry.product.dataSource;
                const sourceRetrievedAt =
                  entry.retrievedAt ?? entry.product.retrievedAt;
                const thc = formatPercent(entry.product.thcPercent);
                const cbd = formatPercent(entry.product.cbdPercent);

                return (
                  <article
                    key={entry.id}
                    className="flex min-w-0 flex-col rounded-xl border border-brand-border bg-brand-surface p-5 transition-colors hover:border-brand-primary/30"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-brand-border bg-brand-background px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                            {CATEGORY_LABELS[entry.product.category] ??
                              entry.product.category}
                          </span>
                          <DataStatusBadge
                            dataStatus={entry.dataStatus}
                            isDemonstration={entry.isDemonstration}
                            verifiedAt={entry.verifiedAt}
                            freshnessExpiresAt={
                              entry.freshnessExpiresAt
                            }
                            compact
                          />
                        </div>
                        <h3 className="mt-3 text-lg font-black text-brand-text">
                          {entry.product.name}
                        </h3>
                        <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">
                          {entry.product.description ||
                            'No evidence-backed description is available.'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                          {demonstrationChain
                            ? 'Sample price'
                            : 'Listed price'}
                        </p>
                        <p className="mt-1 text-xl font-black text-brand-primary">
                          ${entry.price.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[10px] font-bold text-slate-600">
                          {demonstrationChain
                            ? 'Sample availability'
                            : entry.inStock
                              ? 'Reported in stock'
                              : 'Reported out of stock'}
                        </p>
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-brand-border bg-brand-background/45 p-3 text-[10px]">
                      <div>
                        <dt className="uppercase tracking-wider text-slate-600">
                          Strain type
                        </dt>
                        <dd className="mt-0.5 font-bold text-slate-700">
                          {entry.product.strainType
                            ? STRAIN_LABELS[entry.product.strainType] ??
                              entry.product.strainType
                            : 'Not recorded'}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wider text-slate-600">
                          Reported quantity
                        </dt>
                        <dd className="mt-0.5 font-bold text-slate-700">
                          {demonstrationChain
                            ? 'Synthetic sample'
                            : entry.quantity ?? 'Unknown'}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wider text-slate-600">
                          THC
                        </dt>
                        <dd className="mt-0.5 font-bold text-slate-700">
                          {thc ?? 'Not recorded'}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wider text-slate-600">
                          CBD
                        </dt>
                        <dd className="mt-0.5 font-bold text-slate-700">
                          {cbd ?? 'Not recorded'}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border pt-4">
                      <div>
                        <Link
                          href={`/retailer/${entry.retailer.id}`}
                          className="text-xs font-black text-brand-text transition-colors hover:text-brand-primary"
                        >
                          {entry.retailer.name}
                        </Link>
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                          {entry.retailer.type}
                          {entry.retailer.isSponsored
                            ? ' · sponsored retailer'
                            : ' · organic listing'}
                        </p>
                      </div>
                      <Link
                        href={`/retailer/${entry.retailer.id}`}
                        className="text-[10px] font-black uppercase tracking-wider text-brand-primary hover:underline"
                      >
                        Inspect retailer →
                      </Link>
                    </div>

                    <details className="mt-4 rounded-lg border border-brand-border bg-brand-background/35 p-3 text-[10px] text-slate-600">
                      <summary className="cursor-pointer font-black uppercase tracking-wider text-slate-700">
                        Inspect evidence chain
                      </summary>
                      <div className="mt-3 space-y-2 leading-5">
                        <p>
                          Retailer: {retailerStatus.label} · Menu:{' '}
                          {menuStatus.label} · Product: {productStatus.label}
                        </p>
                        <p>
                          Source: {sourceLabel || 'Unspecified'}
                          {sourceUrl ? (
                            <>
                              {' '}
                              ·{' '}
                              <a
                                href={sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-brand-primary hover:underline"
                              >
                                cited source
                              </a>
                            </>
                          ) : (
                            ' · no safe public source link'
                          )}
                        </p>
                        <p>
                          Retrieved: {formatDate(sourceRetrievedAt)} · Verified:{' '}
                          {formatDate(entry.verifiedAt)} · Fresh through:{' '}
                          {formatDate(entry.freshnessExpiresAt)}
                        </p>
                        <p>
                          Record changed: {formatDate(entry.updatedAt)}. A
                          menu flag is not a real-time inventory guarantee.
                        </p>
                      </div>
                    </details>
                  </article>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Product discovery pagination"
              className="mt-6 flex items-center justify-between gap-4 border-t border-brand-border pt-5 text-xs"
            >
              {currentPage > 1 ? (
                <Link
                  href={productDiscoveryHref(filters, currentPage - 1)}
                  className="font-black text-brand-primary hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={productDiscoveryHref(filters, currentPage + 1)}
                  className="font-black text-brand-primary hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
