export type Role = 'patron' | 'pro' | 'breeder' | 'groom' | 'vet' | 'organizer' | 'bank' | 'admin' | 'contract';
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
  /** Vets only: checked by the treasury before the vet can be chosen for an escrow. */
  licence_no?: string | null;
  licence_authority?: string | null;
  insurer?: string | null;
  usd: number;
  pc: number;
}

/** A vet's public track record, computed from the escrows the vet was named in. */
export interface VetStats {
  reports: number;   // examinations reported
  passed: number;
  failed: number;
  missed: number;    // accepted escrows refunded because the vet did not report within 14 days
  open: number;      // accepted escrows waiting for the report
  volume: number;    // PC value of the reported examinations
  verified_at: string | null;
}

export type Party = Pick<Account, 'id' | 'display_name' | 'role' | 'org' | 'country' | 'wallet'>
  & { licence_no?: string | null; licence_authority?: string | null; vet_stats?: VetStats | null };

/** A sign-up as seen by the treasury or the partner bank in the KYC review. */
export interface Applicant extends Party {
  username: string;
  kyc: Kyc;
  created_at: string;
  kyc_at: string | null;
  kyc_by_name: string | null;
  licence_no?: string | null;
  licence_authority?: string | null;
  insurer?: string | null;
  independence_declared_at?: string | null;
}

export interface SignUp {
  username: string;
  password: string;
  display_name: string;
  role: 'patron' | 'pro' | 'breeder' | 'groom' | 'vet';
  org: string;
  country: string;
  /** Vets only. */
  licence_no?: string;
  licence_authority?: string;
  insurer?: string;
  independent?: boolean;
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
  bonuses_open: number;
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
  /** Why a refunded escrow went back to the buyer. */
  refund_reason: 'vet_failed' | 'cancelled' | 'declined' | 'expired' | null;
  /** The seller accepted the escrow and the proposed vet. Before that the vet cannot report. */
  accepted_at: string | null;
  vet_licence: string | null;
  vet_stats: VetStats;
  buyer_id: number; seller_id: number; vet_id: number;
  buyer_name: string; seller_name: string; vet_name: string;
  created_at: string;
  /** Seller acceptance due by then (14 days after locking), after acceptance the vet report (14 days after accepting). */
  expires_at: string;
  settled_at: string | null;
  lock_hash: string | null;
  settle_hash: string | null;
  contract_wallet: string;
}

export type BonusStatus = 'locked' | 'paid' | 'refunded';

export interface Bonus {
  id: number;
  amount: number;
  match: string;
  status: BonusStatus;
  won: boolean | null;
  patron_id: number; player_id: number; organizer_id: number;
  patron_name: string; player_name: string; organizer_name: string;
  created_at: string;
  settled_at: string | null;
  lock_hash: string | null;
  settle_hash: string | null;
}

export interface StandingOrder {
  id: number;
  amount: number;
  memo: string | null;
  every: 'week' | 'month';
  next_due: string;
  active: boolean;
  runs: number;
  created_at: string;
  payer_id: number; payee_id: number;
  payer_name: string; payee_name: string;
  last_hash: string | null;
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
  /** The seller accepts the escrow and the proposed vet, or declines it (refund to the buyer). */
  escrowAccept(token: string, escrow: number): Promise<Escrow>;
  escrowDecline(token: string, escrow: number): Promise<Escrow>;
  /** Payment requests: a payee asks, the payer pays with one click. */
  requests(token: string): Promise<PayRequest[]>;
  requestCreate(token: string, payer: number, amount: number, memo: string): Promise<PayRequest>;
  requestPay(token: string, request: number): Promise<PayRequest>;
  requestDecline(token: string, request: number): Promise<PayRequest>;
  /** Win bonus: patron locks it, the organiser's result settles it. */
  bonuses(token: string): Promise<Bonus[]>;
  bonusCreate(token: string, player: number, organizer: number, amount: number, match: string): Promise<Bonus>;
  bonusResult(token: string, bonus: number, won: boolean): Promise<Bonus>;
  bonusCancel(token: string, bonus: number): Promise<Bonus>;
  /** Standing orders: weekly or monthly payments. The first instalment is paid at once. */
  standings(token: string): Promise<StandingOrder[]>;
  standingCreate(token: string, payee: number, amount: number, memo: string, every: 'week' | 'month'): Promise<StandingOrder>;
  standingPay(token: string, order: number): Promise<StandingOrder>;
  standingCancel(token: string, order: number): Promise<StandingOrder>;
  /** Execute the caller's instalments that are due; returns how many were paid. */
  standingRunDue(token: string): Promise<number>;
}
