import { useEffect, useMemo, useState } from 'react';
import { api, type Stats, type Tx } from '../api';
import { useSearchParams } from 'react-router-dom';
import { money, shortHash, timeAgo } from '../format';
import { blockPayload, verifyChain, type BlockCheck } from '../verify';

const kindLabel: Record<Tx['kind'], string> = { genesis: 'Genesis', mint: 'Mint', transfer: 'Transfer', redeem: 'Burn' };

interface Result { checks: Map<number, BlockCheck>; ok: boolean; ms: number; count: number; tampered: number | null }

export default function Explorer() {
  const [blocks, setBlocks] = useState<Tx[] | null>(null);   // newest first, as served
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [tamper, setTamper] = useState<number | null>(null); // block whose amount we altered locally
  const [params] = useSearchParams();
  const focus = Number(params.get('b')) || null;

  useEffect(() => {
    const load = () => Promise.all([api.explorer(2000), api.stats()])
      .then(([b, s]) => { setBlocks(b); setStats(s); setError(null); })
      .catch((e) => setError((e as Error).message));
    load();
    const id = setInterval(() => { if (tamper === null) load(); }, 8000);
    return () => clearInterval(id);
  }, [tamper]);

  useEffect(() => {
    if (focus && blocks) document.getElementById(`block-${focus}`)?.scrollIntoView({ block: 'center' });
  }, [focus, blocks]);

  // What is shown: the served chain, or a locally altered copy during the tampering demo.
  const shown = useMemo(() => {
    if (!blocks || tamper === null) return blocks;
    return blocks.map((b) => (b.block === tamper ? { ...b, amount: b.amount + 10000 } : b));
  }, [blocks, tamper]);

  // New data arriving invalidates an earlier result.
  useEffect(() => { setResult((r) => (r && r.count !== (blocks?.length ?? 0) ? null : r)); }, [blocks]);

  async function verify(list: Tx[], tampered: number | null) {
    setBusy(true);
    const t0 = performance.now();
    const checks = await verifyChain([...list].reverse());
    await new Promise((r) => setTimeout(r, 350)); // let the person see it working
    setResult({
      checks: new Map(checks.map((c) => [c.block, c])),
      ok: checks.every((c) => c.hashOk && c.linkOk),
      ms: performance.now() - t0, count: list.length, tampered,
    });
    setBusy(false);
  }

  function simulate() {
    if (!blocks) return;
    // pick a non-genesis block in the middle of the chain
    const candidates = blocks.filter((b) => b.kind !== 'genesis');
    const target = candidates[Math.floor(candidates.length / 2)];
    if (!target) return;
    setTamper(target.block);
    const altered = blocks.map((b) => (b.block === target.block ? { ...b, amount: b.amount + 10000 } : b));
    verify(altered, target.block);
    setTimeout(() => document.getElementById(`block-${target.block}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 400);
  }

  function restore() {
    setTamper(null);
    setResult(null);
  }

  const canTamper = (blocks?.filter((b) => b.kind !== 'genesis').length ?? 0) >= 1;

  return (
    <div className="wrap explorer">
        <div className="explorer-head">
          <div>
            <h1>Public ledger</h1>
            <p className="lede">
              Every Polo Coin transaction is a block that contains the fingerprint (SHA-256 hash) of the block before it.
              Changing any past transaction would break every later link. Wallets appear only as addresses and payment
              references only as hashes, so amounts are transparent but people are not named.
            </p>
          </div>
          {stats && (
            <dl className="chain-status">
              <div><dt>Blocks</dt><dd>{blocks?.length ?? stats.tx_count + 1}</dd></div>
              <div><dt>Reserve / supply</dt><dd>{money(stats.reserve_usd)} / {money(stats.supply_pc)}</dd></div>
            </dl>
          )}
        </div>

        <section className={`verify${result ? (result.ok ? ' verify-ok' : ' verify-bad') : ''}`} aria-live="polite">
          <div className="verify-text">
            {!result && !busy && (
              <>
                <h2>Check the chain yourself</h2>
                <p>Your browser downloads every block and recalculates each hash from the block's public data. Nothing is taken on trust from the server.</p>
              </>
            )}
            {busy && <><h2>Verifying…</h2><p>Recalculating {blocks?.length} hashes in your browser.</p></>}
            {result && !busy && result.ok && (
              <>
                <h2>All {result.count} blocks verified</h2>
                <p>Every hash matches its block's contents and every block points to the one before it. Checked in your browser in {Math.max(1, Math.round(result.ms - 350))} ms.</p>
              </>
            )}
            {result && !busy && !result.ok && (
              <>
                <h2>Tampering detected in block #{[...result.checks.values()].find((c) => !c.hashOk || !c.linkOk)?.block}</h2>
                <p>
                  {result.tampered !== null
                    ? <>This is a simulation: the amount of block #{result.tampered} was raised by PC 10,000 in your browser only. Its stored hash no longer matches its contents. Recalculating that hash would not help either, because block #{result.tampered + 1} still points to the original one.</>
                    : <>A block's contents no longer match its hash, or a block does not point to the one before it.</>}
                </p>
              </>
            )}
          </div>
          <div className="verify-actions">
            {tamper === null ? (
              <>
                <button className="btn" onClick={() => blocks && verify(blocks, null)} disabled={!blocks || busy}>
                  {result?.ok ? 'Verify again' : 'Verify chain'}
                </button>
                <button className="btn btn-ghost" onClick={simulate} disabled={!canTamper || busy}>Simulate tampering</button>
              </>
            ) : (
              <button className="btn" onClick={restore} disabled={busy}>Restore original data</button>
            )}
          </div>
        </section>

        {error && <p className="form-error">{error}</p>}
        {!blocks && !error && <p className="muted">Loading the ledger…</p>}

        <ol className="chain">
          {shown?.map((b) => {
            const c = result?.checks.get(b.block);
            const bad = c && (!c.hashOk || !c.linkOk);
            return (
              <li key={b.block} id={`block-${b.block}`} className={`block block-${b.kind}${focus === b.block ? ' focus' : ''}${c ? (bad ? ' is-bad' : ' is-ok') : ''}`}>
                <div className="block-no">#{b.block}</div>
                <div className="block-body">
                  <div className="block-top">
                    <span className={`kind kind-${b.kind}`}>{kindLabel[b.kind]}</span>
                    {b.kind !== 'genesis' && (
                      <span className={`block-amt${tamper === b.block ? ' altered' : ''}`}>
                        PC {money(b.amount)}{b.fee ? <small> + fee {money(b.fee)}</small> : null}
                      </span>
                    )}
                    {tamper === b.block && (
                      <span className="sim-note">Simulated change, originally PC {money(b.amount - 10000)}</span>
                    )}
                    {c && (
                      <span className={`check ${bad ? 'check-bad' : 'check-ok'}`}>
                        {!c.hashOk ? 'Hash does not match contents' : !c.linkOk ? 'Link to previous block broken' : 'Verified'}
                      </span>
                    )}
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
                    {c && !c.hashOk && <span className="recomputed">Recalculated <code title={c.computed}>{shortHash(c.computed)}</code></span>}
                  </div>
                  {c && (
                    <details className="payload">
                      <summary>What was hashed</summary>
                      <code>{blockPayload(b)}</code>
                    </details>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
    </div>
  );
}
