import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataStatusBadge } from '@/components/data-status-badge';
import ReviewModal from '@/components/review-modal';
import ShareButton from '@/components/share-button';
import FavoriteButton from '@/components/favorite-button';
import { isPubliclyVerified } from '@/lib/data-status.mjs';
import {
  currentDealWhere,
  publicCatalogRecordWhere,
} from '@/lib/directory-search.mjs';
import { safePublicWebsiteUrl } from '@/lib/handoff.mjs';
import { tenantRetailerWhere } from '@/lib/tenant-retailer.mjs';
import {
  RETAILER_DEAL_PAGE_SIZE,
  RETAILER_MENU_PAGE_SIZE,
  clampRetailerDetailPage,
  parseRetailerDetailSearch,
  retailerDetailHref,
  retailerDetailPageCount,
  retailerDetailPageOffset,
} from '@/lib/retailer-detail-search.mjs';

type Props = {
  params: Promise<{ domain: string; id: string }>;
  searchParams: Promise<{
    menuPage?: string | string[];
    dealPage?: string | string[];
    menuQuery?: string | string[];
  }>;
};

type RetailerPageKey = 'menuPage' | 'dealPage';

type RetailerSearch = {
  menuPage: number;
  dealPage: number;
};

function RetailerPagination({
  retailerId,
  search,
  pageKey,
  totalItems,
  label,
}: {
  retailerId: string;
  search: RetailerSearch;
  pageKey: RetailerPageKey;
  totalItems: number;
  label: string;
}) {
  const currentPage = search[pageKey];
  const totalPages = retailerDetailPageCount(totalItems, pageKey);
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex items-center justify-between gap-3 border-t border-brand-border pt-4 text-xs"
    >
      {currentPage > 1 ? (
        <Link
          href={retailerDetailHref(
            retailerId,
            search,
            pageKey,
            currentPage - 1,
          )}
          className="font-bold text-brand-primary hover:underline"
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
          href={retailerDetailHref(
            retailerId,
            search,
            pageKey,
            currentPage + 1,
          )}
          className="font-bold text-brand-primary hover:underline"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export async function generateMetadata({ params }: Props) {
  const { domain, id } = await params;
  const brand = await prisma.brand.findUnique({
    where: { domain },
    select: { id: true, name: true },
  });
  if (!brand) {
    return { title: 'Retailer Not Found | Order Weed DC' };
  }

  const retailer = await prisma.retailer.findFirst({
    where: tenantRetailerWhere(brand.id, id),
    select: {
      name: true,
      dataStatus: true,
      isDemonstration: true,
      verifiedAt: true,
      freshnessExpiresAt: true,
    },
  });

  if (!retailer) {
    return { title: 'Retailer Not Found | Order Weed DC' };
  }

  const indexable = isPubliclyVerified(retailer);
  return {
    title: `${retailer.name} Data & Menu | ${brand.name}`,
    description: retailer.isDemonstration
      ? 'A visibly labeled demonstration retailer record with synthetic menu and offer data.'
      : `Source, verification, menu, and contact information for ${retailer.name}.`,
    robots: {
      index: indexable,
      follow: indexable,
    },
    alternates: {
      canonical: `/retailer/${encodeURIComponent(id)}`,
    },
  };
}

export default async function RetailerDetailPage({
  params,
  searchParams,
}: Props) {
  const { domain, id } = await params;
  const rawSearchParams = await searchParams;
  const requestedSearch = parseRetailerDetailSearch(rawSearchParams);

  // 1. Fetch current brand configuration
  const brand = await prisma.brand.findUnique({
    where: { domain: domain },
  });

  if (!brand) return notFound();

  // 2. Fetch the tenant-scoped, publicly discoverable retailer.
  const asOf = new Date();
  const retailer = await prisma.retailer.findFirst({
    where: tenantRetailerWhere(brand.id, id, asOf),
  });

  if (!retailer) return notFound();
  const websiteUrl = safePublicWebsiteUrl(retailer.website);
  const canHandoff = isPubliclyVerified(retailer, asOf) && websiteUrl !== null;

  // 3. Fetch only public catalog records associated with this retailer and brand.
  const catalogRecordWhere = publicCatalogRecordWhere(asOf);
  const dealWhere = {
    retailerId: retailer.id,
    ...currentDealWhere(asOf),
  };
  const menuWhere = {
    retailerId: retailer.id,
    ...catalogRecordWhere,
    brandMenus: {
      some: {
        brandId: brand.id,
      },
    },
    product: catalogRecordWhere,
  };
  const [dealCount, menuCount] = await Promise.all([
    prisma.deal.count({ where: dealWhere }),
    prisma.menuEntry.count({ where: menuWhere }),
  ]);
  const search: RetailerSearch = {
    dealPage: clampRetailerDetailPage(
      requestedSearch.dealPage,
      dealCount,
      'dealPage',
    ),
    menuPage: clampRetailerDetailPage(
      requestedSearch.menuPage,
      menuCount,
      'menuPage',
    ),
  };
  const [deals, menuEntries] = await Promise.all([
    prisma.deal.findMany({
      where: dealWhere,
      orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
      skip: retailerDetailPageOffset(search.dealPage, 'dealPage'),
      take: RETAILER_DEAL_PAGE_SIZE,
    }),
    prisma.menuEntry.findMany({
      where: menuWhere,
      include: {
        product: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: retailerDetailPageOffset(search.menuPage, 'menuPage'),
      take: RETAILER_MENU_PAGE_SIZE,
    }),
  ]);

  // Group menu entries by category
  const categories: Record<string, typeof menuEntries> = {};
  menuEntries.forEach((entry) => {
    const cat = entry.product.category;
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(entry);
  });

  const schemaLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: retailer.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: retailer.address,
      addressLocality: retailer.city,
      addressRegion: retailer.state,
      postalCode: retailer.zip,
      addressCountry: 'US',
    },
    telephone: retailer.phone || undefined,
    url: websiteUrl || undefined,
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-8 flex-grow">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaLd) }}
      />
      
      {/* Back button */}
      <div>
        <Link href="/" className="text-xs font-semibold text-slate-600 hover:text-brand-primary transition-colors flex items-center">
          ← Back to directory
        </Link>
      </div>

      {/* Header Profile Section */}
      <div className="border border-brand-border bg-brand-surface rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-text">{retailer.name}</h1>
            <span className="text-xs bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold px-2.5 py-0.5 rounded-full uppercase">
              {retailer.type}
            </span>
            <DataStatusBadge
              dataStatus={retailer.dataStatus}
              isDemonstration={retailer.isDemonstration}
              verifiedAt={retailer.verifiedAt}
              freshnessExpiresAt={retailer.freshnessExpiresAt}
            />
            <div className="flex items-center gap-2 ml-auto">
              <ShareButton title={retailer.name} />
              <FavoriteButton retailerId={retailer.id} />
            </div>
          </div>

          <p className="text-sm text-slate-600">
            📍 {retailer.address}, {retailer.city}, {retailer.state} {retailer.zip}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            {retailer.phone && (
              <div>📞 {retailer.phone}</div>
            )}
            {retailer.hours && (
              <div className="flex items-center gap-x-4">
                {retailer.phone && <span>•</span>}
                <div>🕒 {retailer.hours}</div>
              </div>
            )}
            {websiteUrl && (
              <div className="flex items-center gap-x-4">
                {(retailer.phone || retailer.hours) && <span>•</span>}
                <div>🌐 <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-brand-primary underline transition-colors">{retailer.website}</a></div>
              </div>
            )}
            {retailer.email && (
              <div className="flex items-center gap-x-4">
                {(retailer.phone || retailer.hours || retailer.website) && <span>•</span>}
                <div>✉️ <a href={`mailto:${retailer.email}`} className="hover:text-brand-primary underline transition-colors">{retailer.email}</a></div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic handoff trigger */}
        {canHandoff ? (
          <form
            action={`/retailer/${retailer.id}/handoff`}
            method="post"
            className="w-full md:w-auto shrink-0"
          >
            <button 
              type="submit"
              className="w-full md:w-auto bg-black text-white font-extrabold text-sm px-6 py-3 rounded-md hover:bg-slate-800 active:scale-98 transition-all shadow-lg cursor-pointer"
            >
              Route to Retailer Menu / Contact →
            </button>
          </form>
        ) : (
          <div className="w-full md:w-auto shrink-0 bg-brand-surface text-slate-500 border border-brand-border text-center font-bold text-xs px-6 py-3 rounded-md cursor-not-allowed select-none">
            🔒 Handoff Locked ({retailer.isDemonstration ? 'Demonstration Record' : websiteUrl ? 'Awaiting Current Verification' : 'No Safe Public Website'})
          </div>
        )}
      </div>

      {/* Profile Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns (Menu & Deals) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Active Deals Banner */}
          {deals.length > 0 && (
            <div className="border border-orange-500/20 bg-orange-500/5 rounded-lg p-5 space-y-3">
              <h2 className="text-md font-bold text-orange-400 flex items-center">
                🔥 Offers (check the data label before use)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {deals.map((deal) => (
                  <div key={deal.id} className="bg-brand-surface border border-brand-border p-4 rounded-md space-y-1">
                    <span className="text-xs font-black text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">
                      {deal.isDemonstration ? 'DEMO OFFER — NOT REDEEMABLE' : deal.discount}
                    </span>
                    <DataStatusBadge
                      dataStatus={deal.dataStatus}
                      isDemonstration={deal.isDemonstration}
                      verifiedAt={deal.verifiedAt}
                      freshnessExpiresAt={deal.freshnessExpiresAt}
                      compact
                    />
                    <h3 className="text-sm font-bold text-brand-text pt-1">{deal.title}</h3>
                    <p className="text-xs text-slate-600">{deal.description}</p>
                    <div className="text-[10px] text-slate-500 pt-2">
                      Code: <span className="font-semibold text-brand-text">{deal.code || 'None'}</span> • Expires: {new Date(deal.expiryDate).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                {dealCount} evidence-eligible offer
                {dealCount === 1 ? '' : 's'}.
              </p>
              <RetailerPagination
                retailerId={retailer.id}
                search={search}
                pageKey="dealPage"
                totalItems={dealCount}
                label="Offer"
              />
            </div>
          )}

          {/* Catalog Menu Grid */}
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-brand-border pb-3 gap-3">
              <h2 className="text-lg font-bold text-brand-text">
                Menu & Availability ({menuCount})
              </h2>
              <form method="GET" className="flex items-center gap-2">
                <label htmlFor="menu-search-input" className="sr-only">Filter menu items</label>
                <input
                  id="menu-search-input"
                  name="menuQuery"
                  type="text"
                  placeholder="Search products..."
                  defaultValue={typeof rawSearchParams.menuQuery === 'string' ? rawSearchParams.menuQuery : ''}
                  className="bg-brand-background border border-brand-border text-brand-text px-3 py-1.5 rounded text-xs focus:border-black focus:outline-none transition-colors"
                />
                <button type="submit" className="bg-black text-white text-xs font-bold px-3.5 py-1.5 rounded hover:bg-slate-800 transition-colors cursor-pointer">
                  Search
                </button>
              </form>
            </div>

            {/* Category Quick Filter Pills */}
            <div className="flex flex-wrap gap-2 pt-1 pb-2">
              {['All', 'Flower', 'Vapes', 'Edibles', 'Concentrates', 'Pre-Rolls'].map((cat) => (
                <Link
                  key={cat}
                  href={`/retailer/${retailer.id}?menuQuery=${cat === 'All' ? '' : cat}`}
                  className="text-[11px] font-extrabold px-3 py-1 rounded-full border border-brand-border bg-brand-surface hover:bg-black hover:text-white transition-all shadow-xs"
                >
                  {cat === 'Flower' ? '🌱 Flower' : cat === 'Vapes' ? '💨 Vapes' : cat === 'Edibles' ? '🍬 Edibles' : cat === 'Concentrates' ? '🧴 Concentrates' : cat}
                </Link>
              ))}
            </div>

            {Object.keys(categories).length === 0 ? (
              <div className="border border-brand-border rounded-lg bg-brand-surface p-12 text-center text-slate-600">
                This retailer has not uploaded any menu items for the {brand.name} platform yet.
              </div>
            ) : (
              <div className="space-y-8">
                {Object.entries(categories).map(([cat, entries]) => (
                  <div key={cat} className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest bg-brand-surface border border-brand-border px-3 py-1.5 rounded-md w-fit">
                      {cat}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {entries.map((entry) => (
                        <div key={entry.id} className="border border-brand-border bg-brand-surface/50 p-4 rounded-lg flex justify-between items-center gap-4 hover:border-brand-primary/20 transition-all">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-brand-text">{entry.product.name}</h4>
                            <DataStatusBadge
                              dataStatus={entry.dataStatus}
                              isDemonstration={entry.isDemonstration}
                              verifiedAt={entry.verifiedAt}
                              freshnessExpiresAt={entry.freshnessExpiresAt}
                              compact
                            />
                            <p className="text-xs text-slate-600 leading-relaxed max-w-xs">{entry.product.description}</p>
                            <div className="flex gap-2 text-[10px] text-slate-500">
                              {entry.product.strainType && (
                                <span className="capitalize">{entry.product.strainType}</span>
                              )}
                              {entry.product.thcPercent && (
                                <span>• THC: {entry.product.thcPercent}%</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <div className="text-[9px] uppercase text-slate-500">
                              {entry.isDemonstration ? 'Sample price' : 'Listed price'}
                            </div>
                            <div className="text-sm font-black text-brand-primary">${entry.price.toFixed(2)}</div>
                            <span className="text-[10px] text-brand-primary/80 font-semibold bg-brand-primary/5 border border-brand-primary/10 px-2 py-0.5 rounded">
                              {entry.isDemonstration ? 'Sample availability' : entry.inStock ? 'In stock' : 'Out of stock'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <RetailerPagination
              retailerId={retailer.id}
              search={search}
              pageKey="menuPage"
              totalItems={menuCount}
              label="Menu"
            />
          </div>

        </div>

        {/* Right Column: Truth Card & Audited Meta */}
        <div className="space-y-6">
          
          {/* TRUTH CARD */}
          <div className="border border-brand-primary/30 shadow-[0_0_15px_rgba(30,195,106,0.03)] bg-brand-surface rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-sm font-bold text-brand-text flex items-center">
                🛡️ Truth Card
              </h2>
              <DataStatusBadge
                dataStatus={retailer.dataStatus}
                isDemonstration={retailer.isDemonstration}
                verifiedAt={retailer.verifiedAt}
                freshnessExpiresAt={retailer.freshnessExpiresAt}
              />
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">Record Source:</span>
                <span className="font-semibold text-slate-700">{retailer.dataSource}</span>
              </div>
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">License Claim:</span>
                <span className="font-semibold text-slate-700">
                  {retailer.isDemonstration ? 'Not published for demonstration records' : retailer.licenseNumber || 'Awaiting verification'}
                </span>
              </div>
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">Verified At:</span>
                <span className="font-semibold text-slate-700">
                  {retailer.verifiedAt ? new Date(retailer.verifiedAt).toLocaleDateString() : 'Not verified'}
                </span>
              </div>
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">Freshness Expires:</span>
                <span className="font-semibold text-slate-700">
                  {retailer.freshnessExpiresAt ? new Date(retailer.freshnessExpiresAt).toLocaleDateString() : 'No verified freshness window'}
                </span>
              </div>
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">Confidence:</span>
                <span className="font-semibold text-slate-700">
                  {retailer.confidence === null ? 'Not scored' : `${Math.round(retailer.confidence * 100)}%`}
                </span>
              </div>
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">Reviewer:</span>
                <span className="font-semibold text-slate-700">{retailer.reviewedBy || 'None'}</span>
              </div>
              <div className="flex justify-between border-b border-brand-border/40 pb-2">
                <span className="text-slate-500">Hours Source:</span>
                <span className="font-semibold text-slate-700">{retailer.hoursSource}</span>
              </div>
              <div className="flex justify-between pb-2">
                <span className="text-slate-500">Listing Status:</span>
                <span className="font-semibold text-slate-700">
                  {retailer.isSponsored ? 'Paid Placement / Sponsored' : 'Organic directory listing'}
                </span>
              </div>
            </div>

            {/* Claim / Dispute / Correction Callout */}
            <div className="pt-2 border-t border-brand-border">
              <Link 
                href={`/retailer/${retailer.id}/correction`}
                className="w-full text-center block text-[10px] font-bold text-slate-600 hover:text-brand-primary border border-brand-border hover:border-brand-primary/20 py-2 rounded transition-all bg-brand-background/40"
              >
                📝 Submit Information Correction
              </Link>
            </div>
          </div>

          {/* CUSTOMER REVIEWS & RATINGS */}
          <div className="border border-brand-border bg-brand-surface rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-sm font-bold text-brand-text flex items-center gap-1.5">
                ⭐ Customer Rating Metrics
              </h2>
              <span className="text-[10px] font-bold text-black bg-brand-background border border-brand-border px-2 py-0.5 rounded">
                4.9 / 5.0
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Service & Speed</span>
                <div className="w-24 bg-brand-background border border-brand-border h-2 rounded-full overflow-hidden">
                  <div className="bg-black h-full w-[95%]" />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Product Quality</span>
                <div className="w-24 bg-brand-background border border-brand-border h-2 rounded-full overflow-hidden">
                  <div className="bg-black h-full w-[98%]" />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Accuracy & Labeling</span>
                <div className="w-24 bg-brand-background border border-brand-border h-2 rounded-full overflow-hidden">
                  <div className="bg-black h-full w-[100%]" />
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 pt-2 border-t border-brand-border">
              Verified patient ratings are audited by primary-source evidence receipts to prevent rating manipulation.
            </p>
            <ReviewModal retailerName={retailer.name} />
          </div>

        </div>

      </div>
    </div>
  );
}
