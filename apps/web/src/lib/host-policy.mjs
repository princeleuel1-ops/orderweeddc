const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const AUTHORITY_PATTERN = /^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/;

const PLATFORM_HOSTNAMES = Object.freeze([
  'orderweeddc.com',
  'www.orderweeddc.com',
  'orderweeddc.localhost',
  'deals.localhost',
  'luxury.localhost',
  'value.localhost',
  'flower.localhost',
  'edibles.localhost',
  'wellness.localhost',
  'accessories.localhost',
  'events.localhost',
  'biz.localhost',
  'dmvweeddelivery.com',
  'dmvweeddelivery.localhost',
  'weedneardc.com',
  'weedneardc.localhost',
  'georgetowndispensarydc.com',
  'georgetowndispensarydc.localhost',
  'dupontcircledispensarydc.com',
  'dupontcircledispensarydc.localhost',
  'capitolhilldispensarydc.com',
  'capitolhilldispensarydc.localhost',
  'ustreetdispensarydc.com',
  'ustreetdispensarydc.localhost',
  'navyyarddispensarydc.com',
  'navyyarddispensarydc.localhost',
  'districtweed.com',
  'districtweed.localhost',
  'weeddmv.com',
  'weeddmv.localhost',
]);

function additionalHostnames(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((hostname) => hostname.trim().toLowerCase())
    .filter((hostname) => HOSTNAME_PATTERN.test(hostname));
}

export function parseAllowedRequestHost(
  authority,
  configuredHostnames = process.env.CANA_ALLOWED_HOSTS,
) {
  if (
    typeof authority !== 'string' ||
    !AUTHORITY_PATTERN.test(authority) ||
    authority.length > 260
  ) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(`http://${authority}`);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port;
  if (
    !HOSTNAME_PATTERN.test(hostname) ||
    (port && (Number(port) < 1 || Number(port) > 65_535))
  ) {
    return null;
  }

  const allowed = new Set([
    ...PLATFORM_HOSTNAMES,
    ...additionalHostnames(configuredHostnames),
  ]);
  if (!allowed.has(hostname)) return null;

  return {
    hostname,
    port,
    authority: port ? `${hostname}:${port}` : hostname,
  };
}

/**
 * Loopback hostnames only ever reach the application from the standalone
 * server's own internal re-dispatch of a middleware rewrite (pass one
 * rewrites /path to /<tenant-domain>/path; the Node standalone runtime
 * re-enters the proxy over loopback to resolve it). External traffic is
 * routed by public vhost and cannot arrive with a loopback Host.
 */
export function isLoopbackHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Parse an authority without consulting the allowlist (loopback triage). */
export function parseRequestAuthority(authority) {
  if (
    typeof authority !== 'string' ||
    !AUTHORITY_PATTERN.test(authority) ||
    authority.length > 260
  ) {
    return null;
  }
  try {
    const parsed = new URL(`http://${authority}`);
    return { hostname: parsed.hostname.toLowerCase(), port: parsed.port };
  } catch {
    return null;
  }
}

/**
 * Root-level static files and file-like routes (sitemap.xml, robots.txt,
 * llms.txt, og-default.jpg, icon-*.png, fonts/*.woff2, manifest.webmanifest)
 * must bypass tenant routing. A bare hostname-shaped path such as
 * "/wellness.localhost" also contains a dot but is NOT a static asset — it
 * must be tenant-routed (and 404) rather than reaching the [domain] route
 * directly. So we passthrough only KNOWN asset/file extensions, never any
 * path that merely contains a dot.
 */
const STATIC_ASSET_EXTENSIONS = new Set([
  'ico', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg',
  'css', 'js', 'map', 'json', 'txt', 'xml', 'webmanifest',
  'woff', 'woff2', 'ttf', 'otf', 'eot', 'pdf', 'mp4', 'webm',
]);

export function isStaticAssetPath(pathname) {
  if (typeof pathname !== 'string') return false;
  const lastSegment = pathname.slice(pathname.lastIndexOf('/') + 1);
  const dot = lastSegment.lastIndexOf('.');
  if (dot <= 0) return false;
  return STATIC_ASSET_EXTENSIONS.has(lastSegment.slice(dot + 1).toLowerCase());
}
