const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const AUTHORITY_PATTERN = /^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/;

const PLATFORM_HOSTNAMES = Object.freeze([
  'orderweeddc.com',
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
