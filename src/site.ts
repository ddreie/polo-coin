/** Pages of the public website: one source for navigation and footer (routes are in App.tsx). */
export interface SitePage {
  path: string;
  label: string;          // navigation label
  title: string;          // page headline
  lede: string;           // one-sentence summary under the headline
  inNav?: boolean;        // shown in the main navigation
  group: 'Product' | 'Trust' | 'Company';
}

export const SITE_PAGES: SitePage[] = [
  { path: '/how-it-works', label: 'How it works', inNav: true, group: 'Product',
    title: 'From patron to pampa in seconds',
    lede: 'Buy Polo Coin, pay your player, and the player is paid in US dollars in Argentina – the whole flow, step by step.' },
  { path: '/solutions', label: 'Solutions', inNav: true, group: 'Product',
    title: 'Built for everyone who keeps polo running',
    lede: 'Patrons pay, professionals, breeders and grooms receive. Each side gets what it needs from the same coin.' },
  { path: '/pricing', label: 'Pricing', inNav: true, group: 'Product',
    title: 'One fee. 1%. Nothing hidden.',
    lede: 'Compare what a payment to Argentina costs with your bank and with Polo Coin.' },
  { path: '/escrow', label: 'Escrow', inNav: true, group: 'Product',
    title: 'Buy the horse, not the risk',
    lede: 'The purchase price is locked in a smart contract and released to the breeder only after the vet check.' },
  { path: '/transparency', label: 'Transparency', inNav: true, group: 'Trust',
    title: 'Every coin, backed and visible',
    lede: 'Live proof that the US dollar reserve equals the Polo Coin in circulation, and how the reserve is held.' },
  { path: '/security', label: 'Security', group: 'Trust',
    title: 'Identified wallets, regulated partners',
    lede: 'No anonymous wallets: every holder is verified, and the reserve is kept apart from the issuer’s own funds.' },
  { path: '/about', label: 'About', inNav: true, group: 'Company',
    title: 'A global sport deserves a global payment system',
    lede: 'Our vision, our mission, the team behind Polo Coin and the road from pilot to launch.' },
  { path: '/brand', label: 'Brand', group: 'Company',
    title: 'The Polo Coin brand',
    lede: 'Colours, typography and logo, and how to use them.' },
];

export const NAV_PAGES = SITE_PAGES.filter((p) => p.inNav);
