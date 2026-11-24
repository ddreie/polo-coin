import type { Account, Api, Applicant, Bonus, Escrow, Party, PayRequest, StandingOrder, Stats, Tx } from './types';
import { blockHash, GENESIS_PREV, sha256Hex } from '../verify';

/**
 * In-browser implementation of the same rules as supabase/setup.sql.
 * Used for offline development (`npm run dev:demo`) and as a fallback build.
 * Data lives in localStorage of the current browser. Keep it in sync with the SQL rules.
 */
const KEY = 'polo-coin-demo-v5';
const FEE_RATE = 0.01;      // on every purchase of PC
const BANK_SHARE = 0.5;
const RESERVE_YIELD = 0.042;
const CASH_SHARE = 0.3;

type Stored = Account & { password: string; created_at: string; kyc_by: number | null };
type StoredEscrow = Omit<Escrow, 'buyer_name' | 'seller_name' | 'vet_name' | 'lock_hash' | 'settle_hash' | 'contract_wallet'>
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
  if (acc.pc < amt) throw new Error(`Insufficient PC balance (available: ${acc.pc.toFixed(2)}).`);
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

async function opEscrowLock(s: State, buyer: Stored, seller: number, vet: number, amount: number, item: string) {
  const amt = checkAmount(amount);
  const what = item.trim().slice(0, 80);
  if (what.length < 2) throw new Error("Describe what you are buying, e.g. the horse's name.");
  if (seller === buyer.id) throw new Error('You cannot buy from yourself.');
  const sel = byId(s, seller);
  if (!sel || sel.kyc !== 'verified' || !['patron', 'pro', 'breeder'].includes(sel.role)) {
    throw new Error('The seller must be a verified patron, player or breeder.');
  }
  const v = byId(s, vet);
  if (!v || v.kyc !== 'verified' || v.role !== 'vet') throw new Error('Choose a verified veterinarian for the pre-purchase examination.');
  if (buyer.pc < amt) throw new Error(`Insufficient PC balance (available: ${buyer.pc.toFixed(2)}).`);
  const contract = byRole(s, 'contract');
  const e: StoredEscrow = {
    id: s.escrows.length + 1, amount: amt, item: what, status: 'locked', vet_passed: null,
    buyer_id: buyer.id, seller_id: seller, vet_id: vet, created_at: now(), settled_at: null, lock_block: null, settle_block: null,
  };
  s.escrows.push(e);
  buyer.pc = round2(buyer.pc - amt);
  contract.pc = round2(contract.pc + amt);
  e.lock_block = (await append(s, 'lock', buyer.id, contract.id, amt, 0, `Escrow #${e.id}: ${what}`)).block;
  return e;
}

async function opEscrowSettle(s: State, id: number, release: boolean, vetPassed: boolean | null) {
  const e = s.escrows.find((x) => x.id === id);
  if (!e) throw new Error('Escrow not found.');
  if (e.status !== 'locked') throw new Error(`Escrow #${e.id} is already ${e.status}.`);
  const contract = byRole(s, 'contract');
  const to = byId(s, release ? e.seller_id : e.buyer_id)!;
  contract.pc = round2(contract.pc - e.amount);
  to.pc = round2(to.pc + e.amount);
  const why = release ? ': vet check passed, paid to seller' : vetPassed === false ? ': vet check failed, refunded' : ': cancelled by buyer, refunded';
  const t = await append(s, release ? 'release' : 'refund', contract.id, to.id, e.amount, 0, `Escrow #${e.id}${why}`);
  Object.assign(e, { status: release ? 'released' : 'refunded', vet_passed: vetPassed, settled_at: now(), settle_block: t.block });
  return e;
}

async function opBonusLock(s: State, patron: Stored, player: number, organizer: number, amount: number, match: string) {
  const amt = checkAmount(amount);
  const what = match.trim().slice(0, 80);
  if (what.length < 2) throw new Error('Name the match the bonus is tied to, e.g. the final.');
  if (player === patron.id) throw new Error('You cannot promise a bonus to yourself.');
  const pl = byId(s, player);
  if (!pl || pl.kyc !== 'verified' || !['pro', 'groom'].includes(pl.role)) throw new Error('The bonus must go to a verified player or groom.');
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
      await mk(6, 'vet', 'Dr. Lucía Ferrer', 'vet', 'Equine vet, Pilar (fictional)', 'Argentina', 0),
      await mk(7, 'groom', 'Martín Gómez', 'groom', 'Groom, Team Blue Oak', 'Argentina', 0),
      await mk(8, 'organizer', 'Alpine Polo Events', 'organizer', 'Tournament organiser (fictional)', 'Switzerland', 0),
      await mk(9, 'escrow', 'Polo Coin Escrow Contract', 'contract', 'Smart contract', 'Switzerland', 0),
      // Two open sign-up applications, so the KYC review can be shown right away.
      await mk(10, 'charlotte', 'Charlotte Hayes', 'patron', 'Team Hollow Creek', 'United States', 100000, 'pending', 120),
      await mk(11, 'valentina', 'Valentina Arrieta', 'pro', '4-goal professional', 'Argentina', 0, 'pending', 25),
    ],
    sessions: {}, reserve: 0, ledger: [], escrows: [], requests: [], bonuses: [], standing: [],
  };
  await append(s, 'genesis', null, null, 0, 0, 'Polo Coin genesis block');
  // Starting history, as in polo.seed()
  const [patron, pro] = [s.accounts[0], s.accounts[1]];
  await opBuy(s, patron, 60000);
  await opTransfer(s, patron, pro.id, 12000, 'Tournament fee, Snow Polo St. Moritz');
  await opRedeem(s, pro, 4000);
  await opEscrowLock(s, patron, 3, 6, 18000, 'Mare "La Bonita", 7 years');
  await opBonusLock(s, patron, pro.id, 8, 3000, 'Final, Alpine Polo Cup');
  // The groom's monthly wages: paid once already, next instalment due in a month.
  s.standing.push({ id: 1, payer_id: patron.id, payee_id: 7, amount: 2500, memo: 'Monthly wages', every: 'month',
    next_due: now(), active: true, runs: 0, created_at: now(), last_block: null });
  await opStandingRun(s, 1);
  s.requests.push({ id: 1, requester_id: pro.id, payer_id: patron.id, amount: 9500, memo: 'Tournament fee, Polo Gold Cup Gstaad',
    status: 'open', created_at: now(), settled_at: null, block: null });
  return s;
}

