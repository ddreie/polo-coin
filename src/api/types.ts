export type Role = 'patron' | 'pro' | 'breeder' | 'bank' | 'admin';

export interface Account {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  org: string;
  country: string;
  wallet: string;
  kyc: string;
  usd: number;
  pc: number;
}

export type Party = Pick<Account, 'id' | 'display_name' | 'role' | 'org' | 'country' | 'wallet'>;

export type TxKind = 'genesis' | 'mint' | 'transfer' | 'redeem';

export interface Tx {
  block: number;
  tx_hash: string;
  prev_hash: string;
  kind: TxKind;
  from_id: number | null;
  to_id: number | null;
  from_name?: string | null;
  to_name?: string | null;
  from_wallet: string | null;
  to_wallet: string | null;
  amount: number;
  fee: number;
  memo?: string | null;
  memo_hash?: string;
  ts_us?: number;
  created_at: string;
}

export interface Stats {
  reserve_usd: number;
  supply_pc: number;
  tx_count: number;
  volume_pc: number;
  fees_pc: number;
  minted_pc: number;
  redeemed_pc: number;
  fee_rate: number;
  bank_share: number;
  reserve_yield: number;
  chain_valid: boolean;
}

/** Everything the website needs from the backend. Two implementations: Supabase and in-browser. */
export interface Api {
  mode: 'supabase' | 'local';
  login(username: string, password: string): Promise<{ token: string; account: Account }>;
  logout(token: string): Promise<void>;
  me(token: string): Promise<Account>;
  directory(token: string): Promise<Party[]>;
  buy(token: string, amount: number): Promise<Tx>;
  transfer(token: string, to: number, amount: number, memo: string): Promise<Tx>;
  redeem(token: string, amount: number): Promise<Tx>;
  transactions(token: string, limit?: number): Promise<Tx[]>;
  explorer(limit?: number): Promise<Tx[]>;
  stats(): Promise<Stats>;
  reset(token: string): Promise<void>;
}
