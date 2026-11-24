import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Account } from './api';

const TOKEN_KEY = 'polo-coin-token';

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

interface Session {
  token: string | null;
  account: Account | null;
  /** True while a stored token is being checked on page load. */
  checking: boolean;
  setAccount: (a: Account) => void;
  /** Stores the session and opens the wallet. */
  login: (token: string, account: Account) => void;
  logout: (next?: string) => Promise<void>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(readToken);
  const [account, setAccount] = useState<Account | null>(null);
  const [checking, setChecking] = useState(!!token);

  // Restore an existing session on page load.
  useEffect(() => {
    if (!token) return;
    api.me(token).then(setAccount).catch(() => { writeToken(null); setToken(null); })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((t: string, a: Account) => {
    writeToken(t); setToken(t); setAccount(a); navigate('/app');
  }, [navigate]);

  const logout = useCallback(async (next = '/login') => {
    if (token) await api.logout(token).catch(() => undefined);
    writeToken(null); setToken(null); setAccount(null); navigate(next);
  }, [token, navigate]);

  const value = useMemo(() => ({ token, account, checking, setAccount, login, logout }),
    [token, account, checking, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession must be used inside <SessionProvider>');
  return s;
}
