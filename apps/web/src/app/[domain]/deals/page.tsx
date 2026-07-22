import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataStatusBadge } from '@/components/data-status-badge';
import { currentDealWhere } from '@/lib/directory-search.mjs';

type Props = {
  params: Promise<{ domain: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { domain } = await params;
  const brand = await prisma.brand.findUnique({
    where: { domain },
    select: { name: true },
  });

  if (!brand) return { title: 'Deals Not Found | Order Weed DC' };

  return {
    title: `Verified Deals & Offers | ${brand.name}`,
    description: `Explore active dispensary deals, verified promotion codes, and special offers across Washington D.C.`,
    alternates: {
      canonical: '/deals',
    },
  };
}

export default async function DealsHubPage({ params }: Props) {
  const { domain } = await params;
  const brand = await prisma.brand.findUnique({
    where: { domain },
  });

  if (!brand) return notFound();

  const asOf = new Date();
  const dealWhere = {
    ...currentDealWhere(asOf),
    retailer: {
      menus: {
        some: {
          brandMenus: {
            some: { brandId: brand.id },
          },
        },
      },
    },
  };

  const deals = await prisma.deal.findMany({
    where: dealWhere,
    include: {
      retailer: {
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          city: true,
        },
      },
    },
    orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
    take: 50,
  });

  return (
    <div className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 animate-fade-in space-y-8">
      {/* Header Banner */}
      <div className="border-b border-brand-border pb-6 space-y-3">
        <Link href="/" className="text-xs font-bold text-slate-500 hover:text-brand-text transition-colors">
          ← Back to directory
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-widest text-orange-500 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full">
              🔥 Verified Promotion Hub
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-text tracking-tight mt-2">
              D.C. Dispensary Deals & Special Offers
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl mt-1">
              Discover active promotional discounts, daily specials, and verified promo codes from D.C. licensed cannabis retailers.
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-brand-text">{deals.length}</span>
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Active Deals</span>
          </div>
        </div>
      </div>

      {/* Deals Grid */}
      {deals.length === 0 ? (
        <div className="border border-brand-border rounded-xl bg-brand-surface p-12 text-center text-slate-600 space-y-3">
          <p className="font-bold text-brand-text">No active deals found at this time.</p>
          <p className="text-xs max-w-md mx-auto">Retailer promotions change frequently. Check back soon or browse our full business directory.</p>
          <Link href="/" className="inline-block bg-black text-white font-bold text-xs px-5 py-2.5 rounded-md hover:bg-slate-800 transition-colors">
            Explore Directory
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deals.map((deal) => (
            <div 
              key={deal.id} 
              className="border border-brand-border bg-brand-surface rounded-xl p-6 flex flex-col justify-between hover:border-black/30 transition-all shadow-sm space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-md">
                    {deal.isDemonstration ? 'DEMO OFFER' : deal.discount}
                  </span>
                  <DataStatusBadge
                    dataStatus={deal.dataStatus}
                    isDemonstration={deal.isDemonstration}
                    verifiedAt={deal.verifiedAt}
                    freshnessExpiresAt={deal.freshnessExpiresAt}
                    compact
                  />
                </div>

                <h3 className="text-lg font-extrabold text-brand-text leading-snug">{deal.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{deal.description}</p>
              </div>

              <div className="space-y-3 border-t border-brand-border/60 pt-4">
                {/* Code & Expiry */}
                <div className="flex items-center justify-between text-xs">
                  <div className="bg-brand-background border border-brand-border px-3 py-1.5 rounded font-mono font-bold text-brand-text">
                    Code: {deal.code || 'NO CODE NEEDED'}
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    Expires {new Date(deal.expiryDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Retailer Card Footer */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <span className="text-xs font-bold text-brand-text block">{deal.retailer.name}</span>
                    <span className="text-[10px] text-slate-500 capitalize">{deal.retailer.type} • {deal.retailer.city}</span>
                  </div>
                  <Link 
                    href={`/retailer/${deal.retailer.id}`}
                    className="text-xs font-bold text-black hover:underline"
                  >
                    View Menu →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
