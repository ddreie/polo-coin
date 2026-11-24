/** Polo Coin design system: small, composable building blocks for all pages.
 *  Styles live in styles.css under "Design system". */
import { createContext, useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SOURCES } from './sources';

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

/** Small label above a headline (sentence case, like a section reference in a report). */
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
        {(title || intro) && (
          <header className={`band-head${intro ? '' : ' band-head-solo'}`}>
            {title && <h2 id={id ? `${id}-h` : undefined}>{title}</h2>}
            {intro && <p className="band-intro">{intro}</p>}
          </header>
        )}
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

/** A key figure with label, e.g. "1%" / "fee per payment". */
export function Stat({ value, label }: { value: ReactNode; label: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/* ---------- Footnotes, as in the seminar paper ---------- */
const NotesCtx = createContext<string[]>([]);

/** Wraps a page: citations inside are numbered in the order of `ids`, the list is printed at the end. */
export function Notes({ ids, children }: { ids: string[]; children: ReactNode }) {
  return (
    <NotesCtx.Provider value={ids}>
      {children}
      <section className="notes" aria-labelledby="notes-h">
        <div className="wrap">
          <h2 id="notes-h">Sources</h2>
          <ol>
            {ids.map((id) => {
              const s = SOURCES[id];
              return (
                <li key={id} id={`note-${id}`}>
                  {s.text}{' '}
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer">{s.url.replace(/^https?:\/\//, '').split('/')[0]}</a>}
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </NotesCtx.Provider>
  );
}

/** Superscript footnote marker that jumps to the source list. */
export function Cite({ id }: { id: string }) {
  const ids = useContext(NotesCtx);
  const n = ids.indexOf(id) + 1;
  if (!n) return null;
  return <sup className="cite"><a href={`#note-${id}`} aria-label={`Source ${n}`}>{n}</a></sup>;
}
