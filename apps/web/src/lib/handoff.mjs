import { isPubliclyVerified } from './data-status.mjs';
import { tenantRetailerWhere } from './tenant-retailer.mjs';

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

export class HandoffError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'HandoffError';
    this.code = code;
  }
}

function isPrivateOrLocalHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    !normalized.includes('.') ||
    normalized.includes(':')
  ) {
    return true;
  }

  const octets = normalized.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

export function safePublicWebsiteUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length < 12 ||
    value.length > 2048 ||
    CONTROL_CHARACTER.test(value)
  ) {
    return null;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    isPrivateOrLocalHostname(parsed.hostname)
  ) {
    return null;
  }

  return parsed.toString();
}

export function safePublicReferenceUrl(value) {
  const destination = safePublicWebsiteUrl(value);
  if (!destination) return null;
  const parsed = new URL(destination);
  if (parsed.search || parsed.hash) return null;
  return parsed.toString();
}

export async function recordVerifiedHandoff(
  db,
  { brandId, retailerId, asOf = new Date() },
) {
  return db.$transaction(async (transaction) => {
    const retailer = await transaction.retailer.findFirst({
      where: tenantRetailerWhere(brandId, retailerId, asOf),
      select: {
        id: true,
        website: true,
        dataStatus: true,
        isDemonstration: true,
        verifiedAt: true,
        freshnessExpiresAt: true,
      },
    });

    if (!retailer || !isPubliclyVerified(retailer, asOf)) {
      throw new HandoffError(
        'Retailer handoff is unavailable for this record.',
        'HANDOFF_NOT_CURRENT',
      );
    }

    const destination = safePublicWebsiteUrl(retailer.website);
    if (!destination) {
      throw new HandoffError(
        'Retailer handoff destination is unavailable.',
        'HANDOFF_DESTINATION_UNAVAILABLE',
      );
    }

    const event = await transaction.leadEvent.create({
      data: {
        brandId,
        retailerId,
        eventType: 'HANDOFF_CLICK',
      },
    });

    return {
      destination,
      eventId: event.id,
    };
  });
}
