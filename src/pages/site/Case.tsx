import { Link } from 'react-router-dom';
import SeasonCalendar from '../../components/SeasonCalendar';
import { startTour, useGoToStep } from '../../components/Tour';
import { ButtonLink, PageHero, Section, Stat, Cite, Notes } from '../../ui';

const MARKET = [
  ['Patrons', 'Pay players, grooms and horses abroad', '1,100–6,750', 'worldwide, 1,120–2,800 in Europe and the US'],
  ['Argentine professionals', 'Receive fees for the seasons abroad', '280–1,400', 'players, 560–2,800 contracts a year'],
  ['Breeders', 'Sell polo horses abroad', '≈ 400', 'association members, 2,441 polo horses exported in 2023 (USD 13.1 m)'],
  ['Grooms', 'Receive wages and send savings home', '840–2,800', 'abroad, sending USD 7.6–25 m home a year'],
];

const CANVAS: { area: string; title: string; items: string[] }[] = [
  { area: 'kp', title: 'Key partners', items: ['Custodian bank (reserve)', 'European partner banks (conversion)', 'Argentine payout partner', 'Blockchain infrastructure', 'Associations, clubs, tournament organisers', 'Veterinarians'] },
  { area: 'ka', title: 'Key activities', items: ['Issuing and redeeming coins', 'KYC and AML checks', 'Reserve management', 'App and smart contracts', 'Community building'] },
  { area: 'kr', title: 'Key resources', items: ['Licences: FINMA (Switzerland), MiCA (EU)', 'USD reserve', 'Wallet and contract platform', 'Network in the polo community'] },
  { area: 'vp', title: 'Value propositions', items: ['1% instead of 3.4–6.6%', 'Seconds instead of days, 24/7', 'Full cost known up front', 'Escrow for horse purchases', 'Win bonus paid automatically'] },
  { area: 'cr', title: 'Customer relationships', items: ['Personal onboarding for patrons', 'Self-service app, in Spanish for recipients', 'Community and referrals'] },
  { area: 'ch', title: 'Channels', items: ['Tournaments: St. Moritz, Gstaad, Sotogrande, Palermo', 'Clubs and associations', 'App and website'] },
  { area: 'cs', title: 'Customer segments', items: ['Payers: patrons in CH, EU, UK, US', 'Recipients: professionals, breeders, grooms'] },
  { area: 'co', title: 'Cost structure', items: ['Compliance and licensing', 'Technology', 'Revenue share with partner banks', 'Tournament marketing', 'Staff'] },
  { area: 'rs', title: 'Revenue streams', items: ['1% purchase fee, shared with partner banks', 'Interest on the reserve, about 2.9% a year per dollar'] },
];

const COMPETITORS = ['Bank wire (SWIFT)', 'Wise', 'Stablecoins via exchange', 'Polo Coin'];
const COMPARE: [string, string[]][] = [
  ['Cost', ['3.4–6.6%', 'low', 'depends on exchanges', '1% once']],
  ['Arrives', ['1–3 days', 'up to 3 days', 'minutes', 'seconds']],
  ['Paid out in', ['USD', 'pesos only', 'USD stablecoin', 'USD via local partner']],
  ['Amount limit', ['none', 'USD 18,000 a month', 'depends on exchange', 'none after KYC']],
  ['Escrow for horses', ['no', 'no', 'no', 'yes']],
  ['Identified users', ['yes', 'yes', 'partly', 'yes, every wallet']],
  ['Built for polo', ['no', 'no', 'no', 'yes']],
];

const SWOT = [
  { key: 's', title: 'Strengths', items: ['Clear cost and time advantage', 'Founders rooted in the polo community', 'Full backing and identified wallets', 'Escrow as unique selling point', 'Free to receive'] },
  { key: 'w', title: 'Weaknesses', items: ['Small core market', 'Dependence on a few partner banks', 'Chicken-and-egg problem of a two-sided platform', 'No track record yet'] },
  { key: 'o', title: 'Opportunities', items: ['Stablecoins are 61.8% of crypto volume in Argentina', 'More legal certainty: Swiss FinIA revision, US GENIUS Act', 'G20 targets for cheaper, faster payments', 'Other equestrian sports and corridors'] },
  { key: 't', title: 'Threats', items: ['High compliance costs', 'Faster SWIFT gpi, expanding Wise', 'Cheaper established stablecoins', 'Volatile Argentine FX rules', 'Falling interest rates'] },
];

const TOWS = [
  ['SO', 'Use the high stablecoin acceptance in Argentina: free receipt and Spanish onboarding build the receiving side first.'],
  ['WO', 'Treat the small core market as a beachhead and expand to player fees, other equestrian sports and new corridors.'],
  ['ST', 'Set escrow and community roots against cheaper generic stablecoins and Wise.'],
  ['WT', 'Work with several partner banks, so that no single partner can stop the conversion or the redemption.'],
];

const MAP = [
  ['1 Introduction: problem, market, stakeholders', '/solutions', 'Solutions'],
  ['2.1 Blockchain and distributed ledger technology', '/explorer', 'Ledger with hash chain'],
  ['2.2 Stablecoins: reserve and run risk', '/transparency', 'Proof of reserves and stress test'],
  ['3 Business model: cost advantage and revenue', '/pricing', 'Pricing, cost and break-even calculators'],
  ['4.1 Participants and payment process', '/login', 'Demo accounts for every role'],
  ['4.2 Smart contracts: escrow, win bonus', '/escrow', 'Escrow'],
  ['4.3 Compliance and transparency', '/security', 'Transaction monitoring'],
  ['4.4 Prototype and real implementation', '/security', 'Prototype and production'],
  ['5 Regulatory and legal framework', '/security', 'Who regulates what'],
  ['6 Competitor analysis', '/pricing', 'Cost comparison'],
  ['7 Roadmap and outlook', '/about#roadmap', 'Roadmap and seasons'],
];

