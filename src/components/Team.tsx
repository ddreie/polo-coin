import { Link } from 'react-router-dom';

/** The six authors of the seminar paper, in the paper's order. `role` is shown when filled in. */
export const TEAM: { name: string; img: string; role?: string }[] = [
  { name: 'Luisa Blumenthal', img: '/team/luisa.webp' },
  { name: 'Andri Bühler', img: '/team/andri.webp' },
  { name: 'Dario Dreier', img: '/team/dario.webp' },
  { name: 'Ivan Massaro', img: '/team/ivan.webp' },
  { name: 'Alyssa Victoria Pühringer', img: '/team/alyssa.webp' },
  { name: 'Janis Raschle', img: '/team/janis.webp' },
];

/** A portrait struck like a coin: green field, gold rim, the head rises above the rim. */
function Medal({ img, size }: { img: string; size: 'l' | 's' }) {
  return (
    <span className={`medal medal-${size}`} aria-hidden="true">
      <span className="medal-disc" />
      <span className="medal-clip"><img src={img} alt="" loading="lazy" decoding="async" /></span>
      <span className="medal-rim" />
    </span>
  );
}

/** About page: one medal per person, name and role underneath. */
export function TeamMedals() {
  return (
    <ul className="medals">
      {TEAM.map((p) => (
        <li key={p.name}>
          <Medal img={p.img} size="l" />
          <strong>{p.name}</strong>
          {p.role && <span>{p.role}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Home page: the six portraits laid out like a row of coins, linking to the About page. */
export function TeamStack() {
  return (
    <Link to="/about#team" className="coin-row" aria-label={`The team: ${TEAM.map((p) => p.name).join(', ')}. About us`}>
      {TEAM.map((p) => (
        <span key={p.name} className="coin-row-item" title={p.name}>
          <Medal img={p.img} size="s" />
        </span>
      ))}
    </Link>
  );
}
