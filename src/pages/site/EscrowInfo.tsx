import { useGoToStep, startTour } from '../../components/Tour';
import { TOUR } from '../../demo';
import { Card, PageHero, Section, Cite, Notes } from '../../ui';

export default function EscrowInfo() {
  const goToStep = useGoToStep();
  const tryIt = () => { startTour(); goToStep(TOUR.findIndex((s) => s.path === '/app/escrow')); };

  return (
    <Notes ids={['akerlof1970', 'ganley2019']}>
      <PageHero eyebrow="Escrow" title="Buy the horse, not the risk"
        lede="The purchase price is locked in a smart contract and released to the breeder only after the vet has confirmed the pre-purchase examination.">
        <button className="btn btn-accent" onClick={tryIt}>Try escrow in the demo</button>
      </PageHero>

      <Section title="The problem: who goes first?">
        <div className="split">
          <p>
            A good polo pony from Argentina costs USD 10,000 to well over 100,000. Argentina exported 2,014 of them in 2018, three quarters of all its horse exports.<Cite id="ganley2019" /> With a bank wire taking days, one side
            always carries the risk: either the patron pays before the horse has passed the vet, or the breeder ships before
            the money has arrived. When buyers and sellers know different things about the goods and cannot protect
            themselves, trades that would benefit both sides do not happen.<Cite id="akerlof1970" />
          </p>
          <p>
            Polo Coin removes the advance: the money is committed, but nobody can touch it until a neutral expert has
            spoken.
          </p>
        </div>
      </Section>

      <Section tone="cream" title="How the escrow contract works">
        <ol className="flow-steps">
          <li><span>1</span><h3>Lock</h3><p>The patron names the horse, the seller and an independent vet, and locks the price. The PC move into the contract’s wallet, visible on the ledger.</p></li>
          <li><span>2</span><h3>Examine</h3><p>The vet examines the horse and reports “passed” or “failed” in the app. Only the vet named in the contract can do this, and the report is due within 14 days.</p></li>
          <li><span>3</span><h3>Settle</h3><p>The contract executes on its own: passed means paid to the breeder within seconds, failed means refunded to the patron. Without a report after 14 days the patron gets the money back, so nothing stays locked forever. The patron can cancel while the check is still open.</p></li>
        </ol>
      </Section>

      <Section title="Why it can be trusted">
        <div className="grid-3">
          <Card title="Nobody holds the money"><p>Locked PC sit in the contract’s own wallet. Not the buyer, not the seller, not Polo Coin can move them outside the rules.</p></Card>
          <Card title="A trusted reporter"><p>A smart contract needs someone to report the real-world event. Here it is the vet, a professional both sides already rely on.</p></Card>
          <Card title="Fully backed"><p>Locked coins remain part of the supply and are backed 1:1 by the reserve like every other PC.</p></Card>
        </div>
      </Section>

      <Section tone="dark" title="The same logic pays a win bonus">
        <p className="band-intro">
          A patron can lock a player’s win bonus for a final. When the tournament organiser records the result, the
          contract pays the player or refunds the patron, without anyone having to remember or chase it. Prize money and
          entry fees at clubs can follow the same pattern after the market launch.
        </p>
        <button className="btn btn-on-dark" onClick={() => { startTour(); goToStep(TOUR.findIndex((s) => s.as === 'organizer')); }}>See the win bonus in the demo</button>
      </Section>
    </Notes>
  );
}
