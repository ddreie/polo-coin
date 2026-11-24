import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type Party, type Role } from '../api';
import { Avatar } from '../components/Brand';
import { KycStatus } from '../components/Kyc';
import { toast } from '../components/Toast';
import { money, money0, roleLabel, shortHash, SWIFT } from '../format';
import { useT } from '../i18n';
import { useWallet } from '../wallet';

type Tab = 'buy' | 'send' | 'request' | 'redeem';

const MEMOS: Partial<Record<Role, Partial<Record<Role, string[]>>>> = {
  patron: { pro: ['Tournament fee', 'Monthly retainer', 'Win bonus'], breeder: ['Horse purchase', 'Training & board'], vet: ['Vet examination'] },
  pro: { breeder: ['Horse purchase', 'Groom wages', 'Training & board'], patron: ['Refund'], vet: ['Vet examination'] },
  breeder: { pro: ['Refund'], patron: ['Refund'], vet: ['Vet examination'] },
};
const REQUEST_MEMOS: Partial<Record<Role, string[]>> = {
  pro: ['Tournament fee', 'Travel and accommodation', 'Win bonus'],
  breeder: ['Horse purchase', 'Training & board', 'Horse transport'],
  vet: ['Pre-purchase examination', 'Treatment'],
};

export default function Pay() {
  const { account } = useWallet();
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const canBuy = account.role === 'patron' || account.usd > 0;
  const canRequest = account.role !== 'patron';
  const tabs: { id: Tab; label: string }[] = [
    ...(canBuy ? [{ id: 'buy' as Tab, label: t('Buy PC') }] : []),
    { id: 'send', label: t('Send PC') },
    ...(canRequest ? [{ id: 'request' as Tab, label: t('Request') }] : []),
    { id: 'redeem', label: t('Cash out') },
  ];
  const asked = params.get('tab') as Tab | null;
  const tab: Tab = tabs.some((x) => x.id === asked) ? asked! : canBuy && account.pc === 0 ? 'buy' : 'send';

  if (account.kyc !== 'verified') return <KycStatus account={account} />;

  return (
    <div className="pay-layout">
      <section className="panel actions" aria-label={t('Pay')}>
        <div className="tabs" role="tablist">
          {tabs.map((x) => (
            <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'tab on' : 'tab'}
              onClick={() => setParams({ tab: x.id }, { replace: true })}>{x.label}</button>
          ))}
        </div>
        {tab === 'buy' && <Buy />}
        {tab === 'send' && <Send />}
        {tab === 'request' && <RequestForm />}
        {tab === 'redeem' && <Redeem />}
      </section>
      <BalanceAside />
    </div>
  );
}

function BalanceAside() {
  const { account } = useWallet();
  const { t } = useT();
  return (
    <aside className="pay-aside">
      <div className="mini-bal"><span>{t('Polo Coin balance')}</span><strong>PC {money(account.pc)}</strong></div>
      <div className="mini-bal"><span>{account.role === 'patron' ? t('Bank account (simulated)') : t('USD paid out to bank account')}</span><strong>USD {money(account.usd)}</strong></div>
    </aside>
  );
}

