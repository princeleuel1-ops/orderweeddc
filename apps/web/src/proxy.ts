import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  isLoopbackHostname,
  isStaticAssetPath,
  parseAllowedRequestHost,
  parseRequestAuthority,
} from '@/lib/host-policy.mjs';
import {
  isCanonicalPlatformHostname,
  tenantDomainForRequestHostname,
} from '@/lib/tenant-host.mjs';
import { buildTenantRewriteUrl } from '@/lib/tenant-rewrite.mjs';

const REDIRECT_MAP: Record<string, string> = {
  'dmvweeddelivery.com': '/?type=delivery',
  'dmvweeddelivery.localhost': '/?type=delivery',

  'weedneardc.com': '/',
  'weedneardc.localhost': '/',

  'georgetowndispensarydc.com': '/neighborhoods/georgetown',
  'georgetowndispensarydc.localhost': '/neighborhoods/georgetown',

  'dupontcircledispensarydc.com': '/neighborhoods/dupont-circle',
  'dupontcircledispensarydc.localhost': '/neighborhoods/dupont-circle',

  'capitolhilldispensarydc.com': '/neighborhoods/capitol-hill',
  'capitolhilldispensarydc.localhost': '/neighborhoods/capitol-hill',

  'ustreetdispensarydc.com': '/neighborhoods/u-street-shaw',
  'ustreetdispensarydc.localhost': '/neighborhoods/u-street-shaw',

  'navyyarddispensarydc.com': '/neighborhoods/navy-yard-wharf',
  'navyyarddispensarydc.localhost': '/neighborhoods/navy-yard-wharf',
};

const NON_INDEXABLE_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function closedHostResponse(title: string, message: string) {
  return new NextResponse(
    `<!doctype html>
     <html lang="en">
       <head>
         <meta charset="utf-8">
         <meta name="robots" content="noindex, nofollow, noarchive">
         <meta name="viewport" content="width=device-width, initial-scale=1">
         <title>${title}</title>
       </head>
       <body style="font-family:sans-serif;background:#0B0F12;color:#E2E8F0;text-align:center;padding:10%">
         <main><h1>${title}</h1><p>${message}</p></main>
       </body>
     </html>`,
    {
      status: 403,
      headers: {
        ...NON_INDEXABLE_RESPONSE_HEADERS,
        'Content-Type': 'text/html; charset=utf-8',
      },
    },
  );
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostnameHeader = request.headers.get('host');

  // Standalone re-entry pass-through: the Node standalone server resolves
  // a middleware rewrite by re-dispatching it internally over loopback,
  // so pass two arrives with Host localhost:<port> and a path that
  // already carries the tenant prefix produced by pass one. Let exactly
  // that shape through untouched. External traffic can never legitimately
  // present a loopback Host (the front proxy routes by public vhost), and
  // the tenant prefix must itself be an allowlisted hostname, so this
  // cannot be used to reach a tenant that pass one would have refused.
  const rawAuthority = parseRequestAuthority(hostnameHeader);
  if (rawAuthority && isLoopbackHostname(rawAuthority.hostname)) {
    const tenantPrefix = url.pathname.split('/')[1] ?? '';
    if (tenantPrefix && parseAllowedRequestHost(tenantPrefix)) {
      return NextResponse.next();
    }
  }

  const requestHost = parseAllowedRequestHost(hostnameHeader);
  if (!requestHost) {
    return new NextResponse('The requested host is not configured.', {
      status: 421,
      headers: {
        ...NON_INDEXABLE_RESPONSE_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
  const { hostname: host, port } = requestHost;

  // Canonical-host consolidation: www permanently redirects to the apex,
  // preserving path and query, so exactly one public origin exists.
  if (host === 'www.orderweeddc.com') {
    const canonicalUrl = new URL(url.pathname + url.search, 'https://orderweeddc.com');
    return NextResponse.redirect(canonicalUrl, 308);
  }

  // Exclude internal Next.js files and public assets from tenant routing.
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/assets') ||
    url.pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 1. Gated & Parked domains handling
  if (host === 'districtweed.com' || host === 'districtweed.localhost') {
    return closedHostResponse(
      'Access Gated',
      'districtweed.com is parked pending brand clearance.',
    );
  }

  if (host === 'weeddmv.com' || host === 'weeddmv.localhost') {
    return closedHostResponse(
      'Access Isolated',
      'weeddmv.com is isolated pending infrastructure and reputation clearance.',
    );
  }

  // Passthrough API routes and genuine static assets only. A path is a
  // static asset only when its final segment ends in a known file
  // extension — NOT merely because it contains a dot. This prevents a
  // hostname-shaped path (e.g. "/wellness.localhost") from bypassing
  // tenant routing and addressing the [domain] route directly.
  if (url.pathname.startsWith('/api') || isStaticAssetPath(url.pathname)) {
    return NextResponse.next();
  }

  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/business')
  ) {
    if (!isCanonicalPlatformHostname(host)) {
      return new NextResponse(
        'The requested administrative surface is not configured for this host.',
        {
          status: 421,
          headers: {
            ...NON_INDEXABLE_RESPONSE_HEADERS,
            'Content-Type': 'text/plain; charset=utf-8',
          },
        },
      );
    }
    return NextResponse.next();
  }

  // 2. Perform redirect if mapped
  const redirectPath = REDIRECT_MAP[host];
  if (redirectPath) {
    const isLocal = host.endsWith('.localhost') || host === 'localhost';
    const targetBase = isLocal
      ? `http://orderweeddc.localhost${port ? `:${port}` : ''}`
      : 'https://orderweeddc.com';
    const targetUrl = `${targetBase}${redirectPath}`;
    return NextResponse.redirect(new URL(targetUrl));
  }

  // 3. Fallback to dynamic brand routing.
  //
  // NextRequest exposes request.url and request.nextUrl from the same parsed URL.
  // Under Passenger that URL was https://localhost:3000 even though Passenger
  // launched this standalone server on a different dynamic loopback port. Merely
  // switching from request.nextUrl to request.url therefore cannot fix the 500.
  //
  // Build the production rewrite from Passenger's runtime PORT and a validated
  // loopback hostname. The existing loopback re-entry guard above then lets the
  // tenant-prefixed second pass reach the [domain] route without recursion.
  const tenantDomain = tenantDomainForRequestHostname(host);

  let rewriteUrl: URL;
  try {
    rewriteUrl = buildTenantRewriteUrl({
      tenantDomain,
      pathname: url.pathname,
      search: url.search,
      runtimePort: process.env.PORT,
      runtimeHostname: process.env.HOSTNAME,
      rawRequestUrl: request.url,
      production: process.env.NODE_ENV === 'production',
    });
  } catch (error) {
    console.error(
      'Tenant rewrite configuration error:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return new NextResponse('The application is temporarily unavailable.', {
      status: 503,
      headers: {
        ...NON_INDEXABLE_RESPONSE_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return NextResponse.rewrite(rewriteUrl);
}

// Config to limit where the middleware runs
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|assets|favicon.ico).*)',
  ],
};
