import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, TOUR } from '../demo';
import { useSession } from '../session';
import { toast } from './Toast';

const KEY = 'polo-coin-tour';
const EVENT = 'polo-tour';

function read(): number | null {
  try { const v = localStorage.getItem(KEY); return v === null ? null : Number(v); } catch { return null; }
}
function write(step: number | null) {
  try { step === null ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, String(step)); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useTourStep() {
  const [step, setStep] = useState<number | null>(read);
  useEffect(() => {
    const on = () => setStep(read());
    window.addEventListener(EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return step;
}

/** Log in as a demo account (or stay) and open the step's page. */
export function useGoToStep() {
  const { account, login } = useSession();
  const navigate = useNavigate();
  return async (i: number) => {
    const s = TOUR[i];
    write(i);
    if (s.as && account?.username !== s.as) {
      try {
        const r = await api.login(s.as, DEMO_PASSWORD);
        login(r.token, r.account, s.path);
        return;
      } catch (e) { toast.error('Could not switch account', (e as Error).message); return; }
    }
    navigate(s.path);
  };
}

export function startTour() { write(0); }

/** Slim bar under the header while the guided demo is running. */
export function TourBar() {
  const step = useTourStep();
  const go = useGoToStep();
  const { account } = useSession();
  const { pathname } = useLocation();
  if (step === null || !TOUR[step]) return null;
  const s = TOUR[step];
  const who = DEMO_ACCOUNTS.find((d) => d.username === s.as);
  const wrongRole = s.as !== null && account?.username !== s.as;
  const here = pathname === s.path.split('?')[0];
  const last = step === TOUR.length - 1;

  return (
    <aside className="tourbar" aria-label="Guided demo">
      <div className="wrap tourbar-inner">
        <span className="tourbar-step">Demo tour · {step + 1}/{TOUR.length}</span>
        <div className="tourbar-text">
          <strong>{s.title}</strong> <span>{s.text}</span>
        </div>
        <div className="tourbar-actions">
          {(wrongRole || !here) && (
            <button className="btn btn-accent btn-small" onClick={() => go(step)}>
              {wrongRole ? `Act as ${who?.name}` : 'Open this step'}
            </button>
          )}
          {step > 0 && <button className="btn btn-on-dark btn-small" onClick={() => go(step - 1)}>Back</button>}
          {!last
            ? <button className="btn btn-on-dark btn-small" onClick={() => go(step + 1)}>Next step</button>
            : <button className="btn btn-on-dark btn-small" onClick={() => write(null)}>Finish</button>}
          <button className="tourbar-x" aria-label="End the tour" onClick={() => write(null)}>×</button>
        </div>
      </div>
    </aside>
  );
}
