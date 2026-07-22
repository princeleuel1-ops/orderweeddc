import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parseAllowedRequestHost } from '@/lib/host-policy.mjs';
import {
  isCanonicalPlatformHostname,
  tenantDomainForRequestHostname,
} from '@/lib/tenant-host.mjs';

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

  if (url.pathname.startsWith('/api') || url.pathname.includes('.')) {
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

  // 3. Fallback to dynamic brand routing
  // Rewrite request path to include the domain folder internally
  const tenantDomain = tenantDomainForRequestHostname(host);
  url.pathname = `/${tenantDomain}${url.pathname}`;
  
  return NextResponse.rewrite(url);
}

// Config to limit where the middleware runs
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|assets|favicon.ico).*)',
  ],
};
