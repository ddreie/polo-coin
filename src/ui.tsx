/** Polo Coin design system: small, composable building blocks for all pages.
 *  Styles live in styles.css under "Design system". */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'accent' | 'ghost' | 'on-dark';
const btnClass = (v: Variant, small?: boolean) =>
  ['btn', v === 'accent' && 'btn-accent', v === 'ghost' && 'btn-ghost', v === 'on-dark' && 'btn-on-dark', small && 'btn-small']
    .filter(Boolean).join(' ');

/** A link styled as a button. Internal paths use the router, external URLs a plain anchor. */
export function ButtonLink({ to, children, variant = 'primary', small }:
  { to: string; children: ReactNode; variant?: Variant; small?: boolean }) {
  return to.startsWith('http')
    ? <a className={btnClass(variant, small)} href={to} target="_blank" rel="noreferrer">{children}</a>
    : <Link className={btnClass(variant, small)} to={to}>{children}</Link>;
}

/** Small uppercase label above a headline. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

/** Page header for content pages: eyebrow, headline, lede, optional actions. */
export function PageHero({ eyebrow, title, lede, children, tone = 'dark' }:
  { eyebrow?: string; title: ReactNode; lede?: ReactNode; children?: ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <header className={`page-hero page-hero-${tone}`}>
      <div className="wrap">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {children && <div className="hero-actions">{children}</div>}
      </div>
    </header>
  );
}

/** Full-width band with consistent vertical rhythm. */
export function Section({ children, tone = 'plain', id, title, intro }:
  { children: ReactNode; tone?: 'plain' | 'cream' | 'dark'; id?: string; title?: ReactNode; intro?: ReactNode }) {
  return (
    <section className={`band band-${tone}`} id={id} aria-labelledby={id && title ? `${id}-h` : undefined}>
      <div className="wrap">
        {title && <h2 id={id ? `${id}-h` : undefined}>{title}</h2>}
        {intro && <p className="band-intro">{intro}</p>}
        {children}
      </div>
    </section>
  );
}

export function Card({ title, children, tone = 'paper' }: { title?: ReactNode; children: ReactNode; tone?: 'paper' | 'cream' | 'dark' }) {
  return (
    <div className={`card card-${tone}`}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'ok' | 'warn' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** A key figure with label, e.g. "1 %" / "fee per payment". */
export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
