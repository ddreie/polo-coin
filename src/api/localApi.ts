import type { Account, Api, Party, Stats, Tx } from './types';

/**
 * In-browser implementation of the same rules as supabase/setup.sql.
 * Used for offline development (`npm run dev:demo`) and as a fallback build.
 * Data lives in localStorage of the current browser.
 */
const KEY = 'polo-coin-demo-v1';
const FEE_RATE = 0.01;
const BANK_SHARE = 0.5;
const RESERVE_YIELD = 0.04;

interface State {
  accounts: (Account & { password: string })[];
  sessions: Record<string, number>;
  reserve: number;
  ledger: Tx[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function seed(): Promise<State> {
  const mk = async (id: number, username: string, display_name: string, role: Account['role'],
    org: string, country: string, usd: number) => ({
    id, username, display_name, role, org, country, usd, pc: 0, kyc: 'verified', password: 'polo2026',
    wallet: '0x' + (await sha256(username)).slice(0, 40),
  });
  const s: State = {
    accounts: [
      await mk(1, 'patron', 'James Whitfield', 'patron', 'Team Blue Oak', 'United Kingdom', 250000),
      await mk(2, 'pro', 'Facundo Ríos', 'pro', '7-goal professional', 'Argentina', 0),
      await mk(3, 'breeder', 'Estancia La Aurora', 'breeder', 'Polo pony breeder', 'Argentina', 0),
      await mk(4, 'bank', 'Banco Pampa Sur', 'bank', 'Partner bank (fictional)', 'Argentina', 0),
      await mk(5, 'admin', 'Polo Coin Treasury', 'admin', 'Issuer & reserve manager', 'Switzerland', 0),
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
  const prev = s.ledger.length ? s.ledger[s.ledger.length - 1].tx_hash : '0'.repeat(64);
  const created_at = new Date().toISOString();
  const tx: Tx = {
    block: s.ledger.length + 1,
    tx_hash: '0x' + (await sha256([prev, kind, from, to, amount, fee, memo, created_at].join('|'))),
    prev_hash: prev, kind, from_id: from, to_id: to, amount, fee, memo, created_at,
    from_wallet: null, to_wallet: null,
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

function publicAccount(a: State['accounts'][number]): Account {
  const { password: _pw, ...rest } = a;
  return rest;
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
      return { token, account: publicAccount(a) };
    },
    async logout(token) {
      const s = await load();
      delete s.sessions[token];
      save(s);
    },
    async me(token) {
      return publicAccount((await auth(token)).acc);
    },
    async directory(token) {
      const { s } = await auth(token);
      return s.accounts.map(({ id, display_name, role, org, country, wallet }): Party =>
        ({ id, display_name, role, org, country, wallet }));
    },
    async buy(token, amount) {
      await delay();
      const { s, acc } = await auth(token);
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
      const { s, acc } = await auth(token);
      const amt = checkAmount(amount);
      if (to === acc.id) throw new Error('You cannot send PC to yourself.');
      const rec = s.accounts.find((a) => a.id === to);
      if (!rec) throw new Error('Recipient not found.');
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
      const { s, acc } = await auth(token);
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
  };
}
