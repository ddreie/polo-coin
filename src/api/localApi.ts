import type { Account, Api, Applicant, Bonus, Escrow, FrozenWallet, Hold, HoldRule, Party, PayRequest, StandingOrder, Stats, Tx, VetStats } from './types';
import { blockHash, GENESIS_PREV, sha256Hex } from '../verify';

/**
 * In-browser implementation of the same rules as supabase/setup.sql.
 * Used for offline development (`npm run dev:demo`) and as a fallback build.
 * Data lives in localStorage of the current browser. Keep it in sync with the SQL rules.
 */
const KEY = 'polo-coin-demo-v9';
const FEE_RATE = 0.01;      // on every purchase of PC
const BANK_SHARE = 0.5;
const RESERVE_YIELD = 0.042;
const CASH_SHARE = 0.3;

type Stored = Account & { password: string; created_at: string; kyc_by: number | null; independence_declared_at?: string | null;
  frozen_by?: number | null; frozen_reason?: string | null };
interface StoredHold {
  id: number; from_id: number; to_id: number; amount: number; memo: string | null; rule: HoldRule; reason: string;
  status: Hold['status']; created_at: string; decided_at: string | null; decided_by: number | null; sender_frozen: boolean;
  lock_block: number | null; settle_block: number | null;
}
type StoredEscrow = Omit<Escrow, 'buyer_name' | 'seller_name' | 'vet_name' | 'vet_licence' | 'vet_stats' | 'lock_hash' | 'settle_hash' | 'contract_wallet'>
  & { lock_block: number | null; settle_block: number | null };
type StoredRequest = Omit<PayRequest, 'requester_name' | 'payer_name' | 'tx_hash'> & { block: number | null };
type StoredBonus = Omit<Bonus, 'patron_name' | 'player_name' | 'organizer_name' | 'lock_hash' | 'settle_hash'>
  & { lock_block: number | null; settle_block: number | null };
type StoredStanding = Omit<StandingOrder, 'payer_name' | 'payee_name' | 'last_hash'> & { last_block: number | null };

