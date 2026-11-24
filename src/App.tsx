import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout, SiteLayout } from './layouts';
import { SessionProvider, useSession } from './session';
import { SITE_PAGES } from './site';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Explorer from './pages/Explorer';
import SitePage, { NotFound } from './pages/SitePage';
import { ToastHost } from './components/Toast';

/** Old links used hash routes (#/login, #/explorer?b=4). Send them to the new paths. */
function LegacyHashRedirect() {
  const { hash } = useLocation();
  if (!hash.startsWith('#/')) return null;
  return <Navigate to={hash.slice(1)} replace />;
}

function Wallet() {
  const { token, account, checking, setAccount, logout } = useSession();
  if (checking) return <div className="loading-screen">Loading your wallet…</div>;
  if (!token || !account) return <Navigate to="/login" replace />;
  return <Dashboard token={token} account={account} setAccount={setAccount} onLogout={logout} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <LegacyHashRedirect />
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            {SITE_PAGES.map((p) => <Route key={p.path} path={p.path} element={<SitePage page={p} />} />)}
            <Route path="explorer" element={<Explorer />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="app" element={<Wallet />} />
          </Route>
        </Routes>
        <ToastHost />
      </SessionProvider>
    </BrowserRouter>
  );
}
