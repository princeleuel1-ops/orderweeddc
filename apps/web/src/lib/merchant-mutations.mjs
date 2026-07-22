import {
  MerchantValidationError,
  validateAddMenuItemMutation,
  validateDealMutation,
  validateMenuEntryMutation,
  validateMerchantIdentifier,
  validateProfileMutation,
} from './merchant-validation.mjs';

const DASHBOARD_DATA_SOURCE = 'Retailer dashboard submission';
const MAIN_BRAND_DOMAIN = 'orderweeddc.localhost';

export class MerchantMutationError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'MerchantMutationError';
    this.code = code;
  }
}

function mutationContext(retailerId, actorUserId) {
  return {
    retailerId: validateMerchantIdentifier(retailerId, 'Retailer ID'),
    actorUserId: validateMerchantIdentifier(actorUserId, 'Actor user ID'),
  };
}

function pendingProvenance(isDemonstration, now) {
  return {
    dataStatus: isDemonstration
      ? 'DEMONSTRATION_ONLY'
      : 'AWAITING_VERIFICATION',
    dataSource: DASHBOARD_DATA_SOURCE,
    retrievedAt: now,
    verifiedAt: null,
    freshnessExpiresAt: null,
    reviewedBy: null,
  };
}

function auditData(actorUserId, action, identifiers) {
  const details = Object.entries(identifiers)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

  return {
    userId: actorUserId,
    action,
    details,
  };
}

function isUniqueConstraintError(error) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002',
  );
}

function mutationTime(now) {
  const value = now ?? new Date();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new MerchantValidationError('Mutation time must be a valid date.');
  }
  return new Date(value);
}

export function calculateDealExpiry(days, now) {
  const expiryDate = mutationTime(now);
  expiryDate.setUTCDate(expiryDate.getUTCDate() + days);
  return expiryDate;
}

export async function updateRetailerProfile(
  db,
  { retailerId, actorUserId, input, now = undefined },
) {
  const context = mutationContext(retailerId, actorUserId);
  const submission = validateProfileMutation(input);
  const timestamp = mutationTime(now);

  return db.$transaction(async (transaction) => {
    const retailer = await transaction.retailer.findUnique({
      where: { id: context.retailerId },
      select: { id: true, isDemonstration: true },
    });
    if (!retailer) {
      throw new MerchantMutationError('Retailer not found.', 'RETAILER_NOT_FOUND');
    }

    await transaction.retailer.update({
      where: { id: context.retailerId },
      data: {
        ...submission,
        lastInfoCheck: timestamp,
        ...pendingProvenance(retailer.isDemonstration, timestamp),
      },
    });
    await transaction.auditLog.create({
      data: auditData(context.actorUserId, 'UPDATE_RETAILER_PROFILE', {
        retailerId: context.retailerId,
      }),
    });
  });
}

export async function updateRetailerMenuEntry(
  db,
  { retailerId, actorUserId, input, now = undefined },
) {
  const context = mutationContext(retailerId, actorUserId);
  const submission = validateMenuEntryMutation(input);
  const timestamp = mutationTime(now);

  return db.$transaction(async (transaction) => {
    const entry = await transaction.menuEntry.findFirst({
      where: {
        id: submission.menuEntryId,
        retailerId: context.retailerId,
      },
      select: { id: true, isDemonstration: true },
    });
    if (!entry) {
      throw new MerchantMutationError(
        'Menu entry not found for this retailer.',
        'MENU_ENTRY_NOT_OWNED',
      );
    }

    const updateResult = await transaction.menuEntry.updateMany({
      where: {
        id: submission.menuEntryId,
        retailerId: context.retailerId,
      },
      data: {
        price: submission.price,
        quantity: submission.quantity,
        inStock: submission.quantity > 0,
        ...pendingProvenance(entry.isDemonstration, timestamp),
      },
    });
    if (updateResult.count !== 1) {
      throw new MerchantMutationError(
        'Menu entry changed before it could be updated.',
        'MENU_ENTRY_CONFLICT',
      );
    }

    await transaction.retailer.update({
      where: { id: context.retailerId },
      data: { menuUpdatedAt: timestamp },
    });
    await transaction.auditLog.create({
      data: auditData(context.actorUserId, 'UPDATE_MENU_ENTRY', {
        retailerId: context.retailerId,
        menuEntryId: submission.menuEntryId,
      }),
    });
  });
}

