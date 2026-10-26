import { useState } from 'react';
import { api, type Account, type Stats, type Tx } from '../api';
import { toast } from './Toast';
import { money, money0, SWIFT } from '../format';

interface Props { token: string; account: Account; txs: Tx[]; stats: Stats | null; onReset: () => void }

export default function RolePanel(p: Props) {
  switch (p.account.role) {
    case 'patron': return <Patron {...p} />;
    case 'pro':
    case 'breeder': return <Receiver {...p} />;
    case 'bank': return <Bank {...p} />;
    case 'admin': return <Treasury {...p} />;
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

function Patron({ account, txs }: Props) {
  const sent = txs.filter((t) => t.kind === 'transfer' && t.from_id === account.id);
  const vol = sent.reduce((s, t) => s + t.amount, 0);
  const fees = sent.reduce((s, t) => s + t.fee, 0);
  const saved = vol * SWIFT.feeMid - fees;
  return (
    <section className="panel role">
      <h2>Your season so far</h2>
      <Figures items={[
        ['Payments sent', String(sent.length)],
        ['Volume paid', `PC ${money0(vol)}`],
        ['Fees paid', `PC ${money(fees)}`],
        ['Saved vs. bank wire', `USD ${money0(Math.max(0, saved))}`, `Assumes a ${(SWIFT.feeMid * 100).toFixed(1)} % wire cost, the midpoint of 2–5 %`],
      ]} />
      {sent.length === 0 && <p className="hint">Buy some PC, then pay Facundo Ríos his tournament fee.</p>}
    </section>
  );
}

function Receiver({ account, txs }: Props) {
  const got = txs.filter((t) => t.kind === 'transfer' && t.to_id === account.id);
  const vol = got.reduce((s, t) => s + t.amount, 0);
  const out = txs.filter((t) => t.kind === 'redeem' && t.from_id === account.id).reduce((s, t) => s + t.amount, 0);
  return (
    <section className="panel role">
      <h2>{account.role === 'pro' ? 'Your earnings' : 'Your sales'}</h2>
      <Figures items={[
        ['Payments received', String(got.length)],
        ['Received in total', `PC ${money0(vol)}`],
        ['Cashed out in USD', `USD ${money0(out)}`],
        ['Wire days avoided', got.length ? `${got.length * SWIFT.daysLow}–${got.length * SWIFT.daysHigh}` : '0', 'Compared with receiving each payment by bank wire'],
      ]} />
      {got.length === 0 && <p className="hint">No payments yet. Log in as the patron and send one.</p>}
    </section>
  );
}

function Bank({ txs, stats }: Props) {
  const red = txs.filter((t) => t.kind === 'redeem');
  const vol = red.reduce((s, t) => s + t.amount, 0);
  const share = stats?.bank_share ?? 0.5;
  const feeIncome = txs.filter((t) => t.kind === 'transfer').reduce((s, t) => s + Math.round(t.fee * share * 100) / 100, 0);
  return (
    <section className="panel role">
      <h2>Partner bank desk</h2>
      <Figures items={[
        ['Cash-outs processed', String(red.length)],
        ['USD paid out', `USD ${money0(vol)}`],
        ['Fee income', `PC ${money(feeIncome)}`, `${share * 100} % of every 1 % transfer fee`],
        ['Transfers on the network', String(txs.filter((t) => t.kind === 'transfer').length)],
      ]} />
      <p className="hint">As a partner bank you see every transaction for AML monitoring. Cash-outs settle instantly against the USD reserve.</p>
    </section>
  );
}

function Treasury({ token, stats, onReset }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!stats) return <section className="panel role"><h2>Reserve</h2><p className="muted">Loading…</p></section>;
  const backing = stats.supply_pc ? stats.reserve_usd / stats.supply_pc : 1;
  const interest = stats.reserve_usd * stats.reserve_yield;

  async function reset() {
    setBusy(true);
    try {
      await api.reset(token);
      toast.ok('Demo reset', 'All balances and transactions are back to the start. Log in again to continue.');
      onReset();
    } catch (e) {
      toast.error('Reset failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel role">
      <h2>Reserve and revenue</h2>
      <div className="backing" aria-label={`Backing ratio ${Math.round(backing * 100)} percent`}>
        <div className="backing-row"><span>USD reserve</span><span>{money0(stats.reserve_usd)}</span></div>
        <div className="backing-bar"><span style={{ width: '100%' }} /></div>
        <div className="backing-row"><span>PC in circulation</span><span>{money0(stats.supply_pc)}</span></div>
        <div className="backing-bar supply"><span style={{ width: `${Math.min(100, (1 / Math.max(backing, 0.0001)) * 100)}%` }} /></div>
      </div>
      <Figures items={[
        ['Backing', `${Math.round(backing * 100)} %`],
        ['Ledger integrity', stats.chain_valid ? 'Hash chain intact' : 'Chain broken'],
        ['Fee revenue (treasury share)', `PC ${money(stats.fees_pc * (1 - stats.bank_share))}`],
        ['Interest on reserve', `USD ${money0(interest)} p.a.`, `At an assumed ${stats.reserve_yield * 100} % T-bill yield`],
      ]} />
      <div className="reset">
        {!confirm ? (
          <button className="btn btn-ghost" onClick={() => setConfirm(true)}>Reset demo</button>
        ) : (
          <div className="reset-confirm">
            <span>Delete all transactions and restore starting balances?</span>
            <button className="btn btn-danger" onClick={reset} disabled={busy}>{busy ? 'Resetting…' : 'Reset demo'}</button>
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        )}
      </div>
    </section>
  );
}
