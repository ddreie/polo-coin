import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type Escrow } from '../api';
import { toast } from '../components/Toast';
import { money, shortHash, timeAgo } from '../format';
import { useT } from '../i18n';
import { useWallet } from '../wallet';
import { AmountInput, useSubmit } from './Pay';

export default function EscrowPage() {
  const { account, escrows } = useWallet();
  const { t } = useT();
  const canBuy = account.kyc === 'verified' && ['patron', 'pro', 'breeder'].includes(account.role);
  const open = escrows.filter((e) => e.status === 'locked');
  const done = escrows.filter((e) => e.status !== 'locked');

  return (
    <>
      <header className="app-page-head">
        <h1>{t('Horse purchases in escrow')}</h1>
        <p className="muted">{t('The purchase price is locked in a smart contract. The vet confirms the pre-purchase examination, then the contract pays the seller by itself.')}</p>
      </header>
      <ContractSteps />
      <div className={canBuy ? 'escrow-layout' : ''}>
        <div className="escrow-list">
          {escrows.length === 0 && <p className="empty panel">{t('No escrows yet.')}</p>}
          {open.map((e) => <EscrowCard key={e.id} e={e} />)}
          {done.map((e) => <EscrowCard key={e.id} e={e} />)}
        </div>
        {canBuy && <CreateEscrow />}
      </div>
    </>
  );
}

function ContractSteps() {
  return (
    <ol className="contract-steps" aria-label="How the escrow contract works">
      <li><span>1</span><strong>Lock</strong><small>Buyer’s PC move into the contract wallet</small></li>
      <li><span>2</span><strong>Examine</strong><small>The named vet checks the horse</small></li>
      <li><span>3</span><strong>Settle</strong><small>Passed: paid to seller. Failed: back to buyer</small></li>
    </ol>
  );
}

function EscrowCard({ e }: { e: Escrow }) {
  const { token, account } = useWallet();
  const { t } = useT();
  const { busy, error, run } = useSubmit();
  const isVet = e.vet_id === account.id && account.kyc === 'verified';
  const isBuyer = e.buyer_id === account.id;
  const status = e.status === 'locked' ? t('Locked') : e.status === 'released' ? t('Paid to seller') : t('Refunded');

  const vet = (passed: boolean) => run(async () => {
    const r = await api.escrowVet(token, e.id, passed);
    if (r.status === 'released') toast.ok(`Escrow #${e.id} settled`, `The contract paid PC ${money(e.amount)} to ${e.seller_name} automatically.`);
    else toast.ok(`Escrow #${e.id} refunded`, `The horse failed the examination. PC ${money(e.amount)} went back to ${e.buyer_name}.`);
  });
  const cancel = () => run(async () => {
    await api.escrowCancel(token, e.id);
    toast.ok(`Escrow #${e.id} cancelled`, `PC ${money(e.amount)} are back in your wallet.`);
  });

  return (
    <article className={`panel escrow-card escrow-${e.status}`}>
      <div className="escrow-head">
        <div>
          <span className={`badge ${e.status === 'locked' ? 'badge-warn' : e.status === 'released' ? 'badge-ok' : 'badge-neutral'}`}>{status}</span>
          <h3>#{e.id} · {e.item}</h3>
        </div>
        <span className="escrow-amount">PC {money(e.amount)}</span>
      </div>
      <dl className="escrow-parties">
        <div><dt>{t('Buyer')}</dt><dd>{e.buyer_name}</dd></div>
        <div><dt>{t('Seller')}</dt><dd>{e.seller_name}</dd></div>
        <div><dt>{t('Veterinarian')}</dt><dd>{e.vet_name}</dd></div>
      </dl>
      <p className="escrow-meta muted">
        {e.status === 'locked'
          ? <>{t('Waiting for the vet check')} · locked {timeAgo(e.created_at)} in contract <code title={e.contract_wallet}>{shortHash(e.contract_wallet)}</code></>
          : <>{e.vet_passed === true ? t('Vet check passed') : e.vet_passed === false ? t('Vet check failed') : 'Cancelled by the buyer'} · settled {e.settled_at ? timeAgo(e.settled_at) : ''}
              {e.settle_hash && <> · tx <code title={e.settle_hash}>{shortHash(e.settle_hash)}</code></>}</>}
      </p>
      {e.status === 'locked' && (isVet || isBuyer) && (
        <div className="escrow-actions">
          {isVet && <>
            <button className="btn btn-accent btn-small" disabled={busy} onClick={() => vet(true)}>{t('Report: passed')}</button>
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => vet(false)}>{t('Report: failed')}</button>
          </>}
          {isBuyer && <button className="btn btn-ghost btn-small" disabled={busy} onClick={cancel}>{t('Cancel and refund')}</button>}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}

function CreateEscrow() {
  const { token, account, parties } = useWallet();
  const { t } = useT();
  const sellers = useMemo(() => parties.filter((p) => p.id !== account.id && ['breeder', 'pro', 'patron'].includes(p.role))
    .sort((a, b) => Number(b.role === 'breeder') - Number(a.role === 'breeder')), [parties, account.id]);
  const vets = useMemo(() => parties.filter((p) => p.role === 'vet'), [parties]);
  const [seller, setSeller] = useState<number | ''>('');
  const [vet, setVet] = useState<number | ''>('');
  const [item, setItem] = useState('');
  const [v, setV] = useState('');
  const { busy, error, run } = useSubmit();
  useEffect(() => { if (seller === '' && sellers.length) setSeller(sellers[0].id); }, [sellers, seller]);
  useEffect(() => { if (vet === '' && vets.length) setVet(vets[0].id); }, [vets, vet]);
  const amt = Number(v) || 0;

  function submit(ev: FormEvent) {
    ev.preventDefault();
    run(async () => {
      const e = await api.escrowCreate(token, Number(seller), Number(vet), amt, item);
      toast.ok(`Escrow #${e.id} created`, `PC ${money(e.amount)} are locked until ${e.vet_name} reports the examination.`);
      setItem(''); setV('');
    });
  }

  return (
    <form className="panel action escrow-create" onSubmit={submit}>
      <h2>{t('Start an escrow')}</h2>
      <label className="memo"><span>{t('Horse')}</span>
        <input value={item} maxLength={80} placeholder='e.g. Gelding "Tango", 8 years' onChange={(e) => setItem(e.target.value)} />
      </label>
      <label className="memo"><span>{t('Seller')}</span>
        <select value={seller} onChange={(e) => setSeller(Number(e.target.value))}>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </select>
      </label>
      <label className="memo"><span>{t('Veterinarian')}</span>
        <select value={vet} onChange={(e) => setVet(Number(e.target.value))}>
          {vets.map((s) => <option key={s.id} value={s.id}>{s.display_name}, {s.org}</option>)}
        </select>
      </label>
      <AmountInput value={v} onChange={setV} cur="PC" max={account.pc} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-accent btn-wide" disabled={busy || amt <= 0 || item.trim().length < 2}>
        {t('Lock {x} PC in escrow', { x: amt > 0 ? money(amt) : '' })}
      </button>
      <p className="muted small">No PC yet? <Link to="/app/pay?tab=buy">{t('Buy PC')}</Link> first.</p>
    </form>
  );
}
