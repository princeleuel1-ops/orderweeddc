import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Patient Help Desk & D.C. Cannabis FAQ | Order Weed DC',
  description:
    'Answers to common questions about Washington D.C. medical cannabis laws, ABCA reciprocity, patient registration, and evidence verification.',
  alternates: {
    canonical: '/help',
  },
};

const FAQS = [
  {
    question: 'How do I purchase medical cannabis in Washington, D.C.?',
    answer:
      'Washington D.C. permits both resident and non-resident patients (age 21+) to register for a temporary or permanent ABCA medical cannabis card online or in-person at licensed dispensaries.',
  },
  {
    question: 'Does D.C. accept out-of-state medical cannabis cards (Reciprocity)?',
    answer:
      'Yes! D.C. ABCA recognizes valid medical cannabis registrations from over 30 states and U.S. territories. Out-of-state patients can purchase directly from licensed D.C. dispensaries.',
  },
  {
    question: 'What is the legal possession limit for medical cannabis in D.C.?',
    answer:
      'Registered patients are allowed to purchase up to 8 ounces of medical cannabis (or equivalent concentrate/edible limit) per rolling 30-day window.',
  },
  {
    question: 'How does Order Weed DC verify dispensary listings?',
    answer:
      'Every active retailer profile is audited against official D.C. ABCA license records, physical storefront addresses, and public evidence URLs before receiving a Verified Current status label.',
  },
  {
    question: 'What is the difference between Storefront and Delivery retailers?',
    answer:
      'Storefront dispensaries operate physical retail locations for in-person shopping, while licensed delivery services deliver medical products directly to eligible D.C. residential addresses.',
  },
];

export default async function HelpPage() {
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 animate-fade-in space-y-8 flex-grow">
      {/* Header */}
      <div className="border-b border-brand-border pb-6 space-y-3">
        <Link href="/" className="text-xs font-bold text-slate-500 hover:text-brand-text transition-colors">
          ← Back to directory
        </Link>
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-black bg-brand-surface border border-brand-border px-3 py-1 rounded-full">
            💡 Patient Guidance & FAQ
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-text tracking-tight mt-2">
            Washington D.C. Medical Cannabis Help Desk
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mt-1">
            Everything you need to know about D.C. ABCA medical cannabis regulations, patient registration, and verified dispensary listings.
          </p>
        </div>
      </div>

      {/* FAQ Accordion Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FAQS.map((faq, index) => (
          <div
            key={index}
            className="border border-brand-border bg-brand-surface rounded-xl p-6 space-y-3 hover:border-black/30 transition-all shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-black text-white font-black text-xs flex items-center justify-center shrink-0">
                ?
              </span>
              <h3 className="text-base font-extrabold text-brand-text leading-snug">{faq.question}</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed pl-9">{faq.answer}</p>
          </div>
        ))}
      </div>

      {/* Contact & Support Section */}
      <div className="border border-brand-border bg-brand-surface rounded-xl p-8 text-center space-y-4 max-w-2xl mx-auto">
        <h2 className="text-lg font-bold text-brand-text">Have a question or correction request?</h2>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          Our compliance ledger ensures all business listings and primary sources remain accurate and up-to-date.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/business/claim"
            className="bg-black text-white font-bold text-xs px-5 py-2.5 rounded-md hover:bg-slate-800 transition-colors"
          >
            Claim Your Business →
          </Link>
          <Link
            href="/"
            className="border border-brand-border text-brand-text font-bold text-xs px-5 py-2.5 rounded-md hover:bg-brand-background transition-colors"
          >
            Browse Dispensaries
          </Link>
        </div>
      </div>
    </div>
  );
}
