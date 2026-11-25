import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, type Account, type Bonus, type Escrow, type Hold, type Party, type PayRequest, type StandingOrder, type Stats, type Tx } from './api';
import { toast } from './components/Toast';
import { useSession } from './session';

/** Everything the wallet pages show, loaded once and refreshed every few seconds
 *  (so payments made in another window or by another role appear by themselves). */
interface Wallet {
  token: string;
  account: Account;
  txs: Tx[];
  parties: Party[];
  stats: Stats | null;
  escrows: Escrow[];
  requests: PayRequest[];
  bonuses: Bonus[];
  standings: StandingOrder[];
  /** Transfers held by transaction monitoring: all of them for reviewers, the own ones for senders. */
  holds: Hold[];
  /** Reload everything; call after an action. Briefly highlights the balance. */
  refresh: (highlight?: boolean) => Promise<void>;
  flash: boolean;
}

const Ctx = createContext<Wallet | null>(null);

export function WalletProvider({ token, account, children }: { token: string; account: Account; children: ReactNode }) {
  const { setAccount, logout } = useSession();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [requests, setRequests] = useState<PayRequest[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [standings, setStandings] = useState<StandingOrder[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [flash, setFlash] = useState(false);
  const lastKyc = useRef(account.kyc);
  const seenIn = useRef<number | null>(null);

  const refresh = useCallback(async (highlight = false) => {
    try {
      // Standing orders that have fallen due are paid whenever the payer's wallet is open.
      const ran = await api.standingRunDue(token).catch(() => 0);
      if (ran > 0) toast.ok(`${ran} standing order${ran > 1 ? 's' : ''} paid`, 'Instalments that had fallen due were paid automatically.');
      const [me, list, st, es, rq, dir, bo, so, ho] = await Promise.all([
        api.me(token), api.transactions(token, 200), api.stats(), api.escrows(token), api.requests(token), api.directory(token),
        api.bonuses(token), api.standings(token), api.holds(token).catch(() => [] as Hold[]),
      ]);
      setAccount(me); setTxs(list); setStats(st); setEscrows(es); setRequests(rq); setParties(dir); setBonuses(bo); setStandings(so);
      setHolds(ho);
      // Announce incoming money that arrived while the page was open.
      const incoming = list.find((t) => t.to_id === me.id && (t.kind === 'transfer' || t.kind === 'release' || t.kind === 'refund'));
      if (seenIn.current !== null && incoming && incoming.block > seenIn.current && !highlight) {
        toast.ok(`Payment received: PC ${incoming.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          incoming.from_name ? `From ${incoming.from_name}${incoming.memo ? ` – ${incoming.memo}` : ''}` : incoming.memo ?? undefined);
        highlight = true;
      }
      seenIn.current = Math.max(seenIn.current ?? 0, ...list.map((t) => t.block));
      if (highlight) { setFlash(true); setTimeout(() => setFlash(false), 1200); }
    } catch (e) {
      if (/session/i.test((e as Error).message)) logout('/login');
    }
  }, [token, setAccount, logout]);

  useEffect(() => {
    refresh();
    const id = setInterval(() => refresh(), 6000);
    return () => clearInterval(id);
  }, [refresh]);

  // Tell a pending user when the reviewer has decided.
  useEffect(() => {
    if (lastKyc.current === 'pending' && account.kyc === 'verified') {
      toast.ok('Identity verified', `${account.kyc_by_name ?? 'The reviewer'} verified your account. You can now use Polo Coin.`);
    } else if (lastKyc.current === 'pending' && account.kyc === 'rejected') {
      toast.error('Application rejected', 'Your identity could not be verified.');
    }
    lastKyc.current = account.kyc;
  }, [account.kyc, account.kyc_by_name]);

  const value = useMemo(() => ({ token, account, txs, parties, stats, escrows, requests, bonuses, standings, holds, refresh, flash }),
    [token, account, txs, parties, stats, escrows, requests, bonuses, standings, holds, refresh, flash]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const w = useContext(Ctx);
  if (!w) throw new Error('useWallet must be used inside <WalletProvider>');
  return w;
}

/** Things waiting for this account: requests to pay, escrows to examine, KYC to review. */
export function useTodos() {
  const { account, escrows, requests, bonuses, holds } = useWallet();
  const toPay = requests.filter((r) => r.status === 'open' && r.payer_id === account.id);
  // The vet can only report once the seller has accepted the escrow and the vet.
  const toExamine = escrows.filter((e) => e.status === 'locked' && e.accepted_at && e.vet_id === account.id);
  const toAccept = escrows.filter((e) => e.status === 'locked' && !e.accepted_at && e.seller_id === account.id);
  const toDecide = bonuses.filter((b) => b.status === 'locked' && b.organizer_id === account.id);
  const waiting = escrows.filter((e) => e.status === 'locked' && !toAccept.includes(e)
    && (e.buyer_id === account.id || e.seller_id === account.id));
  const bonusWaiting = bonuses.filter((b) => b.status === 'locked' && (b.patron_id === account.id || b.player_id === account.id));
  const staff = account.role === 'admin' || account.role === 'bank';
  // Reviewers: held payments to release or return. Senders: their own payments under review.
  const toReview = staff ? holds.filter((h) => h.status === 'held') : [];
  const heldMine = staff ? [] : holds.filter((h) => h.status === 'held' && h.from_id === account.id);
  return { toPay, toExamine, toAccept, toDecide, waiting, bonusWaiting, toReview, heldMine,
    count: toPay.length + toExamine.length + toAccept.length + toDecide.length + toReview.length };
}
