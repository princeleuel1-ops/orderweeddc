export const ADMIN_QUEUE_PAGE_SIZE = 25;
export const ADMIN_QUEUE_MAX_PAGE = 1_000;

export const ADMIN_QUEUE_KEYS = Object.freeze([
  'evidencePage',
  'claimPage',
  'disputePage',
  'stalePage',
]);

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function pageNumber(value) {
  const first = firstValue(value);
  if (Number.isSafeInteger(first) && first >= 1) {
    return Math.min(first, ADMIN_QUEUE_MAX_PAGE);
  }
  const text = first;
  if (typeof text !== 'string' || !/^[1-9]\d{0,3}$/.test(text)) return 1;
  return Math.min(Number(text), ADMIN_QUEUE_MAX_PAGE);
}

export function parseAdminDashboardSearch(searchParams = {}) {
  return Object.fromEntries(
    ADMIN_QUEUE_KEYS.map((key) => [key, pageNumber(searchParams[key])]),
  );
}

export function queuePageCount(totalItems) {
  if (!Number.isSafeInteger(totalItems) || totalItems < 0) {
    throw new TypeError('Queue item count must be a non-negative safe integer.');
  }
  return Math.max(1, Math.ceil(totalItems / ADMIN_QUEUE_PAGE_SIZE));
}

export function clampQueuePage(requestedPage, totalItems) {
  const parsed = pageNumber(String(requestedPage));
  return Math.min(parsed, queuePageCount(totalItems));
}

export function queuePageOffset(page) {
  return (pageNumber(String(page)) - 1) * ADMIN_QUEUE_PAGE_SIZE;
}

export function adminQueueHref(currentPages, queueKey, targetPage) {
  if (!ADMIN_QUEUE_KEYS.includes(queueKey)) {
    throw new TypeError('Unknown administrator queue.');
  }

  const pages = parseAdminDashboardSearch({
    ...currentPages,
    [queueKey]: String(targetPage),
  });
  const params = new URLSearchParams();
  for (const key of ADMIN_QUEUE_KEYS) {
    if (pages[key] > 1) params.set(key, String(pages[key]));
  }
  const query = params.toString();
  return query ? `/admin?${query}` : '/admin';
}