export default function Case() {
  const goToStep = useGoToStep();
  const tour = () => { startTour(); goToStep(0); };
  return (
    <Notes ids={['paper', 'infocampo2026', 'osterwalder2010', 'helms2010']}>
      <PageHero eyebrow="The case" title="Polo Coin in five minutes"
        lede="The seminar paper and this prototype are one piece of work. Here is the argument of the paper, with a link to the place in the demo where you can see each part working.">
        <button className="btn btn-accent" onClick={tour}>Start the guided demo</button>
        <ButtonLink to="/faq" variant="on-dark">FAQ</ButtonLink>
      </PageHero>

      <Section id="problem" title={<><span className="sec-n">1</span>The problem</>}>
        <div className="split">
          <div>
            <p className="band-intro">
              Polo money flows one way: patrons in Europe and the US pay professionals, grooms and breeders from Argentina.
              These payments run through correspondent banks. From a franc, euro or pound account they cost 3.4–6.6% once the
              exchange-rate mark-up is counted, take one to three days to reach the recipient, and leave one side exposed
              when a horse is bought: either the money goes first or the horse does.
            </p>
            <p><Link to="/pricing">Calculate the cost of a transfer</Link></p>
          </div>
          <div className="grid-2">
            <Stat value="3.4–6.6%" label="cost of a bank wire from a non-USD account" />
            <Stat value="1–3 days" label="until the money is in the account" />
            <Stat value="USD 20.7 m" label={<>Argentine horse exports, Jan–Nov 2025 (+9%)<Cite id="infocampo2026" /></>} />
            <Stat value="40,000" label="players in 70 countries rely on Argentine horses and staff" />
          </div>
        </div>
      </Section>

      <Section id="market" tone="cream" title={<><span className="sec-n">2</span>The market</>} intro="Four user groups, estimated bottom-up from association and export statistics.">
        <table className="data-table">
          <thead><tr><th>User group</th><th>Role</th><th className="num">Estimate</th><th>Basis</th></tr></thead>
          <tbody>{MARKET.map(([g, r, n, b]) => <tr key={g}><td><strong>{g}</strong></td><td>{r}</td><td className="num"><strong>{n}</strong></td><td>{b}</td></tr>)}</tbody>
        </table>
        <p><Link to="/solutions">What each group gains</Link></p>
      </Section>

      <Section id="canvas" title={<><span className="sec-n">3</span>The business model</>} intro={<>Business Model Canvas, the nine building blocks of how a company creates, delivers and captures value.<Cite id="osterwalder2010" /></>}>
        <div className="canvas">
          {CANVAS.map((c) => (
            <div key={c.area} className={`canvas-cell canvas-${c.area}`}>
              <h3>{c.title}</h3>
              <ul>{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
        <p><button className="linklike-strong" onClick={tour}>See the value proposition in the guided demo</button></p>
      </Section>

      <Section id="competition" tone="cream" title={<><span className="sec-n">4</span>The competition</>} intro="Each alternative solves part of the problem. Polo Coin combines their strengths for one niche (Porter: differentiation focus).">
        <div className="table-scroll">
          <table className="data-table compare-table">
            <thead><tr><th />{COMPETITORS.map((c) => <th key={c} className={c === 'Polo Coin' ? 'col-pc' : ''}>{c}</th>)}</tr></thead>
            <tbody>{COMPARE.map(([k, vals]) => (
              <tr key={k}><td><strong>{k}</strong></td>{vals.map((v, i) => <td key={i} className={i === 3 ? 'col-pc' : ''}>{v}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
        <p className="muted small">A polo-specific token was launched before (Chukker Polo Token, 2022), but as a tradable metaverse token, not as a fully backed means of payment.</p>
      </Section>

      <Section id="swot" title={<><span className="sec-n">5</span>SWOT and strategy</>} intro={<>A SWOT only pays off when strategies follow from it, so each quadrant pair below leads to one move.<Cite id="helms2010" /></>}>
        <div className="swot">
          {SWOT.map((q) => (
            <div key={q.key} className={`swot-q swot-${q.key}`}>
              <h3>{q.title}</h3>
              <ul>{q.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>
        <h3 className="tows-h">What follows (TOWS)</h3>
        <dl className="tows">{TOWS.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        <p><Link to="/transparency#stress-test">How we answer the run risk: stress test</Link></p>
      </Section>

      <Section id="economics" tone="cream" title={<><span className="sec-n">6</span>The economics</>}>
        <div className="split">
          <p className="band-intro">
            Two revenue streams: the 1% purchase fee and interest on the reserve. The model is fixed-cost intensive, so it
            needs volume. With fixed costs of CHF 500,000 a year, the core polo market alone is not enough, which is why
            Polo Coin starts as a beachhead and expands from there.
          </p>
          <ButtonLink to="/pricing#break-even">Open the break-even calculator</ButtonLink>
        </div>
      </Section>

      <Section id="roadmap" title={<><span className="sec-n">7</span>Roadmap and market entry</>}>
        <SeasonCalendar />
        <p><Link to="/about#roadmap">Full roadmap: preparation, pilot, launch, extensions</Link></p>
      </Section>

      <Section tone="dark" title="Where the paper meets the prototype">
        <table className="data-table map-table">
          <thead><tr><th>Chapter of the paper</th><th>In the prototype</th></tr></thead>
          <tbody>{MAP.map(([c, to, label]) => <tr key={c + to}><td>{c}</td><td><Link to={to}>{label}</Link></td></tr>)}</tbody>
        </table>
      </Section>
    </Notes>
  );
}
