import { useEffect, useState } from 'react';
import { api, type Stats, type Tx } from '../api';
import { DemoBanner, Logo } from '../components/Brand';
import { money, shortHash, timeAgo } from '../format';

const kindLabel: Record<Tx['kind'], string> = { genesis: 'Genesis', mint: 'Mint', transfer: 'Transfer', redeem: 'Burn' };

export default function Explorer({ signedIn }: { signedIn: boolean }) {
  const [blocks, setBlocks] = useState<Tx[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const focus = Number(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('b')) || null;

  useEffect(() => {
    const load = () => Promise.all([api.explorer(60), api.stats()])
      .then(([b, s]) => { setBlocks(b); setStats(s); setError(null); })
      .catch((e) => setError((e as Error).message));
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (focus && blocks) document.getElementById(`block-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus, blocks]);

  return (
    <div className="page">
      <DemoBanner />
      <header className="topbar wrap">
        <Logo />
        <nav className="topnav">
          <a className="btn btn-small" href={signedIn ? '#/app' : '#/login'}>{signedIn ? 'Back to wallet' : 'Log in'}</a>
        </nav>
      </header>
      <main className="wrap explorer">
        <div className="explorer-head">
          <div>
            <h1>Public ledger</h1>
            <p className="lede">
              Every Polo Coin transaction is a block that contains the fingerprint (SHA-256 hash) of the block before it.
              Changing any past transaction would break every later link. Wallets appear only as addresses, so amounts are
              transparent but people are not named.
            </p>
          </div>
          {stats && (
            <dl className="chain-status">
              <div><dt>Chain</dt><dd className={stats.chain_valid ? 'ok' : 'bad'}>{stats.chain_valid ? 'Intact' : 'Broken'}</dd></div>
              <div><dt>Blocks</dt><dd>{stats.tx_count + 1}</dd></div>
              <div><dt>Reserve / supply</dt><dd>{money(stats.reserve_usd)} / {money(stats.supply_pc)}</dd></div>
            </dl>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
        {!blocks && !error && <p className="muted">Loading the ledger…</p>}

        <ol className="chain">
          {blocks?.map((b) => (
            <li key={b.block} id={`block-${b.block}`} className={`block block-${b.kind}${focus === b.block ? ' focus' : ''}`}>
              <div className="block-no">#{b.block}</div>
              <div className="block-body">
                <div className="block-top">
                  <span className={`kind kind-${b.kind}`}>{kindLabel[b.kind]}</span>
                  {b.kind !== 'genesis' && <span className="block-amt">PC {money(b.amount)}{b.fee ? <small> + fee {money(b.fee)}</small> : null}</span>}
                  <span className="muted">{timeAgo(b.created_at)}</span>
                </div>
                {b.kind !== 'genesis' && (
                  <div className="block-flow">
                    <code>{b.from_wallet ? shortHash(b.from_wallet) : 'Reserve (new coins)'}</code>
                    <span aria-hidden="true">to</span>
                    <code>{b.kind === 'redeem' ? `Burned, paid out by ${shortHash(b.to_wallet)}` : shortHash(b.to_wallet)}</code>
                  </div>
                )}
                <div className="block-hashes">
                  <span>Hash <code title={b.tx_hash}>{shortHash(b.tx_hash)}</code></span>
                  <span>Previous <code title={b.prev_hash}>{shortHash(b.prev_hash)}</code></span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
