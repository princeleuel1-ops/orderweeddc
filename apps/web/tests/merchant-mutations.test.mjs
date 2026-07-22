import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MerchantMutationError,
  addRetailerMenuItem,
  createRetailerDeal,
  updateRetailerMenuEntry,
  updateRetailerProfile,
} from '../src/lib/merchant-mutations.mjs';
import {
  MerchantValidationError,
  validateDealMutation,
  validateMenuEntryMutation,
  validateProfileMutation,
} from '../src/lib/merchant-validation.mjs';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(testDirectory, '..');
const NOW = new Date('2026-07-17T16:00:00.000Z');

function createFakeDb(initialState, { failAudit = false } = {}) {
  let store = structuredClone({
    retailers: [],
    products: [],
    menuEntries: [],
    brands: [],
    brandMenus: [],
    deals: [],
    audits: [],
    ...initialState,
  });
  let transactionCount = 0;

  function delegateFor(draft) {
    return {
      retailer: {
        async findUnique({ where }) {
          return draft.retailers.find((item) => item.id === where.id) ?? null;
        },
        async update({ where, data }) {
          const target = draft.retailers.find((item) => item.id === where.id);
          if (!target) throw new Error('Retailer update target missing.');
          Object.assign(target, data);
          return target;
        },
      },
      product: {
        async findUnique({ where }) {
          return draft.products.find((item) => item.id === where.id) ?? null;
        },
      },
      menuEntry: {
        async findFirst({ where }) {
          return (
            draft.menuEntries.find(
              (item) =>
                (where.id === undefined || item.id === where.id) &&
                (where.retailerId === undefined ||
                  item.retailerId === where.retailerId) &&
                (where.productId === undefined ||
                  item.productId === where.productId),
            ) ?? null
          );
        },
        async updateMany({ where, data }) {
          const matches = draft.menuEntries.filter(
            (item) =>
              item.id === where.id && item.retailerId === where.retailerId,
          );
          for (const item of matches) Object.assign(item, data);
          return { count: matches.length };
        },
        async create({ data }) {
          if (
            draft.menuEntries.some(
              (item) =>
                item.retailerId === data.retailerId &&
                item.productId === data.productId,
            )
          ) {
            throw Object.assign(new Error('Unique constraint failed.'), {
              code: 'P2002',
            });
          }
          const entry = { id: 'menu-new', ...data };
          draft.menuEntries.push(entry);
          return entry;
        },
      },
      brand: {
        async findUnique({ where }) {
          return draft.brands.find((item) => item.domain === where.domain) ?? null;
        },
      },
      brandMenu: {
        async create({ data }) {
          if (
            draft.brandMenus.some(
              (item) =>
                item.brandId === data.brandId &&
                item.menuEntryId === data.menuEntryId,
            )
          ) {
            throw Object.assign(new Error('Unique constraint failed.'), {
              code: 'P2002',
            });
          }
          const selection = { id: 'brand-menu-new', ...data };
          draft.brandMenus.push(selection);
          return selection;
        },
      },
      deal: {
        async create({ data }) {
          const deal = { id: 'deal-new', ...data };
          draft.deals.push(deal);
          return deal;
        },
      },
      auditLog: {
        async create({ data }) {
          if (failAudit) throw new Error('Injected audit failure.');
          const audit = { id: `audit-${draft.audits.length + 1}`, ...data };
          draft.audits.push(audit);
          return audit;
        },
      },
    };
  }

  return {
    async $transaction(callback) {
      transactionCount += 1;
      const draft = structuredClone(store);
      const result = await callback(delegateFor(draft));
      store = draft;
      return result;
    },
    snapshot() {
      return structuredClone(store);
    },
    get transactionCount() {
      return transactionCount;
    },
  };
}