export function AmountInput({ value, onChange, cur, max }: { value: string; onChange: (v: string) => void; cur: string; max?: number }) {
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

export function useSubmit() {
  const { refresh } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); await refresh(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return { busy, error, run, setError };
}

const secs = (t0: number) => ((performance.now() - t0) / 1000).toFixed(2);

function Buy() {
  const { token, account, stats } = useWallet();
  const { t } = useT();
  const [v, setV] = useState('');
  const { busy, error, run } = useSubmit();
  const rate = stats?.fee_rate ?? 0.01;
  const amt = Number(v) || 0;
  const fee = Math.round(amt * rate * 100) / 100;
  const maxBuy = Math.floor((account.usd / (1 + rate)) * 100) / 100;

  function submit(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const t0 = performance.now();
      const tx = await api.buy(token, amt);
      toast.ok(`Bought ${money(tx.amount)} PC`, <>USD {money(tx.amount)} went into the reserve, fee USD {money(tx.fee)}. Block #{tx.block}, settled in {secs(t0)} s.</>);
      setV('');
    });
  }

  return (
    <form className="action" onSubmit={submit}>
      <p className="action-help">
        Move US dollars from your bank account into the Polo Coin reserve and receive the same amount in PC.
        You pay one fee of {rate * 100}% now. Sending and cashing out later are free.
      </p>
      <AmountInput value={v} onChange={setV} cur="PC" max={maxBuy} />
      <div className="presets">
        {[10000, 25000, 50000].map((p) => <button type="button" key={p} className="chip" onClick={() => setV(String(p))}>{money0(p)}</button>)}
      </div>
      <dl className="summary">
        <div><dt>{t('You receive')}</dt><dd>PC {money(amt)}</dd></div>
        <div><dt>{t('Fee (1%)')}</dt><dd>USD {money(fee)}</dd></div>
        <div className="total"><dt>{t('You pay')}</dt><dd>USD {money(amt + fee)}</dd></div>
        {amt > 0 && <div className="compare"><dt>{t('Same payment by bank wire')}</dt><dd>USD {money0(amt * SWIFT.feeLow)}–{money0(amt * SWIFT.feeHigh)}, {SWIFT.daysLow}–{SWIFT.daysHigh} days</dd></div>}
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-accent btn-wide" disabled={busy || amt <= 0}>{busy ? t('Buying…') : `${t('Buy PC')}${amt > 0 ? ` · USD ${money(amt + fee)}` : ''}`}</button>
    </form>
  );
}

function PartyPicker({ list, value, onChange, legend }: { list: Party[]; value: number | null; onChange: (id: number) => void; legend: string }) {
  return (
    <fieldset className="recipients">
      <legend>{legend}</legend>
      {list.map((o) => (
        <label key={o.id} className={`recipient${value === o.id ? ' on' : ''}`}>
          <input type="radio" name={legend} checked={value === o.id} onChange={() => onChange(o.id)} />
          <Avatar name={o.display_name} role={o.role} size={32} />
          <span><strong>{o.display_name}</strong><small>{roleLabel[o.role]}, {o.country}</small></span>
        </label>
      ))}
    </fieldset>
  );
}

function Send() {
  const { token, account, parties } = useWallet();
  const { t } = useT();
  const others = useMemo(() => parties.filter((p) => p.id !== account.id && p.role !== 'admin' && p.role !== 'bank'), [parties, account.id]);
  const [to, setTo] = useState<number | null>(null);
  const [v, setV] = useState('');
  const [memo, setMemo] = useState('');
  const { busy, error, run, setError } = useSubmit();

  useEffect(() => {
    if (to === null && others.length) {
      const pref: Role[] = account.role === 'patron' ? ['pro'] : account.role === 'pro' ? ['breeder'] : ['pro'];
      setTo((others.find((o) => pref.includes(o.role)) ?? others[0]).id);
    }
  }, [others, to, account.role]);

  const rec = others.find((o) => o.id === to);
  const amt = Number(v) || 0;
  const memos = rec ? MEMOS[account.role]?.[rec.role] ?? [] : [];

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!rec) { setError('Choose who receives the payment.'); return; }
    run(async () => {
      const t0 = performance.now();
      const tx = await api.transfer(token, rec.id, amt, memo);
      toast.ok(`Sent ${money(tx.amount)} PC to ${rec.display_name}`,
        <>Settled in {secs(t0)} s, no fee. Block #{tx.block}, tx {shortHash(tx.tx_hash)}. A bank wire would still be {SWIFT.daysLow}–{SWIFT.daysHigh} days away.</>);
      setV(''); setMemo('');
    });
  }

  return (
    <form className="action" onSubmit={submit}>
      <p className="action-help">{t('Sending PC is free and final within seconds, any day of the week.')}</p>
      <PartyPicker list={others} value={to} onChange={setTo} legend={t('Recipient')} />
      <AmountInput value={v} onChange={setV} cur="PC" max={account.pc} />
      <label className="memo">
        <span>{t('Reference')}</span>
        <input value={memo} maxLength={120} placeholder={t('What is this payment for?')} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {memos.length > 0 && <div className="presets">{memos.map((m) => <button type="button" key={m} className="chip" onClick={() => setMemo(m)}>{m}</button>)}</div>}
      <dl className="summary">
        <div><dt>{t('{name} receives', { name: rec?.display_name ?? t('Recipient') })}</dt><dd>PC {money(amt)}</dd></div>
        <div><dt>Fee</dt><dd>{t('Free')}</dd></div>
        {amt > 0 && <div className="compare"><dt>{t('Same payment by bank wire')}</dt><dd>USD {money0(amt * SWIFT.feeLow)}–{money0(amt * SWIFT.feeHigh)}, {SWIFT.daysLow}–{SWIFT.daysHigh} days</dd></div>}
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-wide" disabled={busy || amt <= 0 || !rec}>{busy ? t('Sending…') : `${t('Send PC')}${amt > 0 ? ` · ${money(amt)}` : ''}`}</button>
    </form>
  );
}

