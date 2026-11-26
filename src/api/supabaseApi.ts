import { createClient } from '@supabase/supabase-js';
import type { Account, Api, Applicant, Bonus, Escrow, FrozenWallet, Hold, Party, PayRequest, StandingOrder, Stats, Tx } from './types';

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
      ...(f.role === 'vet' ? { p_licence_no: f.licence_no ?? '', p_licence_authority: f.licence_authority ?? '',
        p_insurer: f.insurer ?? '', p_independent: !!f.independent } : {}),
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
    escrowAccept: (t, id) => rpc<Escrow>('api_escrow_accept', { p_token: t, p_escrow: id }).then(num),
    escrowDecline: (t, id) => rpc<Escrow>('api_escrow_decline', { p_token: t, p_escrow: id }).then(num),
    holds: (t) => rpc<Hold[]>('api_holds', { p_token: t }).then((l) => l.map(num)),
    holdDecide: (t, id, release, freeze = false) => rpc<Hold>('api_hold_decide', { p_token: t, p_hold: id, p_release: release, p_freeze: freeze }).then(num),
    freeze: (t, id, reason) => rpc<Account>('api_freeze', { p_token: t, p_account: id, p_reason: reason }).then(num),
    unfreeze: (t, id) => rpc<Account>('api_unfreeze', { p_token: t, p_account: id }).then(num),
    frozen: (t) => rpc<FrozenWallet[]>('api_frozen', { p_token: t }).then((l) => l.map(num)),
    requests: (t) => rpc<PayRequest[]>('api_requests', { p_token: t }).then((r) => r.map(num)),
    requestCreate: (t, payer, amount, memo) =>
      rpc<PayRequest>('api_request_create', { p_token: t, p_payer: payer, p_amount: amount, p_memo: memo }).then(num),
    requestPay: (t, id) => rpc<PayRequest>('api_request_pay', { p_token: t, p_request: id }).then(num),
    requestDecline: (t, id) => rpc<PayRequest>('api_request_decline', { p_token: t, p_request: id }).then(num),
    bonuses: (t) => rpc<Bonus[]>('api_bonuses', { p_token: t }).then((r) => r.map(num)),
    bonusCreate: (t, player, organizer, amount, match) =>
      rpc<Bonus>('api_bonus_create', { p_token: t, p_player: player, p_organizer: organizer, p_amount: amount, p_match: match }).then(num),
    bonusResult: (t, id, won) => rpc<Bonus>('api_bonus_result', { p_token: t, p_bonus: id, p_won: won }).then(num),
    bonusCancel: (t, id) => rpc<Bonus>('api_bonus_cancel', { p_token: t, p_bonus: id }).then(num),
    bonusKeep: (t, id) => rpc<Bonus>('api_bonus_keep', { p_token: t, p_bonus: id }).then(num),
    standings: (t) => rpc<StandingOrder[]>('api_standings', { p_token: t }).then((r) => r.map(num)),
    standingCreate: (t, payee, amount, memo, every) =>
      rpc<StandingOrder>('api_standing_create', { p_token: t, p_payee: payee, p_amount: amount, p_memo: memo, p_every: every }).then(num),
    standingPay: (t, id) => rpc<StandingOrder>('api_standing_pay', { p_token: t, p_order: id }).then(num),
    standingCancel: (t, id) => rpc<StandingOrder>('api_standing_cancel', { p_token: t, p_order: id }).then(num),
    standingRunDue: (t) => rpc<number>('api_standing_run_due', { p_token: t }),
  };
}

/** Postgres numerics arrive as numbers or strings; normalise the money fields. */
function num<T>(o: T): T {
  const r = { ...o } as Record<string, unknown>;
  for (const k of ['usd', 'pc', 'amount', 'fee', 'reserve_usd', 'supply_pc', 'volume_pc', 'fees_pc', 'fees_usd',
    'minted_pc', 'redeemed_pc', 'escrow_pc', 'escrows_open', 'escrows_done', 'bonuses_open', 'wallets',
    'fee_rate', 'bank_share', 'reserve_yield', 'cash_share', 'tx_count']) {
    if (k in r && r[k] !== null) r[k] = Number(r[k]);
  }
  return r as T;
}

function cleanError(msg: string) {
  if (/fetch|network/i.test(msg)) return 'Cannot reach the server. Check your connection and try again.';
  return msg;
}
