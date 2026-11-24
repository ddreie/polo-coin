import { createClient } from '@supabase/supabase-js';
import type { Account, Api, Applicant, Escrow, Party, PayRequest, Stats, Tx } from './types';

/** Calls the api_* Postgres functions defined in supabase/setup.sql. */
export function createSupabaseApi(url: string, key: string): Api {
  const db = createClient(url, key, { auth: { persistSession: false } });

  async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(cleanError(error.message));
    return data as T;
  }

  return {
    mode: 'supabase',
    login: (u, p) => rpc('api_login', { p_username: u, p_password: p }),
    register: (f) => rpc('api_register', {
      p_username: f.username, p_password: f.password, p_display_name: f.display_name,
      p_role: f.role, p_org: f.org, p_country: f.country,
    }),
    logout: (t) => rpc('api_logout', { p_token: t }),
    me: (t) => rpc<Account>('api_me', { p_token: t }).then(num),
    directory: (t) => rpc<Party[]>('api_directory', { p_token: t }),
    buy: (t, a) => rpc<Tx>('api_buy', { p_token: t, p_amount: a }).then(num),
    transfer: (t, to, a, memo) =>
      rpc<Tx>('api_transfer', { p_token: t, p_to: to, p_amount: a, p_memo: memo }).then(num),
    redeem: (t, a) => rpc<Tx>('api_redeem', { p_token: t, p_amount: a }).then(num),
    transactions: (t, limit = 50) =>
      rpc<Tx[]>('api_transactions', { p_token: t, p_limit: limit }).then((r) => r.map(num)),
    explorer: (limit = 25) => rpc<Tx[]>('api_explorer', { p_limit: limit }).then((r) => r.map(num)),
    stats: () => rpc<Stats>('api_stats').then(num),
    reset: (t) => rpc('api_reset', { p_token: t }),
    kycQueue: (t) => rpc<Applicant[]>('api_kyc_queue', { p_token: t }),
    kycDecide: (t, id, ok) => rpc<Account>('api_kyc_decide', { p_token: t, p_account: id, p_approve: ok }).then(num),
    escrows: (t) => rpc<Escrow[]>('api_escrows', { p_token: t }).then((r) => r.map(num)),
    escrowCreate: (t, seller, vet, amount, item) =>
      rpc<Escrow>('api_escrow_create', { p_token: t, p_seller: seller, p_vet: vet, p_amount: amount, p_item: item }).then(num),
    escrowVet: (t, id, passed) => rpc<Escrow>('api_escrow_vet', { p_token: t, p_escrow: id, p_passed: passed }).then(num),
    escrowCancel: (t, id) => rpc<Escrow>('api_escrow_cancel', { p_token: t, p_escrow: id }).then(num),
    requests: (t) => rpc<PayRequest[]>('api_requests', { p_token: t }).then((r) => r.map(num)),
    requestCreate: (t, payer, amount, memo) =>
      rpc<PayRequest>('api_request_create', { p_token: t, p_payer: payer, p_amount: amount, p_memo: memo }).then(num),
    requestPay: (t, id) => rpc<PayRequest>('api_request_pay', { p_token: t, p_request: id }).then(num),
    requestDecline: (t, id) => rpc<PayRequest>('api_request_decline', { p_token: t, p_request: id }).then(num),
  };
}

/** Postgres numerics arrive as numbers or strings; normalise the money fields. */
function num<T>(o: T): T {
  const r = { ...o } as Record<string, unknown>;
  for (const k of ['usd', 'pc', 'amount', 'fee', 'reserve_usd', 'supply_pc', 'volume_pc', 'fees_pc', 'fees_usd',
    'minted_pc', 'redeemed_pc', 'escrow_pc', 'escrows_open', 'escrows_done', 'wallets',
    'fee_rate', 'bank_share', 'reserve_yield', 'cash_share', 'tx_count']) {
    if (k in r && r[k] !== null) r[k] = Number(r[k]);
  }
  return r as T;
}

function cleanError(msg: string) {
  if (/fetch|network/i.test(msg)) return 'Cannot reach the server. Check your connection and try again.';
  return msg;
}
