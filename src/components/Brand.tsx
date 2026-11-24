import type { Role } from '../api';
import { initials } from '../format';

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label="Polo Coin home">
      <img src="/brand/mark-on-light.svg" width="34" height="34" alt="" />
      <span>Polo Coin</span>
    </a>
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
