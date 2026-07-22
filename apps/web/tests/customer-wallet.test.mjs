import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadCustomerWallet } from '../src/lib/customer-wallet.mjs';
import {
  formRedirectUrl,
  isSameOriginFormRequest,
} from '../src/lib/auth/request-policy.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');

function createWalletDb() {
  const brands = [
    { id: 'brand-main', name: 'Main Brand', domain: 'orderweeddc.localhost' },
    { id: 'brand-deals', name: 'Deals Brand', domain: 'deals.localhost' },
  ];
  const users = [
    { id: 'customer-alpha', name: 'Customer Alpha', role: 'CUSTOMER' },
    { id: 'customer-beta', name: 'Customer Beta', role: 'CUSTOMER' },
    { id: 'admin-one', name: 'Administrator', role: 'ADMIN' },
  ];
  const accounts = [
    {
      id: 'account-alpha-main',
      userId: 'customer-alpha',
      brandId: 'brand-main',
      points: 125,
      tier: 'SILVER',
      transactions: [
        {
          id: 'transaction-alpha',
          pointsChanged: 125,
          description: 'Alpha-only transaction',
          createdAt: new Date('2026-07-17T12:00:00.000Z'),
        },
      ],
    },
    {
      id: 'account-alpha-deals',
      userId: 'customer-alpha',
      brandId: 'brand-deals',
      points: 25,
      tier: 'BRONZE',
      transactions: [],
    },
    {
      id: 'account-beta-main',
      userId: 'customer-beta',
      brandId: 'brand-main',
      points: 7,
      tier: 'BRONZE',
      transactions: [
        {
          id: 'transaction-beta',
          pointsChanged: 7,
          description: 'Beta-only transaction',
          createdAt: new Date('2026-07-17T13:00:00.000Z'),
        },
      ],
    },
  ];
  const reads = [];

  function accountDto(account) {
    const brand = brands.find((item) => item.id === account.brandId);
    return {
      id: account.id,
      brandId: account.brandId,
      points: account.points,
      tier: account.tier,
      transactions: account.transactions,
      brand: {
        name: brand.name,
        domain: brand.domain,
      },
    };
  }

  return {
    brand: {
      async findUnique({ where }) {
        return brands.find((brand) => brand.domain === where.domain) ?? null;
      },
    },
    user: {
      async findUnique({ where }) {
        reads.push({ delegate: 'user', userId: where.id });
        return users.find((user) => user.id === where.id) ?? null;
      },
    },
    loyaltyAccount: {
      async findUnique({ where }) {
        const scope = where.userId_brandId;
        reads.push({
          delegate: 'currentAccount',
          userId: scope.userId,
          brandId: scope.brandId,
        });
        const account = accounts.find(
          (item) =>
            item.userId === scope.userId && item.brandId === scope.brandId,
        );
        return account ? accountDto(account) : null;
      },
      async findMany({ where }) {
        reads.push({ delegate: 'networkAccounts', userId: where.userId });
        return accounts
          .filter((account) => account.userId === where.userId)
          .map(accountDto);
      },
    },
    reads,
  };
}

test('two customer sessions receive only their own wallet DTOs', async () => {
  const db = createWalletDb();

  const alpha = await loadCustomerWallet(db, {
    userId: 'customer-alpha',
    domain: 'orderweeddc.localhost',
  });
  const beta = await loadCustomerWallet(db, {
    userId: 'customer-beta',
    domain: 'orderweeddc.localhost',
  });

  assert.equal(alpha.customer.name, 'Customer Alpha');
  assert.equal(alpha.totalNetworkPoints, 150);
  assert.deepEqual(
    alpha.accounts.map((account) => account.id).sort(),
    ['account-alpha-deals', 'account-alpha-main'],
  );
  assert.equal(
    alpha.currentLoyalty.transactions[0].description,
    'Alpha-only transaction',
  );

  assert.equal(beta.customer.name, 'Customer Beta');
  assert.equal(beta.totalNetworkPoints, 7);
  assert.deepEqual(
    beta.accounts.map((account) => account.id),
    ['account-beta-main'],
  );
  assert.equal(
    beta.currentLoyalty.transactions[0].description,
    'Beta-only transaction',
  );

  assert.doesNotMatch(JSON.stringify(alpha), /Customer Beta|Beta-only/);
  assert.doesNotMatch(JSON.stringify(beta), /Customer Alpha|Alpha-only/);
  assert.deepEqual(
    db.reads.map(({ userId }) => userId),
    [
      'customer-alpha',
      'customer-alpha',
      'customer-alpha',
      'customer-beta',
      'customer-beta',
      'customer-beta',
    ],
  );
});

