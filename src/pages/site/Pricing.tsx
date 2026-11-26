import { useState } from 'react';
import { Link } from 'react-router-dom';
import BreakEven from '../../components/BreakEven';
import { money0, wireCost } from '../../format';
import { ButtonLink, Card, PageHero, Section, Cite, Notes } from '../../ui';

/** Figures from the seminar paper (Table 1 and section "Cost advantage of Polo Coin").
 *  Scenario A, USD account: OUR fee only. Scenario B, CHF, EUR or GBP account: OUR fee plus the exchange-rate
 *  mark-up of the account currency (Du et al., 2026; Lloyds; HSBC), applied only to banks of that currency.
 *  Scenario B per the paper: USD 2,000 from 4.26% (Deutsche Bank 0.56% + 3.7%) to 6.64% (BBVA 1.94% + 4.7%),
 *  USD 10,000 from 3.40% (UBS 0.30% + 3.1%) to 5.40% (BBVA 0.70% + 4.7%). */
const OUR = { at2k: { low: 0.0056, high: 0.0194 }, at10k: { low: 0.0030, high: 0.0070 } };
type Acct = 'non-usd' | 'usd';
const ACCOUNTS: { id: Acct; label: string; note: string }[] = [
  { id: 'non-usd', label: 'CHF, EUR or GBP',
    note: 'Mark-ups are applied only to banks of the same account currency. Cheapest: Deutsche Bank at USD 2,000, UBS at USD 10,000. Most expensive: BBVA. Mark-ups: CHF 3.1%, EUR 3.7–4.7% (Du et al., 2026), GBP 3.55–3.7% (Lloyds, HSBC)' },
  { id: 'usd', label: 'USD', note: 'No conversion from a US dollar account, so only the OUR fee applies' },
];
const PC_FEE = 0.01;
const WISE_LIMIT = 18000;

/** OUR fees are mostly fixed, so their share falls with the amount: interpolate on a log scale between the two measurements. */
function ourFee(amount: number, edge: 'low' | 'high') {
  const w = Math.min(1, Math.max(0, Math.log(amount / 2000) / Math.log(5)));
  return OUR.at2k[edge] + (OUR.at10k[edge] - OUR.at2k[edge]) * w;
}
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export default function Pricing() {
  return (
    <Notes ids={['paper', 'wise_b', 'circle2025']}>
      <PageHero eyebrow="Pricing" title="One fee. 1%. Nothing hidden."
        lede="You pay 1% when you buy Polo Coin. Currency conversion, every payment and the cash-out in Argentina are included.">
        <ButtonLink to="/login" variant="accent">Try it in the demo</ButtonLink>
      </PageHero>

      <Section title="What a payment to Argentina really costs" intro="Choose the amount and the currency of your account. Bank figures come from the published fee schedules of nine European and US banks.">
        <Calculator />
      </Section>

      <Section tone="cream" title="What is included">
        <div className="grid-3">
          <Card title="Buying PC: 1%">
            <p>Paid once, in your own currency. Covers the conversion into US dollars at near-wholesale rates and the later cash-out. Shared with our partner banks.</p>
          </Card>
          <Card title="Payments: free">
            <p>Sending and receiving PC costs nothing, however often. Players, breeders and grooms receive the full amount.</p>
          </Card>
          <Card title="Cash-out: free">
            <p>Exchange PC for US dollars at the partner bank in Argentina, 1:1. Converting dollars into pesos is up to you and costs the same with any provider.</p>
          </Card>
        </div>
      </Section>

      <Section id="break-even" title="When does Polo Coin pay for itself?"
        intro="Set the yearly volume, how long coins stay in circulation and the fixed costs. The calculator shows fee and interest income against the costs.">
        <BreakEven />
      </Section>

      <Section tone="cream" title="How Polo Coin earns money">
        <div className="split">
          <p>
            Two revenue streams. First, the 1% purchase fee, part of which goes to the partner banks for conversion
            and payout. Second, interest on the reserve: 70% of it is invested in US Treasury bills with up to 93
            days to maturity. At a yield of about 4.2%, every dollar in the reserve earns roughly 2.9% a year.
            As required by MiCA, this interest is not passed on to coin holders. Circle, the issuer of USDC, earns almost all of its revenue this way.<Cite id="circle2025" />
          </p>
          <p className="muted">
            During the pilot at selected tournaments the purchase fee is waived, so patrons can test Polo Coin without
            any cost. <Link to="/about#roadmap">See the roadmap</Link>.
          </p>
        </div>
      </Section>
    </Notes>
  );
}

