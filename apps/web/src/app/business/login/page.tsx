import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { canonicalPlatformUrl } from '@/lib/server-request-url';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Retailer Manager Sign In | Order Weed DC',
  description: 'Authorized retailer-manager access for a linked business listing.',
};

export default async function BusinessLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const existingSession = await getSession();
  if (existingSession?.role === 'RETAILER_MANAGER' && existingSession.managedRetailerId) {
    redirect('/business/dashboard');
  }
  const resolvedSearchParams = await searchParams;
  const canonicalHome = await canonicalPlatformUrl('/');
  
  return (
    <main className="min-h-screen bg-[#0B0F12] text-brand-text flex flex-col justify-center py-12 sm:px-6 lg:px-8 animate-fade-in">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
        <span className="text-[#1EC36A] font-black text-xs border border-[#1EC36A]/20 bg-[#1EC36A]/5 px-3 py-1 rounded-full uppercase tracking-widest">
          Retailer Portal
        </span>
        <h1 className="text-3xl font-extrabold text-brand-text tracking-tight">Sign in to your business</h1>
        <p className="text-sm text-slate-600">
          Manage your listings, inventory menus, and active deals.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#141A1E] border border-white/5 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form action="/business/session" method="post" className="space-y-6">
            
            {resolvedSearchParams.error === 'invalid' && (
              <div
                role="alert"
                className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded text-xs"
              >
                Invalid email, password, or account type.
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Business Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                className="w-full bg-[#0B0F12] border border-white/10 rounded-md px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-[#1EC36A] transition-colors"
                placeholder="you@yourbusiness.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={256}
                className="w-full bg-[#0B0F12] border border-white/10 rounded-md px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-[#1EC36A] transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
              <span>Sessions expire after eight hours.</span>
              <Link href="/business/claim" className="text-[#1EC36A] hover:underline font-bold">
                Claim your listing →
              </Link>
            </div>

            <div>
              <button
                type="submit"
                className="w-full bg-[#1EC36A] text-black font-extrabold text-sm py-3 px-4 rounded-md hover:bg-opacity-95 active:scale-98 transition-all"
              >
                Sign In
              </button>
            </div>
          </form>
          
          <div className="mt-6 border-t border-white/5 pt-4 text-center">
            <Link href={canonicalHome} className="text-xs text-slate-500 hover:text-brand-text transition-colors">
              ← Back to Consumer Network Portal
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
