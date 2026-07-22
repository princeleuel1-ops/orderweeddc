import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DataStatusBadge } from '@/components/data-status-badge';
import { isPubliclyVerified } from '@/lib/data-status.mjs';
import { serializeStructuredData } from '@/lib/seo-truth.mjs';
import { requestOrigin } from '@/lib/server-request-url';
import { publicCatalogRecordWhere } from '@/lib/directory-search.mjs';

type Props = {
  params: Promise<{ domain: string; slug: string }>;
};

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { domain, slug } = await params;
  const asOf = new Date();
  const [brand, article] = await Promise.all([
    prisma.brand.findUnique({
      where: { domain },
      select: { name: true },
    }),
    prisma.article.findFirst({
      where: {
        slug,
        ...publicCatalogRecordWhere(asOf),
      },
      select: {
        title: true,
        content: true,
        dataStatus: true,
        isDemonstration: true,
        verifiedAt: true,
        freshnessExpiresAt: true,
      },
    }),
  ]);
  if (!brand || !article) {
    return { title: 'Article Not Found | Order Weed DC' };
  }

  const indexable = isPubliclyVerified(article);
  return {
    title: `${article.title} | ${brand.name}`,
    description: article.content.slice(0, 160),
    robots: {
      index: indexable,
      follow: indexable,
    },
    alternates: {
      canonical: `/education/${encodeURIComponent(slug)}`,
    },
  };
}

export default async function EducationalArticleDetailPage({ params }: Props) {
  const { domain, slug } = await params;
  const origin = await requestOrigin();
  const asOf = new Date();

  // 1. Fetch brand context
  const brand = await prisma.brand.findUnique({
    where: { domain: domain },
  });

  if (!brand) return notFound();

  // 2. Fetch the educational article by slug
  const article = await prisma.article.findFirst({
    where: {
      slug,
      ...publicCatalogRecordWhere(asOf),
    },
  });

  if (!article) return notFound();
  const indexable = isPubliclyVerified(article, asOf);

  // 3. Schema JSON-LD structured data for search engine AEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': article.title,
    'description':
      article.content.length > 150
        ? `${article.content.substring(0, 150)}...`
        : article.content,
    'author': {
      '@type': 'Organization',
      'name': article.author,
    },
    'publisher': {
      '@type': 'Organization',
      'name': brand.name,
    },
    ...(article.verifiedAt
      ? { 'datePublished': article.verifiedAt.toISOString() }
      : {}),
    'dateModified': article.updatedAt.toISOString(),
    'mainEntityOfPage': new URL(
      `/education/${article.slug}`,
      origin,
    ).toString(),
  };

  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 animate-fade-in space-y-6 flex-grow">
      
      {/* Inject SEO JSON-LD structured data */}
      {indexable && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeStructuredData(jsonLd) }}
        />
      )}

      {/* Back navigation */}
      <div>
        <Link href="/education" className="text-xs font-semibold text-slate-600 hover:text-brand-primary transition-colors flex items-center">
          ← Back to educational guide
        </Link>
      </div>

      {/* Article Container */}
      <article className="border border-brand-border bg-brand-surface rounded-lg p-6 sm:p-8 space-y-6">
        
        {/* Meta Header */}
        <div className="space-y-3 border-b border-brand-border pb-6">
          <DataStatusBadge
            dataStatus={article.dataStatus}
            isDemonstration={article.isDemonstration}
            verifiedAt={article.verifiedAt}
            freshnessExpiresAt={article.freshnessExpiresAt}
          />
          
          <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-text tracking-tight leading-tight">
            {article.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 pt-1">
            <div>By <span className="font-semibold text-slate-600">{article.author}</span></div>
            <div>•</div>
            <div>Published: {new Date(article.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Content Body */}
        <div className="text-sm text-slate-700 leading-relaxed space-y-4 whitespace-pre-line">
          {article.content}
        </div>

        {/* Informational Legal Notice */}
        <div className="bg-brand-background/40 border border-brand-border p-4 rounded-md text-xs text-slate-500 mt-8">
          ⚖️ **Content Notice**: This record&apos;s status and source are shown above. Demonstration drafts are synthetic and unpublished. Nothing on this page constitutes medical, health, legal, safety, or regulatory advice; consult an authoritative primary source.
        </div>

      </article>
    </div>
  );
}
