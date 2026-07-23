/**
 * Canonical D.C. cannabis legal FAQ entries.
 * Exported as a plain data module so both the legal page (TSX) and the
 * SiteMind audit (sitemind.mjs) can import and count them without crossing
 * the TSX/ESM boundary.
 *
 * Every answer is hedged and points to ABCA when law-dependent.
 */

export const LEGAL_FAQ_ENTRIES = [
  {
    question: 'How old do I need to be to buy cannabis in Washington, D.C.?',
    answer:
      'You must be 21 or older, or a registered medical cannabis patient. Licensed dispensaries check government-issued ID. This site is for adults 21+ only.',
  },
  {
    question: 'Is recreational cannabis legal in D.C.?',
    answer:
      'D.C. law (Initiative 71) allows adults 21+ to possess up to two ounces and to grow limited plants at home, but street sales remain prohibited. Purchases run through the D.C. medical cannabis program, which allows adults 21+ to self-certify at licensed dispensaries. Rules change — always confirm with D.C. ABCA before acting.',
  },
  {
    question: 'Where is cannabis consumption prohibited in D.C.?',
    answer:
      'Public consumption is illegal, and cannabis remains prohibited on federal land — which covers a significant portion of the District, including parks and memorials. Never drive impaired.',
  },
  {
    question: 'Does this site sell or deliver cannabis?',
    answer:
      'No. This platform is an evidence-labeled directory. It links to licensed retailers and never fulfills, delivers, or sells controlled substances directly.',
  },
  {
    question: 'How does this site verify retailer information?',
    answer:
      'Every public record carries an explicit data-status label (for example Verified Current, Awaiting Verification, or Demonstration Only), a named source, and a freshness window. Records that fail the evidence boundary are excluded from search-engine data feeds.',
  },
  {
    question:
      'Are "gifting shops" that operate under Initiative 71 legal in D.C.?',
    answer:
      'Gifting shops operate in a gray area: I-71 permits transfers of cannabis between adults without payment, but ABCA has enforcement authority and has closed unlicensed shops that effectively conduct sales under a "gift" pretext. For certainty and consumer protections, buy from an ABCA-licensed dispensary. Confirm current enforcement posture at abca.dc.gov.',
  },
  {
    question: 'Can visitors or tourists buy cannabis in D.C.?',
    answer:
      'Generally yes — the 21+ self-certification process at ABCA-licensed dispensaries is not restricted to D.C. residents, so visitors 21+ can typically purchase. Bring a government-issued photo ID. Rules and license types can change; verify current eligibility with the dispensary or at abca.dc.gov before visiting.',
  },
  {
    question: 'How much cannabis can I legally possess in D.C.?',
    answer:
      'Initiative 71 allows adults 21+ to possess up to two ounces of cannabis. Possessing more may subject you to civil or criminal penalties. Confirm current possession limits with ABCA or a qualified attorney, as rules can change.',
  },
  {
    question: 'How many cannabis plants can I grow at home?',
    answer:
      'Initiative 71 allows limited home cultivation at a primary residence. Check the current plant count limits directly with ABCA (abca.dc.gov), as the allowable number is subject to change and must be verified before growing.',
  },
  {
    question: 'Is cannabis delivery legal in D.C.?',
    answer:
      "ABCA-licensed dispensaries may offer delivery services under their license type. Not all licensees offer delivery, and delivery service areas vary. Check each retailer's record label on this platform and confirm directly with the retailer. Confirm current delivery rules at abca.dc.gov.",
  },
  {
    question: 'Can I buy cannabis edibles at a D.C. dispensary?',
    answer:
      'Edibles and infused products are sold through the licensed D.C. cannabis program at ABCA-licensed dispensaries. Keep all products in their original packaging, clearly labeled, and away from children and pets. Product availability varies by retailer.',
  },
  {
    question: 'Can I consume cannabis in a hotel or Airbnb in D.C.?',
    answer:
      'Private property rules apply: the property owner or host sets the rules. Most hotels and short-term rentals prohibit cannabis consumption, and some lease terms may also restrict it. Consumption on federal property — including many D.C. parks, memorials, and some street corridors — is never permitted. When in doubt, ask your host and never consume in public or on federal land.',
  },
  {
    question: 'What ID do I need to buy cannabis at a D.C. dispensary?',
    answer:
      "You need a valid, government-issued photo ID that proves you are 21 or older — a driver's license, state ID, passport, or military ID are commonly accepted. Expired IDs are generally not accepted. Individual dispensaries set their own ID policies; confirm with the retailer in advance.",
  },
];

export const LEGAL_FAQ_COUNT = LEGAL_FAQ_ENTRIES.length;
