import { useCallback, useEffect, useState } from 'react';
import { api, type Account } from './api';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import { ToastHost } from './components/Toast';

type Route = 'home' | 'login' | 'app' | 'explorer';
const TOKEN_KEY = 'polo-coin-token';

const readRoute = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return (['login', 'app', 'explorer'] as Route[]).includes(h as Route) ? (h as Route) : 'home';
};
export const go = (r: Route) => { window.location.hash = r === 'home' ? '/' : `/${r}`; };

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [token, setToken] = useState<string | null>(readToken);
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(!!token);

  useEffect(() => {
    const on = () => { setRoute(readRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Restore an existing session on page load.
  useEffect(() => {
    if (!token) return;
    api.me(token).then(setAccount).catch(() => { writeToken(null); setToken(null); })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLogin = useCallback((t: string, a: Account) => {
    writeToken(t); setToken(t); setAccount(a); go('app');
  }, []);

  const onLogout = useCallback(async (next: Route = 'login') => {
    if (token) await api.logout(token).catch(() => undefined);
    writeToken(null); setToken(null); setAccount(null); go(next);
  }, [token]);

  let page;
  if (route === 'explorer') page = <Explorer signedIn={!!account} />;
  else if (route === 'login') page = <Login onLogin={onLogin} current={account} />;
  else if (route === 'app') {
    if (checking) page = <div className="loading-screen">Loading your wallet…</div>;
    else if (token && account) page = <Dashboard token={token} account={account} setAccount={setAccount} onLogout={onLogout} />;
    else page = <Login onLogin={onLogin} current={null} />;
  } else page = <Home signedIn={!!account} />;

  return (
    <>
      {page}
      <ToastHost />
    </>
  );
}
