import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { DemoBanner, Logo } from './components/Brand';
import { useSession } from './session';
import { NAV_PAGES, SITE_PAGES } from './site';
import { ButtonLink } from './ui';

/** Scrolls to the top on every page change (or to #anchor if present). */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function SiteHeader() {
  const { account } = useSession();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="site-header">
      <div className="wrap topbar">
        <Logo />
        <button className="nav-toggle" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>
          <span className="sr-only">Menu</span><span aria-hidden="true">{open ? '✕' : '☰'}</span>
        </button>
        <nav id="site-nav" className={`topnav${open ? ' open' : ''}`} aria-label="Main">
          {NAV_PAGES.map((p) => <NavLink key={p.path} to={p.path}>{p.label}</NavLink>)}
          <NavLink to="/explorer">Ledger</NavLink>
          {account
            ? <ButtonLink to="/app" small>Open wallet</ButtonLink>
            : <>
                <NavLink to="/login" className="nav-login">Log in</NavLink>
                <ButtonLink to="/login" small>Try the demo</ButtonLink>
              </>}
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  const groups = ['Product', 'Trust', 'Company'] as const;
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <img src="/brand/lockup-horizontal-on-dark.svg" alt="Polo Coin" width="168" height="54" />
          <p>Instant, low-cost payments for the polo economy.</p>
        </div>
        {groups.map((g) => (
          <nav key={g} aria-label={g}>
            <h2>{g}</h2>
            <ul>
              {SITE_PAGES.filter((p) => p.group === g).map((p) => <li key={p.path}><Link to={p.path}>{p.label}</Link></li>)}
              {g === 'Trust' && <li><Link to="/explorer">Public ledger</Link></li>}
            </ul>
          </nav>
        ))}
      </div>
      <div className="wrap footer-legal">
        <span>Student prototype for the FinTech &amp; InsurTech seminar, University of Zurich, HS 2026.</span>
        <span>Not a real financial product. All people, banks and money are fictional.</span>
      </div>
    </footer>
  );
}

/** Public website: banner, header, page, footer. */
export function SiteLayout() {
  return (
    <div className="page">
      <ScrollManager />
      <DemoBanner />
      <SiteHeader />
      <main id="main"><Outlet /></main>
      <SiteFooter />
    </div>
  );
}

/** Wallet app: the dashboard brings its own header; only the banner is shared. */
export function AppLayout() {
  return (
    <div className="page app">
      <ScrollManager />
      <DemoBanner />
      <Outlet />
    </div>
  );
}