function RequestForm() {
  const { token, account, parties } = useWallet();
  const { t } = useT();
  const payers = useMemo(() => parties.filter((p) => p.id !== account.id && ['patron', 'pro', 'breeder'].includes(p.role))
    .sort((a, b) => Number(b.role === 'patron') - Number(a.role === 'patron')), [parties, account.id]);
  const [payer, setPayer] = useState<number | null>(null);
  const [v, setV] = useState('');
  const [memo, setMemo] = useState('');
  const { busy, error, run, setError } = useSubmit();
  useEffect(() => { if (payer === null && payers.length) setPayer(payers[0].id); }, [payers, payer]);
  const amt = Number(v) || 0;
  const who = payers.find((p) => p.id === payer);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!who) { setError('Choose who should pay.'); return; }
    run(async () => {
      await api.requestCreate(token, who.id, amt, memo);
      toast.ok(t('Request sent'), `${who.display_name} sees it on the overview and can pay with one click.`);
      setV(''); setMemo('');
    });
  }

  return (
    <form className="action" onSubmit={submit}>
      <p className="action-help">{t('Ask a patron to pay you. They pay with one click, and the money arrives in seconds.')}</p>
      <PartyPicker list={payers} value={payer} onChange={setPayer} legend={t('Who should pay?')} />
      <AmountInput value={v} onChange={setV} cur="PC" />
      <label className="memo">
        <span>{t('Reference')}</span>
        <input value={memo} maxLength={120} placeholder={t('What is this payment for?')} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <div className="presets">{(REQUEST_MEMOS[account.role] ?? []).map((m) => <button type="button" key={m} className="chip" onClick={() => setMemo(m)}>{m}</button>)}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-wide" disabled={busy || amt <= 0 || !who}>{t('Send request')}</button>
    </form>
  );
}

function Redeem() {
  const { token, account } = useWallet();
  const { t } = useT();
  const [v, setV] = useState('');
  const { busy, error, run } = useSubmit();
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
      <p className="action-help">{t('Exchange PC for US dollars at the partner bank, 1:1 and free. The PC is destroyed and the USD leaves the reserve.')}</p>
      <AmountInput value={v} onChange={setV} cur="PC" max={account.pc} />
      <dl className="summary">
        <div><dt>{t('You give')}</dt><dd>PC {money(amt)}</dd></div>
        <div><dt>Fee</dt><dd>{t('Free')}</dd></div>
        <div className="total"><dt>{t('Paid to your bank account')}</dt><dd>USD {money(amt)}</dd></div>
      </dl>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-wide" disabled={busy || amt <= 0}>{busy ? t('Cashing out…') : `${t('Cash out')}${amt > 0 ? ` · USD ${money(amt)}` : ''}`}</button>
    </form>
  );
}