test('profile inputs are normalized and explicitly bounded on the server', () => {
  assert.deepEqual(
    validateProfileMutation({
      name: '  Example   Retailer ',
      address: ' 100 Example Avenue NW ',
      phone: '(202) 555-0100',
      hours: ' 10:00 AM - 8:00 PM ',
      hoursSource: ' Retailer records ',
    }),
    {
      name: 'Example Retailer',
      address: '100 Example Avenue NW',
      phone: '(202) 555-0100',
      hours: '10:00 AM - 8:00 PM',
      hoursSource: 'Retailer records',
    },
  );

  assert.throws(
    () =>
      validateProfileMutation({
        name: 'x'.repeat(121),
        address: '100 Example Avenue',
        phone: '',
        hours: '10-8',
        hoursSource: 'Retailer',
      }),
    MerchantValidationError,
  );
  assert.throws(
    () =>
      validateProfileMutation({
        name: 'Example Retailer',
        address: '100 Example\u0000 Avenue',
        phone: '',
        hours: '10-8',
        hoursSource: 'Retailer',
    }),
    /unsupported characters/,
  );
  assert.throws(
    () =>
      validateProfileMutation({
        name: `A${' '.repeat(121)}B`,
        address: '100 Example Avenue',
        phone: '',
        hours: '10-8',
        hoursSource: 'Retailer',
      }),
    /Business name must be between/,
  );
});

test('unsafe prices, quantities, and deal durations are rejected', () => {
  const menuInput = {
    menuEntryId: 'menu-one',
    price: '25.00',
    quantity: '5',
  };
  for (const unsafePrice of ['NaN', 'Infinity', '-1', '0', '12.345', '10000.01']) {
    assert.throws(
      () => validateMenuEntryMutation({ ...menuInput, price: unsafePrice }),
      MerchantValidationError,
      unsafePrice,
    );
  }
  for (const unsafeQuantity of ['', undefined, '-1', '1.5', '100001', 'Infinity']) {
    assert.throws(
      () => validateMenuEntryMutation({ ...menuInput, quantity: unsafeQuantity }),
      MerchantValidationError,
      unsafeQuantity,
    );
  }

  const dealInput = {
    title: 'Weekend offer',
    discount: '10% OFF',
    code: 'save-10',
    days: '7',
    description: 'A bounded promotion.',
  };
  assert.equal(validateDealMutation(dealInput).code, 'SAVE-10');
  assert.throws(
    () =>
      validateDealMutation({
        ...dealInput,
        description: `A${' '.repeat(1001)}B`,
      }),
    /Deal description must be between/,
  );
  for (const unsafeDays of ['0', '1.5', '91', 'Infinity']) {
    assert.throws(
      () => validateDealMutation({ ...dealInput, days: unsafeDays }),
      MerchantValidationError,
      unsafeDays,
    );
  }
});

test('menu updates preserve the retailer ownership boundary', async () => {
  const db = createFakeDb({
    retailers: [
      { id: 'retailer-alpha', isDemonstration: false, menuUpdatedAt: null },
      { id: 'retailer-beta', isDemonstration: false, menuUpdatedAt: null },
    ],
    menuEntries: [
      {
        id: 'menu-beta',
        retailerId: 'retailer-beta',
        productId: 'product-one',
        price: 20,
        quantity: 4,
        inStock: true,
        isDemonstration: false,
      },
    ],
  });
  const before = db.snapshot();

  await assert.rejects(
    updateRetailerMenuEntry(db, {
      retailerId: 'retailer-alpha',
      actorUserId: 'manager-alpha',
      input: {
        menuEntryId: 'menu-beta',
        price: '1.00',
        quantity: '0',
      },
      now: NOW,
    }),
    (error) =>
      error instanceof MerchantMutationError &&
      error.code === 'MENU_ENTRY_NOT_OWNED',
  );
  assert.deepEqual(db.snapshot(), before);
});

