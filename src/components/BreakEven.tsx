import { useState } from 'react';
import { money0 } from '../format';

/** Assumptions from the seminar paper. */
const CHF_USD = 1.21;          // exchange rate used in the paper's cost comparison
const FEE = 0.01;              // purchase fee
const BANK_SHARE = 0.5;        // part of the fee passed on to partner banks
const TBILL_SHARE = 0.7;       // part of the reserve in T-bills
const YIELD = 0.042;           // 3-month T-bill yield
const MARKET = [               // payment volumes from the paper, USD m per year
  { label: 'Argentine horse exports (declared value)', low: 20, high: 35 },
  { label: 'Remittances of grooms abroad', low: 7.6, high: 25 },
];

const fmtM = (usd: number) => `USD ${(usd / 1e6).toFixed(usd < 1e7 ? 1 : 0)} m`;

/** Fee and interest income against fixed costs: what volume does Polo Coin need to break even? */
export default function BreakEven() {
  const [volumeM, setVolumeM] = useState(50);      // USD m bought per year
  const [days, setDays] = useState(30);            // average time a coin stays in circulation
  const [costsK, setCostsK] = useState(500);       // fixed costs, CHF thousand per year

  const V = volumeM * 1e6;
  const fixed = costsK * 1000 * CHF_USD;
  const feeIncome = V * FEE * (1 - BANK_SHARE);
  const avgReserve = V * (days / 365);
  const interest = avgReserve * TBILL_SHARE * YIELD;
  const result = feeIncome + interest - fixed;
  const marginPerUsd = FEE * (1 - BANK_SHARE) + (days / 365) * TBILL_SHARE * YIELD;
  const breakEven = fixed / marginPerUsd;
  const coreHigh = MARKET.reduce((s, m) => s + m.high, 0) * 1e6;

  return (
    <div className="calc breakeven">
      <div className="be-inputs">
        <label><span>Polo Coin bought per year: <strong>USD {volumeM} m</strong></span>
          <input type="range" min={5} max={300} step={5} value={volumeM} onChange={(e) => setVolumeM(Number(e.target.value))} /></label>
        <label><span>Average time a coin stays in circulation: <strong>{days} days</strong></span>
          <input type="range" min={1} max={180} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
        <label><span>Fixed costs per year: <strong>CHF {money0(costsK * 1000)}</strong></span>
          <input type="range" min={200} max={2000} step={50} value={costsK} onChange={(e) => setCostsK(Number(e.target.value))} /></label>
      </div>

      <table className="data-table">
        <tbody>
          <tr><td>Fee income (1% purchase fee, half kept after partner banks)</td><td className="num">USD {money0(feeIncome)}</td></tr>
          <tr><td>Interest income (average reserve USD {money0(avgReserve)}, 70% in T-bills at 4.2%)</td><td className="num">USD {money0(interest)}</td></tr>
          <tr><td>Fixed costs (CHF {money0(costsK * 1000)} at 1 CHF = {CHF_USD} USD)</td><td className="num">− USD {money0(fixed)}</td></tr>
          <tr className="row-pc"><td><strong>Result per year</strong></td><td className="num"><strong>{result >= 0 ? '' : '− '}USD {money0(Math.abs(result))}</strong></td></tr>
        </tbody>
      </table>

      <p className="calc-result">
        Break-even at <strong>{fmtM(breakEven)}</strong> of Polo Coin bought per year, if coins stay in circulation for {days} days on average.
      </p>
      <div className="be-market">
        {MARKET.map((m) => (
          <div key={m.label}><span>{m.label}</span><strong>USD {m.low}–{m.high} m</strong></div>
        ))}
        <div className="be-gap"><span>Core polo market (both, upper end)</span><strong>{fmtM(coreHigh)}</strong></div>
      </div>
      <p className="muted small">
        {breakEven > coreHigh
          ? 'The core polo market alone does not cover the fixed costs. This is why Polo Coin starts as a beachhead and then adds player fees, club payments, other equestrian sports and further payment corridors.'
          : 'At these assumptions the core polo market could cover the fixed costs.'}
        {' '}Fixed costs of CHF 500,000 are an assumption of the team (compliance, licensing, technology, staff, tournament marketing). Volumes from our seminar paper (SAGyP, Infocampo, own estimates).
      </p>
    </div>
  );
}
