import { useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { Avatar, DemoBanner, Logo } from '../components/Brand';
import { toast } from '../components/Toast';
import { TourBar } from '../components/Tour';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../demo';
import { roleLabel } from '../format';
import { LangProvider, useT } from '../i18n';
import { useSession } from '../session';
import { useTodos, useWallet, WalletProvider } from '../wallet';

/** Wallet app: own header with role-specific navigation, demo role switcher and language toggle. */
export default function AppShell() {
  const { token, account, checking } = useSession();
  const { pathname, search } = useLocation();
  if (checking) return <div className="loading-screen">Loading your wallet…</div>;
  if (!token || !account) return <Navigate to="/login" replace state={{ next: pathname + search }} />;
  return (
    <LangProvider user={account.username} preferred={account.country === 'Argentina' ? 'es' : 'en'}>
      <WalletProvider key={token} token={token} account={account}>
        <div className="page app">
          <DemoBanner />
          <AppHeader />
          <TourBar />
          <main className="wrap app-main"><Outlet /></main>
        </div>
      </WalletProvider>
    </LangProvider>
  );
}

function AppHeader() {
  const { account } = useWallet();
  const { logout } = useSession();
  const { t, lang, setLang } = useT();
  const { count } = useTodos();
  const staff = account.role === 'admin' || account.role === 'bank';
  const [menu, setMenu] = useState(false);

  return (
    <header className="app-header">
      <div className="wrap app-header-inner">
        <Logo onDark />
        <nav className="app-nav" aria-label="Wallet">
          <NavLink to="/app" end>{t('Overview')}{count > 0 && <span className="nav-count">{count}</span>}</NavLink>
          {account.role !== 'vet' && <NavLink to="/app/pay">{t('Pay')}</NavLink>}
          <NavLink to="/app/escrow">{t('Escrow')}</NavLink>
          <NavLink to="/app/activity">{t('Activity')}</NavLink>
          {staff && <NavLink to="/app/review">{t('Review')}</NavLink>}
        </nav>
        <div className="app-tools">
          <div className="lang-toggle" role="group" aria-label={t('Language')}>
            {(['en', 'es'] as const).map((l) => (
              <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          <RoleSwitcher />
          <div className="user-menu">
            <button className="user-chip" aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Avatar name={account.display_name} role={account.role} size={32} />
              <span className="user-chip-text"><strong>{account.display_name}</strong><small>{roleLabel[account.role]}</small></span>
            </button>
            {menu && (
              <div className="user-dropdown" onMouseLeave={() => setMenu(false)}>
                <Link to="/" onClick={() => setMenu(false)}>{t('Website')}</Link>
                <Link to="/explorer" onClick={() => setMenu(false)}>{t('Ledger')}</Link>
                <button onClick={() => logout('/login')}>{t('Log out')}</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/** Demo only: jump between the fictional accounts without logging out. */
function RoleSwitcher() {
  const { account } = useWallet();
  const { login } = useSession();
  const { t } = useT();
  const { pathname } = useLocation();
  const known = DEMO_ACCOUNTS.some((d) => d.username === account.username);

  async function switchTo(username: string) {
    try {
      const r = await api.login(username, DEMO_PASSWORD);
      login(r.token, r.account, pathname.startsWith('/app/review') ? '/app' : pathname);
    } catch (e) { toast.error('Could not switch account', (e as Error).message); }
  }

  return (
    <label className="role-switch">
      <span className="sr-only">{t('Switch role')}</span>
      <select value={known ? account.username : ''} onChange={(e) => e.target.value && switchTo(e.target.value)}>
        {!known && <option value="">{t('Switch role')}</option>}
        <optgroup label={t('Demo accounts')}>
          {DEMO_ACCOUNTS.map((d) => <option key={d.username} value={d.username}>{d.name} · {roleLabel[d.role]}</option>)}
        </optgroup>
      </select>
    </label>
  );
}
