export type Role = 'patron' | 'pro' | 'breeder' | 'vet' | 'bank' | 'admin' | 'contract';
export type Kyc = 'pending' | 'verified' | 'rejected';

export interface Account {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  org: string;
  country: string;
  wallet: string;
  kyc: Kyc;
  kyc_at?: string | null;
  kyc_by_name?: string | null;
  usd: number;
  pc: number;
}

export type Party = Pick<Account, 'id' | 'display_name' | 'role' | 'org' | 'country' | 'wallet'>;

/** A sign-up as seen by the treasury or the partner bank in the KYC review. */
export interface Applicant extends Party {
  username: string;
  kyc: Kyc;
  created_at: string;
  kyc_at: string | null;
  kyc_by_name: string | null;
}

export interface SignUp {
  username: string;
  password: string;
  display_name: string;
  role: 'patron' | 'pro' | 'breeder';
  org: string;
  country: string;
}

export type TxKind = 'genesis' | 'mint' | 'transfer' | 'redeem' | 'lock' | 'release' | 'refund';

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
  /** Purchase fees collected (USD), shared between treasury and partner bank. */
  fees_usd: number;
  minted_pc: number;
  redeemed_pc: number;
  /** PC currently locked in the escrow contract (part of supply). */
  escrow_pc: number;
  escrows_open: number;
  escrows_done: number;
  wallets: number;
  /** Fee on every purchase of PC. */
  fee_rate: number;
  bank_share: number;
  reserve_yield: number;
  /** Part of the reserve held as USD deposits; the rest is in T-bills. */
  cash_share: number;
  chain_valid: boolean;
}

export type EscrowStatus = 'locked' | 'released' | 'refunded';

export interface Escrow {
  id: number;
  amount: number;
  item: string;
  status: EscrowStatus;
  vet_passed: boolean | null;
  buyer_id: number; seller_id: number; vet_id: number;
  buyer_name: string; seller_name: string; vet_name: string;
  created_at: string;
  settled_at: string | null;
  lock_hash: string | null;
  settle_hash: string | null;
  contract_wallet: string;
}

export type RequestStatus = 'open' | 'paid' | 'declined';

export interface PayRequest {
  id: number;
  amount: number;
  memo: string | null;
  status: RequestStatus;
  requester_id: number; payer_id: number;
  requester_name: string; payer_name: string;
  created_at: string;
  settled_at: string | null;
  tx_hash: string | null;
}

/** Everything the website needs from the backend. Two implementations: Supabase and in-browser. */
export interface Api {
  mode: 'supabase' | 'local';
  login(username: string, password: string): Promise<{ token: string; account: Account }>;
  register(form: SignUp): Promise<{ token: string; account: Account }>;
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
  /** Treasury: all applicants. Partner bank: applicants from Argentina. */
  kycQueue(token: string): Promise<Applicant[]>;
  kycDecide(token: string, account: number, approve: boolean): Promise<Account>;
  /** Escrow for horse purchases: lock PC, the vet's report settles it. */
  escrows(token: string): Promise<Escrow[]>;
  escrowCreate(token: string, seller: number, vet: number, amount: number, item: string): Promise<Escrow>;
  escrowVet(token: string, escrow: number, passed: boolean): Promise<Escrow>;
  escrowCancel(token: string, escrow: number): Promise<Escrow>;
  /** Payment requests: a payee asks, the payer pays with one click. */
  requests(token: string): Promise<PayRequest[]>;
  requestCreate(token: string, payer: number, amount: number, memo: string): Promise<PayRequest>;
  requestPay(token: string, request: number): Promise<PayRequest>;
  requestDecline(token: string, request: number): Promise<PayRequest>;
}
