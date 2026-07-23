/**
 * Strain-type landing page content. Deliberately factual and hedged: these
 * pages describe common industry categorizations without making medical or
 * effect guarantees. Individual responses vary; nothing here is medical
 * advice — and the copy says so.
 */
export const STRAIN_TYPES = {
  sativa: {
    name: 'Sativa',
    headline: 'Sativa cannabis in Washington, D.C.',
    summary:
      'Sativa is an industry label historically applied to taller, narrow-leaf cannabis varieties. Products labeled sativa are commonly marketed toward daytime use, though modern research shows labels alone do not reliably predict effects — cannabinoid and terpene content matter more.',
    facts: [
      'The sativa/indica distinction began as a botanical description of plant shape, not an effect guarantee.',
      'Effect differences depend primarily on THC/CBD ratios and terpene profiles, which vary product to product.',
      'Lab-tested cannabinoid percentages on the product record are more informative than the category label.',
    ],
    faq: [
      {
        question: 'What does "sativa" actually mean on a menu?',
        answer:
          'On most menus it is a marketing and inventory category inherited from plant botany. It does not guarantee a specific effect; check the tested THC/CBD numbers and terpene information on each product record.',
      },
      {
        question: 'Are sativa products stronger than indica?',
        answer:
          'No — potency is determined by tested cannabinoid content, not the category label. A sativa and an indica with the same THC percentage are comparably potent.',
      },
    ],
  },
  indica: {
    name: 'Indica',
    headline: 'Indica cannabis in Washington, D.C.',
    summary:
      'Indica is an industry label historically applied to shorter, broad-leaf cannabis varieties. Products labeled indica are commonly marketed toward evening use, though effect labels are not guarantees — tested cannabinoid and terpene content is a better guide.',
    facts: [
      'The indica label began as plant taxonomy, not a clinical effect category.',
      'Two indica-labeled products can differ substantially in tested THC, CBD, and terpene content.',
      'Check each record’s evidence label and tested percentages rather than relying on the category.',
    ],
    faq: [
      {
        question: 'Will an indica product always feel relaxing?',
        answer:
          'Not necessarily. Individual responses vary with dose, tolerance, and product chemistry. The label reflects a marketing category, not a guaranteed effect.',
      },
      {
        question: 'How should I compare indica products?',
        answer:
          'Compare tested THC/CBD percentages, product format, and the record’s verification label. This platform shows the data status and source for every menu entry.',
      },
    ],
  },
  hybrid: {
    name: 'Hybrid',
    headline: 'Hybrid cannabis in Washington, D.C.',
    summary:
      'Most modern cannabis is genetically hybrid. The hybrid label signals a mix of parent lineages; menus often sub-label products as sativa- or indica-leaning, which remains a marketing shorthand rather than a measured effect.',
    facts: [
      'Decades of crossbreeding mean nearly all commercial cannabis is technically hybrid.',
      'The "leaning" sub-labels are inherited from parent strains, not from effect testing.',
      'Tested cannabinoid and terpene data on each record is the reliable comparison basis.',
    ],
    faq: [
      {
        question: 'Is a hybrid a 50/50 mix?',
        answer:
          'Rarely. Hybrid describes mixed lineage in any proportion. The only reliable comparison basis is the tested chemistry shown on the product record.',
      },
    ],
  },
  cbd: {
    name: 'CBD',
    headline: 'CBD-dominant cannabis in Washington, D.C.',
    summary:
      'CBD-dominant products contain more cannabidiol than THC. CBD is non-intoxicating at typical doses, but products may still contain THC — check the tested percentages on each record. Nothing on this page is medical advice.',
    facts: [
      'CBD-dominant does not automatically mean THC-free; tested percentages are shown per record.',
      'D.C. purchase rules apply to CBD products sold through licensed cannabis retailers.',
      'Talk to a qualified clinician before using any cannabis product for a health purpose.',
    ],
    faq: [
      {
        question: 'Will CBD products get me high?',
        answer:
          'CBD is non-intoxicating at typical doses, but many CBD-labeled products contain some THC. Check the tested THC percentage on the specific product record.',
      },
      {
        question: 'Is CBD legal in D.C.?',
        answer:
          'CBD products are sold both through licensed cannabis retailers (regulated under D.C. cannabis rules) and as hemp-derived retail products. Rules differ by channel and change over time — verify with official D.C. sources.',
      },
    ],
  },
};

export const STRAIN_SLUGS = Object.freeze(Object.keys(STRAIN_TYPES));
