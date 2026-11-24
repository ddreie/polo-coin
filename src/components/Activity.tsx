import { Link } from 'react-router-dom';
import type { Account, Tx } from '../api';
import { money, shortHash, timeAgo } from '../format';
import { useT } from '../i18n';

const KIND_LABEL: Record<Tx['kind'], string> = {
  genesis: 'Genesis', mint: 'Buy', transfer: 'Transfer', redeem: 'Cash-out', lock: 'Escrow', release: 'Escrow', refund: 'Escrow',
};

function describe(t: Tx, me: Account) {
  const all = me.role === 'bank' || me.role === 'admin';
  switch (t.kind) {
    case 'mint':
      return { title: all ? `${t.to_name} bought PC` : 'Bought PC with USD', sign: all ? 0 : 1 };
    case 'redeem':
      return { title: all ? `${t.from_name} cashed out to USD` : 'Cashed out to USD', sign: all ? 0 : -1 };
    case 'lock':
      return { title: t.from_id === me.id ? 'Locked in escrow contract' : `${t.from_name} locked PC in escrow`, sign: t.from_id === me.id ? -1 : 0 };
    case 'release':
      return { title: t.to_id === me.id ? 'Escrow paid out to you' : `Escrow paid to ${t.to_name}`, sign: t.to_id === me.id ? 1 : 0 };
    case 'refund':
      return { title: t.to_id === me.id ? 'Escrow refunded to you' : `Escrow refunded to ${t.to_name}`, sign: t.to_id === me.id ? 1 : 0 };
    case 'transfer':
      if (t.from_id === me.id) return { title: `Paid ${t.to_name}`, sign: -1 };
      if (t.to_id === me.id) return { title: `Received from ${t.from_name}`, sign: 1 };
      return { title: `${t.from_name} paid ${t.to_name}`, sign: 0 };
    default:
      return { title: 'Genesis', sign: 0 };
  }
}

export default function Activity({ account, txs, limit }: { account: Account; txs: Tx[]; limit?: number }) {
  const { t } = useT();
  const all = account.role === 'bank' || account.role === 'admin';
  const shown = limit ? txs.slice(0, limit) : txs;
  return (
    <section className="panel activity" aria-labelledby="act-h">
      <div className="panel-head">
        <h2 id="act-h">{limit ? t('Recent activity') : all ? 'All network activity' : t('Activity')}</h2>
        {limit && txs.length > limit ? <Link to="/app/activity">{t('See all')}</Link> : <Link to="/explorer">Open the ledger</Link>}
      </div>
      {txs.length === 0 ? (
        <p className="empty">No transactions yet. {account.role === 'patron' ? 'Buy PC to get started.' : 'Payments you send or receive will show up here.'}</p>
      ) : (
        <table className="tx-table">
          <thead>
            <tr><th>What</th><th>Reference</th><th className="num">Amount</th><th className="num">Fee</th><th>Block</th><th>When</th></tr>
          </thead>
          <tbody>
            {shown.map((tx) => {
              const d = describe(tx, account);
              return (
                <tr key={tx.block}>
                  <td data-label="What"><span className={`kind kind-${tx.kind}`}>{KIND_LABEL[tx.kind]}</span> {d.title}</td>
                  <td data-label="Reference" className="muted">{tx.memo ?? ''}</td>
                  <td data-label="Amount" className={`num amt ${d.sign > 0 ? 'pos' : d.sign < 0 ? 'neg' : ''}`}>
                    {d.sign > 0 ? '+' : d.sign < 0 ? '−' : ''}PC {money(tx.amount)}
                  </td>
                  <td data-label="Fee" className="num muted">{tx.fee ? `USD ${money(tx.fee)}` : '—'}</td>
                  <td data-label="Block"><Link to={`/explorer?b=${tx.block}`} title={tx.tx_hash}>#{tx.block} <code>{shortHash(tx.tx_hash)}</code></Link></td>
                  <td data-label="When" className="muted">{timeAgo(tx.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