test('duplicate catalog selections are rejected and constrained in the schema', async () => {
  const db = createFakeDb({
    retailers: [{ id: 'retailer-alpha', isDemonstration: false }],
    products: [{ id: 'product-one', isDemonstration: false }],
    menuEntries: [
      {
        id: 'menu-existing',
        retailerId: 'retailer-alpha',
        productId: 'product-one',
      },
    ],
  });

  await assert.rejects(
    addRetailerMenuItem(db, {
      retailerId: 'retailer-alpha',
      actorUserId: 'manager-alpha',
      input: { productId: 'product-one', price: '25.00', quantity: '3' },
      now: NOW,
    }),
    (error) =>
      error instanceof MerchantMutationError &&
      error.code === 'DUPLICATE_MENU_ITEM',
  );
  assert.equal(db.snapshot().menuEntries.length, 1);

  const schema = fs.readFileSync(
    path.join(webRoot, 'prisma/schema.prisma'),
    'utf8',
  );
  assert.match(schema, /@@unique\(\[retailerId, productId\]\)/);
  assert.match(schema, /@@unique\(\[brandId, menuEntryId\]\)/);
});

test('legacy inventory remains unknown until a bounded quantity is submitted', () => {
  const schema = fs.readFileSync(
    path.join(webRoot, 'prisma/schema.prisma'),
    'utf8',
  );
  const dashboard = fs.readFileSync(
    path.join(webRoot, 'src/app/business/dashboard/page.tsx'),
    'utf8',
  );

  assert.match(schema, /quantity\s+Int\?/);
  assert.doesNotMatch(schema, /quantity\s+Int\s+@default/);
  assert.match(dashboard, /defaultValue=\{entry\.quantity \?\? ''\}/);
});

test('multi-write mutations roll back if audit evidence cannot be recorded', async () => {
  const db = createFakeDb(
    {
      retailers: [
        {
          id: 'retailer-alpha',
          isDemonstration: false,
          name: 'Original Name',
          address: '100 Original Avenue',
        },
      ],
    },
    { failAudit: true },
  );
  const before = db.snapshot();

  await assert.rejects(
    updateRetailerProfile(db, {
      retailerId: 'retailer-alpha',
      actorUserId: 'manager-alpha',
      input: {
        name: 'Submitted Secret Name',
        address: '200 Updated Avenue',
        phone: '202-555-0100',
        hours: '9 AM - 7 PM',
        hoursSource: 'Retailer records',
      },
      now: NOW,
    }),
    /Injected audit failure/,
  );
  assert.equal(db.transactionCount, 1);
  assert.deepEqual(db.snapshot(), before);
});

