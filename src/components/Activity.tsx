import type { Account, Tx } from '../api';
import { money, shortHash, timeAgo } from '../format';

function describe(t: Tx, me: Account) {
  const all = me.role === 'bank' || me.role === 'admin';
  switch (t.kind) {
    case 'mint':
      return { title: all ? `${t.to_name} bought PC` : 'Bought PC with USD', sign: all ? 0 : 1 };
    case 'redeem':
      return { title: all ? `${t.from_name} cashed out to USD` : 'Cashed out to USD', sign: all ? 0 : -1 };
    case 'transfer':
      if (t.from_id === me.id) return { title: `Paid ${t.to_name}`, sign: -1 };
      if (t.to_id === me.id) return { title: `Received from ${t.from_name}`, sign: 1 };
      return { title: `${t.from_name} paid ${t.to_name}`, sign: 0 };
    default:
      return { title: 'Genesis', sign: 0 };
  }
}

export default function Activity({ account, txs }: { account: Account; txs: Tx[] }) {
  const all = account.role === 'bank' || account.role === 'admin';
  return (
    <section className="panel activity" aria-labelledby="act-h">
      <div className="panel-head">
        <h2 id="act-h">{all ? 'All network activity' : 'Your activity'}</h2>
        <a href="#/explorer">Open the ledger</a>
      </div>
      {txs.length === 0 ? (
        <p className="empty">No transactions yet. {account.role === 'patron' ? 'Buy PC to get started.' : 'Payments you send or receive will show up here.'}</p>
      ) : (
        <table className="tx-table">
          <thead>
            <tr><th>What</th><th>Reference</th><th className="num">Amount</th><th className="num">Fee</th><th>Block</th><th>When</th></tr>
          </thead>
          <tbody>
            {txs.map((t) => {
              const d = describe(t, account);
              // The sender also paid the fee; show it in their amount.
              const shown = t.kind === 'transfer' && t.from_id === account.id ? t.amount + t.fee : t.amount;
              return (
                <tr key={t.block}>
                  <td data-label="What"><span className={`kind kind-${t.kind}`}>{t.kind === 'mint' ? 'Buy' : t.kind === 'redeem' ? 'Cash-out' : 'Transfer'}</span> {d.title}</td>
                  <td data-label="Reference" className="muted">{t.memo ?? ''}</td>
                  <td data-label="Amount" className={`num amt ${d.sign > 0 ? 'pos' : d.sign < 0 ? 'neg' : ''}`}>
                    {d.sign > 0 ? '+' : d.sign < 0 ? '−' : ''}PC {money(shown)}
                  </td>
                  <td data-label="Fee" className="num muted">{t.fee ? money(t.fee) : '—'}</td>
                  <td data-label="Block"><a href={`#/explorer?b=${t.block}`} title={t.tx_hash}>#{t.block} <code>{shortHash(t.tx_hash)}</code></a></td>
                  <td data-label="When" className="muted">{timeAgo(t.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
