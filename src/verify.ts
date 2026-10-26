import type { Tx } from './api';

export const GENESIS_PREV = '0'.repeat(64);

export async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The exact text that is hashed for a block – identical to polo.append() in supabase/setup.sql. */
export function blockPayload(t: Pick<Tx, 'prev_hash' | 'kind' | 'from_wallet' | 'to_wallet' | 'amount' | 'fee' | 'memo_hash' | 'ts_us'>) {
  return [
    t.prev_hash, t.kind, t.from_wallet ?? '', t.to_wallet ?? '',
    Number(t.amount).toFixed(2), Number(t.fee).toFixed(2), t.memo_hash ?? '', String(t.ts_us ?? ''),
  ].join('|');
}

export const blockHash = async (t: Parameters<typeof blockPayload>[0]) => '0x' + (await sha256Hex(blockPayload(t)));

export interface BlockCheck { block: number; hashOk: boolean; linkOk: boolean; computed: string }

/** Recompute every hash and check every link. `blocks` must be oldest first. */
export async function verifyChain(blocks: Tx[]): Promise<BlockCheck[]> {
  const out: BlockCheck[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const computed = await blockHash(b);
    const expectedPrev = i === 0 ? GENESIS_PREV : blocks[i - 1].tx_hash;
    out.push({ block: b.block, computed, hashOk: computed === b.tx_hash, linkOk: b.prev_hash === expectedPrev });
  }
  return out;
}
