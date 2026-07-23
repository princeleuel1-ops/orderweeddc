/**
 * Loud, honest freshness labels — the pattern adopted from Leafly's
 * "Updated 2 minutes ago" menu timestamps (their single best trust-UX
 * signal, field recon 2026-07-23), adapted to our verification system.
 *
 * The label speaks ONLY from recorded evidence: verifiedAt and
 * freshnessExpiresAt. No verifiedAt -> null (render nothing rather than
 * imply freshness that was never established). Deterministic given asOf.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function wholeDaysBetween(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

/**
 * @param {{ verifiedAt?: Date|null, freshnessExpiresAt?: Date|null, asOf?: Date }} input
 * @returns {string|null} e.g. "Verified today · fresh for 29 more days",
 *   "Verified 3 days ago", "Verified 45 days ago · freshness expired" — or
 *   null when no verification has ever been recorded.
 */
export function relativeFreshnessLabel({ verifiedAt, freshnessExpiresAt, asOf = new Date() }) {
  if (!verifiedAt || !(verifiedAt instanceof Date) || Number.isNaN(verifiedAt.getTime())) {
    return null;
  }
  const daysAgo = wholeDaysBetween(verifiedAt, asOf);
  if (daysAgo < 0) return null; // future timestamps are never displayed

  let verifiedPart;
  if (daysAgo === 0) verifiedPart = 'Verified today';
  else if (daysAgo === 1) verifiedPart = 'Verified yesterday';
  else verifiedPart = `Verified ${daysAgo} days ago`;

  if (
    freshnessExpiresAt instanceof Date &&
    !Number.isNaN(freshnessExpiresAt.getTime())
  ) {
    const daysLeft = wholeDaysBetween(asOf, freshnessExpiresAt);
    if (daysLeft < 0) return `${verifiedPart} · freshness expired`;
    if (daysLeft === 0) return `${verifiedPart} · freshness expires today`;
    return `${verifiedPart} · fresh for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}`;
  }
  return verifiedPart;
}
