import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { DataStatusBadge } from '@/components/data-status-badge';
import {
  DC_NEIGHBORHOOD_MAP,
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_QUERY_MAX_LENGTH,
  currentDealWhere,
  directoryRetailerOrderBy,
  directoryRetailerWhere,
  directorySearchHref,
  parseDirectorySearch,
} from '@/lib/directory-search.mjs';
import { canonicalPlatformUrl } from '@/lib/server-request-url';
import { PUBLIC_DEAL_PREVIEW_LIMIT } from '@/lib/retailer-detail-search.mjs';
import { CANONICAL_TENANT_DOMAIN } from '@/lib/tenant-host.mjs';
import { PUBLIC_PRODUCT_DESCRIPTION } from '@/lib/product-brand';
import RetailerMapLoader from '@/components/retailer-map-loader';
import FavoriteButton from '@/components/favorite-button';

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{
    query?: string | string[];
    type?: string | string[];
    status?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

export const metadata = {
  alternates: {
    canonical: '/',
  },
};

export default async function TenantHomePage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const requestedFilters = parseDirectorySearch(resolvedSearchParams);
  const canonicalHome = await canonicalPlatformUrl('/');

  // 1. Fetch current brand
  const brand = await prisma.brand.findUnique({
    where: { domain: resolvedParams.domain },
  });

  if (!brand) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 bg-[#0B0F12] text-brand-text">
        <h1 className="text-2xl font-bold text-red-500 mb-2">404 - Brand Not Found</h1>
        <p className="text-slate-600">The requested hostname is not configured on this network.</p>
        <Link href={canonicalHome} className="mt-4 text-[#1EC36A] hover:underline">
          Go to Main Network Portal
        </Link>
      </div>
    );
  }

  // 2. Query a bounded page of retailers matching this brand and truth state.
  const asOf = new Date();
  const where = directoryRetailerWhere({
    brandId: brand.id,
    filters: requestedFilters,
    asOf,
  });
  const totalResults = await prisma.retailer.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalResults / DIRECTORY_PAGE_SIZE));
  const currentPage = Math.min(requestedFilters.page, totalPages);
  const retailers = await prisma.retailer.findMany({
    where,
    include: {
      deals: {
        where: currentDealWhere(asOf),
        orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        take: PUBLIC_DEAL_PREVIEW_LIMIT,
      },
    },
    orderBy: [...directoryRetailerOrderBy(requestedFilters.sort)],
    skip: (currentPage - 1) * DIRECTORY_PAGE_SIZE,
    take: DIRECTORY_PAGE_SIZE,
  });
  const firstResult =
    totalResults === 0 ? 0 : (currentPage - 1) * DIRECTORY_PAGE_SIZE + 1;
  const lastResult = Math.min(
    currentPage * DIRECTORY_PAGE_SIZE,
    totalResults,
  );
  const hasFilters = Boolean(
      requestedFilters.query ||
      requestedFilters.type ||
      requestedFilters.status ||
      requestedFilters.sort !== 'TRUTH_FIRST',
  );

  return (
    <div className="flex-grow flex flex-col animate-fade-in">
      {/* Search Header Banner */}
      <section className="bg-brand-surface border-b border-brand-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-brand-text mb-2">
              {brand.domain === CANONICAL_TENANT_DOMAIN
                ? 'Washington D.C. Cannabis Discovery' 
                : brand.name}
            </h1>
            <p className="text-sm text-slate-600 max-w-xl">
              {brand.domain === CANONICAL_TENANT_DOMAIN
                ? PUBLIC_PRODUCT_DESCRIPTION
                : brand.description ||
                  'Explore listings with explicit source and freshness labels.'}
            </p>
            <Link
              href="/products"
              className="mt-4 inline-flex rounded-md border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-xs font-black text-brand-primary transition-colors hover:bg-brand-primary hover:text-black"
            >
              Explore evidence-aware products →
            </Link>
          </div>

          {/* Quick Filters */}
          <div className="space-y-3">
            <form method="GET" className="flex flex-wrap items-center gap-2 text-xs">
              <label htmlFor="directory-query" className="sr-only">
                Search retailer listings
              </label>
              <input 
                id="directory-query"
                type="text" 
                name="query" 
                placeholder="Search listings..." 
                defaultValue={requestedFilters.query}
                maxLength={DIRECTORY_QUERY_MAX_LENGTH}
                className="bg-brand-background border border-brand-border text-brand-text px-4 py-2 rounded-md focus:border-brand-primary focus:outline-none w-full sm:w-48 transition-all"
              />
              <label htmlFor="directory-type" className="sr-only">
                Filter by retailer type
              </label>
              <select 
                id="directory-type"
                name="type" 
                defaultValue={requestedFilters.type}
                className="bg-brand-background border border-brand-border text-brand-text px-4 py-2 rounded-md focus:border-brand-primary focus:outline-none transition-all"
              >
                <option value="">All Types</option>
                <option value="delivery">Delivery</option>
                <option value="storefront">Dispensary Storefront</option>
              </select>
              <label htmlFor="directory-status" className="sr-only">
                Filter by data status
              </label>
              <select 
                id="directory-status"
                name="status"
                defaultValue={requestedFilters.status}
                className="bg-brand-background border border-brand-border text-brand-text px-4 py-2 rounded-md focus:border-brand-primary focus:outline-none transition-all"
              >
                <option value="">All Data States</option>
                <option value="VERIFIED_CURRENT">Verified Current</option>
                <option value="AWAITING_VERIFICATION">Awaiting Verification</option>
                <option value="DEMONSTRATION_ONLY">Demonstration Only</option>
                <option value="STALE">Stale</option>
                <option value="DISPUTED">Disputed</option>
              </select>
              <label htmlFor="directory-sort" className="sr-only">
                Sort retailer listings
              </label>
              <select
                id="directory-sort"
                name="sort"
                defaultValue={requestedFilters.sort}
                className="bg-brand-background border border-brand-border text-brand-text px-4 py-2 rounded-md focus:border-brand-primary focus:outline-none transition-all"
              >
                <option value="TRUTH_FIRST">Truth-first</option>
                <option value="RECENTLY_UPDATED">Recently updated</option>
                <option value="NAME_ASC">Name A-Z</option>
                <option value="NEAREST">Nearest First</option>
              </select>
              <Link
                href={directorySearchHref({ ...requestedFilters, status: requestedFilters.status === 'VERIFIED_CURRENT' ? '' : 'VERIFIED_CURRENT' }, 1)}
                className={`px-3 py-2 rounded-md border text-xs font-bold transition-all ${
                  requestedFilters.status === 'VERIFIED_CURRENT'
                    ? 'bg-black text-white border-black'
                    : 'bg-brand-background text-slate-700 border-brand-border hover:border-black'
                }`}
              >
                🟢 Filter Current
              </Link>
              <button type="submit" className="bg-black text-white font-semibold px-4 py-2 rounded-md hover:bg-slate-800 transition-colors cursor-pointer">
                Filter
              </button>
              {hasFilters && (
                <Link href="/" className="text-slate-600 hover:text-brand-text px-2 py-2">
                  Clear
                </Link>
              )}
            </form>

            {/* Neighborhood Quick Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Neighborhoods:</span>
              {Object.entries(DC_NEIGHBORHOOD_MAP).map(([key, item]) => {
                const isActive = requestedFilters.neighborhood === key;
                return (
                  <Link
                    key={key}
                    href={directorySearchHref({ ...requestedFilters, neighborhood: isActive ? '' : key }, 1)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                      isActive 
                        ? 'bg-black text-white border-black' 
                        : 'bg-brand-background text-slate-700 border-brand-border hover:border-black'
                    }`}
                  >
                    📍 {item.label}
                  </Link>
                );
              })}
            </div>

            {/* Quick Strain Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Strains:</span>
              {['sativa', 'indica', 'hybrid', 'cbd'].map((strain) => {
                const isActive = requestedFilters.query?.toLowerCase() === strain;
                return (
                  <Link
                    key={strain}
                    href={directorySearchHref({ ...requestedFilters, query: isActive ? '' : strain }, 1)}
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all ${
                      isActive 
                        ? 'bg-black text-white border-black' 
                        : 'bg-brand-background text-slate-700 border-brand-border hover:border-black'
                    }`}
                  >
                    🌿 {strain}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Main Contents (Directory grid + Simulated Map Sidebar) */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Directory Listings */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
            <div>
              Showing{' '}
              <span className="font-semibold text-brand-primary">
                {firstResult}-{lastResult}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-brand-primary">
                {totalResults}
              </span>{' '}
              labeled results
            </div>
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-primary inline-block"></span>
              <span>
                Sponsorship is labeled and never changes directory order
              </span>
            </div>
          </div>

          {retailers.length === 0 ? (
            <div className="border border-brand-border rounded-lg bg-brand-surface p-12 text-center">
              <p className="text-slate-600">No retailers or listings found matching your filters.</p>
              <Link href="/" className="mt-4 inline-block text-brand-primary font-semibold hover:underline">
                Reset Filters
              </Link>
            </div>
          ) : (
            <form action="/compare" method="GET" className="space-y-4">
              <fieldset className="space-y-4">
                <legend className="sr-only">
                  Select up to three retailers to compare
                </legend>
                <div className="flex flex-col gap-3 rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-primary">
                      orderweeddc Trust Lens
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Select up to three records. Compare evidence, freshness,
                      sponsorship, and handoff eligibility without tracking.
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="shrink-0 rounded-md bg-brand-primary px-4 py-2 text-xs font-black text-black transition-opacity hover:opacity-90"
                  >
                    Compare selected
                  </button>
                </div>
                {retailers.map((retailer) => (
                <div 
                  key={retailer.id} 
                  className={`border rounded-lg bg-brand-surface p-5 hover:border-brand-primary/40 transition-all flex flex-col md:flex-row gap-5 ${
                    retailer.isSponsored ? 'border-brand-primary/30 shadow-[0_0_15px_rgba(30,195,106,0.03)]' : 'border-brand-border'
                  }`}
                >
                  {/* Retailer Thumbnail */}
                  <div className="w-full md:w-28 h-20 md:h-28 bg-brand-background border border-brand-border rounded-md flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                    <span className="text-2xl font-black text-brand-primary/10 select-none">
                      {retailer.name.substring(0, 1).toUpperCase()}
                    </span>
                    {retailer.isSponsored && (
                      <span className="absolute top-0 right-0 bg-brand-primary text-black font-black text-[9px] px-1.5 py-0.5 rounded-bl">
                        SPONSORED
                      </span>
                    )}
                  </div>

                  {/* Retailer Details */}
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between border-b border-brand-border pb-2 mb-2">
                      <label
                        htmlFor={`compare-${retailer.id}`}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600"
                      >
                        <input
                          id={`compare-${retailer.id}`}
                          type="checkbox"
                          name="retailer"
                          value={retailer.id}
                          aria-label={`Compare ${retailer.name}`}
                          className="h-3 w-3 accent-[var(--brand-primary)]"
                        />
                        Compare
                      </label>
                      <FavoriteButton retailerId={retailer.id} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-brand-text hover:text-brand-primary transition-colors">
                        <Link href={`/retailer/${retailer.id}`}>{retailer.name}</Link>
                      </h2>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        retailer.type === 'storefront' 
                          ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400' 
                          : 'bg-brand-primary/10 border border-brand-primary/20 text-brand-primary'
                      }`}>
                        {retailer.type}
                      </span>
                      <DataStatusBadge
                        dataStatus={retailer.dataStatus}
                        isDemonstration={retailer.isDemonstration}
                        verifiedAt={retailer.verifiedAt}
                        freshnessExpiresAt={retailer.freshnessExpiresAt}
                        compact
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>{retailer.address}, {retailer.city}</span>
                      <span>•</span>
                      <span>Source: {retailer.dataSource}</span>
                    </div>

                    {/* Amenity Badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[9px] font-bold text-slate-700 bg-brand-background border border-brand-border px-2 py-0.5 rounded">
                        {retailer.type === 'storefront' ? '🏪 In-Store Shopping' : '⚡ Fast Delivery'}
                      </span>
                      <span className="text-[9px] font-bold text-slate-700 bg-brand-background border border-brand-border px-2 py-0.5 rounded">
                        🚗 Curbside Pickup
                      </span>
                      <span className="text-[9px] font-bold text-slate-700 bg-brand-background border border-brand-border px-2 py-0.5 rounded">
                        📋 ABCA Verified
                      </span>
                      <span className="text-[9px] font-bold text-slate-700 bg-brand-background border border-brand-border px-2 py-0.5 rounded">
                        🕒 Daily: 9 AM - 9 PM
                      </span>
                    </div>

                    {/* Direct Contact & Directions Action Bar */}
                    <div className="flex items-center gap-2 pt-2">
                      {retailer.phone && (
                        <a
                          href={`tel:${retailer.phone}`}
                          className="text-[10px] font-extrabold px-2.5 py-1 rounded border border-brand-border bg-brand-surface hover:bg-black hover:text-white transition-colors"
                        >
                          📞 Call
                        </a>
                      )}
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${retailer.name} ${retailer.address} ${retailer.city} ${retailer.state}`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-extrabold px-2.5 py-1 rounded border border-brand-border bg-brand-surface hover:bg-black hover:text-white transition-colors"
                      >
                        🗺️ Directions
                      </a>
                    </div>

                    {/* active deals indicator */}
                    {retailer.deals.length > 0 && (
                      <div className="pt-2">
                        {retailer.deals.map((deal) => (
                          <span key={deal.id} className="inline-flex items-center text-[10px] font-bold text-orange-400 border border-orange-400/20 bg-orange-400/5 px-2 py-0.5 rounded mr-2">
                            🔥 {deal.isDemonstration ? 'Demo offer (not redeemable)' : deal.discount} - {deal.title}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="text-xs text-slate-500 pt-3 border-t border-brand-border/40 mt-3 flex justify-between items-center">
                      <div>
                        License: <span className="font-semibold text-slate-700">
                          {retailer.isDemonstration ? 'Not published for demonstration records' : retailer.licenseNumber || 'Awaiting verification'}
                        </span>
                      </div>
                      <Link 
                        href={`/retailer/${retailer.id}`}
                        className="text-brand-primary font-bold hover:text-brand-secondary transition-colors"
                      >
                        View Data Status & Menu →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              </fieldset>
            </form>
          )}

          {totalPages > 1 && (
            <nav
              aria-label="Directory pagination"
              className="flex items-center justify-between gap-4 border-t border-brand-border pt-4"
            >
              {currentPage > 1 ? (
                <Link
                  href={directorySearchHref(
                    requestedFilters,
                    currentPage - 1,
                  )}
                  className="text-xs font-bold text-brand-primary hover:underline"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-xs text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link
                  href={directorySearchHref(
                    requestedFilters,
                    currentPage + 1,
                  )}
                  className="text-xs font-bold text-brand-primary hover:underline"
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>

        {/* Right Side: Map & Geographic Sidebar */}
        <div className="space-y-4">
          <div className="border border-brand-border rounded-lg bg-brand-surface p-1 flex flex-col h-[380px] sm:h-[500px] relative overflow-hidden shadow-sm">
            <RetailerMapLoader 
              retailers={retailers.map(r => ({
                id: r.id,
                name: r.name,
                lat: r.lat,
                lng: r.lng,
                type: r.type,
              }))}
            />
          </div>

          {/* D.C. Compliance Quick Guide */}
          <div className="border border-brand-border rounded-lg bg-brand-surface p-5 space-y-3">
            <h3 className="text-sm font-bold text-brand-text flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
              D.C. Medical Cannabis Rules
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Licensing and operating status can change. Confirm any business or license claim with the relevant D.C. government source. Demonstration records on this site are synthetic and remain visibly labeled.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
