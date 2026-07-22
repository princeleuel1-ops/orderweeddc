export class CustomerWalletDataError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CustomerWalletDataError';
    this.code = code;
  }
}

function requireScopeValue(value, label) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 255) {
    throw new CustomerWalletDataError(
      `${label} is required.`,
      'INVALID_WALLET_SCOPE',
    );
  }
  return value;
}

/**
 * Loads a minimal wallet DTO for exactly one authenticated customer.
 *
 * The caller must derive userId from the server-side session. No email, user ID,
 * brand ID, or account ownership value is accepted from request form fields.
 */
export async function loadCustomerWallet(db, { userId, domain }) {
  const scopedUserId = requireScopeValue(userId, 'Session user ID');
  const scopedDomain = requireScopeValue(domain, 'Tenant domain');

  const brand = await db.brand.findUnique({
    where: { domain: scopedDomain },
    select: {
      id: true,
      name: true,
      domain: true,
    },
  });

  if (!brand) {
    return null;
  }

  const [customer, currentLoyalty, loyaltyAccounts] = await Promise.all([
    db.user.findUnique({
      where: { id: scopedUserId },
      select: {
        id: true,
        name: true,
        role: true,
      },
    }),
    db.loyaltyAccount.findUnique({
      where: {
        userId_brandId: {
          userId: scopedUserId,
          brandId: brand.id,
        },
      },
      select: {
        id: true,
        points: true,
        tier: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            pointsChanged: true,
            description: true,
            createdAt: true,
          },
        },
      },
    }),
    db.loyaltyAccount.findMany({
      where: {
        userId: scopedUserId,
      },
      select: {
        id: true,
        brandId: true,
        points: true,
        tier: true,
        brand: {
          select: {
            name: true,
            domain: true,
          },
        },
      },
    }),
  ]);

  if (!customer || customer.role !== 'CUSTOMER') {
    throw new CustomerWalletDataError(
      'The authenticated customer account is unavailable.',
      'CUSTOMER_NOT_FOUND',
    );
  }

  const accounts = loyaltyAccounts
    .map((account) => ({
      id: account.id,
      brandId: account.brandId,
      points: account.points,
      tier: account.tier,
      brand: {
        name: account.brand.name,
        domain: account.brand.domain,
      },
    }))
    .sort((left, right) => left.brand.name.localeCompare(right.brand.name));

  return {
    brand,
    customer: {
      id: customer.id,
      name: customer.name,
    },
    currentLoyalty,
    accounts,
    totalNetworkPoints: accounts.reduce(
      (total, account) => total + account.points,
      0,
    ),
  };
}
