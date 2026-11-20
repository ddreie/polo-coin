import { useEffect, useState } from 'react';
import { api, type Stats } from '../api';
import { DemoBanner, Logo } from '../components/Brand';
import { money0, SWIFT } from '../format';

export default function Home({ signedIn }: { signedIn: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { api.stats().then(setStats).catch(() => undefined); }, []);

  return (
    <div className="page">
      <DemoBanner />
      <header className="topbar wrap">
        <Logo />
        <nav className="topnav">
          <a href="#/explorer">Ledger</a>
          <a className="btn btn-small" href={signedIn ? '#/app' : '#/login'}>{signedIn ? 'Open wallet' : 'Log in'}</a>
        </nav>
      </header>

      <main>
        <section className="hero wrap">
          <div className="hero-copy">
            <h1>Pay your polo team in Argentina the same minute.</h1>
            <p className="lede">
              Patrons in Europe and the US pay professionals and breeders in Argentina by bank wire:
              2–5&nbsp;% in fees and up to a week of waiting. Polo Coin is a fully USD-backed stablecoin
              that settles instantly for 1&nbsp;%, and partner banks in Argentina pay it out in dollars.
            </p>
            <div className="hero-actions">
              <a className="btn" href={signedIn ? '#/app' : '#/login'}>Try the demo</a>
              <a className="btn btn-ghost" href="#/explorer">See the public ledger</a>
            </div>
          </div>
          <Race />
        </section>

        <section className="flow wrap" aria-labelledby="flow-h">
          <h2 id="flow-h">How a tournament payment works</h2>
          <ol className="steps">
            <li>
              <h3>Patron buys Polo Coin</h3>
              <p>USD from the patron's bank account goes into the reserve. The same amount of PC is issued, 1&nbsp;PC = 1&nbsp;USD.</p>
            </li>
            <li>
              <h3>Patron pays the player</h3>
              <p>PC arrives in the player's wallet within seconds, any day of the week. The sender pays a 1&nbsp;% fee.</p>
            </li>
            <li>
              <h3>Player uses or cashes out</h3>
              <p>The player pays a breeder in PC, or redeems PC at the partner bank for USD. Redeemed PC is destroyed.</p>
            </li>
          </ol>
        </section>

        <section className="reserve-strip" aria-labelledby="res-h">
          <div className="wrap reserve-inner">
            <div>
              <h2 id="res-h">Every coin is backed by a dollar</h2>
              <p>These figures come live from the prototype's database. Anyone can check them.</p>
            </div>
            <dl className="reserve-figs">
              <div><dt>USD in reserve</dt><dd>{stats ? money0(stats.reserve_usd) : '…'}</dd></div>
              <div><dt>PC in circulation</dt><dd>{stats ? money0(stats.supply_pc) : '…'}</dd></div>
              <div><dt>Backing</dt><dd>{stats ? (stats.supply_pc ? `${Math.round((stats.reserve_usd / stats.supply_pc) * 100)} %` : '100 %') : '…'}</dd></div>
              <div><dt>Transactions</dt><dd>{stats ? stats.tx_count : '…'}</dd></div>
            </dl>
          </div>
        </section>

        <section className="cta wrap">
          <h2>Play through a payment yourself</h2>
          <p>
            Five demo accounts are ready: a patron, a player, a breeder, the partner bank and the treasury.
            Log in as the patron, pay the player, then log in as the player to see the money arrive.
          </p>
          <div className="hero-actions">
            <a className="btn" href="#/login">Choose a demo account</a>
            <a className="btn btn-ghost" href="#/register">Open your own account</a>
          </div>
        </section>
      </main>

      <footer className="footer wrap">
        <span>Polo Coin is a student prototype for the FinTech &amp; InsurTech seminar, University of Zurich, HS 2026.</span>
        <span>Not a real financial product.</span>
      </footer>
    </div>
  );
}

/** Hero: the same payment by bank wire and by Polo Coin, side by side. */
function Race() {
  const [amount, setAmount] = useState(20000);
  const [run, setRun] = useState(0);
  const pcFee = amount * 0.01;
  const wireLow = amount * SWIFT.feeLow;
  const wireHigh = amount * SWIFT.feeHigh;

  return (
    <figure className="race" aria-label="Cost and speed comparison">
      <label className="race-amount">
        <span>Tournament fee to send</span>
        <span className="race-input">
          <span>USD</span>
          <input
            type="number" min={100} step={500} value={amount}
            onChange={(e) => { setAmount(Math.max(0, Number(e.target.value) || 0)); setRun((r) => r + 1); }}
          />
        </span>
      </label>

      <div className="lane lane-wire">
        <div className="lane-head">
          <strong>Bank wire (SWIFT)</strong>
          <span>{SWIFT.daysLow}–{SWIFT.daysHigh} business days</span>
        </div>
        <div className="track"><span key={`w${run}`} className="runner runner-slow" /></div>
        <div className="lane-foot">Fees USD {money0(wireLow)}–{money0(wireHigh)}</div>
      </div>

      <div className="lane lane-pc">
        <div className="lane-head">
          <strong>Polo Coin</strong>
          <span>Seconds, 24/7</span>
        </div>
        <div className="track"><span key={`p${run}`} className="runner runner-fast" /></div>
        <div className="lane-foot">Fee USD {money0(pcFee)}</div>
      </div>

      <figcaption>
        On this payment the patron keeps up to <strong>USD {money0(Math.max(0, wireHigh - pcFee))}</strong> and
        the player is paid before the next chukka.
      </figcaption>
    </figure>
  );
}
