import type { Account, Api, Applicant, Party, Stats, Tx } from './types';
import { blockHash, GENESIS_PREV, sha256Hex } from '../verify';

/**
 * In-browser implementation of the same rules as supabase/setup.sql.
 * Used for offline development (`npm run dev:demo`) and as a fallback build.
 * Data lives in localStorage of the current browser.
 */
const KEY = 'polo-coin-demo-v3';
const FEE_RATE = 0.01;
const BANK_SHARE = 0.5;
const RESERVE_YIELD = 0.04;

type Stored = Account & { password: string; created_at: string; kyc_by: number | null };

interface State {
  accounts: Stored[];
  sessions: Record<string, number>;
  reserve: number;
  ledger: Tx[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const sha256 = sha256Hex;

async function seed(): Promise<State> {
  const mk = async (id: number, username: string, display_name: string, role: Account['role'],
    org: string, country: string, usd: number, kyc: Account['kyc'] = 'verified', ageMin = 0): Promise<Stored> => ({
    id, username, display_name, role, org, country, usd, pc: 0, kyc, password: 'polo2026',
    wallet: '0x' + (await sha256(username)).slice(0, 40),
    created_at: new Date(Date.now() - ageMin * 60000).toISOString(), kyc_by: null, kyc_at: null,
  });
  const s: State = {
    accounts: [
      await mk(1, 'patron', 'James Whitfield', 'patron', 'Team Blue Oak', 'United Kingdom', 250000),
      await mk(2, 'pro', 'Facundo Ríos', 'pro', '7-goal professional', 'Argentina', 0),
      await mk(3, 'breeder', 'Estancia La Aurora', 'breeder', 'Polo pony breeder', 'Argentina', 0),
      await mk(4, 'bank', 'Banco Pampa Sur', 'bank', 'Partner bank (fictional)', 'Argentina', 0),
      await mk(5, 'admin', 'Polo Coin Treasury', 'admin', 'Issuer & reserve manager', 'Switzerland', 0),
      // Two open sign-up applications, so the KYC review can be shown right away.
      await mk(6, 'charlotte', 'Charlotte Hayes', 'patron', 'Team Hollow Creek', 'United States', 100000, 'pending', 120),
      await mk(7, 'valentina', 'Valentina Arrieta', 'pro', '4-goal professional', 'Argentina', 0, 'pending', 25),
    ],
    sessions: {},
    reserve: 0,
    ledger: [],
  };
  await append(s, 'genesis', null, null, 0, 0, 'Polo Coin genesis block');
  return s;
}

async function append(s: State, kind: Tx['kind'], from: number | null, to: number | null,
  amount: number, fee: number, memo: string | null) {
  const prev = s.ledger.length ? s.ledger[s.ledger.length - 1].tx_hash : GENESIS_PREV;
  const now = Date.now();
  const wallet = (id: number | null) => s.accounts.find((a) => a.id === id)?.wallet ?? null;
  const base = {
    prev_hash: prev, kind, from_wallet: wallet(from), to_wallet: wallet(to), amount, fee,
    memo_hash: await sha256(memo ?? ''), ts_us: now * 1000,
  };
  const tx: Tx = {
    ...base, block: s.ledger.length + 1, tx_hash: await blockHash(base),
    from_id: from, to_id: to, memo, created_at: new Date(now).toISOString(),
  };
  s.ledger.push(tx);
  return tx;
}

function decorate(s: State, tx: Tx): Tx {
  const f = s.accounts.find((a) => a.id === tx.from_id);
  const t = s.accounts.find((a) => a.id === tx.to_id);
  return { ...tx, from_name: f?.display_name ?? null, to_name: t?.display_name ?? null,
    from_wallet: f?.wallet ?? null, to_wallet: t?.wallet ?? null };
}

function publicAccount(s: State, a: Stored): Account {
  const { password: _pw, created_at: _c, kyc_by, ...rest } = a;
  return { ...rest, kyc_by_name: s.accounts.find((x) => x.id === kyc_by)?.display_name ?? null };
}

/** Treasury reviews everyone, the partner bank reviews applicants from Argentina. */
function canReview(r: Stored, a: Stored) {
  return a.role !== 'bank' && a.role !== 'admin' && (r.role === 'admin' || (r.role === 'bank' && a.country === 'Argentina'));
}

export function createLocalApi(): Api {
  let cache: State | null = null;

  async function load(): Promise<State> {
    if (cache) return cache;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return (cache = JSON.parse(raw));
    } catch { /* storage unavailable – keep in memory */ }
    return (cache = await seed());
  }
  function save(s: State) {
    cache = s;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }
  async function auth(token: string) {
    const s = await load();
    const id = s.sessions[token];
    const acc = s.accounts.find((a) => a.id === id);
    if (!acc) throw new Error('Session expired – please log in again.');
    return { s, acc };
  }
  async function authVerified(token: string) {
    const r = await auth(token);
    if (r.acc.kyc === 'pending') throw new Error('Your identity check (KYC) is still pending. You can use Polo Coin once it is verified.');
    if (r.acc.kyc !== 'verified') throw new Error('Your KYC application was rejected. This account cannot use Polo Coin.');
    return r;
  }
  function checkAmount(a: number) {
    if (!Number.isFinite(a) || a <= 0) throw new Error('Amount must be greater than zero.');
    if (a > 1_000_000) throw new Error('Demo limit: max. 1,000,000 per transaction.');
    return round2(a);
  }
  const delay = () => new Promise((r) => setTimeout(r, 120));

  return {
    mode: 'local',
    async login(username, password) {
      await delay();
      const s = await load();
      const a = s.accounts.find((x) => x.username === username.trim().toLowerCase());
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
      const name = f.display_name.trim();
      const country = f.country.trim();
      const org = f.org.trim() || '—';
      if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Username: 3 to 20 characters, only letters, digits and _.');
      if ((f.password ?? '').length < 6) throw new Error('Password: at least 6 characters.');
      if (name.length < 2 || name.length > 60) throw new Error('Please enter your full name (max. 60 characters).');
      if (!['patron', 'pro', 'breeder'].includes(f.role)) throw new Error('Choose patron, professional player or breeder.');
      if (country.length < 2 || country.length > 40 || org.length > 60) throw new Error('Please enter a country (and an organisation of max. 60 characters).');
      if (s.accounts.some((a) => a.username === username)) throw new Error('This username is taken. Please choose another one.');
      if (s.accounts.length >= 200) throw new Error('Demo limit reached. Ask the treasury to reset the demo.');
      const a: Stored = {
        id: Math.max(...s.accounts.map((x) => x.id)) + 1, username, display_name: name, role: f.role, org, country,
        usd: f.role === 'patron' ? 100000 : 0, pc: 0, kyc: 'pending', password: f.password,
        wallet: '0x' + (await sha256(username + ':' + crypto.randomUUID())).slice(0, 40),
        created_at: new Date().toISOString(), kyc_by: null, kyc_at: null,
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
      return s.accounts.filter((a) => a.kyc === 'verified').map(({ id, display_name, role, org, country, wallet }): Party =>
        ({ id, display_name, role, org, country, wallet }));
    },
    async buy(token, amount) {
      await delay();
      const { s, acc } = await authVerified(token);
      const amt = checkAmount(amount);
      if (acc.usd < amt) throw new Error(`Insufficient USD balance (available: ${acc.usd.toFixed(2)}).`);
      acc.usd = round2(acc.usd - amt);
      acc.pc = round2(acc.pc + amt);
      s.reserve = round2(s.reserve + amt);
      const tx = await append(s, 'mint', null, acc.id, amt, 0, 'USD deposited into reserve, PC minted');
      save(s);
      return decorate(s, tx);
    },
    async transfer(token, to, amount, memo) {
      await delay();
      const { s, acc } = await authVerified(token);
      const amt = checkAmount(amount);
      if (to === acc.id) throw new Error('You cannot send PC to yourself.');
      const rec = s.accounts.find((a) => a.id === to);
      if (!rec) throw new Error('Recipient not found.');
      if (rec.kyc !== 'verified') throw new Error('The recipient has not passed KYC yet and cannot receive PC.');
      const fee = round2(amt * FEE_RATE);
      const bankFee = round2(fee * BANK_SHARE);
      if (acc.pc < amt + fee) {
        throw new Error(`Insufficient PC balance: ${(amt + fee).toFixed(2)} needed incl. 1% fee, ${acc.pc.toFixed(2)} available.`);
      }
      const bank = s.accounts.find((a) => a.role === 'bank')!;
      const admin = s.accounts.find((a) => a.role === 'admin')!;
      acc.pc = round2(acc.pc - amt - fee);
      rec.pc = round2(rec.pc + amt);
      bank.pc = round2(bank.pc + bankFee);
      admin.pc = round2(admin.pc + fee - bankFee);
      const tx = await append(s, 'transfer', acc.id, to, amt, fee, memo.trim().slice(0, 120) || null);
      save(s);
      return decorate(s, tx);
    },
    async redeem(token, amount) {
      await delay();
      const { s, acc } = await authVerified(token);
      const amt = checkAmount(amount);
      if (acc.pc < amt) throw new Error(`Insufficient PC balance (available: ${acc.pc.toFixed(2)}).`);
      const bank = s.accounts.find((a) => a.role === 'bank')!;
      acc.pc = round2(acc.pc - amt);
      acc.usd = round2(acc.usd + amt);
      s.reserve = round2(s.reserve - amt);
      const tx = await append(s, 'redeem', acc.id, bank.id, amt, 0, 'PC burned, USD paid out by partner bank');
      save(s);
      return decorate(s, tx);
    },
    async transactions(token, limit = 50) {
      const { s, acc } = await auth(token);
      const all = acc.role === 'bank' || acc.role === 'admin';
      return s.ledger.filter((t) => t.kind !== 'genesis' && (all || t.from_id === acc.id || t.to_id === acc.id))
        .slice(-limit).reverse().map((t) => decorate(s, t));
    },
    async explorer(limit = 25) {
      const s = await load();
      return s.ledger.slice(-limit).reverse().map((t) => {
        const d = decorate(s, t);
        return { ...d, from_name: undefined, to_name: undefined, memo: undefined };
      });
    },
    async stats(): Promise<Stats> {
      const s = await load();
      const sum = (k: Tx['kind'] | null, f: 'amount' | 'fee') =>
        round2(s.ledger.filter((t) => !k || t.kind === k).reduce((x, t) => x + t[f], 0));
      return {
        reserve_usd: s.reserve,
        supply_pc: round2(s.accounts.reduce((x, a) => x + a.pc, 0)),
        tx_count: s.ledger.filter((t) => t.kind !== 'genesis').length,
        volume_pc: sum('transfer', 'amount'),
        fees_pc: sum(null, 'fee'),
        minted_pc: sum('mint', 'amount'),
        redeemed_pc: sum('redeem', 'amount'),
        fee_rate: FEE_RATE,
        bank_share: BANK_SHARE,
        reserve_yield: RESERVE_YIELD,
        chain_valid: s.ledger.every((t, i) => t.prev_hash === (i ? s.ledger[i - 1].tx_hash : '0'.repeat(64))),
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
          kyc_by_name: s.accounts.find((x) => x.id === a.kyc_by)?.display_name ?? null,
        }));
    },
    async kycDecide(token, id, approve) {
      await delay();
      const { s, acc } = await auth(token);
      const a = s.accounts.find((x) => x.id === id);
      if (!a) throw new Error('Applicant not found.');
      if (!canReview(acc, a)) throw new Error('You may not review this applicant. The partner bank reviews applicants from Argentina, the treasury reviews everyone.');
      if (a.kyc !== 'pending') throw new Error(`${a.display_name} has already been ${a.kyc}.`);
      a.kyc = approve ? 'verified' : 'rejected';
      a.kyc_by = acc.id;
      a.kyc_at = new Date().toISOString();
      save(s);
      return publicAccount(s, a);
    },
  };
}
