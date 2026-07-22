function validTime(asOf) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) {
    throw new TypeError('Public retailer visibility time must be a valid date.');
  }
  return new Date(asOf);
}

/**
 * Public discovery is deliberately narrower than data-status labeling:
 * synthetic demonstration records are visible as demos, while a real record
 * must have completed evidence review at least once. New submissions stay in
 * the administrative queue until that boundary is crossed.
 */
export function publicRetailerWhere(asOf = new Date()) {
  const timestamp = validTime(asOf);
  return {
    OR: [
      { isDemonstration: true },
      {
        isDemonstration: false,
        verifiedAt: {
          not: null,
          lte: timestamp,
        },
      },
    ],
  };
}

export function isPubliclyDiscoverable(retailer, asOf = new Date()) {
  const timestamp = validTime(asOf);
  if (retailer?.isDemonstration === true) return true;
  if (!retailer?.verifiedAt) return false;
  const verifiedAt = new Date(retailer.verifiedAt);
  return (
    Number.isFinite(verifiedAt.getTime()) &&
    verifiedAt <= timestamp
  );
}
