import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type Role } from '../api';
import { Avatar } from '../components/Brand';
import { useSession } from '../session';
import { roleLabel } from '../format';

const DEMO: { username: string; name: string; role: Role; what: string }[] = [
  { username: 'patron', name: 'James Whitfield', role: 'patron', what: 'UK patron of Team Blue Oak. Starts with USD 250,000 in his bank account.' },
  { username: 'pro', name: 'Facundo Ríos', role: 'pro', what: '7-goal player from Argentina, hired for the tournament.' },
  { username: 'breeder', name: 'Estancia La Aurora', role: 'breeder', what: 'Breeds and sells polo ponies near Buenos Aires.' },
  { username: 'bank', name: 'Banco Pampa Sur', role: 'bank', what: 'Partner bank that pays out PC in USD and earns half of each fee.' },
  { username: 'admin', name: 'Polo Coin Treasury', role: 'admin', what: 'Issuer. Manages the USD reserve and can reset the demo.' },
];
const PASSWORD = 'polo2026';

export default function Login() {
  const { login: onLogin, account: current } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function login(u: string, p: string) {
    setBusy(u); setError(null);
    try {
      const r = await api.login(u, p);
      onLogin(r.token, r.account);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) { setError('Enter a username and password, or pick a demo account.'); return; }
    login(username, password);
  }

  return (
    <div className="login wrap">
        <div className="login-intro">
          <h1>Log in to a demo wallet</h1>
          <p>
            Pick an account to log in instantly. To test a payment, start as the patron, buy Polo Coin and pay
            the player. Then come back here and log in as the player.
          </p>
          {current && <p className="note">You are logged in as {current.display_name}. Picking another account switches to it.</p>}
        </div>

        <ul className="accounts">
          {DEMO.map((d) => (
            <li key={d.username}>
              <button className="account-pick" onClick={() => login(d.username, PASSWORD)} disabled={!!busy}>
                <Avatar name={d.name} role={d.role} size={44} />
                <span className="account-text">
                  <span className="account-name">{d.name}</span>
                  <span className="account-role">{roleLabel[d.role]}</span>
                  <span className="account-what">{d.what}</span>
                </span>
                <span className="account-go">{busy === d.username ? 'Logging in…' : 'Log in'}</span>
              </button>
            </li>
          ))}
        </ul>

        <form className="login-form" onSubmit={submit}>
          <h2>Or log in manually</h2>
          <p className="muted">Usernames: patron, pro, breeder, bank, admin. Password for all: <code>{PASSWORD}</code></p>
          <div className="form-row">
            <label>Username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <button className="btn" type="submit" disabled={!!busy}>Log in</button>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>

        <div className="signup-cta">
          <h2>New to Polo Coin?</h2>
          <p className="muted">Open your own account. It goes through an identity check (KYC) by the treasury before you can pay.</p>
          <Link className="btn btn-ghost" to="/register">Open an account</Link>
        </div>
    </div>
  );
}
