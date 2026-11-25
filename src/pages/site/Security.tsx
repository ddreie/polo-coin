import { Link } from 'react-router-dom';
import { Card, PageHero, Section, Cite, Notes } from '../../ui';

const REGULATORS: [string, string, string, string][] = [
  ['Switzerland', 'FINMA', 'Supervises stablecoin issuers. Guidance 06/2024: the issuer must identify every holder. A new licence for payment instrument institutions is in consultation.', 'kramer2024'],
  ['European Union', 'National authorities under MiCA', 'Licence for e-money tokens in one member state, valid across the EU, with rules on reserve and redemption.', ''],
  ['Argentina', 'BCRA and CNV', 'The central bank regulates the foreign exchange market. The securities regulator registers crypto service providers.', ''],
  ['United States', 'GENIUS Act (2025)', 'Full 1:1 backing, short-term reserve assets, no interest paid to holders.', 'dechert2025'],
];

const PROTOTYPE = [
  ['Ledger', 'Central database with a SHA-256 hash chain', 'Token on a public blockchain, holding restricted to identified wallets'],
  ['Identity check', 'Treasury or partner bank clicks “verify”', 'Document and video identification by a supervised intermediary'],
  ['Reserve', 'A single number in the database', 'Segregated accounts at a custodian bank, audited regularly'],
  ['Escrow', 'Database function triggered by the vet’s report', 'Smart contract on the blockchain'],
  ['Transaction monitoring', 'Three fixed rules checked on every transfer, reviewed by clicking “release” or “return”',
    'Monitoring software with more rules and scoring, sanctions screening, reports to the authorities where required'],
];

export default function Security() {
  return (
    <Notes ids={['kramer2024', 'efd2025', 'dechert2025', 'bis2025']}>
      <PageHero eyebrow="Security" title="Identified wallets, regulated partners"
        lede="No anonymous wallets: every holder is verified, payments run only between known parties, and the reserve is kept apart from the issuer’s own funds." />

      <Section title="Know your customer, every time">
        <div className="grid-3">
          <Card title="Verified before the first payment"><p>A new account can log in but cannot buy, send or receive until the treasury, or the partner bank for applicants from Argentina, has verified the identity. <Link to="/register">Try the sign-up</Link>.</p></Card>
          <Card title="Monitored like a bank"><p>Every transaction is screened automatically for money-laundering patterns. Public stablecoins are criticised for exactly this gap.<Cite id="bis2025" /> Polo Coin closes it.</p></Card>
          <Card title="Public, but pseudonymous"><p>The ledger shows amounts and wallet addresses. Names and payment references stay private. References are stored only as hashes.</p></Card>
        </div>
      </Section>

      <Section tone="cream" title="Transaction monitoring without slowing anyone down"
        intro="The checks are risk-based: normal payments settle in seconds, and only unusual patterns are held for a short review by the partner bank.">
        <div className="grid-3">
          <Card title="Unusually large"><p>A payment above USD 50,000 that is more than three times anything the wallet has paid before. A patron who regularly pays a player’s season fee is not held, a sudden jump is.</p></Card>
          <Card title="Pass-through"><p>A wallet that forwards at least 80% of what it received from others in the last 24 hours, from USD 10,000. This is the typical pattern of a money mule.</p></Card>
          <Card title="Split payments"><p>Several payments to the same recipient within 24 hours that each stay below the limit but together pass USD 50,000, known as structuring.</p></Card>
        </div>
        <p className="band-intro">
          A held payment moves into a compliance wallet that is visible on the ledger. The partner bank or the treasury
          releases it or returns it to the sender, usually within hours. The sender learns that a routine check is running,
          not which pattern matched, so a launderer cannot learn how to avoid it. In serious cases the treasury freezes the
          wallet: no sending, receiving or cash-out until the case is cleared. <Link to="/login">Log in as the partner bank</Link> to
          review the held payment in the demo.
        </p>
      </Section>

      <Section title="Who regulates what">
        <table className="data-table">
          <thead><tr><th>Market</th><th>Authority or law</th><th>What it means for Polo Coin</th></tr></thead>
          <tbody>{REGULATORS.map(([m, a, w, c]) => <tr key={m}><td>{m}</td><td><strong>{a}</strong></td><td>{w}{c && <Cite id={c} />}{m === 'Switzerland' && <Cite id="efd2025" />}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section tone="cream" title="Prototype and production" intro="This website is a working prototype for a university seminar. Here is what it simulates and how the real product would do it.">
        <table className="data-table">
          <thead><tr><th>Part</th><th>In this prototype</th><th>In production</th></tr></thead>
          <tbody>{PROTOTYPE.map(([p, a, b]) => <tr key={p}><td><strong>{p}</strong></td><td>{a}</td><td>{b}</td></tr>)}</tbody>
        </table>
      </Section>
    </Notes>
  );
}
