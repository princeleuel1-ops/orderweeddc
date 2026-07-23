// Passenger-safe tenant rewrite builder.
//
// Production incident 2026-07-23:
//   Next built the Proxy request URL as https://localhost:3000 even though
//   Phusion Passenger had started the standalone server on a different
//   loopback port. Rewriting that URL made Next proxy to an unbound listener
//   and produced ECONNREFUSED / HTTP 500.
//
// Important: request.url and request.nextUrl are derived from the same URL in
// NextRequest, so switching between them does not repair a bad origin. The
// production target must be built from Passenger's runtime PORT and a
// validated loopback hostname. The existing second-pass guard in proxy.ts then
// allows the tenant-prefixed request through when Next re-dispatches it over
// loopback.

const TENANT_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;
const LOOPBACK_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1']);

function parseRuntimePort(value) {
  const text = String(value ?? '').trim();
  if (!/^[0-9]{1,5}$/.test(text)) return null;
  const port = Number(text);
  return Number.isInteger(port) && port >= 1 && port <= 65_535 ? port : null;
}

function normalizeLoopbackHostname(value) {
  const candidate = String(value ?? '').trim().toLowerCase();
  return LOOPBACK_HOSTNAMES.has(candidate) ? candidate : '127.0.0.1';
}

function loopbackAuthority(hostname, port) {
  return hostname === '::1' ? `[::1]:${port}` : `${hostname}:${port}`;
}

function normalizedTenantPath(tenantDomain, pathname) {
  if (
    typeof tenantDomain !== 'string' ||
    !TENANT_SEGMENT_PATTERN.test(tenantDomain)
  ) {
    throw new TypeError('A safe tenantDomain is required');
  }

  const sourcePath =
    typeof pathname === 'string' && pathname.startsWith('/')
      ? pathname
      : '/';

  return `/${tenantDomain}${sourcePath}`;
}

/**
 * Build the tenant rewrite URL for Next.js running behind Passenger.
 *
 * In production, PORT is mandatory and the destination is pinned to a
 * loopback address. This prevents the public Host or forwarded headers from
 * turning the rewrite into SSRF and avoids the stale localhost:3000 origin.
 *
 * In development only, rawRequestUrl may be used as a same-origin fallback so
 * `next dev` remains convenient when no PORT variable is exported.
 */
export function buildTenantRewriteUrl({
  tenantDomain,
  pathname,
  search = '',
  runtimePort,
  runtimeHostname,
  rawRequestUrl,
  production = process.env.NODE_ENV === 'production',
}) {
  const tenantPath = normalizedTenantPath(tenantDomain, pathname);
  const port = parseRuntimePort(runtimePort);

  let destination;
  if (port) {
    const hostname = normalizeLoopbackHostname(runtimeHostname);
    destination = new URL(`http://${loopbackAuthority(hostname, port)}`);
  } else if (!production && rawRequestUrl) {
    destination = new URL(rawRequestUrl);
    if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
      throw new TypeError('Development rewrite origin must be HTTP(S)');
    }
  } else {
    throw new Error('A valid Passenger PORT is required for production tenant rewrites');
  }

  destination.pathname = tenantPath;
  destination.search = typeof search === 'string' ? search : '';
  destination.hash = '';
  return destination;
}

export function rewriteUsesUnboundDefaultPort(rewriteUrlLike) {
  const target = new URL(rewriteUrlLike);
  return (
    target.protocol === 'https:' &&
    target.hostname === 'localhost' &&
    target.port === '3000'
  );
}
