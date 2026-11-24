import { Link } from 'react-router-dom';
import { Card, PageHero, Section } from '../../ui';

const REGULATORS = [
  ['Switzerland', 'FINMA', 'Supervises stablecoin issuers. Guidance 06/2024: the issuer must identify every holder.'],
  ['European Union', 'National authorities under MiCA', 'Licence for e-money tokens in one member state, valid across the EU; reserve and redemption rules.'],
  ['Argentina', 'BCRA and CNV', 'The central bank regulates the foreign exchange market; the securities regulator registers crypto service providers.'],
  ['United States', 'GENIUS Act (2025)', 'Full 1:1 backing, short-term reserve assets, no interest paid to holders.'],
];

const PROTOTYPE = [
  ['Ledger', 'Central database with a SHA-256 hash chain', 'Token on a public blockchain, holding restricted to identified wallets'],
  ['Identity check', 'Treasury or partner bank clicks “verify”', 'Document and video identification by a supervised intermediary'],
  ['Reserve', 'A single number in the database', 'Segregated accounts at a custodian bank, audited regularly'],
  ['Escrow', 'Database function triggered by the vet’s report', 'Smart contract on the blockchain'],
];

export default function Security() {
  return (
    <>
      <PageHero eyebrow="Security" title="Identified wallets, regulated partners"
        lede="No anonymous wallets: every holder is verified, payments run only between known parties, and the reserve is kept apart from the issuer’s own funds." />

      <Section title="Know your customer, every time">
        <div className="grid-3">
          <Card title="Verified before the first payment"><p>A new account can log in but cannot buy, send or receive until the treasury, or the partner bank for applicants from Argentina, has verified the identity. <Link to="/register">Try the sign-up</Link>.</p></Card>
          <Card title="Monitored like a bank"><p>The partner bank sees every transaction for anti-money-laundering checks. Public stablecoins are criticised for exactly this gap; Polo Coin closes it.</p></Card>
          <Card title="Public, but pseudonymous"><p>The ledger shows amounts and wallet addresses. Names and payment references stay private; references are stored only as hashes.</p></Card>
        </div>
      </Section>

      <Section tone="cream" title="Who regulates what">
        <table className="data-table">
          <thead><tr><th>Market</th><th>Authority or law</th><th>What it means for Polo Coin</th></tr></thead>
          <tbody>{REGULATORS.map(([m, a, w]) => <tr key={m}><td>{m}</td><td><strong>{a}</strong></td><td>{w}</td></tr>)}</tbody>
        </table>
      </Section>

      <Section title="Prototype and production" intro="This website is a working prototype for a university seminar. Here is what it simulates and how the real product would do it.">
        <table className="data-table">
          <thead><tr><th>Part</th><th>In this prototype</th><th>In production</th></tr></thead>
          <tbody>{PROTOTYPE.map(([p, a, b]) => <tr key={p}><td><strong>{p}</strong></td><td>{a}</td><td>{b}</td></tr>)}</tbody>
        </table>
      </Section>
    </>
  );
}
