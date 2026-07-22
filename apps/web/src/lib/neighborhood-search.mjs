import { publicRetailerWhere } from './public-retailer.mjs';

export const NEIGHBORHOOD_CANDIDATE_LIMIT = 200;
export const NEIGHBORHOOD_LATITUDE_WINDOW = 0.04;
export const NEIGHBORHOOD_LONGITUDE_WINDOW = 0.05;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ZIP_PATTERN = /^\d{5}$/;

function coordinate(value, label, minimum, maximum) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new TypeError(`${label} is invalid.`);
  }
  return value;
}

function validTime(asOf) {
  if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime())) {
    throw new TypeError('Neighborhood search time must be a valid date.');
  }
  return new Date(asOf);
}

export function neighborhoodCandidateWhere({
  brandId,
  latitude,
  longitude,
  zips,
  asOf = new Date(),
}) {
  const normalizedBrandId =
    typeof brandId === 'string' ? brandId.trim() : '';
  if (!IDENTIFIER_PATTERN.test(normalizedBrandId)) {
    throw new TypeError('Brand ID has an invalid format.');
  }
  const centerLatitude = coordinate(latitude, 'Latitude', -90, 90);
  const centerLongitude = coordinate(longitude, 'Longitude', -180, 180);
  if (
    !Array.isArray(zips) ||
    zips.length === 0 ||
    zips.length > 20 ||
    zips.some((zip) => typeof zip !== 'string' || !ZIP_PATTERN.test(zip))
  ) {
    throw new TypeError('Neighborhood ZIP codes are invalid.');
  }
  const timestamp = validTime(asOf);

  return {
    ...publicRetailerWhere(timestamp),
    menus: {
      some: {
        brandMenus: {
          some: {
            brandId: normalizedBrandId,
          },
        },
      },
    },
    AND: [
      {
        OR: [
          { zip: { in: [...new Set(zips)] } },
          {
            lat: {
              gte: centerLatitude - NEIGHBORHOOD_LATITUDE_WINDOW,
              lte: centerLatitude + NEIGHBORHOOD_LATITUDE_WINDOW,
            },
            lng: {
              gte: centerLongitude - NEIGHBORHOOD_LONGITUDE_WINDOW,
              lte: centerLongitude + NEIGHBORHOOD_LONGITUDE_WINDOW,
            },
          },
        ],
      },
    ],
  };
}
