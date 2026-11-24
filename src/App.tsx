import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { SiteLayout } from './layouts';
import AppShell from './app/AppShell';
import Overview from './app/Overview';
import Pay from './app/Pay';
import EscrowPage from './app/EscrowPage';
import ActivityPage from './app/ActivityPage';
import ReviewPage from './app/ReviewPage';
import { SessionProvider } from './session';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Explorer from './pages/Explorer';
import { NotFound } from './pages/NotFound';
import HowItWorks from './pages/site/HowItWorks';
import Solutions from './pages/site/Solutions';
import Pricing from './pages/site/Pricing';
import EscrowInfo from './pages/site/EscrowInfo';
import Transparency from './pages/site/Transparency';
import Security from './pages/site/Security';
import About from './pages/site/About';
import Brand from './pages/site/Brand';
import { ToastHost } from './components/Toast';

/** Old links used hash routes (#/login, #/explorer?b=4). Send them to the new paths. */
function LegacyHashRedirect() {
  const { hash } = useLocation();
  if (!hash.startsWith('#/')) return null;
  return <Navigate to={hash.slice(1)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <LegacyHashRedirect />
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="solutions" element={<Solutions />} />
            <Route path="pricing" element={<Pricing />} />
            <Route path="escrow" element={<EscrowInfo />} />
            <Route path="transparency" element={<Transparency />} />
            <Route path="security" element={<Security />} />
            <Route path="about" element={<About />} />
            <Route path="brand" element={<Brand />} />
            <Route path="explorer" element={<Explorer />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="app" element={<AppShell />}>
            <Route index element={<Overview />} />
            <Route path="pay" element={<Pay />} />
            <Route path="escrow" element={<EscrowPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="review" element={<ReviewPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
        </Routes>
        <ToastHost />
      </SessionProvider>
    </BrowserRouter>
  );
}
