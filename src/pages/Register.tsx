import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, type SignUp } from '../api';
import { Avatar } from '../components/Brand';
import { useSession } from '../session';
import { roleLabel } from '../format';

const ROLES: { id: SignUp['role']; what: string }[] = [
  { id: 'patron', what: 'You fund a team and pay players and breeders. Starts with a simulated bank account of USD 100,000.' },
  { id: 'pro', what: 'You play for a patron and receive your fees in Polo Coin.' },
  { id: 'breeder', what: 'You sell or train polo ponies and receive payments in Polo Coin.' },
  { id: 'groom', what: 'You care for the horses and receive your wages in Polo Coin.' },
  { id: 'vet', what: 'You examine horses before a sale and report the result to the escrow contract. Your licence is checked by the Polo Coin Treasury.' },
];

const COUNTRIES = ['Argentina', 'United Kingdom', 'United States', 'Switzerland', 'Germany', 'France', 'Spain', 'Uruguay'];

export default function Register() {
  const onLogin = useSession().login;
  const [f, setF] = useState<SignUp>({ username: '', password: '', display_name: '', role: 'patron', org: '', country: '',
    licence_no: '', licence_authority: '', insurer: '', independent: false });
  const isVet = f.role === 'vet';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof SignUp) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await api.register(f);
      onLogin(r.token, r.account);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login wrap">
        <div className="login-intro">
          <h1>Open a Polo Coin account</h1>
          <p>
            Polo Coin has no anonymous wallets. After you sign up, your account is <strong>pending</strong> until
            the identity check (KYC) is done: the Polo Coin Treasury reviews every applicant, and the partner bank
            Banco Pampa Sur reviews applicants from Argentina. Until then you can log in, but not buy, send or receive PC.
          </p>
          <p>
            <strong>Veterinarians</strong> decide where escrow money goes, so they are checked more strictly and only by the
            Treasury: identity, veterinary licence, professional liability insurance and a declaration of independence.
            Once verified, buyers and sellers can choose them for a horse purchase.
          </p>
          <p className="note">This is a demo. Please use fictional details, not your real name or data.</p>
        </div>

        <form className="signup" onSubmit={submit}>
          <fieldset className="recipients">
            <legend>I am a</legend>
            {ROLES.map((r) => (
              <label key={r.id} className={`recipient${f.role === r.id ? ' on' : ''}`}>
                <input type="radio" name="role" checked={f.role === r.id} onChange={() => setF({ ...f, role: r.id })} />
                <Avatar name={roleLabel[r.id]} role={r.id} size={32} />
                <span><strong>{roleLabel[r.id]}</strong><small>{r.what}</small></span>
              </label>
            ))}
          </fieldset>

          <div className="signup-grid">
            <label>Full name<input required maxLength={60} autoComplete="off" value={f.display_name} onChange={set('display_name')} placeholder="e.g. Martina Ledesma" /></label>
            <label>Country
              <input required maxLength={40} list="countries" value={f.country} onChange={set('country')} placeholder="e.g. Argentina" />
              <datalist id="countries">{COUNTRIES.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="span2"><span>Team, club or business <span className="optional">(optional)</span></span>
              <input maxLength={60} value={f.org} onChange={set('org')}
                placeholder={f.role === 'patron' ? 'e.g. Team Silver Ridge' : f.role === 'pro' ? 'e.g. 5-goal professional'
                  : isVet ? 'e.g. Equine clinic, Pilar' : 'e.g. Haras El Ombú'} />
            </label>
            <label>Username<input required autoComplete="username" value={f.username} onChange={set('username')} placeholder="3–20 letters, digits or _" /></label>
            <label>Password<input required type="password" autoComplete="new-password" minLength={6} value={f.password} onChange={set('password')} placeholder="At least 6 characters" /></label>
          </div>

          {isVet && (
            <fieldset className="vet-fields">
              <legend>Veterinary licence</legend>
              <div className="signup-grid">
                <label>Licence number<input required maxLength={30} value={f.licence_no} onChange={set('licence_no')} placeholder="e.g. MP 1234" /></label>
                <label>Issued by<input required maxLength={80} value={f.licence_authority} onChange={set('licence_authority')} placeholder="e.g. Provincial veterinary register" /></label>
                <label className="span2">Professional liability insurer<input required maxLength={60} value={f.insurer} onChange={set('insurer')} placeholder="Insurance that covers a wrong examination report" /></label>
              </div>
              <label className="check">
                <input type="checkbox" required checked={!!f.independent} onChange={(e) => setF({ ...f, independent: e.target.checked })} />
                <span>I declare that I will only examine horses for sales in which I am independent: I am not employed by,
                  related to or paid by the seller, and I report the result truthfully.</span>
              </label>
            </fieldset>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-wide" disabled={busy}>{busy ? 'Submitting…' : 'Sign up and submit for KYC'}</button>
          <p className="muted small">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
    </div>
  );
}
