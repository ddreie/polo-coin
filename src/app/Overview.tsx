import { Link } from 'react-router-dom';
import { api, type PayRequest } from '../api';
import Activity from '../components/Activity';
import { KycBadge, KycStatus } from '../components/Kyc';
import RolePanel from '../components/RolePanel';
import { toast } from '../components/Toast';
import { money, roleLabel, timeAgo } from '../format';
import { useT } from '../i18n';
import { useTodos, useWallet } from '../wallet';
import { useSubmit } from './Pay';

export default function Overview() {
  const { account, txs, flash } = useWallet();
  const { t } = useT();
  const verified = account.kyc === 'verified';
  const usdLabel = account.role === 'patron' ? t('Bank account (simulated)') : t('USD paid out to bank account');

  return (
    <>
      <section className="whoami">
        <div>
          <p className="eyebrow">{roleLabel[account.role]} · {account.org}, {account.country}</p>
          <h1>{account.display_name}</h1>
          <p className="muted small">
            {t('Wallet')} <code title={account.wallet}>{account.wallet.slice(0, 10)}…{account.wallet.slice(-4)}</code>{' '}
            <KycBadge kyc={account.kyc} />
          </p>
        </div>
        {verified && account.role !== 'vet' && account.role !== 'organizer' && (
          <div className="quick-actions">
            {(account.role === 'patron' || account.usd > 0) && <Link className="btn btn-accent" to="/app/pay?tab=buy">{t('Buy PC')}</Link>}
            <Link className="btn" to="/app/pay?tab=send">{t('Send PC')}</Link>
            <Link className="btn btn-ghost" to="/app/pay?tab=redeem">{t('Cash out')}</Link>
          </div>
        )}
      </section>

      <section className={`balances${flash ? ' flash' : ''}`} aria-label="Balances">
        <div className="bal bal-pc">
          <span className="bal-label">{t('Polo Coin balance')}</span>
          <span className="bal-value"><span className="cur">PC</span>{money(account.pc)}</span>
          <span className="bal-note">{t('= USD {x}, backed 1:1', { x: money(account.pc) })}</span>
        </div>
        <div className="bal bal-usd">
          <span className="bal-label">{usdLabel}</span>
          <span className="bal-value"><span className="cur">USD</span>{money(account.usd)}</span>
          <span className="bal-note">{account.role === 'patron' ? t('Use it to buy Polo Coin') : t('From PC cashed out at the partner bank')}</span>
        </div>
      </section>

      {!verified && <KycStatus account={account} />}

      <div className="dash-grid">
        <Todos />
        <RolePanel />
      </div>

      <Activity account={account} txs={txs} limit={6} />
    </>
  );
}

function Todos() {
  const { account, requests } = useWallet();
  const { toPay, toExamine, toAccept, toDecide, waiting, bonusWaiting } = useTodos();
  const { t } = useT();
  const mine = requests.filter((r) => r.status === 'open' && r.requester_id === account.id);
  const nothing = !toPay.length && !toExamine.length && !toAccept.length && !toDecide.length && !waiting.length && !bonusWaiting.length && !mine.length;

  return (
    <section className="panel todos" aria-labelledby="todo-h">
      <h2 id="todo-h">{t('To do')}</h2>
      {nothing && <p className="muted">{t('Nothing to do right now.')}</p>}
      {toPay.map((r) => <RequestRow key={r.id} r={r} incoming />)}
      {toAccept.map((e) => (
        <div key={`a${e.id}`} className="todo">
          <div><strong>{t('Accept escrow')}: {e.item}</strong><small>Escrow #{e.id}: {e.buyer_name} buys from you, PC {money(e.amount)}, vet {e.vet_name}</small></div>
          <Link className="btn btn-accent btn-small" to="/app/escrow">{t('Review')}</Link>
        </div>
      ))}
      {toExamine.map((e) => (
        <div key={e.id} className="todo">
          <div><strong>Examine {e.item}</strong><small>Escrow #{e.id}: {e.buyer_name} buys from {e.seller_name}, PC {money(e.amount)}</small></div>
          <Link className="btn btn-accent btn-small" to="/app/escrow">Report result</Link>
        </div>
      ))}
      {toDecide.map((b) => (
        <div key={`b${b.id}`} className="todo">
          <div><strong>{t('Record the result')}: {b.match}</strong><small>Win bonus #{b.id}: PC {money(b.amount)} from {b.patron_name} for {b.player_name}</small></div>
          <Link className="btn btn-accent btn-small" to="/app/escrow?type=bonus">{t('Record')}</Link>
        </div>
      ))}
      {bonusWaiting.map((b) => (
        <div key={`bw${b.id}`} className="todo todo-quiet">
          <div><strong>{t('Win bonus')}: {b.match}</strong><small>PC {money(b.amount)} locked for {b.player_name} · {t('Waiting for the result')}</small></div>
          <Link to="/app/escrow?type=bonus">{t('Contracts')}</Link>
        </div>
      ))}
      {waiting.map((e) => (
        <div key={e.id} className="todo todo-quiet">
          <div><strong>{e.item}</strong><small>Escrow #{e.id}, PC {money(e.amount)} locked · {e.accepted_at ? t('Waiting for the vet check') : t('Waiting for the seller to accept')}</small></div>
          <Link to="/app/escrow">{t('Escrow')}</Link>
        </div>
      ))}
      {mine.map((r) => <RequestRow key={r.id} r={r} />)}
    </section>
  );
}

function RequestRow({ r, incoming }: { r: PayRequest; incoming?: boolean }) {
  const { token, account } = useWallet();
  const { t } = useT();
  const { busy, error, run } = useSubmit();
  const pay = () => run(async () => {
    const t0 = performance.now();
    await api.requestPay(token, r.id);
    toast.ok(`Paid PC ${money(r.amount)} to ${r.requester_name}`, `Settled in ${((performance.now() - t0) / 1000).toFixed(2)} s, no fee.`);
  });
  const decline = () => run(async () => { await api.requestDecline(token, r.id); });
  const short = incoming && account.pc < r.amount;

  return (
    <div className={`todo${incoming ? '' : ' todo-quiet'}`}>
      <div>
        <strong>{incoming ? t('{name} asks you for', { name: r.requester_name }) : t('You asked {name} for', { name: r.payer_name })} PC {money(r.amount)}</strong>
        <small>{r.memo ?? 'Payment request'} · {timeAgo(r.created_at)}</small>
        {short && <small className="warn">Not enough PC. <Link to="/app/pay?tab=buy">{t('Buy PC')}</Link> first.</small>}
        {error && <small className="form-error">{error}</small>}
      </div>
      <div className="todo-actions">
        {incoming && <button className="btn btn-accent btn-small" disabled={busy || short} onClick={pay}>{t('Pay now')}</button>}
        <button className="btn btn-ghost btn-small" disabled={busy} onClick={decline}>{incoming ? t('Decline') : t('Withdraw')}</button>
      </div>
    </div>
  );
}
