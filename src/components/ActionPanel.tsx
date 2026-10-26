import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Account, type Party, type Role } from '../api';
import { Avatar } from './Brand';
import { toast } from './Toast';
import { money, money0, roleLabel, shortHash, SWIFT } from '../format';

type Tab = 'buy' | 'send' | 'redeem';

const MEMOS: Partial<Record<Role, Partial<Record<Role, string[]>>>> = {
  patron: { pro: ['Tournament fee', 'Monthly retainer', 'Win bonus'], breeder: ['Horse purchase', 'Training & board'] },
  pro: { breeder: ['Horse purchase', 'Groom wages', 'Training & board'], patron: ['Refund'] },
  breeder: { pro: ['Refund'], patron: ['Refund'] },
};

interface Props { token: string; account: Account; parties: Party[]; onDone: () => Promise<void> }

export default function ActionPanel({ token, account, parties, onDone }: Props) {
  const canBuy = account.role === 'patron' || account.usd > 0;
  const [tab, setTab] = useState<Tab>(canBuy && account.pc === 0 ? 'buy' : 'send');
  useEffect(() => { if (tab === 'buy' && !canBuy) setTab('send'); }, [canBuy, tab]);

  const tabs: { id: Tab; label: string }[] = [
    ...(canBuy ? [{ id: 'buy' as Tab, label: 'Buy PC' }] : []),
    { id: 'send', label: 'Send PC' },
    { id: 'redeem', label: 'Cash out' },
  ];

  return (
    <section className="panel actions" aria-label="Actions">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'buy' && <Buy token={token} account={account} onDone={onDone} />}
      {tab === 'send' && <Send token={token} account={account} parties={parties} onDone={onDone} />}
      {tab === 'redeem' && <Redeem token={token} account={account} onDone={onDone} />}
    </section>
  );
}

function AmountInput({ value, onChange, cur, max }: { value: string; onChange: (v: string) => void; cur: string; max?: number }) {
  return (
    <div className="amount">
      <span className="amount-cur">{cur}</span>
      <input inputMode="decimal" type="number" min="0" step="0.01" placeholder="0.00" value={value}
        onChange={(e) => onChange(e.target.value)} aria-label={`Amount in ${cur}`} />
      {max !== undefined && max > 0 && (
        <button type="button" className="chip" onClick={() => onChange(String(Math.floor(max * 100) / 100))}>Max</button>
      )}
    </div>
  );
}

function useSubmit(onDone: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); await onDone(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return { busy, error, run, setError };
}

const secs = (t0: number) => ((performance.now() - t0) / 1000).toFixed(2);

function Buy({ token, account, onDone }: { token: string; account: Account; onDone: () => Promise<void> }) {
  const [v, setV] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  const amt = Number(v) || 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const t0 = performance.now();
      const tx = await api.buy(token, amt);
      toast.ok(`Bought ${money(tx.amount)} PC`, <>USD {money(tx.amount)} moved into the reserve. Block #{tx.block}, settled in {secs(t0)} s.</>);
      setV('');
    });
  }

  return (
    <form className="action" onSubmit={submit}>
      <p className="action-help">Move USD from your bank account into the Polo Coin reserve. You receive the same amount in PC, free of charge.</p>
      <AmountInput value={v} onChange={setV} cur="USD" max={account.usd} />
      <div className="presets">
        {[10000, 25000, 50000].map((p) => (
          <button type="button" key={p} className="chip" onClick={() => setV(String(p))}>{money0(p)}</button>
        ))}
      </div>
      <dl className="summary">
        <div><dt>You pay</dt><dd>USD {money(amt)}</dd></div>
        <div><dt>You receive</dt><dd>PC {money(amt)}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-wide" disabled={busy || amt <= 0}>{busy ? 'Buying…' : `Buy ${amt > 0 ? money(amt) + ' ' : ''}PC`}</button>
    </form>
  );
}

