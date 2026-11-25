import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Bonus, type Escrow } from '../api';
import { toast } from '../components/Toast';
import { dateShort, daysLeft, money, shortHash, timeAgo } from '../format';
import { useT } from '../i18n';
import { useWallet } from '../wallet';
import { AmountInput, useSubmit } from './Pay';

/** Smart contracts: escrow for horse purchases and win bonuses tied to a match result. */
export default function ContractsPage() {
  const { account } = useWallet();
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const byRole = account.role === 'organizer' || account.role === 'groom' ? 'bonus' : 'escrow';
  const kind = (params.get('type') as 'escrow' | 'bonus' | null) ?? byRole;
  return (
    <>
      <div className="tabs contract-tabs" role="tablist">
        {(['escrow', 'bonus'] as const).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'tab on' : 'tab'}
            onClick={() => setParams({ type: k }, { replace: true })}>{k === 'escrow' ? t('Horse escrow') : t('Win bonus')}</button>
        ))}
      </div>
      {kind === 'escrow' ? <EscrowSection /> : <BonusSection />}
    </>
  );
}

function EscrowSection() {
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

function ContractSteps({ steps = [
  ['Lock', 'Buyer locks the price and proposes a verified vet'],
  ['Accept', 'Seller accepts the terms and the vet, or declines'],
  ['Examine', 'The vet checks the horse and reports'],
  ['Settle', 'Passed: paid to seller. Failed, declined or no response within 14 days: back to buyer'],
] }: { steps?: string[][] }) {
  const { t } = useT();
  return (
    <ol className="contract-steps" aria-label="How the contract works">
      {steps.map(([a, b], i) => <li key={a}><span>{i + 1}</span><strong>{t(a)}</strong><small>{t(b)}</small></li>)}
    </ol>
  );
}

function BonusSection() {
  const { account, bonuses } = useWallet();
  const { t } = useT();
  const canCreate = account.kyc === 'verified' && account.role === 'patron';
  const sorted = [...bonuses.filter((b) => b.status === 'locked'), ...bonuses.filter((b) => b.status !== 'locked')];
  return (
    <>
      <header className="app-page-head">
        <h1>{t('Win bonus')}</h1>
        <p className="muted">{t('The patron locks a bonus for a match. When the tournament organiser records the result, the contract pays the player or refunds the patron by itself.')}</p>
      </header>
      <ContractSteps steps={[
        ['Lock', 'The patron’s bonus moves into the contract'],
        ['Play', 'The organiser records the result'],
        ['Settle', 'Won: paid to the player. Lost: back to the patron'],
      ]} />
      <div className={canCreate ? 'escrow-layout' : ''}>
        <div className="escrow-list">
          {bonuses.length === 0 && <p className="empty panel">{t('No win bonuses yet.')}</p>}
          {sorted.map((b) => <BonusCard key={b.id} b={b} />)}
        </div>
        {canCreate && <CreateBonus />}
      </div>
    </>
  );
}

function BonusCard({ b }: { b: Bonus }) {
  const { token, account } = useWallet();
  const { t } = useT();
  const { busy, error, run } = useSubmit();
  const isOrg = b.organizer_id === account.id && account.kyc === 'verified';
  const isPatron = b.patron_id === account.id;
  const status = b.status === 'locked' ? t('Locked') : b.status === 'paid' ? t('Paid to player') : t('Refunded');
  const result = (won: boolean) => run(async () => {
    const r = await api.bonusResult(token, b.id, won);
    toast.ok(`Win bonus #${b.id} settled`, r.status === 'paid'
      ? `The contract paid PC ${money(b.amount)} to ${b.player_name} automatically.`
      : `Match lost. PC ${money(b.amount)} went back to ${b.patron_name}.`);
  });
  const cancel = () => run(async () => { await api.bonusCancel(token, b.id); toast.ok(`Win bonus #${b.id} cancelled`, `PC ${money(b.amount)} are back in your wallet.`); });

  return (
    <article className={`panel escrow-card escrow-${b.status === 'paid' ? 'released' : b.status}`}>
      <div className="escrow-head">
        <div>
          <span className={`badge ${b.status === 'locked' ? 'badge-warn' : b.status === 'paid' ? 'badge-ok' : 'badge-neutral'}`}>{status}</span>
          <h3>#{b.id} · {b.match}</h3>
        </div>
        <span className="escrow-amount">PC {money(b.amount)}</span>
      </div>
      <dl className="escrow-parties">
        <div><dt>{t('Patron')}</dt><dd>{b.patron_name}</dd></div>
        <div><dt>{t('Player')}</dt><dd>{b.player_name}</dd></div>
        <div><dt>{t('Organiser')}</dt><dd>{b.organizer_name}</dd></div>
      </dl>
      <p className="escrow-meta muted">
        {b.status === 'locked'
          ? <>{t('Waiting for the result')} · locked {timeAgo(b.created_at)}</>
          : <>{b.won === true ? t('Match won') : b.won === false ? t('Match lost') : 'Cancelled by the patron'} · settled {b.settled_at ? timeAgo(b.settled_at) : ''}
              {b.settle_hash && <> · tx <code title={b.settle_hash}>{shortHash(b.settle_hash)}</code></>}</>}
      </p>
      {b.status === 'locked' && (isOrg || isPatron) && (
        <div className="escrow-actions">
          {isOrg && <>
            <button className="btn btn-accent btn-small" disabled={busy} onClick={() => result(true)}>{t('Record: won')}</button>
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => result(false)}>{t('Record: lost')}</button>
          </>}
          {isPatron && <button className="btn btn-ghost btn-small" disabled={busy} onClick={cancel}>{t('Cancel and refund')}</button>}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </article>
  );
}

function CreateBonus() {
  const { token, account, parties } = useWallet();
  const { t } = useT();
  const players = useMemo(() => parties.filter((p) => p.role === 'pro' || p.role === 'groom'), [parties]);
  const orgs = useMemo(() => parties.filter((p) => p.role === 'organizer'), [parties]);
  const [player, setPlayer] = useState<number | ''>('');
  const [org, setOrg] = useState<number | ''>('');
  const [match, setMatch] = useState('');
  const [v, setV] = useState('');
  const { busy, error, run } = useSubmit();
  useEffect(() => { if (player === '' && players.length) setPlayer(players[0].id); }, [players, player]);
  useEffect(() => { if (org === '' && orgs.length) setOrg(orgs[0].id); }, [orgs, org]);
  const amt = Number(v) || 0;

  function submit(ev: FormEvent) {
    ev.preventDefault();
    run(async () => {
      const b = await api.bonusCreate(token, Number(player), Number(org), amt, match);
      toast.ok(`Win bonus #${b.id} locked`, `PC ${money(b.amount)} wait for ${b.organizer_name} to record the result.`);
      setMatch(''); setV('');
    });
  }

  return (
    <form className="panel action escrow-create" onSubmit={submit}>
      <h2>{t('Promise a win bonus')}</h2>
      <label className="memo"><span>{t('Match')}</span>
        <input value={match} maxLength={80} placeholder="e.g. Final, Polo Gold Cup Gstaad" onChange={(e) => setMatch(e.target.value)} />
      </label>
      <label className="memo"><span>{t('Player')}</span>
        <select value={player} onChange={(e) => setPlayer(Number(e.target.value))}>
          {players.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </select>
      </label>
      <label className="memo"><span>{t('Organiser')}</span>
        <select value={org} onChange={(e) => setOrg(Number(e.target.value))}>
          {orgs.map((s) => <option key={s.id} value={s.id}>{s.display_name}</option>)}
        </select>
      </label>
      <AmountInput value={v} onChange={setV} cur="PC" max={account.pc} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-accent btn-wide" disabled={busy || amt <= 0 || match.trim().length < 2}>
        {t('Lock {x} PC as win bonus', { x: amt > 0 ? money(amt) : '' })}
      </button>
    </form>
  );
}

function EscrowCard({ e }: { e: Escrow }) {
  const { token, account } = useWallet();
  const { t, lang } = useT();
  const { busy, error, run } = useSubmit();
  const isVet = e.vet_id === account.id && account.kyc === 'verified';
  const isSeller = e.seller_id === account.id && account.kyc === 'verified';
  const accepted = !!e.accepted_at;
  const left = daysLeft(e.expires_at);
  const outcome = e.vet_passed === true ? t('Vet check passed')
    : e.refund_reason === 'expired' && !accepted ? t('Not accepted by the seller within 14 days, refunded to the buyer')
    : e.refund_reason === 'expired' ? t('No vet report within 14 days, refunded to the buyer')
    : e.refund_reason === 'declined' ? t('Declined by the seller, refunded to the buyer')
    : e.vet_passed === false || e.refund_reason === 'vet_failed' ? t('Vet check failed')
    : t('Cancelled by the buyer');
  const isBuyer = e.buyer_id === account.id;
  const status = e.status === 'locked' ? (accepted ? t('Locked') : t('Waiting for seller'))
    : e.status === 'released' ? t('Paid to seller') : t('Refunded');

  const vet = (passed: boolean) => run(async () => {
    const r = await api.escrowVet(token, e.id, passed);
    if (r.refund_reason === 'expired') toast.error(`Escrow #${e.id} has expired`, `The 14-day deadline passed before your report. The contract refunded PC ${money(e.amount)} to ${e.buyer_name}.`);
    else if (r.status === 'released') toast.ok(`Escrow #${e.id} settled`, `The contract paid PC ${money(e.amount)} to ${e.seller_name} automatically.`);
    else toast.ok(`Escrow #${e.id} refunded`, `The horse failed the examination. PC ${money(e.amount)} went back to ${e.buyer_name}.`);
  });
  const cancel = () => run(async () => {
    const r = await api.escrowCancel(token, e.id);
    if (r.refund_reason === 'expired') toast.ok(`Escrow #${e.id} had already expired`, `The deadline passed, so PC ${money(e.amount)} are back in your wallet.`);
    else toast.ok(`Escrow #${e.id} cancelled`, `PC ${money(e.amount)} are back in your wallet.`);
  });

  const accept = () => run(async () => {
    const r = await api.escrowAccept(token, e.id);
    if (r.refund_reason === 'expired') toast.error(`Escrow #${e.id} has expired`, `You did not accept within 14 days. The contract refunded ${e.buyer_name}.`);
    else toast.ok(`Escrow #${e.id} accepted`, `${e.vet_name} can now examine the horse and has 14 days to report. ${e.buyer_name} can no longer cancel.`);
  });
  const decline = () => run(async () => {
    await api.escrowDecline(token, e.id);
    toast.ok(`Escrow #${e.id} declined`, `The contract sent PC ${money(e.amount)} back to ${e.buyer_name}.`);
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
        <div><dt>{t('Veterinarian')}</dt><dd>{e.vet_name}{e.vet_licence && <small className="licence">{t('Licence')} {e.vet_licence}, {t('verified by Polo Coin')}</small>}</dd></div>
      </dl>
      <p className="escrow-meta muted">
        {e.status === 'locked'
          ? <>{accepted ? t('Accepted by the seller, waiting for the vet check') : t('Waiting for the seller to accept the escrow and the vet')} · locked {timeAgo(e.created_at)} in contract <code title={e.contract_wallet}>{shortHash(e.contract_wallet)}</code></>
          : <>{outcome} · settled {e.settled_at ? timeAgo(e.settled_at) : ''}
              {e.settle_hash && <> · tx <code title={e.settle_hash}>{shortHash(e.settle_hash)}</code></>}</>}
      </p>
      {e.status === 'locked' && (
        <p className={`escrow-deadline${left <= 3 ? ' soon' : ''}`}>
          {accepted
            ? t('Vet report due by {d} ({n} days left). Without a report, the contract refunds the buyer automatically.',
              { d: dateShort(e.expires_at, lang), n: String(left) })
            : t('The seller has until {d} to accept ({n} days left). Until then the buyer can still cancel.',
              { d: dateShort(e.expires_at, lang), n: String(left) })}
        </p>
      )}
      {e.status === 'locked' && ((isVet && accepted) || (isBuyer && !accepted) || (isSeller && !accepted)) && (
        <div className="escrow-actions">
          {isSeller && !accepted && <>
            <button className="btn btn-accent btn-small" disabled={busy} onClick={accept}>{t('Accept escrow and vet')}</button>
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={decline}>{t('Decline')}</button>
          </>}
          {isVet && accepted && <>
            <button className="btn btn-accent btn-small" disabled={busy} onClick={() => vet(true)}>{t('Report: passed')}</button>
            <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => vet(false)}>{t('Report: failed')}</button>
          </>}
          {isBuyer && !accepted && <button className="btn btn-ghost btn-small" disabled={busy} onClick={cancel}>{t('Cancel and refund')}</button>}
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
      toast.ok(`Escrow #${e.id} created`, `PC ${money(e.amount)} are locked. Next, ${e.seller_name} accepts the escrow and ${e.vet_name} as vet.`);
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
          {vets.map((s) => <option key={s.id} value={s.id}>{[s.display_name, s.org !== '—' ? s.org : null, s.licence_no ? `licence ${s.licence_no}` : null].filter(Boolean).join(', ')}</option>)}
        </select>
        <small className="muted">{t('Only vets whose licence Polo Coin has checked are listed. Choose one you and the seller trust: the seller has to accept your choice.')}</small>
      </label>
      <AmountInput value={v} onChange={setV} cur="PC" max={account.pc} />
      <p className="muted small">{t('If the seller does not accept or the vet does not report within 14 days, the PC come back to you automatically.')}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-accent btn-wide" disabled={busy || amt <= 0 || item.trim().length < 2}>
        {t('Lock {x} PC in escrow', { x: amt > 0 ? money(amt) : '' })}
      </button>
      <p className="muted small">No PC yet? <Link to="/app/pay?tab=buy">{t('Buy PC')}</Link> first.</p>
    </form>
  );
}
