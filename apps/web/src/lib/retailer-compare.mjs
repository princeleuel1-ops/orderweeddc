import { publicRetailerWhere } from './public-retailer.mjs';

export const RETAILER_COMPARE_LIMIT = 3;
export const RETAILER_COMPARE_INPUT_LIMIT = 12;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function validIdentifier(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} is required.`);
  }
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    throw new TypeError(`${label} has an invalid format.`);
  }
  return normalized;
}

function validTime(asOf) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) {
    throw new TypeError('Retailer comparison time must be a valid date.');
  }
  return new Date(asOf);
}

function inputValues(value) {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null ? [] : [value];
}

export function parseRetailerCompareSelection(value) {
  const inputs = inputValues(value);
  const ids = [];
  let duplicateCount = 0;
  let invalidCount = 0;
  let overLimitCount = Math.max(
    0,
    inputs.length - RETAILER_COMPARE_INPUT_LIMIT,
  );

  for (const input of inputs.slice(0, RETAILER_COMPARE_INPUT_LIMIT)) {
    const normalized = typeof input === 'string' ? input.trim() : '';
    if (!IDENTIFIER_PATTERN.test(normalized)) {
      invalidCount += 1;
      continue;
    }
    if (ids.includes(normalized)) {
      duplicateCount += 1;
      continue;
    }
    if (ids.length >= RETAILER_COMPARE_LIMIT) {
      overLimitCount += 1;
      continue;
    }
    ids.push(normalized);
  }

  return Object.freeze({
    ids: Object.freeze(ids),
    duplicateCount,
    invalidCount,
    overLimitCount,
    rejectedCount: duplicateCount + invalidCount + overLimitCount,
  });
}

export function retailerCompareWhere({
  brandId,
  retailerIds,
  asOf = new Date(),
}) {
  const scopedBrandId = validIdentifier(brandId, 'Brand ID');
  const timestamp = validTime(asOf);
  const selection = parseRetailerCompareSelection(retailerIds);

  return {
    id: { in: [...selection.ids] },
    ...publicRetailerWhere(timestamp),
    menus: {
      some: {
        brandMenus: {
          some: {
            brandId: scopedBrandId,
          },
        },
      },
    },
  };
}

export function retailerCompareHref(retailerIds) {
  const selection = parseRetailerCompareSelection(retailerIds);
  const params = new URLSearchParams();
  for (const id of selection.ids) params.append('retailer', id);
  const query = params.toString();
  return query ? `/compare?${query}` : '/compare';
}
