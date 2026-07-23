// Same-origin tenant rewrite builder for the Passenger / LiteSpeed standalone runtime.
//
// WHY THIS EXISTS (production incident 2026-07-23):
//   The tenant proxy previously rewrote `request.nextUrl`. Behind Phusion Passenger,
//   request.nextUrl carries the FORWARDED protocol (https, from x-forwarded-proto) over the
//   INTERNAL TCP host (localhost:3000). Passing that ABSOLUTE URL to NextResponse.rewrite()
//   made Next treat it as a cross-origin target and PROXY to https://localhost:3000 — where no
//   listener exists under Passenger — producing:
//       x-middleware-rewrite: https://localhost:3000/orderweeddc.localhost
//       Failed to proxy ... ECONNREFUSED ::1:3000 / 127.0.0.1:3000   → HTTP 500 on "/".
//
//   The fix builds the rewrite from the RAW INTERNAL request URL (request.url), which is the
//   origin the standalone server actually serves. That keeps the rewrite SAME-ORIGIN, so Next
//   resolves it in-process with no HTTP round trip and never assumes a TCP listener on :3000.

/**
 * Build a same-origin internal rewrite URL for tenant routing.
 * @param {string} rawRequestUrl  request.url (the internal origin the server actually served)
 * @param {string} tenantDomain   allowlisted tenant domain, e.g. "orderweeddc.localhost"
 * @param {string} pathname       original request pathname (always begins with "/")
 * @param {string} [search]       original query string ("" or "?a=b")
 * @returns {URL}                 same-origin URL with the tenant segment prefixed
 */
export function buildTenantRewriteUrl(rawRequestUrl, tenantDomain, pathname, search = '') {
  if (!tenantDomain) throw new TypeError('tenantDomain required');
  const internal = new URL(rawRequestUrl); // origin the standalone server actually serves
  // Preserve the ORIGINAL prefixing behavior exactly: `/${tenant}${pathname}`.
  internal.pathname = `/${tenantDomain}${pathname || '/'}`;
  internal.search = search || '';
  return internal;
}

/**
 * True when a rewrite target would leave the internal origin (i.e. Next would PROXY it).
 * Used by tests and defensive assertions to guarantee we never self-proxy again.
 */
export function rewriteTargetIsSelfProxy(rewriteUrlLike, rawRequestUrl) {
  return new URL(rewriteUrlLike).origin !== new URL(rawRequestUrl).origin;
}
