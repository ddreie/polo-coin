import { useState } from 'react';
import type { Stats } from '../api';
import { money0 } from '../format';

/** Bank-run check: what happens if a share of all holders redeem at once?
 *  Cash pays out the same day; beyond that, T-bills are sold (settled the next business day).
 *  An optional fire-sale discount shows how much a forced sale could cost. */
export default function StressTest({ stats }: { stats: Stats | null }) {
  const [run, setRun] = useState(50);
  const [haircut, setHaircut] = useState(0);
  const reserve = stats?.reserve_usd || 56000;
  const supply = stats?.supply_pc || reserve;
  const cashShare = stats?.cash_share ?? 0.3;
  const cash = reserve * cashShare;
  const bills = reserve - cash;

  const redeem = supply * (run / 100);
  const fromCash = Math.min(redeem, cash);
  const needFromBills = Math.max(0, redeem - fromCash);
  const h = haircut / 100;
  const billsSold = h < 1 ? needFromBills / (1 - h) : needFromBills;
  const loss = billsSold - needFromBills;
  const leftReserve = reserve - redeem - loss;
  const leftSupply = supply - redeem;
  // When every coin is redeemed, the loss falls on the last holders: compare what is paid with what is owed.
  const backing = leftSupply > 0.005 ? leftReserve / leftSupply : supply > 0 ? (reserve - loss) / supply : 1;
  const ok = backing >= 0.9995;
  const pctOf = (x: number) => `${Math.max(0, Math.min(100, (x / reserve) * 100))}%`;

  return (
    <div className="stress">
      <div className="stress-inputs">
        <label>
          <span>Holders who cash out at once: <strong>{run}%</strong></span>
          <input type="range" min={0} max={100} step={5} value={run} onChange={(e) => setRun(Number(e.target.value))} />
        </label>
        <label>
          <span>Discount when selling T-bills in a hurry: <strong>{haircut.toFixed(1)}%</strong></span>
          <input type="range" min={0} max={2} step={0.1} value={haircut} onChange={(e) => setHaircut(Number(e.target.value))} />
        </label>
      </div>

      <div className="stress-bar" aria-hidden="true">
        <span className="sb-cash" style={{ width: pctOf(fromCash) }} />
        <span className="sb-bills" style={{ width: pctOf(billsSold) }} />
        <span className="sb-left" style={{ width: pctOf(Math.max(0, leftReserve)) }} />
      </div>
      <div className="stress-legend">
        <span><i className="sb-cash" /> Paid from cash, same day</span>
        <span><i className="sb-bills" /> T-bills sold, next business day</span>
        <span><i className="sb-left" /> Reserve left</span>
      </div>

      <table className="data-table stress-table">
        <tbody>
          <tr><td>Redemptions</td><td className="num">USD {money0(redeem)}</td></tr>
          <tr><td>Paid from USD deposits ({Math.round(cashShare * 100)}% of the reserve)</td><td className="num">USD {money0(fromCash)}</td></tr>
          <tr><td>T-bills sold</td><td className="num">USD {money0(billsSold)}</td></tr>
          <tr><td>Loss from selling at a discount</td><td className="num">USD {money0(loss)}</td></tr>
          <tr className="row-pc"><td><strong>{leftSupply > 0.005 ? 'Backing of the coins still in circulation' : 'Share of the coins paid out in full'}</strong></td><td className="num"><strong>{(backing * 100).toFixed(1)}%</strong></td></tr>
        </tbody>
      </table>

      <p className={`stress-verdict${ok ? '' : ' warn'}`}>
        {needFromBills === 0
          ? <>The cash part alone covers this run. Every holder is paid the same day.</>
          : ok
            ? <>Cash covers the first {Math.round((fromCash / supply) * 100)}% of the coins. The rest is paid the next business day from T-bills, and every remaining coin stays fully backed.</>
            : <>Even a forced sale at {haircut.toFixed(1)}% below value leaves {(backing * 100).toFixed(1)}% backing. Short-dated T-bills (at most 93 days) barely move in price, which is why the reserve holds nothing riskier.</>}
      </p>
    </div>
  );
}
