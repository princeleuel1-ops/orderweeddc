import { isIP } from 'node:net';

const FORM_CONTENT_TYPES = [
  'application/x-www-form-urlencoded',
  'multipart/form-data',
];

function normalizedAddress(value) {
  if (typeof value !== 'string') return null;
  const first = value.split(',')[0]?.trim().replace(/^\[|\]$/g, '');
  return first && isIP(first) ? first.toLowerCase() : null;
}

export function authenticationClientIdentity(request) {
  const candidates = [
    request.headers.get('cf-connecting-ip'),
    request.headers.get('x-real-ip'),
    request.headers.get('x-forwarded-for'),
  ];
  for (const candidate of candidates) {
    const address = normalizedAddress(candidate);
    if (address) return address;
  }
  return 'unresolved';
}

export function isSameOriginFormRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!FORM_CONTENT_TYPES.some((type) => contentType.startsWith(type))) {
    return false;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const hostname = host.split(':')[0].toLowerCase();
    const forwardedProtocol = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      .trim()
      .toLowerCase();
    const expectedProtocol =
      forwardedProtocol === 'http' || forwardedProtocol === 'https'
        ? `${forwardedProtocol}:`
        : hostname.endsWith('.localhost')
          ? 'http:'
          : 'https:';

    return (
      originUrl.host.toLowerCase() === host.toLowerCase() &&
      originUrl.protocol === expectedProtocol
    );
  } catch {
    return false;
  }
}

export function formRedirectUrl(request, pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) {
    throw new Error('Form redirect path must be same-origin.');
  }
  if (!isSameOriginFormRequest(request)) {
    throw new Error('Form redirect origin must match the request host.');
  }
  const origin = request.headers.get('origin');
  return new URL(pathname, origin);
}