export async function addRetailerMenuItem(
  db,
  { retailerId, actorUserId, input, now = undefined },
) {
  const context = mutationContext(retailerId, actorUserId);
  const submission = validateAddMenuItemMutation(input);
  const timestamp = mutationTime(now);

  try {
    return await db.$transaction(async (transaction) => {
      const [retailer, product, duplicate] = await Promise.all([
        transaction.retailer.findUnique({
          where: { id: context.retailerId },
          select: { id: true, isDemonstration: true },
        }),
        transaction.product.findUnique({
          where: { id: submission.productId },
          select: { id: true, isDemonstration: true },
        }),
        transaction.menuEntry.findFirst({
          where: {
            retailerId: context.retailerId,
            productId: submission.productId,
          },
          select: { id: true },
        }),
      ]);

      if (!retailer) {
        throw new MerchantMutationError('Retailer not found.', 'RETAILER_NOT_FOUND');
      }
      if (!product) {
        throw new MerchantMutationError('Catalog product not found.', 'PRODUCT_NOT_FOUND');
      }
      if (duplicate) {
        throw new MerchantMutationError(
          'This catalog product is already on the retailer menu.',
          'DUPLICATE_MENU_ITEM',
        );
      }

      const isDemonstration =
        retailer.isDemonstration || product.isDemonstration;
      const entry = await transaction.menuEntry.create({
        data: {
          retailerId: context.retailerId,
          productId: submission.productId,
          price: submission.price,
          quantity: submission.quantity,
          inStock: submission.quantity > 0,
          ...pendingProvenance(isDemonstration, timestamp),
          isDemonstration,
        },
      });

      const mainBrand = await transaction.brand.findUnique({
        where: { domain: MAIN_BRAND_DOMAIN },
        select: { id: true },
      });
      if (mainBrand) {
        await transaction.brandMenu.create({
          data: {
            brandId: mainBrand.id,
            menuEntryId: entry.id,
          },
        });
      }

      await transaction.retailer.update({
        where: { id: context.retailerId },
        data: { menuUpdatedAt: timestamp },
      });
      await transaction.auditLog.create({
        data: auditData(context.actorUserId, 'ADD_MENU_ITEM', {
          retailerId: context.retailerId,
          menuEntryId: entry.id,
          productId: submission.productId,
        }),
      });

      return entry;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new MerchantMutationError(
        'This catalog product is already on the retailer menu.',
        'DUPLICATE_MENU_ITEM',
      );
    }
    throw error;
  }
}

export async function createRetailerDeal(
  db,
  { retailerId, actorUserId, input, now = undefined },
) {
  const context = mutationContext(retailerId, actorUserId);
  const submission = validateDealMutation(input);
  const timestamp = mutationTime(now);
  const expiryDate = calculateDealExpiry(submission.days, timestamp);

  return db.$transaction(async (transaction) => {
    const retailer = await transaction.retailer.findUnique({
      where: { id: context.retailerId },
      select: { id: true, isDemonstration: true },
    });
    if (!retailer) {
      throw new MerchantMutationError('Retailer not found.', 'RETAILER_NOT_FOUND');
    }

    const deal = await transaction.deal.create({
      data: {
        retailerId: context.retailerId,
        title: submission.title,
        discount: submission.discount,
        code: submission.code,
        expiryDate,
        description: submission.description,
        isActive: true,
        ...pendingProvenance(retailer.isDemonstration, timestamp),
        isDemonstration: retailer.isDemonstration,
      },
    });
    await transaction.retailer.update({
      where: { id: context.retailerId },
      data: { dealUpdatedAt: timestamp },
    });
    await transaction.auditLog.create({
      data: auditData(context.actorUserId, 'CREATE_RETAILER_DEAL', {
        retailerId: context.retailerId,
        dealId: deal.id,
      }),
    });

    return deal;
  });
}
