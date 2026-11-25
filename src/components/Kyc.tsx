import { useCallback, useEffect, useState } from 'react';
import { api, type Account, type Applicant } from '../api';
import { Avatar } from './Brand';
import { toast } from './Toast';
import { roleLabel, timeAgo } from '../format';

export function KycBadge({ kyc }: { kyc: Account['kyc'] }) {
  const label = kyc === 'verified' ? 'KYC verified' : kyc === 'pending' ? 'KYC pending' : 'KYC rejected';
  return <span className={`kyc-badge kyc-${kyc}`}>{label}</span>;
}

/** Shown instead of the actions while an account has not passed KYC. */
export function KycStatus({ account }: { account: Account }) {
  const isVet = account.role === 'vet';
  const reviewer = account.country === 'Argentina' && !isVet
    ? 'the Polo Coin Treasury or our partner bank Banco Pampa Sur'
    : 'the Polo Coin Treasury';
  if (account.kyc === 'rejected') {
    return (
      <section className="panel kyc-status kyc-status-rejected">
        <h2>Your application was rejected</h2>
        <p>
          {account.kyc_by_name ?? 'The reviewer'} could not verify your identity, so this account cannot buy, send,
          receive or cash out Polo Coin. In a real setup you would be told why and could appeal.
        </p>
      </section>
    );
  }
  return (
    <section className="panel kyc-status">
      <h2>Your identity check is pending</h2>
      <p>
        Thanks for signing up. Before you can use Polo Coin, {reviewer} has to verify who you are. This is required
        by anti-money-laundering rules: every holder of Polo Coin must be identified.
        {isVet && <> As a vet your report decides where escrow money goes, so the Treasury also checks your licence
          ({account.licence_no}), your liability insurance and your declaration of independence.</>}
      </p>
      <ol className="kyc-steps">
        <li className="done"><strong>Account opened</strong><span>Wallet created, not yet active</span></li>
        <li className="now"><strong>{isVet ? 'Identity and licence check' : 'Identity check'}</strong><span>Waiting for review</span></li>
        <li><strong>{isVet ? 'Listed as verified vet' : 'Ready to pay'}</strong>
          <span>{isVet ? 'Buyers and sellers can choose you for an escrow' : 'Buy, send, receive and cash out PC'}</span></li>
      </ol>
      <p className="hint">
        To try it out: open a second window, log in as <code>admin</code>{!isVet && <> (or <code>bank</code> for applicants from
        Argentina)</>} and verify this account. This page updates by itself.
      </p>
    </section>
  );
}

/** What the treasury checks before a vet may report on escrows (simulated: the reviewer ticks each step). */
const VET_CHECKS: [string, string][] = [
  ['identity', 'Identity checked (passport, address)'],
  ['licence', 'Licence found in the issuing register and valid'],
  ['insurance', 'Professional liability insurance confirmed'],
  ['independence', 'Declaration of independence signed'],
];

/** Review list for the treasury (everyone, vets only here) and the partner bank (applicants from Argentina). */
export function KycReview({ token, account }: { token: string; account: Account }) {
  const [list, setList] = useState<Applicant[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // The treasury's licence checklist per vet applicant: all four boxes before "Verify".
  const [checks, setChecks] = useState<Record<number, Record<string, boolean>>>({});
  const tick = (id: number, k: string, v: boolean) => setChecks((c) => ({ ...c, [id]: { ...c[id], [k]: v } }));
  const allChecked = (id: number) => VET_CHECKS.every(([k]) => checks[id]?.[k]);

  const load = useCallback(() => api.kycQueue(token).then(setList).catch(() => undefined), [token]);
  useEffect(() => {
    load();
    const id = setInterval(load, 6000);   // picks up new sign-ups from other windows
    return () => clearInterval(id);
  }, [load]);

  async function decide(a: Applicant, approve: boolean) {
    setBusy(a.id);
    try {
      await api.kycDecide(token, a.id, approve);
      if (approve) toast.ok(`${a.display_name} verified`, 'The wallet is now active and can buy, send, receive and cash out PC.');
      else toast.ok(`${a.display_name} rejected`, 'The account stays blocked and cannot hold Polo Coin.');
      await load();
    } catch (e) {
      toast.error('Review failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pending = list?.filter((a) => a.kyc === 'pending') ?? [];
  const decided = list?.filter((a) => a.kyc !== 'pending') ?? [];

  return (
    <section className="panel kyc-review" aria-label="Identity checks">
      <div className="panel-head">
        <h2>Identity checks (KYC){pending.length > 0 && <span className="count">{pending.length}</span>}</h2>
      </div>
      <p className="muted kyc-scope">
        {account.role === 'admin'
          ? 'As the issuer, the treasury is responsible for identifying every holder of Polo Coin. You review all applicants, and only you check vets, because their report decides where escrow money goes.'
          : 'You review applicants from Argentina on behalf of the treasury, since you know them from the cash-out anyway. Vets are checked by the treasury.'}
      </p>

      {list === null ? <p className="muted">Loading…</p> : pending.length === 0 ? (
        <p className="empty">No open applications. New sign-ups appear here.</p>
      ) : (
        <ul className="applicants">
          {pending.map((a) => (
            <li key={a.id} className={`applicant${a.role === 'vet' ? ' is-vet' : ''}`}>
              <Avatar name={a.display_name} role={a.role} size={40} />
              <div className="applicant-text">
                <strong>{a.display_name}</strong>
                <span>{roleLabel[a.role]}, {a.org !== '—' ? `${a.org}, ` : ''}{a.country}</span>
                <small>Username {a.username}, applied {timeAgo(a.created_at)}</small>
              </div>
              <div className="applicant-actions">
                <button className="btn btn-small" disabled={busy !== null || (a.role === 'vet' && !allChecked(a.id))}
                  title={a.role === 'vet' && !allChecked(a.id) ? 'Tick all four checks first' : undefined} onClick={() => decide(a, true)}>
                  {busy === a.id ? 'Saving…' : 'Verify'}
                </button>
                <button className="btn btn-small btn-ghost" disabled={busy !== null} onClick={() => decide(a, false)}>Reject</button>
              </div>
              {a.role === 'vet' && (
                <div className="vet-check">
                  <dl>
                    <dt>Licence</dt><dd>{a.licence_no}, {a.licence_authority}</dd>
                    <dt>Insurance</dt><dd>{a.insurer}</dd>
                    <dt>Independence</dt><dd>{a.independence_declared_at ? `declared ${timeAgo(a.independence_declared_at)}` : 'not declared'}</dd>
                  </dl>
                  {VET_CHECKS.map(([k, label]) => (
                    <label key={k}>
                      <input type="checkbox" checked={!!checks[a.id]?.[k]} onChange={(e) => tick(a.id, k, e.target.checked)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {decided.length > 0 && (
        <details className="decided">
          <summary>Recent decisions ({decided.length})</summary>
          <ul>
            {decided.map((a) => (
              <li key={a.id}>
                <span>{a.display_name}, {a.country}</span>
                <span><KycBadge kyc={a.kyc} /> by {a.kyc_by_name}, {a.kyc_at ? timeAgo(a.kyc_at) : ''}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
