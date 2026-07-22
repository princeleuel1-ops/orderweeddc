const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export class TenantBoundaryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TenantBoundaryError';
    this.code = 'INVALID_TENANT_BOUNDARY_INPUT';
  }
}

function identifier(value, label) {
  if (typeof value !== 'string') {
    throw new TenantBoundaryError(`${label} is required.`);
  }
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new TenantBoundaryError(`${label} has an invalid format.`);
  }
  return normalized;
}

export function tenantRetailerWhere(brandId, retailerId, asOf = new Date()) {
  return {
    id: identifier(retailerId, 'Retailer ID'),
    ...publicRetailerWhere(asOf),
    menus: {
      some: {
        brandMenus: {
          some: {
            brandId: identifier(brandId, 'Brand ID'),
          },
        },
      },
    },
  };
}
import { publicRetailerWhere } from './public-retailer.mjs';
