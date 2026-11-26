import { TeamMedals } from '../../components/Team';
import SeasonCalendar from '../../components/SeasonCalendar';
import { Card, PageHero, Section, Cite, Notes } from '../../ui';


const ROADMAP = [
  { when: 'Until mid-2028', title: 'Preparation', points: ['Licences: FINMA (Switzerland), MiCA (one EU member state)', 'Contracts with custodian, European and Argentine partner banks', 'Move from the prototype ledger to a public blockchain', 'Polo Coin app with identity checks'] },
  { when: 'Summer 2028 – winter 2029', title: 'Pilot', points: ['Selected tournaments of the European summer season', 'Then the US winter season: the same Argentine players, twice', 'Purchase fee waived during the pilot', 'Win well-known patrons and players first'] },
  { when: 'Spring 2029', title: 'Market launch', points: ['Europe and the United States', 'Onboarding through associations, clubs and tournaments'] },
  { when: 'From end of 2029', title: 'Extensions', points: ['Club and tournament payments: entry fees, prize money, horse leasing', 'Further segments such as horse shipments', 'Smart contracts for automatic prize money and horse lease release', 'Payout partners in further countries, e.g. Uruguay', 'Other equestrian sports: show jumping, racing'] },
];

export default function About() {
  return (
    <Notes ids={['collins1996', 'moore2014', 'paper']}>
      <PageHero eyebrow="About" title="A global sport deserves a global payment system"
        lede="Polo Coin started as a seminar project at the University of Zurich: six students, one niche market, and the question of whether a fully backed stablecoin can fix its payments." />

      <Section title="Vision and mission" intro={<>A vision names an enduring purpose and a bold picture of the future, the mission says what we contribute to it.<Cite id="collins1996" /></>}>
        <div className="grid-2">
          <Card tone="dark" title="Vision"><p className="statement">To become the standard payment currency of the international polo world.</p></Card>
          <Card tone="cream" title="Mission"><p className="statement">To let patrons, players and breeders move money across borders within minutes and at a transparent fee, through a stablecoin backed by US dollars and built together with the polo community and its institutions.</p></Card>
        </div>
        <p className="values">Two values guide us: <strong>trust</strong> and <strong>transparency</strong>.</p>
      </Section>

      <Section tone="cream" id="roadmap" title="Roadmap" intro={<>A small, well-connected niche first, then the next markets: the beachhead strategy.<Cite id="moore2014" /></>}>
        <ol className="roadmap">
          {ROADMAP.map((r, i) => (
            <li key={r.title} className={i === 1 ? 'now' : ''}>
              <span className="roadmap-when">{r.when}</span>
              <h3>{r.title}</h3>
              <ul>{r.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="seasons" title="Why the pilot runs in two seasons">
        <SeasonCalendar />
      </Section>

      <Section tone="cream" id="team" title="The team" intro="Six students at the University of Zurich, working in three pairs.">
        <TeamMedals />
        <p className="muted">
          Seminar “FinTech &amp; InsurTech – Digitalization of the Financial Services Industry”, Swiss FinTech Innovation Lab,
          University of Zurich, autumn semester 2026. Lecturer: Prof. Dr. Thomas Puschmann.<Cite id="paper" />
        </p>
      </Section>
    </Notes>
  );
}
