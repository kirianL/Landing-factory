export interface NavItem {
  label: string;
  href: string;
  subItems?: { label: string; href: string }[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Services',
    href: '#topics',
    subItems: [
      { label: 'Asset Protection', href: '#topics' },
      { label: 'Family Protection', href: '#topics' },
      { label: 'Asset Transfer', href: '#topics' },
      { label: 'UAE & Cross-Border', href: '#topics' },
    ],
  },
  {
    label: 'Key Topics',
    href: '#topics',
    subItems: [
      { label: 'Trusts & Foundations', href: '#topics' },
      { label: 'Tax Issues', href: '#topics' },
      { label: 'Currency Regulation', href: '#topics' },
      { label: 'Investments via CFC', href: '#topics' },
    ],
  },
  {
    label: 'About Us',
    href: '#about',
    subItems: [
      { label: 'Our History (Est. 1995)', href: '#about' },
      { label: 'Global Partners', href: '#partners' },
      { label: 'Latest News', href: '#news' },
    ],
  },
  {
    label: 'Contacts',
    href: '#contact',
  },
];

export const KEY_TOPICS = [
  {
    id: 'foreign-assets',
    title: 'Foreign Assets',
    description:
      'Account opening, structuring and protection of assets in foreign jurisdictions. Current developments and practical solutions.',
    image: '/images/topic-foreign.jpg',
  },
  {
    id: 'currency-regulation',
    title: 'Currency Regulation',
    description:
      'Foreign exchange control, reporting requirements for overseas accounts and transactions. How to navigate restrictions.',
    image: '/images/topic-currency.jpg',
  },
  {
    id: 'inheritance',
    title: 'Inheritance',
    description:
      'Asset succession planning, inheritance structures, and cross-border protection of family wealth and interests.',
    image: '/images/topic-inheritance.jpg',
  },
  {
    id: 'investments-cfc',
    title: 'Investments via CFC',
    description:
      'Controlled foreign companies: taxation, statutory reporting, structuring and international compliance risk mitigation.',
    image: '/images/topic-cfc.jpg',
  },
  {
    id: 'family-foundations',
    title: 'Trusts & Foundations',
    description:
      'Private foundations, fiduciary governance, and multi-generational capital preservation frameworks.',
    image: '/images/topic-foreign.jpg',
  },
];

export const VIDEOS = [
  {
    id: 'v1',
    title: 'Wealth Tax & CFC Reporting',
    description: 'Why this tax does not exist, what takes its place, and how CFC compliance actually works in practice.',
    duration: '08:42',
    thumbnail: '/images/topic-cfc.jpg',
  },
  {
    id: 'v2',
    title: 'Who are unworthy heirs?',
    description: 'Let us examine who is legally recognized as an unworthy heir, how courts rule, and how to protect succession.',
    duration: '11:15',
    thumbnail: '/images/topic-inheritance.jpg',
  },
  {
    id: 'v3',
    title: 'Cross-border payment compliance',
    description: 'Practical risk management for international settlements, correspondent banks, and CRS 2.0 checks.',
    duration: '09:30',
    thumbnail: '/images/topic-currency.jpg',
  },
];

export const FAQ_CARDS = [
  {
    id: 'faq-1',
    variant: 'light' as const,
    question: "Does the payment agent's fee depend on the destination country or currency?",
    answer:
      'Does the agent fee vary depending on the country receiving the funds and the transaction currency? We break down market benchmarks.',
  },
  {
    id: 'faq-2',
    variant: 'dark' as const,
    question: 'Market rate for a payment agent working with China',
    answer:
      'What percentage fee for a payment agent do you consider market rate for payments to China? State-owned company, volume up to $1M per month.',
  },
];

export interface PartnerPin {
  id: string;
  country: string;
  lat: number;
  lon: number;
  partners: string[];
}

export const PARTNER_PINS: PartnerPin[] = [
  {
    id: 'russia',
    country: 'Russia',
    lat: 55.7558,
    lon: 37.6173,
    partners: ['MTS Bank', 'Sberbank Private Banking', 'Alfa-Bank', 'MKB Private Bank', 'Absolut Bank'],
  },
  {
    id: 'switzerland',
    country: 'Switzerland',
    lat: 46.948,
    lon: 7.4474,
    partners: ['Julius Baer Advisory', 'Lombard Odier Desk', 'Zurich Fiduciary Partners'],
  },
  {
    id: 'cyprus',
    country: 'Cyprus',
    lat: 35.1856,
    lon: 33.3823,
    partners: ['Limassol Corporate Trust', 'Mediterranean Audit Group'],
  },
  {
    id: 'uae',
    country: 'UAE',
    lat: 25.2048,
    lon: 55.2708,
    partners: ['DIFC Wealth Counsel', 'Emirates Private Desk', 'ADGM Structuring'],
  },
  {
    id: 'china',
    country: 'China',
    lat: 31.2304,
    lon: 121.4737,
    partners: ['Shanghai Cross-Border Desk', 'Hong Kong Fiduciary Alliance'],
  },
  {
    id: 'singapore',
    country: 'Singapore',
    lat: 1.3521,
    lon: 103.8198,
    partners: ['MAS Licensed Family Office Desk', 'Straits Legal Partners'],
  },
];

export const LATEST_NEWS = [
  {
    id: 'uae-banking',
    date: '11.06.2026',
    title: 'UAE Banking Risks: Common Mistakes by Private Clients',
    excerpt:
      'The UAE is rolling out CRS 2.0. Banks are tightening compliance checks on clients, their funds and transactions. Compliance is no longer a one-off procedure.',
    image: '/images/about-office.jpg',
  },
  {
    id: 'payment-agents',
    date: '09.06.2026',
    title: 'Payment Agents: Why Businesses Need Them in 2026',
    excerpt:
      'Under sanctions and cross-border restrictions, payment agents have become a key tool for reliable and transparent international transactions.',
    image: '/images/topic-currency.jpg',
  },
  {
    id: 'prenuptial',
    date: '04.06.2026',
    title: 'Prenuptial Agreements: Why Planning Ahead Makes Sense',
    excerpt:
      'A prenuptial agreement lets couples decide in advance who keeps what. We explain how it works and why it is better to think about it before, not after.',
    image: '/images/topic-cfc.jpg',
  },
];