function decorate(s: State, tx: Tx): Tx {
  const f = byId(s, tx.from_id); const t = byId(s, tx.to_id);
  return { ...tx, from_name: f?.display_name ?? null, to_name: t?.display_name ?? null,
    from_wallet: f?.wallet ?? null, to_wallet: t?.wallet ?? null };
}
const hashOf = (s: State, block: number | null) => s.ledger.find((t) => t.block === block)?.tx_hash ?? null;
const name = (s: State, id: number) => byId(s, id)?.display_name ?? '';
function escrowOut(s: State, e: StoredEscrow): Escrow {
  const { lock_block, settle_block, ...rest } = e;
  return { ...rest, buyer_name: name(s, e.buyer_id), seller_name: name(s, e.seller_id), vet_name: name(s, e.vet_id),
    lock_hash: hashOf(s, lock_block), settle_hash: hashOf(s, settle_block), contract_wallet: byRole(s, 'contract').wallet };
}
function requestOut(s: State, r: StoredRequest): PayRequest {
  const { block, ...rest } = r;
  return { ...rest, requester_name: name(s, r.requester_id), payer_name: name(s, r.payer_id), tx_hash: hashOf(s, block) };
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
  const { password: _pw, created_at: _c, kyc_by, ...rest } = a;
  return { ...rest, kyc_by_name: byId(s, kyc_by)?.display_name ?? null };
}
/** Treasury reviews everyone, the partner bank reviews applicants from Argentina. */
function canReview(r: Stored, a: Stored) {
  return !['bank', 'admin', 'vet', 'organizer', 'contract'].includes(a.role) && (r.role === 'admin' || (r.role === 'bank' && a.country === 'Argentina'));
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
    if (r.acc.kyc === 'pending') throw new Error('Your identity check (KYC) is still pending. You can use Polo Coin once it is verified.');
    if (r.acc.kyc !== 'verified') throw new Error('Your KYC application was rejected. This account cannot use Polo Coin.');
    return r;
  }
  const delay = () => new Promise((r) => setTimeout(r, 120));
  /** Run an operation and persist the state only if it succeeded (like a DB transaction). */
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
      if (!['patron', 'pro', 'breeder', 'groom'].includes(f.role)) throw new Error('Choose patron, professional player, breeder or groom.');
      if (country.length < 2 || country.length > 40 || org.length > 60) throw new Error('Please enter a country (and an organisation of max. 60 characters).');
      if (s.accounts.some((a) => a.username === username)) throw new Error('This username is taken. Please choose another one.');
      if (s.accounts.length >= 200) throw new Error('Demo limit reached. Ask the treasury to reset the demo.');
      const a: Stored = {
        id: Math.max(...s.accounts.map((x) => x.id)) + 1, username, display_name: nm, role: f.role, org, country,
        usd: f.role === 'patron' ? 100000 : 0, pc: 0, kyc: 'pending', password: f.password,
        wallet: '0x' + (await sha256(username + ':' + crypto.randomUUID())).slice(0, 40),
        created_at: now(), kyc_by: null, kyc_at: null,
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
      return s.accounts.filter((a) => a.kyc === 'verified' && a.role !== 'contract')
        .map(({ id, display_name, role, org, country, wallet }): Party => ({ id, display_name, role, org, country, wallet }));
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
        }));
    },
    async kycDecide(token, id, approve) {
      await delay();
      const { s, acc } = await auth(token);
      const a = byId(s, id);
      if (!a) throw new Error('Applicant not found.');
      if (!canReview(acc, a)) throw new Error('You may not review this applicant. The partner bank reviews applicants from Argentina, the treasury reviews everyone.');
      if (a.kyc !== 'pending') throw new Error(`${a.display_name} has already been ${a.kyc}.`);
      Object.assign(a, { kyc: approve ? 'verified' : 'rejected', kyc_by: acc.id, kyc_at: now() });
      save(s);
      return publicAccount(s, a);
    },
    async escrows(token) {
      const { s, acc } = await auth(token);
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
      return escrowOut(s, await opEscrowSettle(s, id, passed, passed));
    }),
    escrowCancel: (token, id) => tx(token, async (s, acc) => {
      const e = s.escrows.find((x) => x.id === id);
      if (!e) throw new Error('Escrow not found.');
      if (e.buyer_id !== acc.id) throw new Error(`Only the buyer can cancel escrow #${e.id}.`);
      return escrowOut(s, await opEscrowSettle(s, id, false, null));
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
