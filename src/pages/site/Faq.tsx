import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PageHero, Section } from '../../ui';

const FAQ: { group: string; items: [string, ReactNode][] }[] = [
  { group: 'Safety', items: [
    ['What happens if Polo Coin goes bankrupt?',
      <>The US dollar reserve is held at a custodian bank in segregated accounts, apart from Polo Coin’s own money. If the issuer fails, the reserve still belongs to the holders, and every coin can be redeemed at one dollar. <Link to="/transparency">See the reserve</Link>.</>],
    ['Is one Polo Coin always worth one US dollar?',
      <>Yes, by design. A coin is only created when a dollar arrives in the reserve, and it can be redeemed 1:1 at any time. The reserve holds only US dollar deposits (at least 30%) and US Treasury bills with up to 93 days to maturity, which barely move in price. <Link to="/transparency#stress-test">Try the stress test</Link>.</>],
    ['What if many holders want their money back at the same time?',
      <>Cash covers the first redemptions on the same day. Beyond that, T-bills are sold and paid out the next business day. Because they are so short-dated, they can be sold without a meaningful loss.</>],
    ['Does Polo Coin pay interest on my coins?',
      <>No. The interest on the reserve stays with the issuer, as required for e-money tokens under MiCA (Art. 50) and in line with the US GENIUS Act. It is one of Polo Coin’s two revenue streams.</>],
  ] },
  { group: 'Alternatives', items: [
    ['Why not just use USDC or USDT?',
      <>Private users cannot buy or redeem them directly with the issuer. A patron would have to buy at a crypto exchange and the player would have to sell at another one, with extra fees and technical know-how. The quality of reserves also differs: S&amp;P Global rated USDT’s ability to keep its peg as weak. Polo Coin is bought and cashed out through regulated partners and adds escrow for horse purchases.</>],
    ['Why not Wise?',
      <>Wise is cheap and transparent, but for Argentina it pays out pesos only and is limited to the equivalent of USD 18,000 per month. Player fees agreed in dollars and horse purchases do not fit that. <Link to="/pricing">Compare the costs</Link>.</>],
    ['Why not a normal bank transfer?',
      <>From a franc, euro or pound account a transfer to Argentina costs 2–5% once the exchange-rate mark-up is included, and takes one to three days to reach the recipient’s account. Polo Coin costs 1% and arrives in seconds.</>],
  ] },
  { group: 'Using Polo Coin', items: [
    ['Do I need to know anything about crypto?',
      <>No. You use an app like any banking app. There are no keys to manage and no exchanges to use. Patrons are onboarded personally, players and breeders use the app in Spanish.</>],
    ['What does it cost?',
      <>1% when you buy Polo Coin, including the currency conversion. Payments, payment requests, standing orders, escrow and cash-out are free. During the pilot even the purchase fee is waived.</>],
    ['Can I receive pesos?',
      <>You cash out in US dollars at the partner in Argentina. Converting them into pesos is possible as with any dollar account and costs about the same with any provider, subject to Argentine foreign exchange rules.</>],
    ['What happens if the horse fails the vet check?',
      <>The escrow contract sends the money straight back to the buyer. Only the vet named in the contract can report the result. <Link to="/escrow">How escrow works</Link>.</>],
    ['Who can open an account?',
      <>Patrons, professional players, breeders and grooms, after an identity check. There are no anonymous wallets. <Link to="/security">Security and regulation</Link>.</>],
  ] },
  { group: 'About this website', items: [
    ['Is Polo Coin real?',
      <>Not yet. This is a working prototype for a seminar at the University of Zurich. All people, banks and money in the demo are fictional. <Link to="/case">Read the case</Link>.</>],
    ['Where will it start?',
      <>With a pilot at selected tournaments of the European summer season 2028, followed by the US winter season 2029. <Link to="/about#roadmap">See the roadmap</Link>.</>],
  ] },
];

export default function Faq() {
  return (
    <>
      <PageHero eyebrow="FAQ" title="Questions patrons and players ask"
        lede="Short answers on safety, costs and how Polo Coin compares with banks, Wise and other stablecoins." />
      {FAQ.map((g, i) => (
        <Section key={g.group} tone={i % 2 ? 'cream' : 'plain'} title={g.group}>
          <div className="faq">
            {g.items.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <div className="faq-a">{a}</div>
              </details>
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