test('profile and inventory updates commit minimal actor and record audit evidence', async () => {
  const db = createFakeDb({
    retailers: [
      {
        id: 'retailer-alpha',
        isDemonstration: false,
        name: 'Original Name',
        address: '100 Original Avenue',
        menuUpdatedAt: null,
      },
    ],
    menuEntries: [
      {
        id: 'menu-alpha',
        retailerId: 'retailer-alpha',
        productId: 'product-one',
        price: 20,
        quantity: 4,
        inStock: true,
        isDemonstration: false,
      },
    ],
  });

  await updateRetailerProfile(db, {
    retailerId: 'retailer-alpha',
    actorUserId: 'manager-alpha',
    input: {
      name: 'Private Submitted Name',
      address: '200 Updated Avenue',
      phone: '202-555-0100',
      hours: '9 AM - 7 PM',
      hoursSource: 'Private submitted records',
    },
    now: NOW,
  });
  await updateRetailerMenuEntry(db, {
    retailerId: 'retailer-alpha',
    actorUserId: 'manager-alpha',
    input: {
      menuEntryId: 'menu-alpha',
      price: '25.50',
      quantity: '0',
    },
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(db.transactionCount, 2);
  assert.equal(state.menuEntries[0].price, 25.5);
  assert.equal(state.menuEntries[0].quantity, 0);
  assert.equal(state.menuEntries[0].inStock, false);
  assert.deepEqual(state.retailers[0].menuUpdatedAt, NOW);
  assert.deepEqual(
    state.audits.map(({ userId, action, details }) => ({
      userId,
      action,
      details,
    })),
    [
      {
        userId: 'manager-alpha',
        action: 'UPDATE_RETAILER_PROFILE',
        details: 'retailerId=retailer-alpha',
      },
      {
        userId: 'manager-alpha',
        action: 'UPDATE_MENU_ENTRY',
        details: 'retailerId=retailer-alpha menuEntryId=menu-alpha',
      },
    ],
  );
  assert.doesNotMatch(
    state.audits.map((audit) => audit.details).join(' '),
    /Private|Submitted|25\.50|202-555-0100/,
  );
});

test('menu creation commits catalog link, inventory, timestamp, and minimal audit together', async () => {
  const db = createFakeDb({
    retailers: [
      { id: 'retailer-alpha', isDemonstration: false, menuUpdatedAt: null },
    ],
    products: [{ id: 'product-one', isDemonstration: false }],
    brands: [{ id: 'brand-main', domain: 'orderweeddc.localhost' }],
  });

  await addRetailerMenuItem(db, {
    retailerId: 'retailer-alpha',
    actorUserId: 'manager-alpha',
    input: { productId: 'product-one', price: '25.50', quantity: '0' },
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(db.transactionCount, 1);
  assert.equal(state.menuEntries.length, 1);
  assert.equal(state.menuEntries[0].price, 25.5);
  assert.equal(state.menuEntries[0].quantity, 0);
  assert.equal(state.menuEntries[0].inStock, false);
  assert.deepEqual(state.brandMenus[0], {
    id: 'brand-menu-new',
    brandId: 'brand-main',
    menuEntryId: 'menu-new',
  });
  assert.deepEqual(state.retailers[0].menuUpdatedAt, NOW);
  assert.equal(state.audits[0].userId, 'manager-alpha');
  assert.equal(state.audits[0].action, 'ADD_MENU_ITEM');
  assert.equal(
    state.audits[0].details,
    'retailerId=retailer-alpha menuEntryId=menu-new productId=product-one',
  );
  assert.doesNotMatch(state.audits[0].details, /25\.50/);
});

test('deal creation uses a bounded UTC duration and audits identifiers only', async () => {
  const db = createFakeDb({
    retailers: [
      { id: 'retailer-alpha', isDemonstration: false, dealUpdatedAt: null },
    ],
  });

  await createRetailerDeal(db, {
    retailerId: 'retailer-alpha',
    actorUserId: 'manager-alpha',
    input: {
      title: 'Private submitted title',
      discount: '10% OFF',
      code: 'save10',
      days: '7',
      description: 'Submitted promotion details.',
    },
    now: NOW,
  });

  const state = db.snapshot();
  assert.equal(db.transactionCount, 1);
  assert.deepEqual(state.deals[0].expiryDate, new Date('2026-07-24T16:00:00.000Z'));
  assert.deepEqual(state.retailers[0].dealUpdatedAt, NOW);
  assert.equal(state.audits[0].userId, 'manager-alpha');
  assert.equal(
    state.audits[0].details,
    'retailerId=retailer-alpha dealId=deal-new',
  );
  assert.doesNotMatch(state.audits[0].details, /Private|Submitted|10%/);
});

test('database uniqueness races map to the same deterministic duplicate error', async () => {
  const db = {
    async $transaction() {
      throw Object.assign(new Error('Unique constraint failed.'), { code: 'P2002' });
    },
  };

  await assert.rejects(
    addRetailerMenuItem(db, {
      retailerId: 'retailer-alpha',
      actorUserId: 'manager-alpha',
      input: {
        productId: 'product-one',
        price: '25.00',
        quantity: '1',
      },
      now: NOW,
    }),
    (error) =>
      error instanceof MerchantMutationError &&
      error.code === 'DUPLICATE_MENU_ITEM',
  );
});