interface State {
  accounts: Stored[];
  sessions: Record<string, number>;
  reserve: number;
  ledger: Tx[];
  escrows: StoredEscrow[];
  requests: StoredRequest[];
  bonuses: StoredBonus[];
  standing: StoredStanding[];
  holds: StoredHold[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sha256 = sha256Hex;
const now = () => new Date().toISOString();

function checkAmount(a: number) {
  if (!Number.isFinite(a) || a <= 0) throw new Error('Amount must be greater than zero.');
  if (a > 1_000_000) throw new Error('Demo limit: max. 1,000,000 per transaction.');
  return round2(a);
}
const byRole = (s: State, role: Account['role']) => s.accounts.find((a) => a.role === role)!;
const byId = (s: State, id: number | null) => s.accounts.find((a) => a.id === id);
/** The compliance hold wallet: PC of transfers under review (mirrors polo.hold_id). */
const holdWallet = (s: State) => s.accounts.find((a) => a.username === 'compliance')!;

// Transaction monitoring thresholds (same as polo.config).
const AML_LARGE = 50000, AML_MULTIPLE = 3, AML_PASSTHROUGH_MIN = 10000, AML_PASSTHROUGH_SHARE = 0.8;
const fmt0 = (n: number) => Math.round(n).toLocaleString('en-US');

/** Transaction monitoring (mirrors polo.aml_check): the rule and reason if a transfer looks suspicious. */
function amlCheck(s: State, from: number, to: number, amt: number): { rule: HoldRule; reason: string } | null {
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const maxes = [...s.ledger.filter((t) => t.kind === 'transfer' && t.from_id === from).map((t) => t.amount),
    ...(s.holds ?? []).filter((h) => h.from_id === from && h.status === 'released').map((h) => h.amount)];
  const max = maxes.length ? Math.max(...maxes) : null;
  if (amt > AML_LARGE && (max === null || amt > AML_MULTIPLE * max)) {
    return { rule: 'large', reason: max === null
      ? `Unusually large: first payment of this wallet, PC ${fmt0(amt)}, above the PC ${fmt0(AML_LARGE)} threshold.`
      : `Unusually large: PC ${fmt0(amt)} is more than ${AML_MULTIPLE} times this wallet's largest earlier payment (PC ${fmt0(max)}).` };
  }
  const recent = s.ledger.filter((t) => t.created_at > dayAgo);
  const inSum = recent.filter((t) => t.to_id === from && (t.kind === 'transfer' || t.kind === 'release') && t.from_id !== to)
    .reduce((x, t) => x + t.amount, 0);
  const outSum = recent.filter((t) => t.from_id === from && (t.kind === 'transfer' || t.kind === 'lock')).reduce((x, t) => x + t.amount, 0);
  if (amt >= AML_PASSTHROUGH_MIN && inSum >= AML_PASSTHROUGH_MIN && outSum + amt >= AML_PASSTHROUGH_SHARE * inSum) {
    return { rule: 'passthrough', reason: `Pass-through: this wallet received PC ${fmt0(inSum)} from others in the last 24 hours and would forward ${Math.round(100 * (outSum + amt) / inSum)}% of it.` };
  }
  const same = recent.filter((t) => t.kind === 'transfer' && t.from_id === from && t.to_id === to);
  const sum = same.reduce((x, t) => x + t.amount, 0);
  if (same.length >= 2 && amt <= AML_LARGE && sum + amt > AML_LARGE) {
    return { rule: 'split', reason: `Split payments: ${same.length + 1} payments to the same recipient within 24 hours add up to PC ${fmt0(sum + amt)}.` };
  }
  return null;
}

async function append(s: State, kind: Tx['kind'], from: number | null, to: number | null,
  amount: number, fee: number, memo: string | null) {
  const prev = s.ledger.length ? s.ledger[s.ledger.length - 1].tx_hash : GENESIS_PREV;
  const t = Date.now();
  const base = {
    prev_hash: prev, kind, from_wallet: byId(s, from)?.wallet ?? null, to_wallet: byId(s, to)?.wallet ?? null,
    amount, fee, memo_hash: await sha256(memo ?? ''), ts_us: t * 1000,
  };
  const tx: Tx = {
    ...base, block: s.ledger.length + 1, tx_hash: await blockHash(base),
    from_id: from, to_id: to, memo, created_at: new Date(t).toISOString(),
  };
  s.ledger.push(tx);
  return tx;
}

// ---- Business operations (mirror polo.op_* in setup.sql) ----
async function opBuy(s: State, acc: Stored, amount: number) {
  const amt = checkAmount(amount);
  const fee = round2(amt * FEE_RATE);
  const bankFee = round2(fee * BANK_SHARE);
  if (acc.usd < amt + fee) {
    throw new Error(`Insufficient USD balance: ${(amt + fee).toFixed(2)} needed incl. 1% fee, ${acc.usd.toFixed(2)} available.`);
  }
  acc.usd = round2(acc.usd - amt - fee);
  acc.pc = round2(acc.pc + amt);
  const bank = byRole(s, 'bank'); const admin = byRole(s, 'admin');
  bank.usd = round2(bank.usd + bankFee);
  admin.usd = round2(admin.usd + fee - bankFee);
  s.reserve = round2(s.reserve + amt);
  return append(s, 'mint', null, acc.id, amt, fee, 'USD deposited into reserve, PC minted');
}

async function opTransfer(s: State, acc: Stored, to: number, amount: number, memo: string) {
  const amt = checkAmount(amount);
  if (to === acc.id) throw new Error('You cannot send PC to yourself.');
  const rec = byId(s, to);
  if (!rec || rec.role === 'contract') throw new Error('Recipient not found.');
  if (rec.kyc !== 'verified') throw new Error('The recipient has not passed KYC yet and cannot receive PC.');
  if (rec.frozen_at) throw new Error("The recipient's wallet is frozen and cannot receive PC right now.");
  if (acc.pc < amt) throw new Error(`Insufficient PC balance (available: ${acc.pc.toFixed(2)}).`);
  // Transaction monitoring: suspicious transfers go to the compliance hold wallet instead.
  const flag = amlCheck(s, acc.id, to, amt);
  if (flag) {
    s.holds ??= [];
    const h: StoredHold = { id: s.holds.length + 1, from_id: acc.id, to_id: to, amount: amt, memo: memo.trim().slice(0, 120) || null,
      rule: flag.rule, reason: flag.reason, status: 'held', created_at: now(), decided_at: null, decided_by: null,
      sender_frozen: false, lock_block: null, settle_block: null };
    s.holds.push(h);
    const hw = holdWallet(s);
    acc.pc = round2(acc.pc - amt);
    hw.pc = round2(hw.pc + amt);
    const t = await append(s, 'lock', acc.id, hw.id, amt, 0, `Payment #${h.id} held for compliance review`);
    h.lock_block = t.block;
    return t;
  }
  acc.pc = round2(acc.pc - amt);
  rec.pc = round2(rec.pc + amt);
  return append(s, 'transfer', acc.id, to, amt, 0, memo.trim().slice(0, 120) || null);
}

async function opRedeem(s: State, acc: Stored, amount: number) {
  const amt = checkAmount(amount);
  if (acc.pc < amt) throw new Error(`Insufficient PC balance (available: ${acc.pc.toFixed(2)}).`);
  acc.pc = round2(acc.pc - amt);
  acc.usd = round2(acc.usd + amt);
  s.reserve = round2(s.reserve - amt);
  return append(s, 'redeem', acc.id, byRole(s, 'bank').id, amt, 0, 'PC burned, USD paid out by partner bank');
}

/** Vet report deadline: without a report the escrow refunds the buyer (same as polo.config.escrow_days). */
export const ESCROW_DAYS = 14;

async function opEscrowLock(s: State, buyer: Stored, seller: number, vet: number, amount: number, item: string) {
  const amt = checkAmount(amount);
  const what = item.trim().slice(0, 80);
  if (what.length < 2) throw new Error("Describe what you are buying, e.g. the horse's name.");
  if (seller === buyer.id) throw new Error('You cannot buy from yourself.');
  const sel = byId(s, seller);
  if (!sel || sel.kyc !== 'verified' || sel.frozen_at || !['patron', 'pro', 'breeder'].includes(sel.role)) {
    throw new Error('The seller must be a verified patron, player or breeder.');
  }
  const v = byId(s, vet);
  if (!v || v.kyc !== 'verified' || v.role !== 'vet') throw new Error('Choose a verified veterinarian for the pre-purchase examination.');
  if (buyer.pc < amt) throw new Error(`Insufficient PC balance (available: ${buyer.pc.toFixed(2)}).`);
  const contract = byRole(s, 'contract');
  const e: StoredEscrow = {
    id: s.escrows.length + 1, amount: amt, item: what, status: 'locked', vet_passed: null, refund_reason: null, accepted_at: null,
    buyer_id: buyer.id, seller_id: seller, vet_id: vet, created_at: now(),
    expires_at: new Date(Date.now() + ESCROW_DAYS * 86400000).toISOString(),
    settled_at: null, lock_block: null, settle_block: null,
  };
  s.escrows.push(e);
  buyer.pc = round2(buyer.pc - amt);
  contract.pc = round2(contract.pc + amt);
  e.lock_block = (await append(s, 'lock', buyer.id, contract.id, amt, 0, `Escrow #${e.id}: ${what}`)).block;
  return e;
}

async function opEscrowSettle(s: State, id: number, release: boolean, vetPassed: boolean | null,
  reason: Escrow['refund_reason']) {
  const e = s.escrows.find((x) => x.id === id);
  if (!e) throw new Error('Escrow not found.');
  if (e.status !== 'locked') throw new Error(`Escrow #${e.id} is already ${e.status}.`);
  const contract = byRole(s, 'contract');
  const to = byId(s, release ? e.seller_id : e.buyer_id)!;
  contract.pc = round2(contract.pc - e.amount);
  to.pc = round2(to.pc + e.amount);
  const why = release ? ': vet check passed, paid to seller'
    : reason === 'vet_failed' ? ': vet check failed, refunded'
    : reason === 'declined' ? ': declined by seller, refunded'
    : reason === 'expired' && !e.accepted_at ? `: not accepted by seller within ${ESCROW_DAYS} days, refunded`
    : reason === 'expired' ? `: no vet report within ${ESCROW_DAYS} days, refunded`
    : ': cancelled by buyer, refunded';
  const t = await append(s, release ? 'release' : 'refund', contract.id, to.id, e.amount, 0, `Escrow #${e.id}${why}`);
  Object.assign(e, { status: release ? 'released' : 'refunded', vet_passed: vetPassed, refund_reason: release ? null : reason,
    settled_at: now(), settle_block: t.block });
  return e;
}

/** The seller accepts the escrow and the proposed vet: the vet now has 14 days to report, the buyer can no longer cancel. */
function opEscrowAccept(s: State, id: number, seller: number) {
  const e = s.escrows.find((x) => x.id === id);
  if (!e) throw new Error('Escrow not found.');
  if (e.seller_id !== seller) throw new Error(`Only the seller named in escrow #${e.id} can accept it.`);
  if (e.status !== 'locked') throw new Error(`Escrow #${e.id} is already ${e.status}.`);
  if (e.accepted_at) throw new Error(`You have already accepted escrow #${e.id}.`);
  Object.assign(e, { accepted_at: now(), expires_at: new Date(Date.now() + ESCROW_DAYS * 86400000).toISOString() });
  return e;
}

/** Escrow deadline: refund every open escrow whose seller acceptance or vet report is overdue. */
async function opEscrowExpireDue(s: State) {
  const due = s.escrows.filter((e) => e.status === 'locked' && e.expires_at <= now()).sort((a, b) => a.id - b.id);
  for (const e of due) await opEscrowSettle(s, e.id, false, null, 'expired');
  return due.length;
}

async function opBonusLock(s: State, patron: Stored, player: number, organizer: number, amount: number, match: string) {
  const amt = checkAmount(amount);
  const what = match.trim().slice(0, 80);
  if (what.length < 2) throw new Error('Name the match the bonus is tied to, e.g. the final.');
  if (player === patron.id) throw new Error('You cannot promise a bonus to yourself.');
  const pl = byId(s, player);
  if (!pl || pl.kyc !== 'verified' || pl.frozen_at || !['pro', 'groom'].includes(pl.role)) throw new Error('The bonus must go to a verified player or groom.');
  const org = byId(s, organizer);
  if (!org || org.kyc !== 'verified' || org.role !== 'organizer') throw new Error('Choose the tournament organiser who records the result.');
  if (patron.pc < amt) throw new Error(`Insufficient PC balance (available: ${patron.pc.toFixed(2)}).`);
  const contract = byRole(s, 'contract');
  const b: StoredBonus = {
    id: s.bonuses.length + 1, amount: amt, match: what, status: 'locked', won: null,
    patron_id: patron.id, player_id: player, organizer_id: organizer, created_at: now(), settled_at: null, lock_block: null, settle_block: null,
  };
  s.bonuses.push(b);
  patron.pc = round2(patron.pc - amt);
  contract.pc = round2(contract.pc + amt);
  b.lock_block = (await append(s, 'lock', patron.id, contract.id, amt, 0, `Win bonus #${b.id}: ${what}`)).block;
  return b;
}

async function opBonusSettle(s: State, id: number, pay: boolean, won: boolean | null) {
  const b = s.bonuses.find((x) => x.id === id);
  if (!b) throw new Error('Win bonus not found.');
  if (b.status !== 'locked') throw new Error(`Win bonus #${b.id} is already ${b.status}.`);
  const contract = byRole(s, 'contract');
  const to = byId(s, pay ? b.player_id : b.patron_id)!;
  contract.pc = round2(contract.pc - b.amount);
  to.pc = round2(to.pc + b.amount);
  const why = pay ? ': match won, paid to player' : won === false ? ': match lost, refunded' : ': cancelled by patron, refunded';
  const t = await append(s, pay ? 'release' : 'refund', contract.id, to.id, b.amount, 0, `Win bonus #${b.id}${why}`);
  Object.assign(b, { status: pay ? 'paid' : 'refunded', won, settled_at: now(), settle_block: t.block });
  return b;
}

const addPeriod = (iso: string, every: 'week' | 'month') => {
  const d = new Date(iso);
  if (every === 'week') d.setDate(d.getDate() + 7); else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
};

async function opStandingRun(s: State, id: number) {
  const o = s.standing.find((x) => x.id === id);
  if (!o) throw new Error('Standing order not found.');
  if (!o.active) throw new Error(`Standing order #${o.id} has been cancelled.`);
  const payer = byId(s, o.payer_id)!;
  const t = await opTransfer(s, payer, o.payee_id, o.amount, `${o.memo ?? 'Standing order'} (standing order #${o.id})`);
  Object.assign(o, { runs: o.runs + 1, last_block: t.block, next_due: addPeriod(o.next_due, o.every) });
  return t;
}

async function seed(): Promise<State> {
  const mk = async (id: number, username: string, display_name: string, role: Account['role'],
    org: string, country: string, usd: number, kyc: Account['kyc'] = 'verified', ageMin = 0): Promise<Stored> => ({
    id, username, display_name, role, org, country, usd, pc: 0, kyc,
    password: role === 'contract' ? crypto.randomUUID() : 'polo2026',
    wallet: '0x' + (await sha256(role === 'contract' ? 'escrow-contract' : username)).slice(0, 40),
    created_at: new Date(Date.now() - ageMin * 60000).toISOString(), kyc_by: null, kyc_at: null,
  });
  const s: State = {
    accounts: [
      await mk(1, 'patron', 'James Whitfield', 'patron', 'Team Blue Oak', 'United Kingdom', 250000),
      await mk(2, 'pro', 'Facundo Ríos', 'pro', '7-goal professional', 'Argentina', 0),
      await mk(3, 'breeder', 'Estancia La Aurora', 'breeder', 'Polo pony breeder', 'Argentina', 0),
      await mk(4, 'bank', 'Banco Pampa Sur', 'bank', 'Partner bank (fictional)', 'Argentina', 0),
      await mk(5, 'admin', 'Polo Coin Treasury', 'admin', 'Issuer & reserve manager', 'Switzerland', 0),
      { ...await mk(6, 'vet', 'Dr. Lucía Ferrer', 'vet', 'Equine vet, Pilar (fictional)', 'Argentina', 0),
        licence_no: 'MP 3307 (fictional)', licence_authority: 'Provincial veterinary register, Buenos Aires',
        insurer: 'Seguros del Plata (fictional)', independence_declared_at: new Date(Date.now() - 200 * 86400000).toISOString(),
        kyc_by: 5, kyc_at: new Date(Date.now() - 199 * 86400000).toISOString() },
      await mk(7, 'groom', 'Martín Gómez', 'groom', 'Groom, Team Blue Oak', 'Argentina', 0),
      await mk(8, 'organizer', 'Alpine Polo Events', 'organizer', 'Tournament organiser (fictional)', 'Switzerland', 0),
      await mk(9, 'escrow', 'Polo Coin Escrow Contract', 'contract', 'Smart contract', 'Switzerland', 0),
      // Two open sign-up applications, so the KYC review can be shown right away.
      await mk(10, 'charlotte', 'Charlotte Hayes', 'patron', 'Team Hollow Creek', 'United States', 100000, 'pending', 120),
      await mk(11, 'valentina', 'Valentina Arrieta', 'pro', '4-goal professional', 'Argentina', 0, 'pending', 25),
      { ...await mk(12, 'tomas', 'Dr. Tomás Iriarte', 'vet', 'Equine clinic, Cañuelas (fictional)', 'Argentina', 0, 'pending', 50),
        licence_no: 'MP 5172 (fictional)', licence_authority: 'Provincial veterinary register, Buenos Aires',
        insurer: 'Seguros del Plata (fictional)', independence_declared_at: new Date(Date.now() - 50 * 60000).toISOString() },
      // Transfers under compliance review sit here until the partner bank or treasury decides.
      { ...await mk(13, 'compliance', 'Polo Coin Compliance Hold', 'contract', 'Held for AML review', 'Switzerland', 0),
        wallet: '0x' + (await sha256('compliance-hold')).slice(0, 40) },
    ],
    sessions: {}, reserve: 0, ledger: [], escrows: [], requests: [], bonuses: [], standing: [], holds: [],
  };
  await append(s, 'genesis', null, null, 0, 0, 'Polo Coin genesis block');
  // Starting history, as in polo.seed()
  const [patron, pro] = [s.accounts[0], s.accounts[1]];
  await opBuy(s, patron, 60000);
  await opTransfer(s, patron, pro.id, 12000, 'Tournament fee, Snow Polo St. Moritz');
  await opRedeem(s, pro, 4000);
  // Two earlier horse purchases examined by Dr. Ferrer, so her track record is not empty.
  const pampero = await opEscrowLock(s, patron, 3, 6, 9000, 'Gelding "Pampero", 9 years');
  opEscrowAccept(s, pampero.id, 3);
  await opEscrowSettle(s, pampero.id, true, true, null);
  const brisa = await opEscrowLock(s, patron, 3, 6, 7500, 'Mare "Brisa", 6 years');
  opEscrowAccept(s, brisa.id, 3);
  await opEscrowSettle(s, brisa.id, false, false, 'vet_failed');
  const bonita = await opEscrowLock(s, patron, 3, 6, 18000, 'Mare "La Bonita", 7 years');
  opEscrowAccept(s, bonita.id, 3);   // accepted, waiting for the vet
  await opBonusLock(s, patron, pro.id, 8, 3000, 'Final, Alpine Polo Cup');
  // The groom's monthly wages: paid once already, next instalment due in a month.
  s.standing.push({ id: 1, payer_id: patron.id, payee_id: 7, amount: 2500, memo: 'Monthly wages', every: 'month',
    next_due: now(), active: true, runs: 0, created_at: now(), last_block: null });
  await opStandingRun(s, 1);
  s.requests.push({ id: 1, requester_id: pro.id, payer_id: patron.id, amount: 9500, memo: 'Tournament fee, Polo Gold Cup Gstaad',
    status: 'open', created_at: now(), settled_at: null, block: null });
  // A payment caught by transaction monitoring: far larger than anything the patron paid before.
  await opBuy(s, patron, 80000);
  await opTransfer(s, patron, 3, 80000, 'Six polo ponies for the season');
  return s;
}

function decorate(s: State, tx: Tx): Tx {
  const f = byId(s, tx.from_id); const t = byId(s, tx.to_id);
  return { ...tx, from_name: f?.display_name ?? null, to_name: t?.display_name ?? null,
    from_wallet: f?.wallet ?? null, to_wallet: t?.wallet ?? null };
}
const hashOf = (s: State, block: number | null) => s.ledger.find((t) => t.block === block)?.tx_hash ?? null;
const name = (s: State, id: number) => byId(s, id)?.display_name ?? '';
/** A vet's public track record (mirrors polo.vet_stats). */
function vetStats(s: State, vet: number): VetStats {
  const mine = s.escrows.filter((e) => e.vet_id === vet);
  const reported = mine.filter((e) => e.vet_passed !== null);
  return {
    reports: reported.length,
    passed: reported.filter((e) => e.vet_passed === true).length,
    failed: reported.filter((e) => e.vet_passed === false).length,
    missed: mine.filter((e) => e.refund_reason === 'expired' && e.accepted_at).length,
    open: mine.filter((e) => e.status === 'locked' && e.accepted_at).length,
    volume: round2(reported.reduce((t, e) => t + e.amount, 0)),
    verified_at: byId(s, vet)?.kyc_at ?? null,
  };
}

function holdOut(s: State, h: StoredHold, staff: boolean): Hold {
  const from = byId(s, h.from_id);
  return { id: h.id, amount: h.amount, memo: h.memo, status: h.status, from_id: h.from_id, to_id: h.to_id,
    from_name: name(s, h.from_id), to_name: name(s, h.to_id),
    rule: staff ? h.rule : null, reason: staff ? h.reason : null,   // reasons only for reviewers (no tipping-off)
    sender_frozen: h.sender_frozen, from_frozen: !!from?.frozen_at, from_since: from?.kyc_at ?? from?.created_at ?? h.created_at,
    from_payments: s.ledger.filter((t) => t.kind === 'transfer' && t.from_id === h.from_id).length,
    created_at: h.created_at, decided_at: h.decided_at, decided_by_name: byId(s, h.decided_by)?.display_name ?? null,
    lock_hash: hashOf(s, h.lock_block), settle_hash: hashOf(s, h.settle_block) };
}

/** Compliance review of a held transfer (mirrors polo.op_hold_decide, the ledger entry is appended by the caller). */
function opHoldDecide(s: State, id: number, reviewer: number, release: boolean) {
  const h = (s.holds ?? []).find((x) => x.id === id);
  if (!h) throw new Error('Held payment not found.');
  if (h.status !== 'held') throw new Error(`Payment #${h.id} has already been ${h.status}.`);
  if (release && byId(s, h.to_id)?.frozen_at) throw new Error("The recipient's wallet is frozen. Return the payment to the sender instead.");
  const to = byId(s, release ? h.to_id : h.from_id)!;
  const hw = holdWallet(s);
  hw.pc = round2(hw.pc - h.amount);
  to.pc = round2(to.pc + h.amount);
  Object.assign(h, { status: release ? 'released' : 'returned', decided_at: now(), decided_by: reviewer });
  return h;
}

/** Freeze a customer wallet (mirrors polo.op_freeze). */
function opFreeze(s: State, id: number, by: number, reason: string) {
  const a = byId(s, id);
  if (!a) throw new Error('Account not found.');
  if (['bank', 'admin', 'contract'].includes(a.role)) throw new Error('This account cannot be frozen.');
  if (a.frozen_at) throw new Error(`${a.display_name} is already frozen.`);
  const why = (reason ?? '').trim().slice(0, 200);
  if (why.length < 5) throw new Error('Give a short reason for the freeze (it stays internal).');
  Object.assign(a, { frozen_at: now(), frozen_by: by, frozen_reason: why });
  return a;
}

function escrowOut(s: State, e: StoredEscrow): Escrow {
  const { lock_block, settle_block, ...rest } = e;
  return { ...rest, buyer_name: name(s, e.buyer_id), seller_name: name(s, e.seller_id), vet_name: name(s, e.vet_id),
    vet_licence: byId(s, e.vet_id)?.licence_no ?? null, vet_stats: vetStats(s, e.vet_id),
    lock_hash: hashOf(s, lock_block), settle_hash: hashOf(s, settle_block), contract_wallet: byRole(s, 'contract').wallet };
}
function requestOut(s: State, r: StoredRequest): PayRequest {
  const { block, ...rest } = r;
  return { ...rest, requester_name: name(s, r.requester_id), payer_name: name(s, r.payer_id), tx_hash: hashOf(s, block),
    held: s.ledger.find((t) => t.block === block)?.kind === 'lock' };
}
function bonusOut(s: State, b: StoredBonus): Bonus {
  const { lock_block, settle_block, ...rest } = b;
  return { ...rest, patron_name: name(s, b.patron_id), player_name: name(s, b.player_id), organizer_name: name(s, b.organizer_id),
    lock_hash: hashOf(s, lock_block), settle_hash: hashOf(s, settle_block) };
}
function standingOut(s: State, o: StoredStanding): StandingOrder {
  const { last_block, ...rest } = o;
  return { ...rest, payer_name: name(s, o.payer_id), payee_name: name(s, o.payee_id), last_hash: hashOf(s, last_block) };
}
function publicAccount(s: State, a: Stored): Account {
  const { password: _pw, created_at: _c, kyc_by, frozen_by: _fb, frozen_reason: _fr, ...rest } = a;
  return { ...rest, kyc_by_name: byId(s, kyc_by)?.display_name ?? null };
}
/** Treasury reviews everyone, the partner bank reviews applicants from Argentina. */
function canReview(r: Stored, a: Stored) {
  return !['bank', 'admin', 'organizer', 'contract'].includes(a.role)
    && (r.role === 'admin' || (r.role === 'bank' && a.country === 'Argentina' && a.role !== 'vet'));
}

export function createLocalApi(): Api {
  let cache: State | null = null;

  async function load(): Promise<State> {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return (cache = JSON.parse(raw));
    } catch { /* storage unavailable – keep in memory */ }
    const s = await seed();
    save(s);
    return s;
  }
  function save(s: State) {
    cache = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  async function auth(token: string) {
    const s = await load();
    const acc = byId(s, s.sessions[token]);
    if (!acc) throw new Error('Session expired – please log in again.');
    return { s, acc };
  }
  async function authVerified(token: string) {
    const r = await auth(token);
    if (r.acc.frozen_at) throw new Error('This wallet is frozen by the Polo Coin Treasury pending a compliance review. You cannot send, receive or cash out PC until it is lifted.');
    if (r.acc.kyc === 'pending') throw new Error('Your identity check (KYC) is still pending. You can use Polo Coin once it is verified.');
    if (r.acc.kyc !== 'verified') throw new Error('Your KYC application was rejected. This account cannot use Polo Coin.');
    return r;
  }
  const delay = () => new Promise((r) => setTimeout(r, 120));
  /** Run an operation and persist the state only if it succeeded (like a DB transaction). */
  /** Like tx, for reviewers (partner bank, treasury). */
  async function staffTx<T>(token: string, fn: (s: State, acc: Stored) => Promise<T>) {
    await delay();
    const { s, acc } = await auth(token);
    if (acc.role !== 'admin' && acc.role !== 'bank') throw new Error('Only the partner bank and the treasury review held payments.');
    const backup = JSON.stringify(s);
    try { const r = await fn(s, acc); save(s); return r; } catch (e) { cache = JSON.parse(backup); throw e; }
  }
  async function tx<T>(token: string, fn: (s: State, acc: Stored) => Promise<T>) {
    await delay();
    const { s, acc } = await authVerified(token);
    const backup = JSON.stringify(s);
    try { const r = await fn(s, acc); save(s); return r; } catch (e) { cache = JSON.parse(backup); throw e; }
  }

  return {
    mode: 'local',
    async login(username, password) {
      await delay();
      const s = await load();
      const a = s.accounts.find((x) => x.username === username.trim().toLowerCase() && x.role !== 'contract');
      if (!a || a.password !== password) throw new Error('Wrong username or password.');
      const token = crypto.randomUUID();
      s.sessions[token] = a.id;
      save(s);
      return { token, account: publicAccount(s, a) };
    },
    async register(f) {
      await delay();
      const s = await load();
      const username = f.username.trim().toLowerCase();
      const nm = f.display_name.trim();
      const country = f.country.trim();
      const org = f.org.trim() || '—';
      if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username: 3 to 20 characters, only letters, digits and _.');
      if ((f.password ?? '').length < 6) throw new Error('Password: at least 6 characters.');
      if (nm.length < 2 || nm.length > 60) throw new Error('Please enter your full name (max. 60 characters).');
      if (!['patron', 'pro', 'breeder', 'groom', 'vet'].includes(f.role)) throw new Error('Choose patron, professional player, breeder, groom or veterinarian.');
      const vet = f.role === 'vet';
      if (vet) {
        const lic = (f.licence_no ?? '').trim(), auth = (f.licence_authority ?? '').trim(), ins = (f.insurer ?? '').trim();
        if (lic.length < 3 || lic.length > 30) throw new Error('Vets: please enter your licence number (3 to 30 characters).');
        if (auth.length < 3 || auth.length > 80) throw new Error('Vets: please name the register or authority that issued your licence.');
        if (ins.length < 2 || ins.length > 60) throw new Error('Vets: please name your professional liability insurer.');
        if (!f.independent) throw new Error('Vets: please confirm the declaration of independence.');
      }
      if (country.length < 2 || country.length > 40 || org.length > 60) throw new Error('Please enter a country (and an organisation of max. 60 characters).');
      if (s.accounts.some((a) => a.username === username)) throw new Error('This username is taken. Please choose another one.');
      if (s.accounts.length >= 200) throw new Error('Demo limit reached. Ask the treasury to reset the demo.');
      const a: Stored = {
        id: Math.max(...s.accounts.map((x) => x.id)) + 1, username, display_name: nm, role: f.role, org, country,
        usd: f.role === 'patron' ? 100000 : 0, pc: 0, kyc: 'pending', password: f.password,
        wallet: '0x' + (await sha256(username + ':' + crypto.randomUUID())).slice(0, 40),
        created_at: now(), kyc_by: null, kyc_at: null,
        ...(vet ? { licence_no: f.licence_no!.trim(), licence_authority: f.licence_authority!.trim(),
          insurer: f.insurer!.trim(), independence_declared_at: now() } : {}),
      };
      s.accounts.push(a);
      const token = crypto.randomUUID();
      s.sessions[token] = a.id;
      save(s);
      return { token, account: publicAccount(s, a) };
    },
    async logout(token) {
      const s = await load();
      delete s.sessions[token];
      save(s);
    },
    async me(token) {
      const { s, acc } = await auth(token);
      return publicAccount(s, acc);
    },
    async directory(token) {
      const { s } = await auth(token);
      return s.accounts.filter((a) => a.kyc === 'verified' && a.role !== 'contract' && !a.frozen_at)
        .map(({ id, display_name, role, org, country, wallet, licence_no, licence_authority }): Party => ({
          id, display_name, role, org, country, wallet, licence_no: licence_no ?? null, licence_authority: licence_authority ?? null,
          vet_stats: role === 'vet' ? vetStats(s, id) : null }));
    },
    buy: (token, amount) => tx(token, async (s, acc) => decorate(s, await opBuy(s, acc, amount))),
    transfer: (token, to, amount, memo) => tx(token, async (s, acc) => decorate(s, await opTransfer(s, acc, to, amount, memo))),
    redeem: (token, amount) => tx(token, async (s, acc) => decorate(s, await opRedeem(s, acc, amount))),
    async transactions(token, limit = 50) {
      const { s, acc } = await auth(token);
      const all = acc.role === 'bank' || acc.role === 'admin';
      return s.ledger.filter((t) => t.kind !== 'genesis' && (all || t.from_id === acc.id || t.to_id === acc.id))
        .slice(-limit).reverse().map((t) => decorate(s, t));
    },
    async explorer(limit = 25) {
      const s = await load();
      return s.ledger.slice(-limit).reverse().map((t) => ({ ...decorate(s, t), from_name: undefined, to_name: undefined, memo: undefined }));
    },
    async stats(): Promise<Stats> {
      const s = await load();
      const sum = (kinds: Tx['kind'][] | null, f: 'amount' | 'fee') =>
        round2(s.ledger.filter((t) => !kinds || kinds.includes(t.kind)).reduce((x, t) => x + t[f], 0));
      return {
        reserve_usd: s.reserve,
        supply_pc: round2(s.accounts.reduce((x, a) => x + a.pc, 0)),
        tx_count: s.ledger.filter((t) => t.kind !== 'genesis').length,
        volume_pc: sum(['transfer', 'release'], 'amount'),
        fees_pc: sum(null, 'fee'),
        fees_usd: sum(['mint'], 'fee'),
        minted_pc: sum(['mint'], 'amount'),
        redeemed_pc: sum(['redeem'], 'amount'),
        escrow_pc: byRole(s, 'contract').pc,
        held_pc: holdWallet(s).pc,
        holds_open: (s.holds ?? []).filter((h) => h.status === 'held').length,
        escrows_open: s.escrows.filter((e) => e.status === 'locked').length,
        escrows_done: s.escrows.filter((e) => e.status !== 'locked').length,
        bonuses_open: s.bonuses.filter((b) => b.status === 'locked').length,
        wallets: s.accounts.filter((a) => a.kyc === 'verified' && a.role !== 'contract').length,
        fee_rate: FEE_RATE, bank_share: BANK_SHARE, reserve_yield: RESERVE_YIELD, cash_share: CASH_SHARE,
        chain_valid: s.ledger.every((t, i) => t.prev_hash === (i ? s.ledger[i - 1].tx_hash : GENESIS_PREV)),
      };
    },
    async reset(token) {
      const { acc } = await auth(token);
      if (acc.role !== 'admin') throw new Error('Only the treasury admin can reset the demo.');
      save(await seed());
    },
    async kycQueue(token) {
      const { s, acc } = await auth(token);
      if (acc.role !== 'admin' && acc.role !== 'bank') throw new Error('Only the treasury and the partner bank review KYC applications.');
      const when = (a: Stored) => a.kyc_at ?? a.created_at;
      return s.accounts
        .filter((a) => canReview(acc, a) && (a.kyc === 'pending' || a.kyc_by !== null))
        .sort((a, b) => Number(b.kyc === 'pending') - Number(a.kyc === 'pending') || when(b).localeCompare(when(a)))
        .slice(0, 50)
        .map((a): Applicant => ({
          id: a.id, username: a.username, display_name: a.display_name, role: a.role, org: a.org, country: a.country,
          wallet: a.wallet, kyc: a.kyc, created_at: a.created_at, kyc_at: a.kyc_at ?? null,
          kyc_by_name: byId(s, a.kyc_by)?.display_name ?? null,
          licence_no: a.licence_no ?? null, licence_authority: a.licence_authority ?? null, insurer: a.insurer ?? null,
          independence_declared_at: a.independence_declared_at ?? null,
        }));
    },
    async kycDecide(token, id, approve) {
      await delay();
      const { s, acc } = await auth(token);
      const a = byId(s, id);
      if (!a) throw new Error('Applicant not found.');
      if (!canReview(acc, a)) throw new Error('You may not review this applicant. The partner bank reviews applicants from Argentina, the treasury reviews everyone and alone checks vets.');
      if (a.kyc !== 'pending') throw new Error(`${a.display_name} has already been ${a.kyc}.`);
      Object.assign(a, { kyc: approve ? 'verified' : 'rejected', kyc_by: acc.id, kyc_at: now() });
      save(s);
      return publicAccount(s, a);
    },
    async escrows(token) {
      const { s, acc } = await auth(token);
      if (await opEscrowExpireDue(s)) save(s);   // every wallet refresh enforces the deadline
      const all = acc.role === 'bank' || acc.role === 'admin';
      return s.escrows.filter((e) => all || [e.buyer_id, e.seller_id, e.vet_id].includes(acc.id))
        .sort((a, b) => Number(b.status === 'locked') - Number(a.status === 'locked') || b.id - a.id)
        .map((e) => escrowOut(s, e));
    },
    escrowCreate: (token, seller, vet, amount, item) =>
      tx(token, async (s, acc) => escrowOut(s, await opEscrowLock(s, acc, seller, vet, amount, item))),
    escrowVet: (token, id, passed) => tx(token, async (s, acc) => {
      const e = s.escrows.find((x) => x.id === id);
      if (!e) throw new Error('Escrow not found.');
      if (e.vet_id !== acc.id) throw new Error(`Only the veterinarian named in escrow #${e.id} can report the examination.`);
      await opEscrowExpireDue(s);   // deadline passed: the refund wins over a late report
      if (e.refund_reason === 'expired') return escrowOut(s, e);
      if (e.status === 'locked' && !e.accepted_at) throw new Error(`The seller has not accepted escrow #${e.id} yet. You can report once the seller has accepted you as vet.`);
      return escrowOut(s, await opEscrowSettle(s, id, passed, passed, passed ? null : 'vet_failed'));
    }),
    escrowCancel: (token, id) => tx(token, async (s, acc) => {
      const e = s.escrows.find((x) => x.id === id);
      if (!e) throw new Error('Escrow not found.');
      if (e.buyer_id !== acc.id) throw new Error(`Only the buyer can cancel escrow #${e.id}.`);
      await opEscrowExpireDue(s);
      if (e.refund_reason === 'expired') return escrowOut(s, e);
      if (e.status === 'locked' && e.accepted_at) {
        throw new Error(`The seller has accepted escrow #${e.id}, so it can no longer be cancelled. It settles with the vet's report, or refunds you if there is none within ${ESCROW_DAYS} days.`);
      }
      return escrowOut(s, await opEscrowSettle(s, id, false, null, 'cancelled'));
    }),
    escrowAccept: (token, id) => tx(token, async (s, acc) => {
      await opEscrowExpireDue(s);
      const e = s.escrows.find((x) => x.id === id);
      if (e?.refund_reason === 'expired') return escrowOut(s, e);
      return escrowOut(s, opEscrowAccept(s, id, acc.id));
    }),
    async holds(token) {
      const { s, acc } = await auth(token);
      const staff = acc.role === 'admin' || acc.role === 'bank';
      return (s.holds ?? []).filter((h) => staff || h.from_id === acc.id)
        .sort((a, b) => Number(b.status === 'held') - Number(a.status === 'held') || b.id - a.id).slice(0, 50)
        .map((h) => holdOut(s, h, staff));
    },
    holdDecide: (token, id, release, freeze = false) => staffTx(token, async (s, acc) => {
      if (freeze && acc.role !== 'admin') throw new Error('Only the treasury can freeze a wallet.');
      if (freeze && release) throw new Error('A payment cannot be released while freezing its sender.');
      const h = opHoldDecide(s, id, acc.id, release);
      const t = await append(s, release ? 'release' : 'refund', holdWallet(s).id, release ? h.to_id : h.from_id, h.amount, 0,
        `Payment #${h.id} ${release ? 'released after compliance review' : 'returned to sender after compliance review'}`);
      h.settle_block = t.block;
      if (freeze) { opFreeze(s, h.from_id, acc.id, `Held payment #${h.id}: ${h.reason}`); h.sender_frozen = true; }
      return holdOut(s, h, true);
    }),
    freeze: (token, id, reason) => staffTx(token, async (s, acc) => {
      if (acc.role !== 'admin') throw new Error('Only the treasury can freeze a wallet.');
      return publicAccount(s, opFreeze(s, id, acc.id, reason));
    }),
    unfreeze: (token, id) => staffTx(token, async (s, acc) => {
      if (acc.role !== 'admin') throw new Error('Only the treasury can lift a freeze.');
      const a = byId(s, id);
      if (!a?.frozen_at) throw new Error('This wallet is not frozen.');
      Object.assign(a, { frozen_at: null, frozen_by: null, frozen_reason: null });
      return publicAccount(s, a);
    }),
    async frozen(token) {
      const { s, acc } = await auth(token);
      if (acc.role !== 'admin' && acc.role !== 'bank') throw new Error('Only the partner bank and the treasury see frozen wallets.');
      return s.accounts.filter((a) => a.frozen_at).sort((a, b) => b.frozen_at!.localeCompare(a.frozen_at!))
        .map((a): FrozenWallet => ({ id: a.id, display_name: a.display_name, role: a.role, country: a.country, pc: a.pc,
          frozen_at: a.frozen_at!, frozen_reason: a.frozen_reason ?? '', frozen_by_name: byId(s, a.frozen_by ?? null)?.display_name ?? null }));
    },
    escrowDecline: (token, id) => tx(token, async (s, acc) => {
      await opEscrowExpireDue(s);
      const e = s.escrows.find((x) => x.id === id);
      if (!e) throw new Error('Escrow not found.');
      if (e.seller_id !== acc.id) throw new Error(`Only the seller named in escrow #${e.id} can decline it.`);
      if (e.refund_reason === 'expired') return escrowOut(s, e);
      if (e.status === 'locked' && e.accepted_at) throw new Error(`You have already accepted escrow #${e.id}. It now settles with the vet's report.`);
      return escrowOut(s, await opEscrowSettle(s, id, false, null, 'declined'));
    }),
    async requests(token) {
      const { s, acc } = await auth(token);
      return s.requests.filter((r) => r.requester_id === acc.id || r.payer_id === acc.id)
        .sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open') || b.id - a.id)
        .slice(0, 50).map((r) => requestOut(s, r));
    },
    requestCreate: (token, payer, amount, memo) => tx(token, async (s, acc) => {
      const amt = checkAmount(amount);
      if (payer === acc.id) throw new Error('You cannot request money from yourself.');
      const p = byId(s, payer);
      if (!p || p.kyc !== 'verified' || p.role === 'contract') throw new Error('Payer not found or not verified.');
      if (s.requests.filter((r) => r.requester_id === acc.id && r.status === 'open').length >= 20) throw new Error('Demo limit: max. 20 open requests.');
      const r: StoredRequest = { id: s.requests.length + 1, requester_id: acc.id, payer_id: payer, amount: amt,
        memo: memo.trim().slice(0, 120) || null, status: 'open', created_at: now(), settled_at: null, block: null };
      s.requests.push(r);
      return requestOut(s, r);
    }),
    requestPay: (token, id) => tx(token, async (s, acc) => {
      const r = s.requests.find((x) => x.id === id);
      if (!r) throw new Error('Request not found.');
      if (r.payer_id !== acc.id) throw new Error('This request is addressed to someone else.');
      if (r.status !== 'open') throw new Error(`This request is already ${r.status}.`);
      const t = await opTransfer(s, acc, r.requester_id, r.amount, r.memo ?? `Payment request #${r.id}`);
      Object.assign(r, { status: 'paid', settled_at: now(), block: t.block });
      return requestOut(s, r);
    }),
    async requestDecline(token, id) {
      await delay();
      const { s, acc } = await auth(token);
      const r = s.requests.find((x) => x.id === id);
      if (!r) throw new Error('Request not found.');
      if (r.payer_id !== acc.id && r.requester_id !== acc.id) throw new Error('This request is not yours.');
      if (r.status !== 'open') throw new Error(`This request is already ${r.status}.`);
      Object.assign(r, { status: 'declined', settled_at: now() });
      save(s);
      return requestOut(s, r);
    },
    async bonuses(token) {
      const { s, acc } = await auth(token);
      const all = acc.role === 'bank' || acc.role === 'admin';
      return s.bonuses.filter((b) => all || [b.patron_id, b.player_id, b.organizer_id].includes(acc.id))
        .sort((a, b) => Number(b.status === 'locked') - Number(a.status === 'locked') || b.id - a.id)
        .map((b) => bonusOut(s, b));
    },
    bonusCreate: (token, player, organizer, amount, match) =>
      tx(token, async (s, acc) => bonusOut(s, await opBonusLock(s, acc, player, organizer, amount, match))),
    bonusResult: (token, id, won) => tx(token, async (s, acc) => {
      const b = s.bonuses.find((x) => x.id === id);
      if (!b) throw new Error('Win bonus not found.');
      if (b.organizer_id !== acc.id) throw new Error(`Only the organiser named in win bonus #${b.id} can record the result.`);
      return bonusOut(s, await opBonusSettle(s, id, won, won));
    }),
    bonusCancel: (token, id) => tx(token, async (s, acc) => {
      const b = s.bonuses.find((x) => x.id === id);
      if (!b) throw new Error('Win bonus not found.');
      if (b.patron_id !== acc.id) throw new Error(`Only the patron can cancel win bonus #${b.id}.`);
      return bonusOut(s, await opBonusSettle(s, id, false, null));
    }),
    async standings(token) {
      const { s, acc } = await auth(token);
      return s.standing.filter((o) => o.payer_id === acc.id || o.payee_id === acc.id)
        .sort((a, b) => Number(b.active) - Number(a.active) || b.id - a.id).map((o) => standingOut(s, o));
    },
    standingCreate: (token, payee, amount, memo, every) => tx(token, async (s, acc) => {
      const amt = checkAmount(amount);
      if (every !== 'week' && every !== 'month') throw new Error('Choose weekly or monthly.');
      if (payee === acc.id) throw new Error('You cannot pay yourself.');
      const p = byId(s, payee);
      if (!p || p.kyc !== 'verified' || p.role === 'contract') throw new Error('Recipient not found or not verified.');
      if (s.standing.filter((o) => o.payer_id === acc.id && o.active).length >= 10) throw new Error('Demo limit: max. 10 active standing orders.');
      const o: StoredStanding = { id: s.standing.length + 1, payer_id: acc.id, payee_id: payee, amount: amt,
        memo: memo.trim().slice(0, 120) || null, every, next_due: now(), active: true, runs: 0, created_at: now(), last_block: null };
      s.standing.push(o);
      await opStandingRun(s, o.id);
      return standingOut(s, o);
    }),
    standingPay: (token, id) => tx(token, async (s, acc) => {
      const o = s.standing.find((x) => x.id === id);
      if (!o || o.payer_id !== acc.id) throw new Error('Standing order not found.');
      await opStandingRun(s, id);
      return standingOut(s, o);
    }),
    async standingCancel(token, id) {
      await delay();
      const { s, acc } = await auth(token);
      const o = s.standing.find((x) => x.id === id);
      if (!o || o.payer_id !== acc.id) throw new Error('Standing order not found.');
      o.active = false;
      save(s);
      return standingOut(s, o);
    },
    async standingRunDue(token) {
      const { s, acc } = await auth(token);
      let n = 0;
      for (const o of s.standing.filter((x) => x.payer_id === acc.id && x.active && x.next_due <= now()).slice(0, 12)) {
        const backup = JSON.stringify(s);
        try { await opStandingRun(s, o.id); n++; } catch { Object.assign(s, JSON.parse(backup)); }
      }
      if (n) save(s);
      return n;
    },
  };
}
