import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Account, type Party, type Stats, type Tx } from '../api';
import { Link } from 'react-router-dom';
import { Avatar, Logo } from '../components/Brand';
import ActionPanel from '../components/ActionPanel';
import Activity from '../components/Activity';
import RolePanel from '../components/RolePanel';
import { KycBadge, KycReview, KycStatus } from '../components/Kyc';
import { toast } from '../components/Toast';
import { money, roleLabel } from '../format';

interface Props {
  token: string;
  account: Account;
  setAccount: (a: Account) => void;
  onLogout: (next?: string) => void;
}

export default function Dashboard({ token, account, setAccount, onLogout }: Props) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [flash, setFlash] = useState(false);
  const lastKyc = useRef(account.kyc);
  const verified = account.kyc === 'verified';

  // Tell a pending user when the reviewer has decided (the dashboard polls every few seconds).
  useEffect(() => {
    if (lastKyc.current === 'pending' && account.kyc === 'verified') {
      toast.ok('Identity verified', `${account.kyc_by_name ?? 'The reviewer'} verified your account. You can now use Polo Coin.`);
      api.directory(token).then(setParties).catch(() => undefined);
    } else if (lastKyc.current === 'pending' && account.kyc === 'rejected') {
      toast.error('Application rejected', 'Your identity could not be verified.');
    }
    lastKyc.current = account.kyc;
  }, [account.kyc, account.kyc_by_name, token]);

  const refresh = useCallback(async () => {
    try {
      const [me, list, st] = await Promise.all([api.me(token), api.transactions(token, 100), api.stats()]);
      setAccount(me); setTxs(list); setStats(st);
    } catch (e) {
      if (/session/i.test((e as Error).message)) onLogout('login');
    }
  }, [token, setAccount, onLogout]);

  useEffect(() => {
    refresh();
    api.directory(token).then(setParties).catch(() => undefined);
    const id = setInterval(refresh, 6000);   // picks up payments made in other windows
    return () => clearInterval(id);
  }, [token, refresh]);

  const afterAction = useCallback(async () => {
    await refresh();
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
  }, [refresh]);

  return (
    <>
      <header className="topbar wrap">
        <Logo />
        <nav className="topnav">
          <Link to="/">Website</Link>
          <Link to="/explorer">Ledger</Link>
          <Link to="/login">Switch account</Link>
          <button className="linklike" onClick={() => onLogout('/login')}>Log out</button>
        </nav>
      </header>

      <main className="wrap dash">
        <section className="whoami">
          <Avatar name={account.display_name} role={account.role} size={56} />
          <div>
            <h1>{account.display_name}</h1>
            <p className="muted">
              {roleLabel[account.role]}, {account.org}, {account.country}.
              Wallet <code title={account.wallet}>{account.wallet.slice(0, 10)}…{account.wallet.slice(-4)}</code>
              {' '}<KycBadge kyc={account.kyc} />
            </p>
          </div>
        </section>

        <section className={`balances${flash ? ' flash' : ''}`} aria-label="Balances">
          <div className="bal bal-pc">
            <span className="bal-label">Polo Coin</span>
            <span className="bal-value"><span className="cur">PC</span>{money(account.pc)}</span>
            <span className="bal-note">= USD {money(account.pc)}, backed 1:1</span>
          </div>
          <div className="bal bal-usd">
            <span className="bal-label">{account.role === 'patron' ? 'Bank account (simulated)' : 'USD paid out to bank account'}</span>
            <span className="bal-value"><span className="cur">USD</span>{money(account.usd)}</span>
            <span className="bal-note">{account.role === 'patron' ? 'Use it to buy Polo Coin' : 'From PC redeemed at the partner bank'}</span>
          </div>
        </section>

        <div className="dash-grid">
          {verified
            ? <ActionPanel token={token} account={account} parties={parties} onDone={afterAction} />
            : <KycStatus account={account} />}
          <RolePanel token={token} account={account} txs={txs} stats={stats} onReset={() => onLogout('login')} />
        </div>

        {(account.role === 'admin' || account.role === 'bank') && <KycReview token={token} account={account} />}

        <Activity account={account} txs={txs} />
      </main>
    </>
  );
}
