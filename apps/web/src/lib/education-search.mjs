export const EDUCATION_QUERY_MAX_LENGTH = 80;
export const EDUCATION_PAGE_SIZE = 12;
export const EDUCATION_MAX_PAGE = 1_000;
export const EDUCATION_PAGE_KEYS = Object.freeze([
  'articlePage',
  'strainPage',
]);

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEducationSearch(value) {
  const text = firstValue(value);
  if (typeof text !== 'string') return '';
  return text
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, EDUCATION_QUERY_MAX_LENGTH);
}

function pageNumber(value) {
  const text = firstValue(value);
  if (Number.isSafeInteger(text) && text >= 1) {
    return Math.min(text, EDUCATION_MAX_PAGE);
  }
  if (typeof text !== 'string' || !/^[1-9]\d{0,3}$/.test(text)) return 1;
  return Math.min(Number(text), EDUCATION_MAX_PAGE);
}

export function parseEducationHubSearch(searchParams = {}) {
  return {
    strain: parseEducationSearch(searchParams.strain),
    articlePage: pageNumber(searchParams.articlePage),
    strainPage: pageNumber(searchParams.strainPage),
  };
}

export function educationPageCount(totalItems) {
  if (!Number.isSafeInteger(totalItems) || totalItems < 0) {
    throw new TypeError(
      'Education item count must be a non-negative safe integer.',
    );
  }
  return Math.max(1, Math.ceil(totalItems / EDUCATION_PAGE_SIZE));
}

export function clampEducationPage(requestedPage, totalItems) {
  return Math.min(pageNumber(requestedPage), educationPageCount(totalItems));
}

export function educationPageOffset(page) {
  return (pageNumber(page) - 1) * EDUCATION_PAGE_SIZE;
}

export function educationHubHref(currentSearch, pageKey, targetPage) {
  if (!EDUCATION_PAGE_KEYS.includes(pageKey)) {
    throw new TypeError('Unknown education collection.');
  }
  const parsed = parseEducationHubSearch({
    ...currentSearch,
    [pageKey]: targetPage,
  });
  const params = new URLSearchParams();
  if (parsed.strain) params.set('strain', parsed.strain);
  for (const key of EDUCATION_PAGE_KEYS) {
    if (parsed[key] > 1) params.set(key, String(parsed[key]));
  }
  const query = params.toString();
  return query ? `/education?${query}` : '/education';
}
