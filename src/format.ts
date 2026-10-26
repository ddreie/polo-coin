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

export const roleLabel: Record<Role, string> = {
  patron: 'Patron',
  pro: 'Professional player',
  breeder: 'Breeder',
  bank: 'Partner bank',
  admin: 'Treasury',
};

/** Typical cross-border bank wire (from the business case). */
export const SWIFT = { feeLow: 0.02, feeHigh: 0.05, feeMid: 0.035, daysLow: 3, daysHigh: 7 };

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
