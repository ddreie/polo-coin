import type { Role } from './api';

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const money = (n: number) => nf.format(n);
export const money0 = (n: number) => nf0.format(n);
export const shortHash = (h?: string | null) => (h ? `${h.slice(0, 8)}…${h.slice(-6)}` : '—');

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Whole days until a deadline (0 = due today or overdue). */
export const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
export const dateShort = (iso: string, lang: 'en' | 'es' = 'en') =>
  new Date(iso).toLocaleDateString(lang === 'es' ? 'es-AR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export const roleLabel: Record<Role, string> = {
  patron: 'Patron',
  pro: 'Professional player',
  breeder: 'Breeder',
  groom: 'Groom',
  vet: 'Veterinarian',
  organizer: 'Tournament organiser',
  bank: 'Partner bank',
  admin: 'Treasury',
  contract: 'Smart contract',
};

/** Bank wire from a CHF, EUR or GBP account, as in the seminar paper (section 3.3.2, scenario B):
 *  total cost = OUR fee + exchange-rate mark-up.
 *  USD 2,000:  4.26% (Deutsche Bank 0.56% + 3.7%) to 6.64% (BBVA 1.94% + 4.7%).
 *  USD 10,000: 3.40% (UBS 0.30% + 3.1%) to 5.40% (BBVA 0.70% + 4.7%).
 *  Overall range 3.4–6.6%. Transfers take one to three days. */
export const SWIFT = { feeLow: 0.034, feeHigh: 0.066, daysLow: 1, daysHigh: 3 };
const WIRE = { at2k: { low: 0.0426, high: 0.0664 }, at10k: { low: 0.034, high: 0.054 } };

/** Bank wire cost share for an amount from a non-USD account. OUR fees are mostly fixed, so the share falls with
 *  the amount: interpolated on a log scale between the paper's two measurements, held constant outside them. */
export function wireCost(amount: number, edge: 'low' | 'high' | 'mid' = 'mid'): number {
  const w = Math.min(1, Math.max(0, Math.log(Math.max(amount, 1) / 2000) / Math.log(5)));
  const at = (e: 'low' | 'high') => WIRE.at2k[e] + (WIRE.at10k[e] - WIRE.at2k[e]) * w;
  return edge === 'mid' ? (at('low') + at('high')) / 2 : at(edge);
}

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
