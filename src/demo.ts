import type { Role } from './api';

export const DEMO_PASSWORD = 'polo2026';

/** Demo accounts (all fictional), as seeded by polo.seed(). */
export const DEMO_ACCOUNTS: { username: string; name: string; role: Role; what: string }[] = [
  { username: 'patron', name: 'James Whitfield', role: 'patron', what: 'UK patron of Team Blue Oak. Pays players and buys horses.' },
  { username: 'pro', name: 'Facundo Ríos', role: 'pro', what: '7-goal player from Argentina, hired for the season.' },
  { username: 'breeder', name: 'Estancia La Aurora', role: 'breeder', what: 'Breeds and sells polo ponies near Buenos Aires.' },
  { username: 'groom', name: 'Martín Gómez', role: 'groom', what: 'Groom of Team Blue Oak. Paid monthly by standing order.' },
  { username: 'vet', name: 'Dr. Lucía Ferrer', role: 'vet', what: 'Equine vet. Confirms pre-purchase examinations for escrow.' },
  { username: 'organizer', name: 'Alpine Polo Events', role: 'organizer', what: 'Tournament organiser. Records match results for win bonuses.' },
  { username: 'bank', name: 'Banco Pampa Sur', role: 'bank', what: 'Partner bank. Pays out PC in USD and reviews KYC in Argentina.' },
  { username: 'admin', name: 'Polo Coin Treasury', role: 'admin', what: 'Issuer. Manages the USD reserve and can reset the demo.' },
];

export interface TourStep {
  /** Demo account to act as; null = public page, no login needed. */
  as: string | null;
  path: string;
  title: string;
  text: string;
}

/** The guided demo: the whole business case in eight steps, switching roles with one click. */
export const TOUR: TourStep[] = [
  { as: 'patron', path: '/app/pay?tab=buy', title: 'Buy Polo Coin',
    text: 'James buys PC with US dollars from his bank account. He pays a single 1% fee on top, and the dollars go into the reserve.' },
  { as: 'patron', path: '/app', title: 'Pay the player’s request',
    text: 'Facundo has asked for his Gstaad tournament fee. James pays it with one click. Transfers are free.' },
  { as: 'pro', path: '/app', title: 'Paid in seconds',
    text: 'Now as Facundo: the fee is already in his wallet. Switch the language to Español at the top right.' },
  { as: 'patron', path: '/app/escrow', title: 'Buy a horse with escrow',
    text: 'James locks the price of a horse in the escrow contract. Pick the breeder as seller and Dr. Ferrer as vet.' },
  { as: 'vet', path: '/app/escrow', title: 'The vet confirms',
    text: 'Dr. Ferrer reports the pre-purchase examination. If it passes, the contract pays the breeder automatically.' },
  { as: 'organizer', path: '/app/escrow?type=bonus', title: 'The final is won',
    text: 'The tournament organiser records the result of the final. The win bonus contract pays Facundo at once.' },
  { as: 'breeder', path: '/app/pay?tab=redeem', title: 'Cash out in US dollars',
    text: 'The breeder exchanges PC for USD at the partner bank, 1:1 and free. The PC are destroyed.' },
  { as: null, path: '/transparency', title: 'Check the proof of reserves',
    text: 'Anyone can see that the USD reserve equals the PC in circulation, and verify every block of the ledger.' },
];
