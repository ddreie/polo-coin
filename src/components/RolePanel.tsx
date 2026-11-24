import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { toast } from './Toast';
import { money, money0, SWIFT } from '../format';
import { useSession } from '../session';
import { useWallet } from '../wallet';

/** Key figures for the logged-in role, next to the to-do list on the overview. */
export default function RolePanel() {
  const { account } = useWallet();
  switch (account.role) {
    case 'patron': return <Patron />;
    case 'pro':
    case 'breeder': return <Receiver />;
    case 'vet': return <Vet />;
    case 'bank': return <Bank />;
    case 'admin': return <Treasury />;
    default: return null;
  }
}

function Figures({ items }: { items: [string, string, string?][] }) {
  return (
    <dl className="figures">
      {items.map(([k, v, note]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd>{note && <span className="fig-note">{note}</span>}</div>
      ))}
    </dl>
  );
}

function Patron() {
  const { account, txs } = useWallet();
  const sent = txs.filter((t) => (t.kind === 'transfer' || t.kind === 'lock') && t.from_id === account.id);
  const vol = sent.reduce((s, t) => s + t.amount, 0);
  const fees = txs.filter((t) => t.kind === 'mint' && t.to_id === account.id).reduce((s, t) => s + t.fee, 0);
  const saved = vol * SWIFT.feeMid - fees;
  return (
    <section className="panel role">
      <h2>Your season so far</h2>
      <Figures items={[
        ['Payments sent', String(sent.length)],
        ['Volume paid', `PC ${money0(vol)}`],
        ['Fees paid (1 % on purchases)', `USD ${money(fees)}`],
        ['Saved vs. bank wire', `USD ${money0(Math.max(0, saved))}`, `Assumes a ${(SWIFT.feeMid * 100).toFixed(1)} % wire cost, the midpoint of 2–5 %`],
      ]} />
    </section>
  );
}

function Receiver() {
  const { account, txs } = useWallet();
  const got = txs.filter((t) => (t.kind === 'transfer' || t.kind === 'release') && t.to_id === account.id);
  const vol = got.reduce((s, t) => s + t.amount, 0);
  const out = txs.filter((t) => t.kind === 'redeem' && t.from_id === account.id).reduce((s, t) => s + t.amount, 0);
  return (
    <section className="panel role">
      <h2>{account.role === 'pro' ? 'Your earnings' : 'Your sales'}</h2>
      <Figures items={[
        ['Payments received', String(got.length)],
        ['Received in total', `PC ${money0(vol)}`, 'Receiving is always free'],
        ['Cashed out in USD', `USD ${money0(out)}`],
        ['Wire days avoided', got.length ? `${got.length * SWIFT.daysLow}–${got.length * SWIFT.daysHigh}` : '0', 'Compared with receiving each payment by bank wire'],
      ]} />
    </section>
  );
}

function Vet() {
  const { account, escrows } = useWallet();
  const mine = escrows.filter((e) => e.vet_id === account.id);
  return (
    <section className="panel role">
      <h2>Examinations</h2>
      <Figures items={[
        ['Waiting for you', String(mine.filter((e) => e.status === 'locked').length)],
        ['Reported', String(mine.filter((e) => e.status !== 'locked').length)],
        ['Value secured', `PC ${money0(mine.reduce((s, e) => s + e.amount, 0))}`, 'Purchase prices you confirmed or are examining'],
      ]} />
      <p className="hint">Your report is the trigger of the smart contract: “passed” pays the seller, “failed” refunds the buyer. <Link to="/app/escrow">Open escrows</Link></p>
    </section>
  );
}

function Bank() {
  const { account, txs, stats } = useWallet();
  const red = txs.filter((t) => t.kind === 'redeem');
  const vol = red.reduce((s, t) => s + t.amount, 0);
  const share = stats?.bank_share ?? 0.5;
  return (
    <section className="panel role">
      <h2>Partner bank desk</h2>
      <Figures items={[
        ['Cash-outs processed', String(red.length)],
        ['USD paid out', `USD ${money0(vol)}`],
        ['Fee income', `USD ${money(account.usd)}`, `${share * 100} % of the 1 % purchase fee, for currency conversion`],
        ['Transactions on the network', String(txs.length)],
      ]} />
      <p className="hint">As a partner bank you see every transaction for AML monitoring and review KYC applications from Argentina.</p>
    </section>
  );
}

function Treasury() {
  const { token, account, stats } = useWallet();
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!stats) return <section className="panel role"><h2>Reserve</h2><p className="muted">Loading…</p></section>;
  const backing = stats.supply_pc ? stats.reserve_usd / stats.supply_pc : 1;
  const tbills = stats.reserve_usd * (1 - stats.cash_share);
  const interest = tbills * stats.reserve_yield;

  async function reset() {
    setBusy(true);
    try {
      await api.reset(token);
      toast.ok('Demo reset', 'All balances and transactions are back to the start. Log in again to continue.');
      logout('/login');
    } catch (e) {
      toast.error('Reset failed', (e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <section className="panel role">
      <h2>Reserve and revenue</h2>
      <Figures items={[
        ['Backing', `${Math.round(backing * 100)} %`, `USD ${money0(stats.reserve_usd)} reserve for PC ${money0(stats.supply_pc)}`],
        ['Fee revenue (treasury share)', `USD ${money(account.usd)}`],
        ['Interest on reserve', `USD ${money0(interest)} p.a.`, `${Math.round((1 - stats.cash_share) * 100)} % in T-bills at ${(stats.reserve_yield * 100).toFixed(1)} %`],
        ['Ledger integrity', stats.chain_valid ? 'Hash chain intact' : 'Chain broken'],
      ]} />
      <p className="hint"><Link to="/transparency">Public proof of reserves</Link></p>
      <div className="reset">
        {!confirm ? (
          <button className="btn btn-ghost btn-small" onClick={() => setConfirm(true)}>Reset demo</button>
        ) : (
          <div className="reset-confirm">
            <span>Delete all transactions and restore starting balances?</span>
            <button className="btn btn-danger btn-small" onClick={reset} disabled={busy}>{busy ? 'Resetting…' : 'Reset demo'}</button>
            <button className="btn btn-ghost btn-small" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>
    </section>
  );
}
