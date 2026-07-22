import 'server-only';
import { headers } from 'next/headers';
import { parseAllowedRequestHost } from '@/lib/host-policy.mjs';
import {
  CANONICAL_PUBLIC_HOSTNAME,
  canonicalOriginForRequestHost,
  originForRequestHost,
} from '@/lib/tenant-host.mjs';

const FALLBACK_ORIGIN = new URL(`https://${CANONICAL_PUBLIC_HOSTNAME}`);

async function allowedRequestHost() {
  const requestHeaders = await headers();
  return parseAllowedRequestHost(requestHeaders.get('host'));
}

export async function requestOrigin() {
  const requestHost = await allowedRequestHost();
  return requestHost
    ? originForRequestHost(requestHost)
    : new URL(FALLBACK_ORIGIN);
}

export async function canonicalPlatformUrl(pathname = '/') {
  const requestHost = await allowedRequestHost();
  const origin = requestHost
    ? canonicalOriginForRequestHost(requestHost)
    : FALLBACK_ORIGIN;
  return new URL(pathname, origin).toString();
}