function Send({ token, account, parties, onDone }: Props) {
  const others = useMemo(() => parties.filter((p) => p.id !== account.id && p.role !== 'admin' && p.role !== 'bank'), [parties, account.id]);
  const [to, setTo] = useState<number | null>(null);
  const [v, setV] = useState('');
  const [memo, setMemo] = useState('');
  const { busy, error, run, setError } = useSubmit(onDone);

  useEffect(() => {
    if (to === null && others.length) {
      const pref: Role[] = account.role === 'patron' ? ['pro'] : account.role === 'pro' ? ['breeder'] : ['pro'];
      setTo((others.find((o) => pref.includes(o.role)) ?? others[0]).id);
    }
  }, [others, to, account.role]);

  const rec = others.find((o) => o.id === to);
  const amt = Number(v) || 0;
  const fee = Math.round(amt * 0.01 * 100) / 100;
  const memos = rec ? MEMOS[account.role]?.[rec.role] ?? [] : [];
  const maxSend = Math.floor((account.pc / 1.01) * 100) / 100;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!rec) { setError('Choose who receives the payment.'); return; }
    run(async () => {
      const t0 = performance.now();
      const tx = await api.transfer(token, rec.id, amt, memo);
      toast.ok(`Sent ${money(tx.amount)} PC to ${rec.display_name}`,
        <>Settled in {secs(t0)} s. Block #{tx.block}, tx {shortHash(tx.tx_hash)}. A bank wire would still be {SWIFT.daysLow}–{SWIFT.daysHigh} days away.</>);
      setV(''); setMemo('');
    });
  }

  return (
    <form className="action" onSubmit={submit}>
      <fieldset className="recipients">
        <legend>Recipient</legend>
        {others.map((o) => (
          <label key={o.id} className={`recipient${to === o.id ? ' on' : ''}`}>
            <input type="radio" name="to" checked={to === o.id} onChange={() => setTo(o.id)} />
            <Avatar name={o.display_name} role={o.role} size={32} />
            <span><strong>{o.display_name}</strong><small>{roleLabel[o.role]}, {o.country}</small></span>
          </label>
        ))}
      </fieldset>

      <AmountInput value={v} onChange={setV} cur="PC" max={maxSend} />

      <label className="memo">
        <span>Reference</span>
        <input value={memo} maxLength={120} placeholder="What is this payment for?" onChange={(e) => setMemo(e.target.value)} />
      </label>
      {memos.length > 0 && (
        <div className="presets">
          {memos.map((m) => <button type="button" key={m} className="chip" onClick={() => setMemo(m)}>{m}</button>)}
        </div>
      )}

      <dl className="summary">
        <div><dt>{rec ? rec.display_name : 'Recipient'} receives</dt><dd>PC {money(amt)}</dd></div>
        <div><dt>Fee (1 %)</dt><dd>PC {money(fee)}</dd></div>
        <div className="total"><dt>You pay</dt><dd>PC {money(amt + fee)}</dd></div>
        {amt > 0 && <div className="compare"><dt>Same payment by bank wire</dt><dd>USD {money0(amt * SWIFT.feeLow)}–{money0(amt * SWIFT.feeHigh)} fees, {SWIFT.daysLow}–{SWIFT.daysHigh} days</dd></div>}
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-wide" disabled={busy || amt <= 0 || !rec}>
        {busy ? 'Sending…' : `Send ${amt > 0 ? money(amt) + ' ' : ''}PC`}
      </button>
    </form>
  );
}

function Redeem({ token, account, onDone }: { token: string; account: Account; onDone: () => Promise<void> }) {
  const [v, setV] = useState('');
  const { busy, error, run } = useSubmit(onDone);
  const amt = Number(v) || 0;

  function submit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const t0 = performance.now();
      const tx = await api.redeem(token, amt);
      toast.ok(`Cashed out USD ${money(tx.amount)}`, <>Banco Pampa Sur paid USD {money(tx.amount)} to your bank account. {money(tx.amount)} PC destroyed. Settled in {secs(t0)} s.</>);
      setV('');
    });
  }

  return (
    <form className="action" onSubmit={submit}>
      <p className="action-help">Exchange PC for US dollars at the partner bank Banco Pampa Sur, 1:1 and free. The PC is destroyed and the USD leaves the reserve.</p>
      <AmountInput value={v} onChange={setV} cur="PC" max={account.pc} />
      <dl className="summary">
        <div><dt>You give</dt><dd>PC {money(amt)}</dd></div>
        <div><dt>Paid to your bank account</dt><dd>USD {money(amt)}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-wide" disabled={busy || amt <= 0}>{busy ? 'Cashing out…' : `Cash out ${amt > 0 ? 'USD ' + money(amt) : ''}`}</button>
    </form>
  );
}