test('non-customer records cannot be loaded through the wallet data boundary', async () => {
  const db = createWalletDb();
  await assert.rejects(
    loadCustomerWallet(db, {
      userId: 'admin-one',
      domain: 'orderweeddc.localhost',
    }),
    (error) =>
      error?.name === 'CustomerWalletDataError' &&
      error?.code === 'CUSTOMER_NOT_FOUND',
  );
});

test('customer session forms require a matching browser origin', () => {
  function request({ origin, host, contentType, url } = {}) {
    const headers = new Headers();
    if (origin) headers.set('origin', origin);
    if (host) headers.set('host', host);
    if (contentType) headers.set('content-type', contentType);
    return {
      headers,
      url: url || 'http://orderweeddc.localhost:3000/customer/session',
    };
  }

  const valid = request({
    origin: 'http://orderweeddc.localhost:3000',
    host: 'orderweeddc.localhost:3000',
    contentType: 'application/x-www-form-urlencoded',
  });
  assert.equal(isSameOriginFormRequest(valid), true);
  assert.equal(
    formRedirectUrl(valid, '/wallet').toString(),
    'http://orderweeddc.localhost:3000/wallet',
  );

  assert.equal(
    isSameOriginFormRequest(
      request({
        origin: 'https://orderweeddc.localhost:3000',
        host: 'orderweeddc.localhost:3000',
        contentType: 'application/x-www-form-urlencoded',
      }),
    ),
    false,
  );
  assert.equal(
    isSameOriginFormRequest(
      request({
        origin: 'https://attacker.example',
        host: 'orderweeddc.localhost:3000',
        contentType: 'application/x-www-form-urlencoded',
      }),
    ),
    false,
  );
  assert.equal(
    isSameOriginFormRequest(
      request({
        origin: 'http://orderweeddc.localhost:3000',
        host: 'orderweeddc.localhost:3000',
        contentType: 'application/json',
      }),
    ),
    false,
  );
  assert.equal(isSameOriginFormRequest(request()), false);
  assert.throws(() => formRedirectUrl(valid, 'https://attacker.example'));
});

test('wallet routing authenticates before data access and contains no fixed customer', () => {
  const walletSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/wallet/page.tsx'),
    'utf8',
  );
  const loginSource = fs.readFileSync(
    path.join(webRoot, 'src/app/[domain]/customer/login/page.tsx'),
    'utf8',
  );
  const sessionSource = fs.readFileSync(
    path.join(webRoot, 'src/lib/auth/session.ts'),
    'utf8',
  );
  const customerSessionSource = fs.readFileSync(
    path.join(
      webRoot,
      'src/app/[domain]/customer/session/route.ts',
    ),
    'utf8',
  );
  const loginHandlerSource = fs.readFileSync(
    path.join(webRoot, 'src/lib/auth/login-handler.ts'),
    'utf8',
  );
  const customerLogoutSource = fs.readFileSync(
    path.join(
      webRoot,
      'src/app/[domain]/customer/logout/route.ts',
    ),
    'utf8',
  );
  const sitemapSource = fs.readFileSync(
    path.join(webRoot, 'src/app/sitemap.ts'),
    'utf8',
  );
  const robotsSource = fs.readFileSync(
    path.join(webRoot, 'src/app/robots.ts'),
    'utf8',
  );

  assert.match(walletSource, /const session = await requireCustomer\(\)/);
  assert.match(walletSource, /userId: session\.userId/);
  assert.ok(
    walletSource.indexOf('await requireCustomer()') <
      walletSource.indexOf('await loadCustomerWallet'),
  );
  assert.doesNotMatch(walletSource, /customer@orderweeddc\.com/);
  assert.doesNotMatch(walletSource, /prisma\.user\.findFirst/);
  assert.match(sessionSource, /export async function requireCustomer/);
  assert.match(loginSource, /action="\/customer\/session"/);
  assert.match(loginSource, /method="post"/);
  assert.match(customerSessionSource, /handleCredentialLogin/);
  assert.match(customerSessionSource, /role:\s*'CUSTOMER'/);
  assert.match(loginHandlerSource, /isSameOriginFormRequest\(request\)/);
  assert.match(loginHandlerSource, /createSession\(user\.id\)/);
  assert.match(customerLogoutSource, /session\?\.role === 'CUSTOMER'/);
  assert.match(customerLogoutSource, /isSameOriginFormRequest\(request\)/);
  assert.match(walletSource, /action="\/customer\/logout"/);
  assert.doesNotMatch(sitemapSource, /\/wallet/);
  assert.match(robotsSource, /'\/customer'/);
  assert.match(robotsSource, /'\/wallet'/);
});
