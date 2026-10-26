import type { Role } from '../api';
import { initials } from '../format';

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label="Polo Coin home">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <circle cx="16" cy="16" r="15" fill="var(--turf)" />
        <circle cx="16" cy="16" r="10.5" fill="none" stroke="var(--brass)" strokeWidth="2" />
        <text x="16" y="20.5" textAnchor="middle" fontWeight="800" fontSize="11.5" fill="var(--chalk)">PC</text>
      </svg>
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
