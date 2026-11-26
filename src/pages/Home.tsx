import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { startTour, useGoToStep } from '../components/Tour';
import { money0, SWIFT, wireCost } from '../format';
import { useSession } from '../session';
import { ButtonLink, Cite, Notes, Section } from '../ui';
import { useStats } from '../useStats';
import { TeamStack } from '../components/Team';

const Coin = lazy(() => import('../components/Coin'));

export default function Home() {
  const signedIn = !!useSession().account;
  const stats = useStats();
  const goToStep = useGoToStep();
  const tour = () => { startTour(); goToStep(0); };

  return (
    <Notes ids={['paper', 'fsb2025', 'ganley2019']}>
      <section className="home-hero">
        <div className="wrap home-hero-inner">
          <p className="hero-badge">
            <img src="/brand/icon-on-dark.svg" width="18" height="18" alt="" />
            A US dollar stablecoin for the polo economy
          </p>
          <h1>Pay your polo team in Argentina the same minute.</h1>
          <p className="home-lede">
            Patrons in Europe and the US pay players, breeders and grooms in Argentina by bank wire, at 3.4–6.6% in fees from a franc, euro or pound account
            and several days of waiting.<Cite id="paper" /> Polo Coin is backed 1:1 by US dollars. You pay 1% when you buy it.
            Every payment after that is free and arrives in seconds.
          </p>
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={tour}>Start the guided demo</button>
            <Link className="btn btn-on-dark" to={signedIn ? '/app' : '/how-it-works'}>{signedIn ? 'Open wallet' : 'How it works'}</Link>
          </div>
        </div>
        <div className="coin-stage">
          <Suspense fallback={<div className="coin" />}><Coin /></Suspense>
        </div>
      </section>

      <section className="band band-plain compare-band" aria-labelledby="compare-h">
        <div className="wrap">
          <header className="band-head">
            <h2 id="compare-h">The same payment, two ways</h2>
            <p className="band-intro">
              Enter a tournament fee. The bank wire assumes the usual correspondent banking route from a European account.
              Only about a third of retail cross-border payments arrive within one hour.<Cite id="fsb2025" />
            </p>
          </header>
          <Race />
        </div>
      </section>

      <section className="figures-row" aria-label="Live figures from the prototype">
        <div className="wrap">
          <dl className="ledger-figures">
            <div><dt>In the reserve, live</dt><dd>{stats ? <><small>USD</small>{money0(stats.reserve_usd)}</> : '…'}</dd></div>
            <div><dt>Backing of every coin</dt><dd>{stats ? (stats.supply_pc ? `${Math.round((stats.reserve_usd / stats.supply_pc) * 100)}%` : '100%') : '…'}</dd></div>
            <div><dt>Transactions on the ledger</dt><dd>{stats ? stats.tx_count : '…'}</dd></div>
            <div><dt>Settlement in the demo</dt><dd>&lt;1 s</dd></div>
          </dl>
        </div>
      </section>

      <Section title="One coin, four kinds of people" intro="Polo money flows one way: from patrons abroad to the professionals, breeders and grooms who come from Argentina. Polo Coin serves both ends.">
        <div className="columns columns-4">
          {AUDIENCES.map((a) => (
            <Link key={a.title} className="audience" to={`/solutions#${a.id}`}>
              <span className="audience-role">{a.role}</span>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="cream" title="How a tournament payment works" intro="Three steps, from the patron’s bank account to dollars in Argentina.">
        <ol className="sequence">
          <li><h3>Buy</h3><p>The patron buys Polo Coin with CHF, EUR, GBP or USD. The dollars go into the reserve, the same amount of PC is issued. Fee: 1%, once.</p></li>
          <li><h3>Pay</h3><p>PC moves from wallet to wallet in seconds, 24/7, without fees. Every payment is a block in a hash-chained ledger.</p></li>
          <li><h3>Use or cash out</h3><p>The player keeps PC as dollars, pays a breeder or groom with it, or cashes out at the partner bank, 1:1 and free.</p></li>
        </ol>
        <p className="more"><Link to="/how-it-works">The full flow, step by step</Link></p>
      </Section>

      <Section tone="dark">
        <div className="split">
          <div>
            <h2>Buy the horse, not the risk.</h2>
            <p className="band-intro">
              Argentina exported 2,014 polo horses in 2018, most of them to the US and the UK.<Cite id="ganley2019" /> Today either the
              buyer pays before the horse has passed the vet, or the breeder ships before being paid. With Polo Coin the
              price waits in a smart contract and is released the moment the vet confirms the pre-purchase examination.
            </p>
            <ButtonLink to="/escrow" variant="on-dark">How escrow works</ButtonLink>
          </div>
          <ol className="contract-trail">
            <li><strong>Locked</strong><span>The patron’s PC move into the contract</span></li>
            <li><strong>Vet check</strong><span>The named vet reports the result</span></li>
            <li><strong>Released</strong><span>Paid to the breeder, or refunded</span></li>
          </ol>
        </div>
      </Section>

      <Section title="Built on trust and transparency">
        <div className="columns columns-3">
          <div><h3>Fully backed</h3><p>Every PC is matched by a US dollar: at least 30% as bank deposits, the rest in short-term US Treasury bills. <Link to="/transparency">See the live proof</Link>.</p></div>
          <div><h3>Identified wallets</h3><p>No anonymous accounts. Every holder passes an identity check before the first payment. <Link to="/security">Security and regulation</Link>.</p></div>
          <div><h3>Verifiable ledger</h3><p>Each transaction carries the fingerprint of the one before. Change one, and the chain breaks. <Link to="/explorer">Verify it yourself</Link>.</p></div>
        </div>
      </Section>

      <section className="band band-plain team-band" aria-labelledby="team-h">
        <div className="wrap"><div className="team-band-inner">
          <div>
            <h2 id="team-h">Six students, one coin</h2>
            <p className="band-intro">
              Polo Coin was designed and built in the FinTech &amp; InsurTech seminar at the University of Zurich, from the
              business case to the working prototype.
            </p>
            <p className="more"><Link to="/about#team">Meet the team</Link></p>
          </div>
          <TeamStack />
        </div></div>
      </section>

      <section className="cta-band">
        <div className="wrap cta-inner">
          <div>
            <h2>See it work in three minutes</h2>
            <p>Eight steps through the whole business case: buy, pay, receive in Spanish, escrow a horse, let the vet release it, pay a win bonus, cash out, and check the reserve.</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={tour}>Start the guided demo</button>
            <Link className="btn btn-on-dark" to="/login">Choose an account</Link>
          </div>
        </div>
      </section>
    </Notes>
  );
}

const AUDIENCES = [
  { id: 'patrons', role: 'Pays', title: 'Patrons', text: 'Pay players, grooms and horses abroad for 1% instead of 3.4–6.6%, with the full cost known up front.' },
  { id: 'players', role: 'Receives', title: 'Professionals', text: 'Get the tournament fee in US dollars within seconds, before the next chukka.' },
  { id: 'breeders', role: 'Receives', title: 'Breeders', text: 'Ship the horse knowing the price is already locked in escrow.' },
  { id: 'grooms', role: 'Receives and sends', title: 'Grooms', text: 'Receive wages and send savings home to the family without fixed bank fees.' },
];

/** The same payment by bank wire and by Polo Coin, set like two lines of a bank statement. */
function Race() {
  const [amount, setAmount] = useState(20000);
  const [run, setRun] = useState(0);
  const pcFee = amount * 0.01;
  const wireLow = amount * wireCost(amount, 'low');
  const wireHigh = amount * wireCost(amount, 'high');

  return (
    <figure className="race">
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

      <table className="race-table">
        <thead>
          <tr><th scope="col">Route</th><th scope="col">Arrives</th><th scope="col" className="num">Cost in USD</th></tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Bank wire (SWIFT)</th>
            <td>{SWIFT.daysLow}–{SWIFT.daysHigh} business days<span className="track"><span key={`w${run}`} className="runner runner-slow" /></span></td>
            <td className="num">{money0(wireLow)}–{money0(wireHigh)}</td>
          </tr>
          <tr className="race-pc">
            <th scope="row">Polo Coin</th>
            <td>Seconds, 24/7<span className="track"><span key={`p${run}`} className="runner runner-fast" /></span></td>
            <td className="num">{money0(pcFee)}<small>once, when buying</small></td>
          </tr>
        </tbody>
      </table>

      <figcaption>
        On this payment the patron keeps up to <strong>USD {money0(Math.max(0, wireHigh - pcFee))}</strong>, and the player is
        paid before the next chukka.
      </figcaption>
    </figure>
  );
}
