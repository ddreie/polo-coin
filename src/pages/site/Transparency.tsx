import { Link } from 'react-router-dom';
import StressTest from '../../components/StressTest';
import { money0 } from '../../format';
import { ButtonLink, Card, PageHero, Section, Stat } from '../../ui';
import { useStats } from '../../useStats';

export default function Transparency() {
  const s = useStats();
  const backing = s && s.supply_pc ? s.reserve_usd / s.supply_pc : 1;
  const cash = s ? s.reserve_usd * s.cash_share : 0;
  const bills = s ? s.reserve_usd - cash : 0;
  const interest = s ? bills * s.reserve_yield : 0;

  return (
    <>
      <PageHero eyebrow="Transparency" title="Every coin, backed and visible"
        lede="Live proof that the US dollar reserve equals the Polo Coin in circulation. These figures come straight from the prototype’s database and update every few seconds.">
        <ButtonLink to="/explorer" variant="accent">Verify the ledger</ButtonLink>
      </PageHero>

      <Section title="Proof of reserves">
        <div className="por">
          <div className="por-bars" aria-label={`Backing ${Math.round(backing * 100)} percent`}>
            <div className="por-row"><span>USD in the reserve</span><strong>{s ? money0(s.reserve_usd) : '…'}</strong></div>
            <div className="por-bar"><span className="por-fill" style={{ width: '100%' }} /></div>
            <div className="por-row"><span>Polo Coin in circulation</span><strong>{s ? money0(s.supply_pc) : '…'}</strong></div>
            <div className="por-bar"><span className="por-fill por-fill-pc" style={{ width: `${Math.min(100, 100 / Math.max(backing, 0.0001))}%` }} /></div>
            <p className={`por-verdict${s && !s.chain_valid ? ' bad' : ''}`}>
              {s ? <>Backing <strong>{Math.round(backing * 100)}%</strong> · ledger {s.chain_valid ? 'intact' : 'broken'} · {s.tx_count} transactions</> : 'Loading live figures…'}
            </p>
          </div>
          <div className="grid-2 por-stats">
            <Stat value={s ? `PC ${money0(s.escrow_pc)}` : '…'} label={`locked in escrow (${s?.escrows_open ?? 0} open)`} />
            <Stat value={s ? String(s.wallets) : '…'} label="identified wallets" />
            <Stat value={s ? `USD ${money0(s.fees_usd)}` : '…'} label="purchase fees collected" />
            <Stat value={s ? `USD ${money0(interest)}` : '…'} label="interest per year on the reserve" />
          </div>
        </div>
      </Section>

      <Section tone="cream" title="How the reserve is held" intro="Safety first: only cash and the shortest US government debt.">
        <div className="reserve-mix">
          <div className="mix-bar" aria-hidden="true">
            <span className="mix-cash" style={{ width: `${(s?.cash_share ?? 0.3) * 100}%` }}>{Math.round((s?.cash_share ?? 0.3) * 100)}%</span>
            <span className="mix-bills">{Math.round((1 - (s?.cash_share ?? 0.3)) * 100)}%</span>
          </div>
          <div className="grid-2">
            <Card title={`US dollar deposits · USD ${money0(cash)}`}>
              <p>At least 30% of the reserve is held as bank deposits, the legal minimum for e-money tokens under MiCA (Art. 54). It covers redemptions immediately.</p>
            </Card>
            <Card title={`US Treasury bills · USD ${money0(bills)}`}>
              <p>The rest is invested in T-bills with at most 93 days to maturity, the limit of the US GENIUS Act. Their value barely moves with interest rates, so they can be sold within a day without loss.</p>
            </Card>
          </div>
        </div>
      </Section>

      <Section id="stress-test" title="Stress test: what if everyone wants out?"
        intro="A stablecoin can suffer a run like a bank: if many holders redeem at once and the reserve has to be sold at a loss, the last holders are not fully covered. Try it with the live reserve.">
        <StressTest stats={s} />
      </Section>

      <Section tone="cream" title="Our rules">
        <ul className="checklist checklist-2">
          <li>PC is created only when US dollars arrive in the reserve, and destroyed when they leave.</li>
          <li>Every holder can redeem 1:1 at any time through the partner bank.</li>
          <li>The reserve is kept in segregated accounts, apart from Polo Coin’s own funds, so holders are protected if the issuer fails.</li>
          <li>Interest on the reserve is not paid to holders, in line with MiCA (Art. 50).</li>
          <li>Every transaction is public as a hash-chained block, with wallets shown as addresses, not names.</li>
          <li>The reserve is audited regularly in production. This prototype simulates the audit.</li>
        </ul>
        <p><Link to="/security">Security and regulation →</Link></p>
      </Section>
    </>
  );
}
