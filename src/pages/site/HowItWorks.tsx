import { Link } from 'react-router-dom';
import { ButtonLink, Card, PageHero, Section, Cite, Notes } from '../../ui';

const FLOW = [
  { who: 'Patron', where: 'Europe / US', what: 'Pays CHF, EUR, GBP or USD from the usual bank account.' },
  { who: 'European partner bank', where: 'Conversion', what: 'Converts to US dollars at near-wholesale rates.' },
  { who: 'Custodian bank', where: 'Reserve', what: 'Holds the dollars apart from Polo Coin’s own money. PC is issued 1:1.' },
  { who: 'Wallets', where: 'Polo Coin network', what: 'PC moves between identified wallets in seconds, free of charge.' },
  { who: 'Argentine partner', where: 'Payout', what: 'Redeems PC and pays US dollars into the recipient’s account.' },
];

export default function HowItWorks() {
  return (
    <Notes ids={['swift2024', 'nilsson2022', 'fsb2025']}>
      <PageHero eyebrow="How it works" title="From patron to pampa in seconds"
        lede="Polo Coin replaces the chain of correspondent banks with one shared ledger. You pay one fee when you buy the coin. Everything after that is free.">
        <ButtonLink to="/login" variant="accent">Try it in the demo</ButtonLink>
      </PageHero>

      <Section title="The money flow" intro="Five parties, one rule: there is never more Polo Coin than US dollars in the reserve.">
        <ol className="flow-diagram">
          {FLOW.map((f, i) => (
            <li key={f.who}>
              <span className="flow-n">{i + 1}</span>
              <strong>{f.who}</strong>
              <em>{f.where}</em>
              <p>{f.what}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="cream" title="Three things you can do with a coin">
        <div className="grid-3">
          <Card title="Buy (mint)">
            <p>US dollars go into the reserve and the same amount of PC is created in your wallet. This is the only moment you pay a fee: 1%, covering currency conversion and the later cash-out.</p>
          </Card>
          <Card title="Pay (transfer)">
            <p>PC moves from your wallet to any identified wallet in seconds, on weekends too. Free, final, and recorded as a block in the ledger. Add a reference like “Tournament fee, Gstaad”.</p>
          </Card>
          <Card title="Cash out (burn)">
            <p>The partner bank pays you US dollars 1:1 and the PC is destroyed. Or keep it: in Argentina a dollar instrument is a welcome store of value.</p>
          </Card>
        </div>
      </Section>

      <Section title="Why it is faster than a bank wire">
        <div className="split">
          <div>
            <p>
              A wire from Zurich to Buenos Aires passes several banks. 90% of SWIFT payments reach the receiving bank within
              an hour,<Cite id="swift2024" /> but the last step into the customer’s account is the bottleneck: compliance checks, capital controls and
              opening hours.<Cite id="nilsson2022" /> Only about a third of retail cross-border payments arrive within one hour.<Cite id="fsb2025" />
            </p>
            <p>
              Polo Coin settles on its own ledger. Identity checks happen once, when a wallet is opened, not on every payment.
              That is why a transfer takes seconds, at any time.
            </p>
          </div>
          <dl className="vs">
            <div><dt>Bank wire (SWIFT)</dt><dd>1–3 days, 2–5% cost</dd></div>
            <div className="vs-pc"><dt>Polo Coin</dt><dd>Seconds, 1% once</dd></div>
          </dl>
        </div>
      </Section>

      <Section tone="cream" title="Under the hood" intro="The prototype simulates a blockchain in a database. The principles are the same.">
        <div className="grid-2">
          <Card title="A hash-chained ledger">
            <p>Every transaction becomes a block that contains the SHA-256 fingerprint of the previous block. Changing any past payment would change its fingerprint and break every later link. <Link to="/explorer">Try to tamper with it</Link>.</p>
          </Card>
          <Card title="Programmable money">
            <p>Smart contracts move money when a condition is met. The escrow contract releases a horse’s price when the vet confirms the examination. <Link to="/escrow">See escrow</Link>.</p>
          </Card>
        </div>
      </Section>
    </Notes>
  );
}