function Calculator() {
  const [amount, setAmount] = useState(10000);
  const [acct, setAcct] = useState<Acct>('non-usd');
  const a = Math.max(0, amount);
  const m = ACCOUNTS.find((x) => x.id === acct)!;
  const bankLow = acct === 'usd' ? ourFee(a || 1, 'low') : wireCost(a || 1, 'low');
  const bankHigh = acct === 'usd' ? ourFee(a || 1, 'high') : wireCost(a || 1, 'high');
  const saveLow = Math.max(0, bankLow - PC_FEE);
  const saveHigh = Math.max(0, bankHigh - PC_FEE);

  return (
    <div className="calc">
      <div className="calc-inputs">
        <label>
          <span>Amount to pay (USD)</span>
          <input type="number" min={100} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        </label>
        <div className="calc-cur" role="group" aria-label="Your account currency">
          <span>Your account is in</span>
          <div>
            {ACCOUNTS.map((c) => (
              <button key={c.id} type="button" aria-pressed={acct === c.id} onClick={() => setAcct(c.id)}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>

      <table className="data-table">
        <thead><tr><th>Option</th><th className="num">Cost</th><th className="num">In USD</th><th>Arrives</th><th>Paid out in</th></tr></thead>
        <tbody>
          <tr>
            <td>Bank wire, cheapest bank</td><td className="num">{pct(bankLow)}</td><td className="num">{money0(a * bankLow)}</td><td>1–3 days</td><td>USD</td>
          </tr>
          <tr>
            <td>Bank wire, most expensive bank</td><td className="num">{pct(bankHigh)}</td><td className="num">{money0(a * bankHigh)}</td><td>1–3 days</td><td>USD</td>
          </tr>
          <tr className="muted-row">
            <td>Money transfer app (e.g. Wise)</td><td className="num">low</td><td className="num">—</td><td>up to 3 days</td>
            <td>{a > WISE_LIMIT ? `Not possible above USD ${money0(WISE_LIMIT)} a month` : 'Pesos only'}</td>
          </tr>
          <tr className="row-pc">
            <td><strong>Polo Coin</strong></td><td className="num"><strong>{pct(PC_FEE)}</strong></td><td className="num"><strong>{money0(a * PC_FEE)}</strong></td><td><strong>Seconds</strong></td><td><strong>USD</strong></td>
          </tr>
        </tbody>
      </table>

      <p className="calc-result">
        {saveHigh > 0
          ? <>On this payment you save <strong>USD {money0(a * saveLow)}–{money0(a * saveHigh)}</strong> ({pct(saveLow)}–{pct(saveHigh)} points) compared with a bank wire.</>
          : <>From a US dollar account, large payments by bank wire can be cheaper than 1%. Polo Coin still arrives in seconds and offers escrow.</>}
      </p>
      <p className="muted small">
        Bank cost = OUR fee (all charges paid by the sender) + exchange-rate mark-up. {m.note}. Mark-ups exclude wire fees, so real
        bank costs are likely higher. Converting received dollars into pesos adds about 1.7% with any option. Bank fees: fee
        schedules of Bank of America, Barclays, BBVA, Chase, Deutsche Bank, ING, Lloyds, UBS, UniCredit, 2026.<Cite id="paper" /> Wise limit for
        Argentina: USD 18,000 per month.<Cite id="wise_b" />
      </p>
    </div>
  );
}
