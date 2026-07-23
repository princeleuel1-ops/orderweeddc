/**
 * Canonical neighborhood landing-page definitions shared by the
 * neighborhoods index, the per-neighborhood pages, and the sitemap.
 * Adding an entry here automatically publishes the page everywhere.
 */
export const NEIGHBORHOOD_CONFIGS = {
  georgetown: {
    name: 'Georgetown',
    lat: 38.9097,
    lng: -77.0654,
    zips: ['20007'],
    description:
      "D.C.'s historic waterfront neighborhood. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'Cobblestone streets, the C&O Canal, and M Street retail — Georgetown pairs history with a dense shopping corridor.',
  },
  'dupont-circle': {
    name: 'Dupont Circle',
    lat: 38.9097,
    lng: -77.0433,
    zips: ['20036', '20009'],
    description:
      "D.C.'s cultural hub. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      "Embassies, bookstores, and late-night energy around the circle — one of the district's busiest walkable hubs.",
  },
  'capitol-hill': {
    name: 'Capitol Hill',
    lat: 38.8899,
    lng: -77.009,
    zips: ['20002', '20003'],
    description:
      "D.C.'s political heart. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'Row houses, Eastern Market, and Barracks Row — the Hill blends neighborhood calm with national landmarks.',
  },
  'u-street-shaw': {
    name: 'U Street and Shaw',
    lat: 38.9169,
    lng: -77.0322,
    zips: ['20001', '20009'],
    description:
      "D.C.'s historic entertainment corridor. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'The historic Black Broadway corridor — music venues, murals, and a fast-growing food scene.',
  },
  'navy-yard-wharf': {
    name: 'Navy Yard and Wharf',
    lat: 38.8766,
    lng: -76.9902,
    zips: ['20003', '20024'],
    description:
      "D.C.'s waterfront district. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      "Ballpark blocks and waterfront piers — the district's newest high-density riverfront neighborhoods.",
  },
  'adams-morgan': {
    name: 'Adams Morgan',
    lat: 38.9210,
    lng: -77.0420,
    zips: ['20009'],
    description:
      "D.C.'s international nightlife and arts district. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'Diverse restaurants, the 18th Street strip, and proximity to the Woodley Park and Columbia Heights Metro stops make Adams Morgan a central hub for nightlife and culture.',
  },
  'columbia-heights': {
    name: 'Columbia Heights',
    lat: 38.9285,
    lng: -77.0295,
    zips: ['20010', '20009'],
    description:
      "D.C.'s Latino cultural corridor. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      "The Columbia Heights Metro anchors a dense, multicultural commercial strip along 14th Street with murals, markets, and some of D.C.'s most vibrant street life.",
  },
  'h-street-noma': {
    name: 'H Street and NoMa',
    lat: 38.9007,
    lng: -76.9950,
    zips: ['20002'],
    description:
      "D.C.'s emerging arts and transit corridor. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      "The H Street streetcar line runs through a corridor of independent venues and galleries, while NoMa's Union Station adjacency drives rapid mixed-use development.",
  },
  'chinatown-penn-quarter': {
    name: 'Chinatown and Penn Quarter',
    lat: 38.8990,
    lng: -77.0210,
    zips: ['20001'],
    description:
      "D.C.'s downtown entertainment and civic core. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'Gallery Place and the Capital One Arena anchor a dense block of galleries, restaurants, and federal landmarks, with the Gallery Place-Chinatown Metro a block away.',
  },
  'southwest-waterfront': {
    name: 'Southwest Waterfront',
    lat: 38.8790,
    lng: -77.0170,
    zips: ['20024'],
    description:
      "D.C.'s redeveloped waterfront district. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'The Wharf development along the Potomac waterfront brings seafood, live music at the Anthem, and water-taxi access to a historically underserved quadrant of the city.',
  },
  'woodley-park': {
    name: 'Woodley Park and Cleveland Park',
    lat: 38.9330,
    lng: -77.0570,
    zips: ['20008'],
    description:
      "D.C.'s upper Connecticut Avenue residential corridor. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      "Two Red Line Metro stops connect quiet, tree-lined streets near the National Zoo, with Connecticut Avenue's independent restaurants and the historic Uptown Theater.",
  },
  'petworth-brightwood': {
    name: 'Petworth and Brightwood',
    lat: 38.9420,
    lng: -77.0230,
    zips: ['20011'],
    description:
      "D.C.'s northwest residential growth corridor. The local demo uses this center point to exercise geographic filtering.",
    blurb:
      'The Georgia Avenue corridor and the Petworth Metro stop anchor a fast-growing neighborhood of rowhomes, murals, and independently owned restaurants and coffee shops.',
  },
};

export const NEIGHBORHOOD_SLUGS = Object.freeze(
  Object.keys(NEIGHBORHOOD_CONFIGS),
);
