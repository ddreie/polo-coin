import type { Account, Tx } from './api';
import { money } from './format';

const KIND: Record<Tx['kind'], string> = {
  genesis: 'Genesis block', mint: 'Purchase of Polo Coin', transfer: 'Payment', redeem: 'Cash-out to US dollars',
  lock: 'Locked in smart contract', release: 'Paid out by smart contract', refund: 'Refunded by smart contract',
};

async function logoDataUrl() {
  try {
    const blob = await (await fetch('/brand/app-icon-512.png')).blob();
    return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
  } catch { return null; }
}

/** Creates a PDF receipt for one transaction and downloads it. jsPDF is loaded only when needed. */
export async function downloadReceipt(t: Tx, me: Account) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const green: [number, number, number] = [15, 64, 39];
  const cream: [number, number, number] = [235, 207, 173];
  const orange: [number, number, number] = [242, 106, 30];

  doc.setFillColor(...green); doc.rect(0, 0, 210, 42, 'F');
  const logo = await logoDataUrl();
  if (logo) doc.addImage(logo, 'PNG', 18, 9, 24, 24);
  doc.setTextColor(...cream); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text('Polo Coin', 48, 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Payment receipt', 48, 27);
  doc.text(`Block #${t.block}`, 192, 20, { align: 'right' });
  doc.text(new Date(t.created_at).toLocaleString('en-GB'), 192, 27, { align: 'right' });

  doc.setTextColor(20, 32, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(KIND[t.kind], 18, 60);
  doc.setFontSize(28); doc.setTextColor(...green);
  doc.text(`PC ${money(t.amount)}`, 18, 74);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(94, 102, 96);
  doc.text(`= USD ${money(t.amount)}, backed 1:1 by the Polo Coin reserve`, 18, 81);

  const rows: [string, string][] = [
    ['From', t.from_name ?? (t.kind === 'mint' ? 'Polo Coin reserve (new coins issued)' : '—')],
    ['To', t.to_name ?? '—'],
    ['Reference', t.memo ?? '—'],
    ['Fee', t.fee ? `USD ${money(t.fee)} (1% purchase fee)` : 'None'],
    ['From wallet', t.from_wallet ?? '—'],
    ['To wallet', t.to_wallet ?? '—'],
    ['Transaction hash', t.tx_hash],
    ['Previous block hash', t.prev_hash],
  ];
  let y = 96;
  doc.setDrawColor(228, 217, 203);
  for (const [k, v] of rows) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(94, 102, 96); doc.setFontSize(9);
    doc.text(k.toUpperCase(), 18, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 32, 26); doc.setFontSize(10);
    const lines = doc.splitTextToSize(v, 125) as string[];
    doc.text(lines, 67, y);
    y += 6 + (lines.length - 1) * 5;
    doc.line(18, y - 3, 192, y - 3);
    y += 3;
  }

  doc.setFillColor(...orange); doc.circle(21, y + 8, 2.2, 'F');
  doc.setFontSize(9); doc.setTextColor(94, 102, 96);
  doc.text(doc.splitTextToSize(
    'Every transaction is a block on the Polo Coin ledger and contains the fingerprint of the block before it. '
    + `Verify this payment at ${window.location.origin}/explorer?b=${t.block}`, 165) as string[], 27, y + 9);
  doc.text(`Issued for ${me.display_name}. Seminar prototype, University of Zurich. All people, banks and money are fictional.`, 18, 285);
  doc.save(`polo-coin-receipt-${t.block}.pdf`);
}
