import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  canonicalPlatformUrl,
  requestOrigin,
} from '@/lib/server-request-url';
import { buildTenantTheme } from '@/lib/tenant-theme.mjs';
import { CANONICAL_TENANT_DOMAIN } from '@/lib/tenant-host.mjs';
import {
  PUBLIC_PRODUCT_DESCRIPTION,
  PUBLIC_PRODUCT_NAME,
} from '@/lib/product-brand';
import CartDrawer from '@/components/cart-drawer';

export async function generateMetadata({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const origin = await requestOrigin();
  const brand = await prisma.brand.findUnique({
    where: { domain },
  });
  const demonstrationCount = brand
    ? await prisma.retailer.count({
        where: {
          isDemonstration: true,
          menus: { some: { brandMenus: { some: { brandId: brand.id } } } },
        },
      })
    : 0;
  const isDemonstrationEnvironment =
    origin.hostname.endsWith('.localhost') || demonstrationCount > 0;
  const displayName =
    domain === CANONICAL_TENANT_DOMAIN
      ? PUBLIC_PRODUCT_NAME
      : brand?.name || PUBLIC_PRODUCT_NAME;

  return {
    title: `${displayName} | Washington, D.C.`,
    description:
      domain === CANONICAL_TENANT_DOMAIN
        ? PUBLIC_PRODUCT_DESCRIPTION
        : brand?.description ||
          'Directory prototype with explicit source and verification states.',
    metadataBase: origin,
    robots: {
      index: !isDemonstrationEnvironment,
      follow: !isDemonstrationEnvironment,
    },
  };
}

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const [canonicalAdmin, canonicalBusiness] = await Promise.all([
    canonicalPlatformUrl('/admin'),
    canonicalPlatformUrl('/business/login'),
  ]);
  const brand = await prisma.brand.findUnique({
    where: { domain },
  });
  const isCanonicalBrand = domain === CANONICAL_TENANT_DOMAIN;
  const displayName = isCanonicalBrand
    ? PUBLIC_PRODUCT_NAME
    : brand?.name || PUBLIC_PRODUCT_NAME;
  const demonstrationCount = brand
    ? await prisma.retailer.count({
        where: {
          isDemonstration: true,
          menus: { some: { brandMenus: { some: { brandId: brand.id } } } },
        },
      })
    : 0;

  const theme = buildTenantTheme(brand);
  const themeStyle = {
    '--brand-primary': theme.primary,
    '--brand-secondary': theme.secondary,
    '--brand-background': theme.background,
    '--brand-surface': theme.surface,
    '--brand-border': 'rgba(255, 255, 255, 0.08)',
    '--brand-text': theme.text,
  } as CSSProperties;

  return (
    <div className="flex flex-col min-h-screen" style={themeStyle}>
      {/* Brand Header Nav */}
      <header className="border-b border-brand-border bg-brand-surface/85 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link
              href="/"
              aria-label={`${displayName} home`}
              className="flex items-center text-xl font-black tracking-[-0.04em] text-brand-text"
            >
              {isCanonicalBrand ? (
                <span>
                  orderweed<span className="text-brand-primary">dc</span>
                </span>
              ) : (
                <>
                  <span className="mr-2 rounded-md border border-brand-primary/20 bg-brand-primary/10 px-2.5 py-1 text-sm font-semibold text-brand-primary">
                    {brand?.name.substring(0, 2).toUpperCase() || 'OW'}
                  </span>
                  <span>{displayName}</span>
                </>
              )}
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-6 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-brand-primary transition-colors">Retailers</Link>
            <Link href="/products" className="hover:text-brand-primary transition-colors">Products</Link>
            <Link href="/compare" className="hover:text-brand-primary transition-colors">Compare</Link>
            <Link href="/?type=delivery" className="hover:text-brand-primary transition-colors">Delivery</Link>
            <Link href="/?type=storefront" className="hover:text-brand-primary transition-colors">Storefronts</Link>
            <Link href={canonicalAdmin} className="text-slate-500 hover:text-slate-700 transition-colors">Admin Portal</Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            <div className="text-xs text-slate-500 hidden sm:block border border-brand-border px-3 py-1.5 rounded-full bg-brand-background">
              Network: <span className="font-semibold text-slate-700">{PUBLIC_PRODUCT_NAME}</span>
            </div>
            <Link
              href={canonicalBusiness}
              className="bg-brand-primary text-black font-semibold text-xs px-4 py-2 rounded-md hover:bg-opacity-90 transition-all"
            >
              Business Portal
            </Link>
          </div>
        </div>
      </header>

      {demonstrationCount > 0 && (
        <aside className="border-b border-violet-400/30 bg-violet-400/10 px-4 py-3 text-center text-xs font-semibold text-violet-200">
          Demonstration environment: visible businesses, coordinates, license fields, menus, prices, deals, articles, and rewards are synthetic unless a record explicitly says otherwise.
        </aside>
      )}

      {/* Dynamic Route Viewport */}
      <main className="flex-grow flex flex-col bg-brand-background text-brand-text">
        {children}
      </main>

      {/* Network Ownership Disclosure Footer */}
      <footer className="border-t border-brand-border bg-brand-surface py-8 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p className="mb-2">
            © {new Date().getFullYear()} {displayName}. All rights reserved. • <span className="text-orange-500 font-bold">🔞 21+ Only</span>
          </p>
          <p className="text-slate-600 max-w-xl mx-auto leading-relaxed">
            Disclosure: {displayName} is an evidence-aware directory prototype.
            Check each record&apos;s data-status label and primary source before
            relying on it. This platform does not fulfill, deliver, or sell
            controlled substances directly.
          </p>
        </div>
      </footer>
      <CartDrawer />
    </div>
  );
}
