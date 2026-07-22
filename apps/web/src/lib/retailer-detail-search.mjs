export const PUBLIC_DEAL_PREVIEW_LIMIT = 3;
export const RETAILER_MENU_PAGE_SIZE = 24;
export const RETAILER_DEAL_PAGE_SIZE = 12;
export const RETAILER_DETAIL_MAX_PAGE = 1_000;
export const RETAILER_DETAIL_PAGE_KEYS = Object.freeze([
  'menuPage',
  'dealPage',
]);

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value) {
  const text = firstValue(value);
  if (Number.isSafeInteger(text) && text >= 1) {
    return Math.min(text, RETAILER_DETAIL_MAX_PAGE);
  }
  if (typeof text !== 'string' || !/^[1-9]\d{0,3}$/.test(text)) return 1;
  return Math.min(Number(text), RETAILER_DETAIL_MAX_PAGE);
}

function pageSize(pageKey) {
  switch (pageKey) {
    case 'menuPage':
      return RETAILER_MENU_PAGE_SIZE;
    case 'dealPage':
      return RETAILER_DEAL_PAGE_SIZE;
    default:
      throw new TypeError('Unknown retailer detail collection.');
  }
}

export function parseRetailerDetailSearch(searchParams = {}) {
  return {
    menuPage: pageNumber(searchParams.menuPage),
    dealPage: pageNumber(searchParams.dealPage),
  };
}

export function retailerDetailPageCount(totalItems, pageKey) {
  if (!Number.isSafeInteger(totalItems) || totalItems < 0) {
    throw new TypeError(
      'Retailer detail item count must be a non-negative safe integer.',
    );
  }
  return Math.max(1, Math.ceil(totalItems / pageSize(pageKey)));
}

export function clampRetailerDetailPage(requestedPage, totalItems, pageKey) {
  return Math.min(
    pageNumber(requestedPage),
    retailerDetailPageCount(totalItems, pageKey),
  );
}

export function retailerDetailPageOffset(page, pageKey) {
  return (pageNumber(page) - 1) * pageSize(pageKey);
}

export function retailerDetailHref(
  retailerId,
  currentSearch,
  pageKey,
  targetPage,
) {
  const normalizedRetailerId =
    typeof retailerId === 'string' ? retailerId.trim() : '';
  if (!IDENTIFIER_PATTERN.test(normalizedRetailerId)) {
    throw new TypeError('Retailer ID has an invalid format.');
  }
  if (!RETAILER_DETAIL_PAGE_KEYS.includes(pageKey)) {
    throw new TypeError('Unknown retailer detail collection.');
  }
  const parsed = parseRetailerDetailSearch({
    ...currentSearch,
    [pageKey]: targetPage,
  });
  const params = new URLSearchParams();
  for (const key of RETAILER_DETAIL_PAGE_KEYS) {
    if (parsed[key] > 1) params.set(key, String(parsed[key]));
  }
  const query = params.toString();
  const pathname = `/retailer/${encodeURIComponent(normalizedRetailerId)}`;
  return query ? `${pathname}?${query}` : pathname;
}
