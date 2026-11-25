import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Account, type FrozenWallet, type Hold, type HoldRule } from '../api';
import { toast } from './Toast';
import { money, roleLabel, shortHash, timeAgo } from '../format';
import { useWallet } from '../wallet';

const RULE_LABEL: Record<HoldRule, string> = {
  large: 'Unusually large',
  passthrough: 'Pass-through',
  split: 'Split payments',
};

/** Transaction monitoring for the partner bank and the treasury: held payments and frozen wallets. */
export function MonitoringReview({ token, account }: { token: string; account: Account }) {
  const { holds, refresh } = useWallet();
  const [busy, setBusy] = useState<number | null>(null);
  const isTreasury = account.role === 'admin';
  const open = holds.filter((h) => h.status === 'held');
  const done = holds.filter((h) => h.status !== 'held');

  async function decide(h: Hold, release: boolean, freeze = false) {
    setBusy(h.id);
    try {
      await api.holdDecide(token, h.id, release, freeze);
      if (release) toast.ok(`Payment #${h.id} released`, `PC ${money(h.amount)} went to ${h.to_name}.`);
      else toast.ok(`Payment #${h.id} returned`, `PC ${money(h.amount)} went back to ${h.from_name}${freeze ? ', and the wallet is now frozen' : ''}.`);
      await refresh(true);
    } catch (e) {
      toast.error('Review failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel monitoring" aria-label="Transaction monitoring">
      <div className="panel-head">
        <h2>Transaction monitoring{open.length > 0 && <span className="count">{open.length}</span>}</h2>
      </div>
      <p className="muted kyc-scope">
        Almost every payment settles in seconds. Only payments that match a risk pattern are held here until
        {isTreasury ? ' you or the partner bank release' : ' you or the treasury release'} them or send them back.
        The sender only sees that a routine check is running, not why.
      </p>
      <ul className="aml-rules">
        <li><strong>Unusually large:</strong> above PC 50,000 and more than 3× the sender’s largest earlier payment.</li>
        <li><strong>Pass-through:</strong> the sender forwards at least 80% of what it received from others in the last 24 hours (from PC 10,000).</li>
        <li><strong>Split payments:</strong> several payments to one recipient within 24 hours that together pass PC 50,000.</li>
      </ul>

      {open.length === 0 ? <p className="empty">No payments waiting for review.</p> : (
        <ul className="applicants">
          {open.map((h) => (
            <li key={h.id} className="applicant hold">
              <div className="applicant-text">
                <span className="badge badge-warn">{h.rule ? RULE_LABEL[h.rule] : 'Held'}</span>
                <strong>Payment #{h.id}: PC {money(h.amount)}</strong>
                <span>{h.from_name} to {h.to_name}{h.memo ? `, “${h.memo}”` : ''}</span>
                <small>{h.reason}</small>
                <small>Sender: customer since {timeAgo(h.from_since)}, {h.from_payments} earlier payments · held {timeAgo(h.created_at)}
                  {h.lock_hash && <> · tx <code>{shortHash(h.lock_hash)}</code></>}</small>
              </div>
              <div className="applicant-actions">
                <button className="btn btn-small" disabled={busy !== null} onClick={() => decide(h, true)}>{busy === h.id ? 'Saving…' : 'Release'}</button>
                <button className="btn btn-small btn-ghost" disabled={busy !== null} onClick={() => decide(h, false)}>Return to sender</button>
                {isTreasury && !h.from_frozen && (
                  <button className="btn btn-small btn-danger" disabled={busy !== null} onClick={() => decide(h, false, true)}>Return and freeze sender</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="decided">
          <summary>Recent decisions ({done.length})</summary>
          <ul>
            {done.map((h) => (
              <li key={h.id}>
                <span>#{h.id} · PC {money(h.amount)}, {h.from_name} to {h.to_name}</span>
                <span>{h.status === 'released' ? 'Released' : 'Returned'}{h.sender_frozen ? ', sender frozen' : ''} by {h.decided_by_name}, {h.decided_at ? timeAgo(h.decided_at) : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <FrozenWallets token={token} account={account} />
    </section>
  );
}

function FrozenWallets({ token, account }: { token: string; account: Account }) {
  const { parties, refresh } = useWallet();
  const [list, setList] = useState<FrozenWallet[] | null>(null);
  const [who, setWho] = useState<number | ''>('');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const isTreasury = account.role === 'admin';
  const load = useCallback(() => api.frozen(token).then(setList).catch(() => undefined), [token]);
  useEffect(() => { load(); const id = setInterval(load, 6000); return () => clearInterval(id); }, [load]);
  const candidates = useMemo(() => parties.filter((p) => !['bank', 'admin'].includes(p.role)), [parties]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.ok(ok); setWho(''); setWhy(''); await load(); await refresh(); }
    catch (e) { toast.error('Not possible', (e as Error).message); }
    finally { setBusy(false); }
  }
  function freeze(e: FormEvent) {
    e.preventDefault();
    const p = candidates.find((c) => c.id === who);
    if (p) act(() => api.freeze(token, p.id, why), `${p.display_name} frozen`);
  }

  return (
    <div className="frozen">
      <h3>Frozen wallets</h3>
      {list === null ? <p className="muted">Loading…</p> : list.length === 0 ? <p className="muted">No wallet is frozen.</p> : (
        <ul>
          {list.map((f) => (
            <li key={f.id}>
              <div><strong>{f.display_name}</strong> <span className="muted">{roleLabel[f.role]}, {f.country}, PC {money(f.pc)}</span>
                <small>{f.frozen_reason} · by {f.frozen_by_name}, {timeAgo(f.frozen_at)}</small></div>
              {isTreasury && <button className="btn btn-small btn-ghost" disabled={busy}
                onClick={() => act(() => api.unfreeze(token, f.id), `${f.display_name} unfrozen`)}>Lift freeze</button>}
            </li>
          ))}
        </ul>
      )}
      {isTreasury ? (
        <form className="freeze-form" onSubmit={freeze}>
          <select value={who} onChange={(e) => setWho(Number(e.target.value) || '')} aria-label="Wallet to freeze">
            <option value="">Freeze a wallet…</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{p.display_name} ({roleLabel[p.role]})</option>)}
          </select>
          <input value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} placeholder="Internal reason, e.g. report from a correspondent bank" aria-label="Reason" />
          <button className="btn btn-small btn-danger" disabled={busy || who === '' || why.trim().length < 5}>Freeze</button>
        </form>
      ) : <p className="muted small">Only the treasury can freeze or unfreeze wallets. Ask them if you see a reason.</p>}
    </div>
  );
}
