import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataStatusBadge } from '@/components/data-status-badge';
import {
  currentDealWhere,
} from '@/lib/directory-search.mjs';
import { PUBLIC_DEAL_PREVIEW_LIMIT } from '@/lib/retailer-detail-search.mjs';
import {
  NEIGHBORHOOD_CANDIDATE_LIMIT,
  neighborhoodCandidateWhere,
} from '@/lib/neighborhood-search.mjs';

type Props = {
  params: Promise<{ domain: string; slug: string }>;
};

const NEIGHBORHOOD_CONFIGS: Record<string, { name: string; lat: number; lng: number; description: string; zips: string[] }> = {
  'georgetown': {
    name: 'Georgetown',
    lat: 38.9097,
    lng: -77.0654,
    zips: ['20007'],
    description: "D.C.'s historic waterfront neighborhood. The local demo uses this center point to exercise geographic filtering."
  },
  'dupont-circle': {
    name: 'Dupont Circle',
    lat: 38.9097,
    lng: -77.0433,
    zips: ['20036', '20009'],
    description: "D.C.'s cultural hub. The local demo uses this center point to exercise geographic filtering."
  },
  'capitol-hill': {
    name: 'Capitol Hill',
    lat: 38.8899,
    lng: -77.0090,
    zips: ['20002', '20003'],
    description: "D.C.'s political heart. The local demo uses this center point to exercise geographic filtering."
  },
  'u-street-shaw': {
    name: 'U Street and Shaw',
    lat: 38.9169,
    lng: -77.0322,
    zips: ['20001', '20009'],
    description: "D.C.'s historic entertainment corridor. The local demo uses this center point to exercise geographic filtering."
  },
  'navy-yard-wharf': {
    name: 'Navy Yard and Wharf',
    lat: 38.8766,
    lng: -76.9902,
    zips: ['20003', '20024'],
    description: "D.C.'s waterfront district. The local demo uses this center point to exercise geographic filtering."
  }
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const neighborhood = NEIGHBORHOOD_CONFIGS[slug];

  if (!neighborhood) {
    return {
      title: 'Neighborhood Not Found | Order Weed DC',
      robots: { index: false, follow: false, nocache: true },
    };
  }

  const title = `${neighborhood.name} Cannabis Dispensaries & Directory | Order Weed DC`;
  const description = `Explore verified medical cannabis dispensaries, delivery services, and active deals in ${neighborhood.name}, Washington D.C.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/neighborhoods/${slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/neighborhoods/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default async function NeighborhoodHubPage({ params }: Props) {
  const { domain, slug } = await params;

  // 1. Fetch current brand configuration
  const brand = await prisma.brand.findUnique({
    where: { domain: domain },
  });

  if (!brand) return notFound();

  const config = NEIGHBORHOOD_CONFIGS[slug];
  if (!config) return notFound();

  // 2. Query Retailers matching this brand's catalog
  const asOf = new Date();
  const candidateWhere = neighborhoodCandidateWhere({
    brandId: brand.id,
    latitude: config.lat,
    longitude: config.lng,
    zips: config.zips,
    asOf,
  });
  const candidateCount = await prisma.retailer.count({
    where: candidateWhere,
  });
  const allRetailers = await prisma.retailer.findMany({
    where: candidateWhere,
    include: {
      deals: {
        where: currentDealWhere(asOf),
        orderBy: [{ expiryDate: 'asc' }, { id: 'asc' }],
        take: PUBLIC_DEAL_PREVIEW_LIMIT,
      },
    },
    orderBy: { id: 'asc' },
    take: NEIGHBORHOOD_CANDIDATE_LIMIT,
  });

  // Filter retailers located within 2.5 miles of the neighborhood center or matching zip code
  const neighborhoodRetailers = allRetailers.filter(r => {
    const distance = getDistanceMiles(config.lat, config.lng, r.lat, r.lng);
    const matchesZip = r.zip ? config.zips.includes(r.zip) : false;
    return distance <= 2.5 || matchesZip;
  });

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://orderweeddc.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: config.name,
        item: `https://orderweeddc.com/neighborhoods/${slug}`,
      },
    ],
  };

  return (
    <div className="flex-grow flex flex-col animate-fade-in">
      {/* Header Banner */}
      <section className="bg-brand-surface border-b border-brand-border py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link href="/" className="text-xs font-semibold text-slate-600 hover:text-brand-primary mb-3 inline-block transition-colors">
            ← Back to directory
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-text">
              {config.name} Cannabis Directory
            </h1>
            <span className="text-[10px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Geographic Demonstration
            </span>
          </div>
          <p className="text-sm text-slate-600 max-w-2xl mt-2 leading-relaxed">
            {config.description} Results below are not evidence of a business location, service area, or license.
          </p>
        </div>
      </section>

      {/* Grid Layout */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 flex-grow">
        
        {/* Left: Neighborhood listings */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-brand-text uppercase tracking-wider border-b border-brand-border pb-2 mb-2">
            Labeled Demo Records Near {config.name}
          </h2>
          {candidateCount > NEIGHBORHOOD_CANDIDATE_LIMIT && (
            <div className="rounded-md border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-200">
              The geographic candidate window contains {candidateCount}{' '}
              records. This local view evaluates the first{' '}
              {NEIGHBORHOOD_CANDIDATE_LIMIT} stable candidates; use the
              directory filters for complete tenant discovery.
            </div>
          )}

          {neighborhoodRetailers.length === 0 ? (
            <div className="border border-brand-border rounded-lg bg-brand-surface p-12 text-center text-slate-600">
              No registered retailers found directly within {config.name} at this time.
            </div>
          ) : (
            <div className="space-y-4">
              {neighborhoodRetailers.map((retailer, i) => (
                <div 
                  key={retailer.id} 
                  className={`border rounded-lg bg-brand-surface p-5 hover:border-brand-primary/40 transition-all flex flex-col md:flex-row gap-5 ${
                    retailer.isSponsored ? 'border-brand-primary/30 shadow-[0_0_15px_rgba(30,195,106,0.03)]' : 'border-brand-border'
                  }`}
                >
                  {/* Pin label index */}
                  <div className="w-10 h-10 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>

                  {/* Details */}
                  <div className="flex-grow space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-brand-text hover:text-brand-primary transition-colors">
                        <Link href={`/retailer/${retailer.id}`}>{retailer.name}</Link>
                      </h3>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-800 text-slate-600">
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

                    <p className="text-sm text-slate-600">
                      📍 {retailer.address}, {retailer.city} ({getDistanceMiles(config.lat, config.lng, retailer.lat, retailer.lng).toFixed(1)} miles away)
                    </p>

                    {retailer.deals.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-1">
                        {retailer.deals.map((deal) => (
                          <span key={deal.id} className="text-[10px] text-orange-400 bg-orange-400/5 border border-orange-400/20 px-2 py-0.5 rounded">
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
                        className="text-brand-primary font-bold hover:underline"
                      >
                        View Data Status & Menu →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Map sidebar centered on the neighborhood */}
        <div className="space-y-4">
          <div className="border border-brand-border rounded-lg bg-brand-surface p-4 flex flex-col h-[350px] relative overflow-hidden">
            <div className="absolute inset-0 bg-slate-950 opacity-95 flex flex-col justify-between p-4 pointer-events-none select-none font-mono text-[9px] text-slate-600">
              <div className="flex justify-between">
                <span>{config.name.toUpperCase()} MAP SECTOR</span>
                <span>LAT: {config.lat.toFixed(4)}</span>
              </div>

              {/* Centered target marker representing the neighborhood center */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border border-dashed border-brand-primary/40 animate-ping absolute"></div>
                <div className="w-3 h-3 rounded-full bg-brand-primary/30 border border-brand-primary flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-brand-primary"></div>
                </div>
                <span className="text-slate-600 bg-brand-surface border border-brand-border px-2 py-0.5 rounded text-[10px] font-sans font-bold tracking-wider mt-12 whitespace-nowrap">
                  📍 {config.name} Center
                </span>
              </div>

              {/* Neighboring retailer pins relative to config center */}
              {neighborhoodRetailers.map((r, i) => {
                // Map coordinates range: +/- 0.03 relative to config lat/lng
                const leftPercent = 50 + ((r.lng - config.lng) / 0.06) * 100;
                const topPercent = 50 - ((r.lat - config.lat) / 0.04) * 100;
                return (
                  <div 
                    key={r.id}
                    className="absolute flex flex-col items-center group pointer-events-auto"
                    style={{
                      left: `${Math.max(10, Math.min(90, leftPercent))}%`,
                      top: `${Math.max(10, Math.min(90, topPercent))}%`,
                    }}
                  >
                    <Link href={`/retailer/${r.id}`} className="flex flex-col items-center cursor-pointer">
                      <div className="w-5 h-5 rounded-full bg-brand-primary text-black font-black flex items-center justify-center shadow-lg hover:scale-125 transition-transform text-[10px]">
                        {i + 1}
                      </div>
                      <span className="hidden group-hover:block absolute bottom-6 bg-brand-surface text-brand-text text-[9px] border border-brand-border px-2 py-0.5 rounded whitespace-nowrap shadow-xl z-20 font-sans">
                        {r.name}
                      </span>
                    </Link>
                  </div>
                );
              })}

              <div className="flex justify-between">
                <span>LNG: {config.lng.toFixed(4)}</span>
                <span>ZOOM: 14</span>
              </div>
            </div>
          </div>

          {/* Local Guide Callout */}
          <div className="border border-brand-border rounded-lg bg-brand-surface p-5 text-xs text-slate-600 leading-relaxed">
            <h4 className="font-bold text-brand-text mb-2">Coordinate Preview Notice</h4>
            These points and distance calculations exercise the interface with synthetic records. Confirm real locations, service areas, and license status with primary sources.
          </div>
        </div>

      </div>
    </div>
  );
}
