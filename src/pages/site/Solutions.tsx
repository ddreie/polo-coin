import { ButtonLink, PageHero, Section, Stat } from '../../ui';

const GROUPS = [
  {
    id: 'patrons', title: 'Patrons', role: 'They pay',
    pain: 'A patron finances a team: player fees, horses, grooms, transport. Paying Argentina from a franc, euro or pound account costs the wire fee plus a hidden exchange-rate mark-up of 3–5 %.',
    gain: ['1 % once, conversion included, known before you pay', 'No US dollar account needed', 'Pay any player in seconds, also on match day', 'Escrow protects horse purchases'],
    figure: ['1,100–6,750', 'patrons worldwide pay abroad'],
  },
  {
    id: 'players', title: 'Professional players', role: 'They receive',
    pain: 'Argentine professionals play the season in the US in winter and in Europe in summer. Their fees are agreed in dollars, but bank wires take days and arrive with deductions.',
    gain: ['Paid in US dollars within seconds', 'Receiving is free', 'Keep PC or cash out 1:1 at the partner bank', 'Request a fee with one click'],
    figure: ['280–1,400', 'Argentine professionals play abroad'],
  },
  {
    id: 'breeders', title: 'Breeders', role: 'They receive',
    pain: 'Argentina exports more polo horses than anyone: 2,441 in 2023, worth USD 13.1 million. Each sale raises the same question: who goes first, the payment or the horse?',
    gain: ['Price locked in escrow before the horse ships', 'Released automatically after the vet check', 'No amount limit, unlike remittance apps', 'Paid in dollars, not pesos'],
    figure: ['USD 13.1 m', 'polo horse exports, 2023'],
  },
  {
    id: 'grooms', title: 'Grooms', role: 'They receive and send',
    pain: 'Many grooms follow their players abroad for the season and send half of their wages home. Fixed bank fees eat a large share of small transfers.',
    gain: ['Wages paid straight into a wallet', 'Free transfers to family in Argentina', 'Cash out in dollars when needed'],
    figure: ['USD 7.6–25 m', 'sent home by grooms each year'],
  },
];

export default function Solutions() {
  return (
    <>
      <PageHero eyebrow="Solutions" title="Built for everyone who keeps polo running"
        lede="Polo is a global sport with a one-way money flow: patrons in Europe and the US pay professionals, breeders and grooms from Argentina. Polo Coin is designed for exactly that corridor.">
        <ButtonLink to="/login" variant="accent">Try a role in the demo</ButtonLink>
      </PageHero>

      {GROUPS.map((g, i) => (
        <Section key={g.id} id={g.id} tone={i % 2 ? 'cream' : 'plain'}>
          <div className="solution">
            <div>
              <p className="eyebrow">{g.role}</p>
              <h2>{g.title}</h2>
              <p className="solution-pain">{g.pain}</p>
              <Stat value={g.figure[0]} label={g.figure[1]} />
            </div>
            <ul className="checklist">
              {g.gain.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
        </Section>
      ))}

      <Section tone="dark" title="And the institutions behind them">
        <div className="grid-3">
          <div><h3>Partner banks</h3><p>Convert currencies, hold the reserve and pay out dollars in Argentina, for a share of the 1&nbsp;% fee.</p></div>
          <div><h3>Clubs and associations</h3><p>Give access to the community and lend their trust. Their members get cheaper, faster payments.</p></div>
          <div><h3>Tournament organisers</h3><p>Bring all groups together for weeks. The ideal place for a pilot, and later for entry fees and prize money.</p></div>
        </div>
        <p className="muted-on-dark small">Market figures are estimates from our seminar paper (University of Zurich, 2026), based on association and export statistics.</p>
      </Section>
    </>
  );
}
