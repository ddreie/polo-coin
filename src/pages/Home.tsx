import { useState } from 'react';
import { Link } from 'react-router-dom';
import { startTour, useGoToStep } from '../components/Tour';
import { money0, SWIFT } from '../format';
import { useSession } from '../session';
import { ButtonLink, Card, Eyebrow, Section, Stat } from '../ui';
import { useStats } from '../useStats';

export default function Home() {
  const signedIn = !!useSession().account;
  const stats = useStats();
  const goToStep = useGoToStep();
  const tour = () => { startTour(); goToStep(0); };

  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <Eyebrow>The payment currency of the polo world</Eyebrow>
          <h1>Pay your polo team in Argentina the same minute.</h1>
          <p className="lede">
            Patrons in Europe and the US pay professionals, breeders and grooms in Argentina by bank wire:
            2–5% in fees and several days of waiting. Polo Coin is a stablecoin backed 1:1 by US dollars.
            One fee of 1% when you buy it. Every payment after that is free and arrives in seconds.
          </p>
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={tour}>Start the guided demo</button>
            <Link className="btn btn-ghost" to={signedIn ? '/app' : '/how-it-works'}>{signedIn ? 'Open wallet' : 'How it works'}</Link>
          </div>
        </div>
        <Race />
      </section>

      <section className="live-strip" aria-label="Live figures from the prototype">
        <div className="wrap live-grid">
          <Stat value={stats ? `USD ${money0(stats.reserve_usd)}` : '…'} label="in the reserve, live" />
          <Stat value={stats ? (stats.supply_pc ? `${Math.round((stats.reserve_usd / stats.supply_pc) * 100)}%` : '100%') : '…'} label="backing of every coin" />
          <Stat value={stats ? String(stats.tx_count) : '…'} label="transactions on the ledger" />
          <Stat value="< 1 s" label="settlement in the demo" />
        </div>
      </section>

      <Section title="One coin, four kinds of people" intro="Polo money flows one way: from patrons abroad to the professionals, breeders and grooms who come from Argentina. Polo Coin serves both ends.">
        <div className="grid-4">
          {AUDIENCES.map((a) => (
            <Link key={a.title} className="audience" to={`/solutions#${a.id}`}>
              <span className="audience-role">{a.role}</span>
              <h3>{a.title}</h3>
              <p>{a.text}</p>
              <span className="audience-more">Learn more →</span>
            </Link>
          ))}
        </div>
      </Section>

      <Section tone="cream" title="How a tournament payment works">
        <ol className="flow-steps">
          <li><span>1</span><h3>Buy</h3><p>The patron buys Polo Coin with CHF, EUR, GBP or USD. The dollars go into the reserve, the same amount of PC is issued. Fee: 1%, once.</p></li>
          <li><span>2</span><h3>Pay</h3><p>PC moves from wallet to wallet in seconds, 24/7, without fees. Every payment is a block in a hash-chained ledger.</p></li>
          <li><span>3</span><h3>Use or cash out</h3><p>The player keeps PC as dollars, pays a breeder or groom with it, or cashes out at the partner bank, 1:1 and free.</p></li>
        </ol>
        <p><Link to="/how-it-works">The full flow, step by step →</Link></p>
      </Section>

      <Section tone="dark">
        <div className="split">
          <div>
            <Eyebrow>Escrow for horse purchases</Eyebrow>
            <h2>Buy the horse, not the risk.</h2>
            <p className="band-intro">
              Today either the buyer pays before the horse has passed the vet, or the breeder ships before being paid.
              With Polo Coin the price waits in a smart contract and is released the moment the vet confirms the
              pre-purchase examination.
            </p>
            <ButtonLink to="/escrow" variant="on-dark">How escrow works</ButtonLink>
          </div>
          <ol className="mini-contract">
            <li><strong>Locked</strong><span>Patron’s PC move into the contract</span></li>
            <li><strong>Vet check</strong><span>The named vet reports the result</span></li>
            <li><strong>Released</strong><span>Paid to the breeder, or refunded</span></li>
          </ol>
        </div>
      </Section>

      <Section title="Built on trust and transparency">
        <div className="grid-3">
          <Card title="Fully backed"><p>Every PC is matched by a US dollar: at least 30% as bank deposits, the rest in short-term US Treasury bills. <Link to="/transparency">See the live proof</Link>.</p></Card>
          <Card title="Identified wallets"><p>No anonymous accounts. Every holder passes an identity check before the first payment. <Link to="/security">Security and regulation</Link>.</p></Card>
          <Card title="Verifiable ledger"><p>Each transaction carries the fingerprint of the one before. Change one, and the chain breaks. <Link to="/explorer">Verify it yourself</Link>.</p></Card>
        </div>
      </Section>

      <section className="cta-band">
        <div className="wrap cta-inner">
          <div>
            <h2>See it work in three minutes</h2>
            <p>Seven steps through the whole business case: buy, pay, receive in Spanish, escrow a horse, let the vet release it, cash out, and check the reserve.</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={tour}>Start the guided demo</button>
            <Link className="btn btn-on-dark" to="/login">Choose an account</Link>
          </div>
        </div>
      </section>
    </>
  );
}

const AUDIENCES = [
  { id: 'patrons', role: 'Pays', title: 'Patrons', text: 'Pay players, grooms and horses abroad for 1% instead of 2–5%, with the full cost known up front.' },
  { id: 'players', role: 'Receives', title: 'Professionals', text: 'Get the tournament fee in US dollars within seconds, before the next chukka.' },
  { id: 'breeders', role: 'Receives', title: 'Breeders', text: 'Ship the horse knowing the price is already locked in escrow.' },
  { id: 'grooms', role: 'Receives and sends', title: 'Grooms', text: 'Receive wages and send savings home to the family without fixed bank fees.' },
];

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
        <div className="lane-foot">Fee USD {money0(pcFee)}, once, when buying</div>
      </div>

      <figcaption>
        On this payment the patron keeps up to <strong>USD {money0(Math.max(0, wireHigh - pcFee))}</strong> and
        the player is paid before the next chukka.
      </figcaption>
    </figure>
  );
}
