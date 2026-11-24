import { Link } from 'react-router-dom';
import type { Role } from '../api';
import { initials } from '../format';

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link to="/" className="logo" aria-label="Polo Coin home">
      <img src={onDark ? '/brand/mark-on-dark.svg' : '/brand/mark-on-light.svg'} width="34" height="34" alt="" />
      <span>Polo Coin</span>
    </Link>
  );
}

export function Avatar({ name, role, size = 40 }: { name: string; role: Role; size?: number }) {
  return (
    <span className={`avatar avatar-${role}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function DemoBanner() {
  return (
    <div className="demo-banner">
      Seminar prototype (University of Zurich). All people, banks and money are fictional.
    </div>
  );
}
