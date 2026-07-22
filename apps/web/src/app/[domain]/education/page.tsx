import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { DataStatusBadge } from '@/components/data-status-badge';
import {
  EDUCATION_PAGE_SIZE,
  EDUCATION_QUERY_MAX_LENGTH,
  clampEducationPage,
  educationHubHref,
  educationPageCount,
  educationPageOffset,
  parseEducationHubSearch,
} from '@/lib/education-search.mjs';
import { publicCatalogRecordWhere } from '@/lib/directory-search.mjs';
import DosageCalculator from '@/components/dosage-calculator';

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{
    strain?: string | string[];
    articlePage?: string | string[];
    strainPage?: string | string[];
  }>;
};

type EducationPageKey = 'articlePage' | 'strainPage';

type EducationSearch = {
  strain: string;
  articlePage: number;
  strainPage: number;
};

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cannabis Education & Strain Guide | Order Weed DC',
  description:
    'Demonstration educational content and explicitly labeled catalog information for Washington, D.C.',
  alternates: {
    canonical: '/education',
  },
};

function EducationPagination({
  search,
  pageKey,
  totalItems,
  label,
}: {
  search: EducationSearch;
  pageKey: EducationPageKey;
  totalItems: number;
  label: string;
}) {
  const currentPage = search[pageKey];
  const totalPages = educationPageCount(totalItems);
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={`${label} pagination`}
      className="flex items-center justify-between gap-3 border-t border-brand-border pt-4 text-xs"
    >
      {currentPage > 1 ? (
        <Link
          href={educationHubHref(search, pageKey, currentPage - 1)}
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
          href={educationHubHref(search, pageKey, currentPage + 1)}
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

export default async function EducationHubPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const requestedSearch = parseEducationHubSearch(resolvedSearchParams);
  const asOf = new Date();
  const publicRecordWhere = publicCatalogRecordWhere(asOf);

  // 1. Fetch brand
  const brand = await prisma.brand.findUnique({
    where: { domain: resolvedParams.domain },
  });

  if (!brand) {
    return <div className="text-center p-8 bg-[#0B0F12]">Error: Brand not found.</div>;
  }

  const strainWhere = {
    ...publicRecordWhere,
    category: 'flower',
    name: requestedSearch.strain
      ? { contains: requestedSearch.strain }
      : undefined,
  };
  const [articleCount, strainCount] = await Promise.all([
    prisma.article.count({ where: publicRecordWhere }),
    prisma.product.count({ where: strainWhere }),
  ]);
  const search: EducationSearch = {
    strain: requestedSearch.strain,
    articlePage: clampEducationPage(
      requestedSearch.articlePage,
      articleCount,
    ),
    strainPage: clampEducationPage(requestedSearch.strainPage, strainCount),
  };

  // 2. Fetch independently bounded public education collections.
  const [articles, strains] = await Promise.all([
    prisma.article.findMany({
      where: publicRecordWhere,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: educationPageOffset(search.articlePage),
      take: EDUCATION_PAGE_SIZE,
    }),
    prisma.product.findMany({
      where: strainWhere,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: educationPageOffset(search.strainPage),
      take: EDUCATION_PAGE_SIZE,
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-8 flex-grow">
      
      {/* Back button */}
      <div>
        <Link href="/" className="text-xs font-semibold text-slate-600 hover:text-brand-primary transition-colors">
          ← Back to directory
        </Link>
      </div>

      {/* Header section */}
      <div className="border border-brand-border bg-brand-surface rounded-lg p-6">
        <span className="text-brand-primary text-[10px] font-black uppercase tracking-widest border border-brand-primary/20 bg-brand-primary/5 px-2.5 py-0.5 rounded">
          Science & Legislation
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-text mt-2">D.C. Cannabis Education & Strain Guide</h1>
        <p className="text-sm text-slate-600 mt-1">
          Explore legal frameworks, terpene science guides, and cataloged strains in Washington D.C.
        </p>
      </div>

      {/* Interactive Dosage Calculator */}
      <DosageCalculator />

      {/* Columns: Articles vs Strain Dictionary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Educational Articles */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-brand-text border-b border-brand-border pb-2">
            📰 Published Articles
          </h2>

          <div className="space-y-6">
            {articles.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brand-border bg-brand-surface p-8 text-center text-sm text-slate-500">
                No evidence-eligible educational articles are available.
              </div>
            ) : (
              articles.map((article) => (
                <div key={article.id} className="border border-brand-border bg-brand-surface p-5 rounded-lg space-y-3 hover:border-brand-primary/20 transition-all">
                  <h3 className="text-base font-bold text-brand-text hover:text-brand-primary transition-colors">
                    <Link href={`/education/${encodeURIComponent(article.slug)}`}>{article.title}</Link>
                  </h3>
                  <DataStatusBadge
                    dataStatus={article.dataStatus}
                    isDemonstration={article.isDemonstration}
                    verifiedAt={article.verifiedAt}
                    freshnessExpiresAt={article.freshnessExpiresAt}
                    compact
                  />

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                    {article.content}
                  </p>

                  <div className="text-[10px] text-slate-500 flex justify-between pt-2 border-t border-brand-border/40">
                    <div>By <span className="font-semibold text-slate-600">{article.author}</span></div>
                    <div>Published: {new Date(article.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))
            )}
            <EducationPagination
              search={search}
              pageKey="articlePage"
              totalItems={articleCount}
              label="Article"
            />
          </div>
        </div>

        {/* Right Column: Strain Glossary */}
        <div className="space-y-6">
          <div className="border border-brand-border bg-brand-surface rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold text-brand-text flex items-center">
              🌿 Strain Dictionary Glossary
            </h2>

            {/* Strain Search form */}
            <form method="GET" className="flex gap-2">
              <label htmlFor="strain-search" className="sr-only">
                Search the demonstration strain catalog
              </label>
              <input 
                id="strain-search"
                type="text" 
                name="strain" 
                placeholder="Search strains (e.g. Sour)..." 
                defaultValue={search.strain}
                maxLength={EDUCATION_QUERY_MAX_LENGTH}
                className="bg-brand-background border border-brand-border text-brand-text px-3 py-1.5 rounded text-xs focus:outline-none w-full"
              />
              {search.articlePage > 1 && (
                <input
                  type="hidden"
                  name="articlePage"
                  value={search.articlePage}
                />
              )}
              <button type="submit" className="bg-black text-white font-bold text-xs px-3.5 py-1.5 rounded hover:bg-slate-800 transition-colors">
                Go
              </button>
            </form>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {strains.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No strains matching your query in the catalog.</p>
              ) : (
                strains.map((strain) => (
                  <div key={strain.id} className="bg-brand-background/40 border border-brand-border p-3.5 rounded space-y-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-xs font-bold text-brand-text">{strain.name}</h4>
                      <span className="text-[9px] bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {strain.strainType}
                      </span>
                    </div>
                    <DataStatusBadge
                      dataStatus={strain.dataStatus}
                      isDemonstration={strain.isDemonstration}
                      verifiedAt={strain.verifiedAt}
                      freshnessExpiresAt={strain.freshnessExpiresAt}
                      compact
                    />

                    <p className="text-[10px] text-slate-600 leading-normal">
                      {strain.description}
                    </p>

                    <div className="text-[9px] text-slate-500 flex gap-2 pt-1">
                      {strain.thcPercent && <span>THC: {strain.thcPercent}%</span>}
                      {strain.cbdPercent && <span>• CBD: {strain.cbdPercent}%</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {strainCount} eligible strain record
              {strainCount === 1 ? '' : 's'} match this search.
            </p>
            <EducationPagination
              search={search}
              pageKey="strainPage"
              totalItems={strainCount}
              label="Strain"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
