import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireCustomer } from '@/lib/auth/session';
import { loadCustomerWallet } from '@/lib/customer-wallet.mjs';

type Props = {
  params: Promise<{ domain: string }>;
};

type WalletView = {
  brand: {
    id: string;
    name: string;
    domain: string;
  };
  customer: {
    id: string;
    name: string | null;
  };
  currentLoyalty: {
    id: string;
    points: number;
    tier: string;
    transactions: Array<{
      id: string;
      pointsChanged: number;
      description: string;
      createdAt: Date;
    }>;
  } | null;
  accounts: Array<{
    id: string;
    brandId: string;
    points: number;
    tier: string;
    brand: {
      name: string;
      domain: string;
    };
  }>;
  totalNetworkPoints: number;
};

export const dynamic = 'force-dynamic';

export default async function CustomerWalletPage({ params }: Props) {
  const session = await requireCustomer();
  const { domain } = await params;
  const wallet = (await loadCustomerWallet(prisma, {
    userId: session.userId,
    domain,
  })) as WalletView | null;

  if (!wallet) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center p-8 bg-[#0B0F12]">
        <p className="text-red-400 font-bold">This host brand is not configured.</p>
        <Link href="/" className="mt-4 text-sm text-brand-primary hover:underline">
          Return to the directory
        </Link>
      </div>
    );
  }

  const { brand, customer, currentLoyalty, accounts, totalNetworkPoints } =
    wallet;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-8 flex-grow">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xs font-semibold text-slate-600 hover:text-brand-primary transition-colors"
        >
          ← Back to listings
        </Link>
        <form action="/customer/logout" method="post">
          <button
            type="submit"
            className="text-xs font-semibold text-slate-600 hover:text-brand-text transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="border border-brand-border bg-brand-surface rounded-lg p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <span className="text-brand-primary text-xs font-black uppercase tracking-widest border border-brand-primary/20 bg-brand-primary/5 px-2.5 py-0.5 rounded">
            Private customer wallet
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-text mt-2">
            Welcome back{customer.name ? `, ${customer.name}` : ''}
          </h1>
          <p className="text-xs text-slate-600">
            This view is bound to your authenticated account.
          </p>
        </div>

        <div className="bg-brand-background border border-brand-border px-5 py-3 rounded-md shrink-0">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Network points balance
          </div>
          <div className="text-xl font-black text-brand-primary mt-0.5">
            {totalNetworkPoints}{' '}
            <span className="text-xs text-slate-600 font-normal">Pts</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="border border-brand-primary/20 bg-brand-surface rounded-lg p-6 space-y-6 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-brand-primary/5 blur-xl" />

            <div className="flex justify-between items-start border-b border-brand-border/40 pb-4">
              <div>
                <h2 className="text-md font-bold text-brand-text uppercase tracking-wider">
                  {brand.name} points account
                </h2>
                <span className="text-[10px] text-slate-600">
                  Attributed to {brand.domain}
                </span>
              </div>
              <span className="text-[10px] font-black text-black bg-brand-primary px-3 py-1 rounded">
                {currentLoyalty?.tier || 'NO'} TIER
              </span>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-5xl font-black text-brand-text">
                {currentLoyalty?.points || 0}
              </span>
              <span className="text-slate-600 font-semibold">
                Available points
              </span>
            </div>

            <div className="bg-brand-background/40 border border-brand-border p-4 rounded text-xs text-slate-600 leading-relaxed">
              Points and transactions in this development environment are
              synthetic. This wallet does not establish age, eligibility,
              legal status, cash value, or an active redemption right.
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-700">
                Recent transactions
              </h3>
              {!currentLoyalty ||
              currentLoyalty.transactions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  No point movements recorded for this brand.
                </p>
              ) : (
                <div className="space-y-2">
                  {currentLoyalty.transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="text-xs border-b border-brand-border/30 pb-2 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold text-slate-700">
                          {transaction.description}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span
                        className={`font-black ${
                          transaction.pointsChanged >= 0
                            ? 'text-brand-primary'
                            : 'text-red-400'
                        }`}
                      >
                        {transaction.pointsChanged >= 0
                          ? `+${transaction.pointsChanged}`
                          : transaction.pointsChanged}{' '}
                        pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="border border-brand-border bg-brand-surface rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-bold text-brand-text">
              Cross-brand balances
            </h2>

            {accounts.length === 0 ? (
              <p className="text-xs text-slate-500">
                No loyalty accounts are linked to this customer.
              </p>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3.5 border rounded flex justify-between items-center gap-4 ${
                      account.brandId === brand.id
                        ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
                        : 'border-brand-border bg-brand-background/30'
                    }`}
                  >
                    <div>
                      <h3 className="text-xs font-bold text-brand-text">
                        {account.brand.name}
                      </h3>
                      <span className="text-[9px] text-slate-500">
                        {account.brand.domain}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-black text-brand-text">
                        {account.points} Pts
                      </div>
                      <span className="text-[8px] font-bold text-slate-600 uppercase tracking-wider">
                        {account.tier}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 text-[10px] text-slate-500 leading-normal text-center border-t border-brand-border">
              Only accounts owned by the current authenticated customer are
              included.
            </div>
          </section>

          {/* Bookmarked Dispensaries & Saved Deals */}
          <section className="border border-brand-border bg-brand-surface rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-brand-text flex items-center gap-1.5">
                ⭐ Saved Dispensaries
              </h2>
              <span className="text-[10px] font-bold text-slate-500 bg-brand-background border border-brand-border px-2 py-0.5 rounded">
                Verified D.C.
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bookmark dispensaries to track live menu updates and active promotions in real-time.
            </p>
            <Link
              href="/"
              className="mt-2 block w-full text-center bg-black text-white font-bold text-xs py-2 px-3 rounded hover:bg-slate-800 transition-colors"
            >
              Browse Directory →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
