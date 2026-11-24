-- =====================================================================
-- Polo Coin prototype – database setup for Supabase
-- Paste this whole file into Supabase → SQL Editor → "Run".
-- It is safe to run again: it drops and recreates everything.
-- =====================================================================
--
-- Architecture
--   * All tables live in the private schema "polo", which the Supabase
--     API does NOT expose. The browser can never read or write tables
--     directly.
--   * The website only calls the api_* functions below (Postgres RPC).
--     They run as SECURITY DEFINER, check the session token and apply
--     all business rules inside one database transaction (atomic).
--   * Every movement is appended to a hash-chained ledger
--     (tx_hash = sha256(prev_hash || payload)), mimicking a blockchain.
--
-- Business rules (from the seminar paper)
--   * 1 PC = 1 USD, 100 % backed by the USD reserve.
--   * Buying PC (mint) costs a one-time fee of 1 % on top, paid in USD and
--     split 50/50 between the Polo Coin treasury and the partner bank.
--     The fee covers currency conversion and the later redemption.
--   * Transfers between wallets and redeeming PC at the partner bank (burn)
--     are free.
--   * Escrow (smart contract): a buyer locks PC for a horse; the named vet
--     confirms the pre-purchase examination; the contract then releases the
--     PC to the seller automatically, or refunds the buyer if the horse fails.
--     Locked PC sit in the wallet of the escrow contract and stay in supply.
--   * Payment requests: a professional asks a patron for a fee; the patron
--     pays it with one click (a normal transfer).
--   * Win bonus (smart contract): a patron locks a bonus for a player; the
--     named tournament organiser records the result; won = paid to the
--     player, lost = back to the patron.
--   * Standing orders: weekly or monthly payments (e.g. a groom's wages),
--     executed when due (whenever the payer's wallet is open) or on demand.
--   * Reserve: at least 30 % held as USD deposits (MiCA Art. 54), the rest in
--     US Treasury bills (up to 93 days); assumed yield 4.2 % p.a.
--   * KYC: new users sign up with status 'pending'. They can log in but
--     cannot buy, send, receive or cash out until the treasury (any
--     applicant) or the partner bank (applicants from Argentina) verifies
--     them. No anonymous wallets.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

drop schema if exists polo cascade;
create schema polo;
revoke all on schema polo from public;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table polo.accounts (
  id            serial primary key,
  username      text unique not null,
  password_hash text not null,
  display_name  text not null,
  role          text not null check (role in ('patron','pro','breeder','groom','vet','organizer','bank','admin','contract')),
  org           text not null,
  country       text not null,
  wallet        text unique not null,
  kyc           text not null default 'pending' check (kyc in ('pending','verified','rejected')),
  kyc_by        int references polo.accounts(id),      -- who verified or rejected the applicant
  kyc_at        timestamptz,
  created_at    timestamptz not null default now(),
  usd           numeric(14,2) not null default 0 check (usd >= 0),
  pc            numeric(14,2) not null default 0 check (pc >= 0)
);

create table polo.sessions (
  token      uuid primary key default gen_random_uuid(),
  account_id int not null references polo.accounts(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '12 hours'
);

create table polo.reserve (
  id  boolean primary key default true check (id),
  usd numeric(14,2) not null default 0 check (usd >= 0)
);

create table polo.ledger (
  block      bigserial primary key,
  tx_hash    text not null unique,
  prev_hash  text not null,
  kind       text not null check (kind in ('genesis','mint','transfer','redeem','lock','release','refund')),
  from_id    int references polo.accounts(id),
  to_id      int references polo.accounts(id),
  amount     numeric(14,2) not null default 0,
  fee        numeric(14,2) not null default 0,
  memo       text,
  memo_hash  text not null,          -- sha256 of the reference; the reference itself stays private
  ts_us      bigint not null,        -- timestamp in microseconds since 1970 (part of the hash)
  created_at timestamptz not null default now()
);

create table polo.config (
  id            boolean primary key default true check (id),
  fee_rate      numeric not null default 0.01,   -- 1 % on every purchase of PC
  bank_share    numeric not null default 0.5,    -- share of the fee for the partner bank
  reserve_yield numeric not null default 0.042,  -- yield on 3-month US Treasury bills
  cash_share    numeric not null default 0.30    -- part of the reserve held as USD deposits (MiCA Art. 54)
);

create table polo.escrows (
  id           serial primary key,
  buyer_id     int not null references polo.accounts(id),
  seller_id    int not null references polo.accounts(id),
  vet_id       int not null references polo.accounts(id),
  amount       numeric(14,2) not null check (amount > 0),
  item         text not null,                       -- e.g. the horse being bought
  status       text not null default 'locked' check (status in ('locked','released','refunded')),
  vet_passed   boolean,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  lock_block   bigint references polo.ledger(block),
  settle_block bigint references polo.ledger(block)
);

create table polo.requests (
  id           serial primary key,
  requester_id int not null references polo.accounts(id),
  payer_id     int not null references polo.accounts(id),
  amount       numeric(14,2) not null check (amount > 0),
  memo         text,
  status       text not null default 'open' check (status in ('open','paid','declined')),
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  block        bigint references polo.ledger(block)
);

-- Row Level Security as a second safety net. The schema is not exposed to the
-- API anyway; the api_* functions run as table owner and are not affected.
create table polo.bonuses (
  id           serial primary key,
  patron_id    int not null references polo.accounts(id),
  player_id    int not null references polo.accounts(id),
  organizer_id int not null references polo.accounts(id),
  amount       numeric(14,2) not null check (amount > 0),
  match        text not null,                       -- e.g. the final the bonus is tied to
  status       text not null default 'locked' check (status in ('locked','paid','refunded')),
  won          boolean,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz,
  lock_block   bigint references polo.ledger(block),
  settle_block bigint references polo.ledger(block)
);

create table polo.standing (
  id         serial primary key,
  payer_id   int not null references polo.accounts(id),
  payee_id   int not null references polo.accounts(id),
  amount     numeric(14,2) not null check (amount > 0),
  memo       text,
  every      text not null check (every in ('week','month')),
  next_due   timestamptz not null,
  active     boolean not null default true,
  runs       int not null default 0,
  created_at timestamptz not null default now(),
  last_block bigint references polo.ledger(block)
);

alter table polo.accounts enable row level security;
alter table polo.sessions enable row level security;
alter table polo.reserve  enable row level security;
alter table polo.ledger   enable row level security;
alter table polo.config   enable row level security;
alter table polo.escrows  enable row level security;
alter table polo.requests enable row level security;
alter table polo.bonuses  enable row level security;
alter table polo.standing enable row level security;

-- ---------------------------------------------------------------------
-- Internal helpers (not callable from the website)
-- ---------------------------------------------------------------------
create function polo.wallet_of(p_seed text) returns text
language sql immutable set search_path = '' as $$
  select '0x' || substr(encode(extensions.digest(p_seed, 'sha256'), 'hex'), 1, 40)
$$;

-- Resolve a session token to an account id, or fail.
create function polo.auth(p_token uuid) returns int
language plpgsql set search_path = '' as $$
declare v_id int;
begin
  select account_id into v_id from polo.sessions
   where token = p_token and expires_at > now();
  if v_id is null then
    raise exception 'Session expired – please log in again.';
  end if;
  return v_id;
end $$;

-- Like polo.auth, but the account must also have passed KYC.
create function polo.auth_verified(p_token uuid) returns int
language plpgsql set search_path = '' as $$
declare v_id int := polo.auth(p_token); v_kyc text;
begin
  select kyc into v_kyc from polo.accounts where id = v_id;
  if v_kyc = 'pending' then
    raise exception 'Your identity check (KYC) is still pending. You can use Polo Coin once it is verified.';
  elsif v_kyc <> 'verified' then
    raise exception 'Your KYC application was rejected. This account cannot use Polo Coin.';
  end if;
  return v_id;
end $$;

-- Append a block to the hash-chained ledger.
-- tx_hash = '0x' || sha256( prev_hash | kind | from_wallet | to_wallet | amount | fee | memo_hash | ts_us )
-- Every field in that formula is public (api_explorer), so anyone can recompute and verify the chain.
create function polo.append(p_kind text, p_from int, p_to int,
                            p_amount numeric, p_fee numeric, p_memo text)
returns polo.ledger
language plpgsql set search_path = '' as $$
declare v_prev text; v_row polo.ledger; v_now timestamptz := clock_timestamp();
        v_us bigint; v_memo_hash text; v_fw text; v_tw text;
begin
  perform pg_advisory_xact_lock(424242);          -- serialise the chain
  select tx_hash into v_prev from polo.ledger order by block desc limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_us := floor(extract(epoch from v_now) * 1000000)::bigint;
  v_memo_hash := encode(extensions.digest(coalesce(p_memo, ''), 'sha256'), 'hex');
  select wallet into v_fw from polo.accounts where id = p_from;
  select wallet into v_tw from polo.accounts where id = p_to;
  insert into polo.ledger (tx_hash, prev_hash, kind, from_id, to_id, amount, fee, memo, memo_hash, ts_us, created_at)
  values ('0x' || encode(extensions.digest(concat_ws('|',
            v_prev, p_kind, coalesce(v_fw, ''), coalesce(v_tw, ''),
            round(p_amount, 2)::numeric(14,2)::text, round(p_fee, 2)::numeric(14,2)::text,
            v_memo_hash, v_us::text), 'sha256'), 'hex'),
          v_prev, p_kind, p_from, p_to, p_amount, p_fee, p_memo, v_memo_hash, v_us, v_now)
  returning * into v_row;
  return v_row;
end $$;

create function polo.check_amount(p_amount numeric) returns numeric
language plpgsql immutable set search_path = '' as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;
  if p_amount > 1000000 then
    raise exception 'Demo limit: max. 1,000,000 per transaction.';
  end if;
  return round(p_amount, 2);
end $$;

create function polo.account_json(a polo.accounts) returns json
language sql stable set search_path = '' as $$
  select json_build_object('id', a.id, 'username', a.username, 'display_name', a.display_name,
    'role', a.role, 'org', a.org, 'country', a.country, 'wallet', a.wallet,
    'kyc', a.kyc, 'kyc_at', a.kyc_at,
    'kyc_by_name', (select display_name from polo.accounts where id = a.kyc_by),
    'usd', a.usd, 'pc', a.pc)
$$;

create function polo.tx_json(l polo.ledger) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'block', l.block, 'tx_hash', l.tx_hash, 'prev_hash', l.prev_hash, 'kind', l.kind,
    'from_id', l.from_id, 'to_id', l.to_id,
    'from_name', (select display_name from polo.accounts where id = l.from_id),
    'to_name',   (select display_name from polo.accounts where id = l.to_id),
    'from_wallet', (select wallet from polo.accounts where id = l.from_id),
    'to_wallet',   (select wallet from polo.accounts where id = l.to_id),
    'amount', l.amount, 'fee', l.fee, 'memo', l.memo, 'created_at', l.created_at)
$$;

create function polo.escrow_json(e polo.escrows) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'id', e.id, 'amount', e.amount, 'item', e.item, 'status', e.status, 'vet_passed', e.vet_passed,
    'buyer_id', e.buyer_id, 'seller_id', e.seller_id, 'vet_id', e.vet_id,
    'buyer_name',  (select display_name from polo.accounts where id = e.buyer_id),
    'seller_name', (select display_name from polo.accounts where id = e.seller_id),
    'vet_name',    (select display_name from polo.accounts where id = e.vet_id),
    'created_at', e.created_at, 'settled_at', e.settled_at,
    'lock_hash',   (select tx_hash from polo.ledger where block = e.lock_block),
    'settle_hash', (select tx_hash from polo.ledger where block = e.settle_block),
    'contract_wallet', (select wallet from polo.accounts where role = 'contract' order by id limit 1))
$$;

create function polo.request_json(r polo.requests) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'id', r.id, 'amount', r.amount, 'memo', r.memo, 'status', r.status,
    'requester_id', r.requester_id, 'payer_id', r.payer_id,
    'requester_name', (select display_name from polo.accounts where id = r.requester_id),
    'payer_name',     (select display_name from polo.accounts where id = r.payer_id),
    'created_at', r.created_at, 'settled_at', r.settled_at,
    'tx_hash', (select tx_hash from polo.ledger where block = r.block))
$$;

create function polo.bonus_json(b polo.bonuses) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'id', b.id, 'amount', b.amount, 'match', b.match, 'status', b.status, 'won', b.won,
    'patron_id', b.patron_id, 'player_id', b.player_id, 'organizer_id', b.organizer_id,
    'patron_name',    (select display_name from polo.accounts where id = b.patron_id),
    'player_name',    (select display_name from polo.accounts where id = b.player_id),
    'organizer_name', (select display_name from polo.accounts where id = b.organizer_id),
    'created_at', b.created_at, 'settled_at', b.settled_at,
    'lock_hash',   (select tx_hash from polo.ledger where block = b.lock_block),
    'settle_hash', (select tx_hash from polo.ledger where block = b.settle_block))
$$;

create function polo.standing_json(o polo.standing) returns json
language sql stable set search_path = '' as $$
  select json_build_object(
    'id', o.id, 'amount', o.amount, 'memo', o.memo, 'every', o.every, 'next_due', o.next_due,
    'active', o.active, 'runs', o.runs, 'created_at', o.created_at,
    'payer_id', o.payer_id, 'payee_id', o.payee_id,
    'payer_name', (select display_name from polo.accounts where id = o.payer_id),
    'payee_name', (select display_name from polo.accounts where id = o.payee_id),
    'last_hash',  (select tx_hash from polo.ledger where block = o.last_block))
$$;

create function polo.role_of(p_id int) returns text
language sql stable set search_path = '' as $$
  select role from polo.accounts where id = p_id
$$;

create function polo.contract_id() returns int
language sql stable set search_path = '' as $$
  select id from polo.accounts where role = 'contract' order by id limit 1
$$;

-- ---------------------------------------------------------------------
-- Business operations. Used by the api_* functions and by the demo seed,
-- so the starting data follows exactly the same rules.
-- ---------------------------------------------------------------------

-- Mint: USD from the buyer's bank account into the reserve, the same amount of PC is issued.
-- The buyer pays a one-time fee of fee_rate on top (in USD), shared between treasury and partner bank.
create function polo.op_buy(p_id int, p_amount numeric) returns polo.ledger
language plpgsql set search_path = '' as $$
declare v_amt numeric := polo.check_amount(p_amount); c polo.config; v_fee numeric; v_bank_fee numeric;
        v_bank int; v_admin int; a polo.accounts;
begin
  select * into c from polo.config;
  v_fee := round(v_amt * c.fee_rate, 2);
  v_bank_fee := round(v_fee * c.bank_share, 2);
  select id into v_bank  from polo.accounts where role = 'bank'  order by id limit 1;
  select id into v_admin from polo.accounts where role = 'admin' order by id limit 1;
  perform 1 from polo.accounts where id in (p_id, v_bank, v_admin) order by id for update;
  select * into a from polo.accounts where id = p_id;
  if a.usd < v_amt + v_fee then
    raise exception 'Insufficient USD balance: % needed incl. 1%% fee, % available.', v_amt + v_fee, a.usd;
  end if;
  update polo.accounts set usd = usd - (v_amt + v_fee), pc = pc + v_amt where id = p_id;
  update polo.accounts set usd = usd + v_bank_fee where id = v_bank;
  update polo.accounts set usd = usd + (v_fee - v_bank_fee) where id = v_admin;
  update polo.reserve set usd = usd + v_amt where id;
  return polo.append('mint', null, p_id, v_amt, v_fee, 'USD deposited into reserve, PC minted');
end $$;

-- Transfer between wallets: free and final.
create function polo.op_transfer(p_from int, p_to int, p_amount numeric, p_memo text) returns polo.ledger
language plpgsql set search_path = '' as $$
declare v_amt numeric := polo.check_amount(p_amount); a polo.accounts;
begin
  if p_to = p_from then raise exception 'You cannot send PC to yourself.'; end if;
  if not exists (select 1 from polo.accounts where id = p_to and role <> 'contract') then
    raise exception 'Recipient not found.';
  end if;
  if not exists (select 1 from polo.accounts where id = p_to and kyc = 'verified') then
    raise exception 'The recipient has not passed KYC yet and cannot receive PC.';
  end if;
  perform 1 from polo.accounts where id in (p_from, p_to) order by id for update;
  select * into a from polo.accounts where id = p_from;
  if a.pc < v_amt then
    raise exception 'Insufficient PC balance (available: %).', a.pc;
  end if;
  update polo.accounts set pc = pc - v_amt where id = p_from;
  update polo.accounts set pc = pc + v_amt where id = p_to;
  return polo.append('transfer', p_from, p_to, v_amt, 0, nullif(trim(left(p_memo, 120)), ''));
end $$;

-- Burn: PC destroyed, USD paid from the reserve to the holder's bank account by the partner bank. Free.
create function polo.op_redeem(p_id int, p_amount numeric) returns polo.ledger
language plpgsql set search_path = '' as $$
declare v_amt numeric := polo.check_amount(p_amount); v_bank int; a polo.accounts;
begin
  select id into v_bank from polo.accounts where role = 'bank' order by id limit 1;
  select * into a from polo.accounts where id = p_id for update;
  if a.pc < v_amt then
    raise exception 'Insufficient PC balance (available: %).', a.pc;
  end if;
  update polo.accounts set pc = pc - v_amt, usd = usd + v_amt where id = p_id;
  update polo.reserve set usd = usd - v_amt where id;
  return polo.append('redeem', p_id, v_bank, v_amt, 0, 'PC burned, USD paid out by partner bank');
end $$;

-- Escrow: lock the buyer's PC in the contract wallet.
create function polo.op_escrow_lock(p_buyer int, p_seller int, p_vet int, p_amount numeric, p_item text) returns polo.escrows
language plpgsql set search_path = '' as $$
declare v_amt numeric := polo.check_amount(p_amount); v_item text := trim(left(coalesce(p_item, ''), 80));
        v_contract int := polo.contract_id(); a polo.accounts; e polo.escrows; t polo.ledger;
begin
  if length(v_item) < 2 then raise exception 'Describe what you are buying, e.g. the horse''s name.'; end if;
  if p_seller = p_buyer then raise exception 'You cannot buy from yourself.'; end if;
  if not exists (select 1 from polo.accounts where id = p_seller and kyc = 'verified' and role in ('patron','pro','breeder')) then
    raise exception 'The seller must be a verified patron, player or breeder.';
  end if;
  if not exists (select 1 from polo.accounts where id = p_vet and kyc = 'verified' and role = 'vet') then
    raise exception 'Choose a verified veterinarian for the pre-purchase examination.';
  end if;
  perform 1 from polo.accounts where id in (p_buyer, v_contract) order by id for update;
  select * into a from polo.accounts where id = p_buyer;
  if a.pc < v_amt then
    raise exception 'Insufficient PC balance (available: %).', a.pc;
  end if;
  insert into polo.escrows (buyer_id, seller_id, vet_id, amount, item)
  values (p_buyer, p_seller, p_vet, v_amt, v_item) returning * into e;
  update polo.accounts set pc = pc - v_amt where id = p_buyer;
  update polo.accounts set pc = pc + v_amt where id = v_contract;
  t := polo.append('lock', p_buyer, v_contract, v_amt, 0, 'Escrow #' || e.id || ': ' || v_item);
  update polo.escrows set lock_block = t.block where id = e.id returning * into e;
  return e;
end $$;

-- Escrow: the contract pays out to the seller (vet passed) or back to the buyer (vet failed or buyer cancelled).
create function polo.op_escrow_settle(p_escrow int, p_release boolean, p_vet_passed boolean) returns polo.escrows
language plpgsql set search_path = '' as $$
declare e polo.escrows; v_contract int := polo.contract_id(); v_to int; t polo.ledger;
begin
  select * into e from polo.escrows where id = p_escrow for update;
  if e.id is null then raise exception 'Escrow not found.'; end if;
  if e.status <> 'locked' then raise exception 'Escrow #% is already %.', e.id, e.status; end if;
  v_to := case when p_release then e.seller_id else e.buyer_id end;
  perform 1 from polo.accounts where id in (v_to, v_contract) order by id for update;
  update polo.accounts set pc = pc - e.amount where id = v_contract;
  update polo.accounts set pc = pc + e.amount where id = v_to;
  t := polo.append(case when p_release then 'release' else 'refund' end, v_contract, v_to, e.amount, 0,
                   'Escrow #' || e.id || case when p_release then ': vet check passed, paid to seller'
                                          when p_vet_passed is false then ': vet check failed, refunded'
                                          else ': cancelled by buyer, refunded' end);
  update polo.escrows set status = case when p_release then 'released' else 'refunded' end,
         vet_passed = p_vet_passed, settled_at = now(), settle_block = t.block
   where id = e.id returning * into e;
  return e;
end $$;

-- Win bonus: the patron locks the bonus in the contract wallet.
create function polo.op_bonus_lock(p_patron int, p_player int, p_organizer int, p_amount numeric, p_match text) returns polo.bonuses
language plpgsql set search_path = '' as $$
declare v_amt numeric := polo.check_amount(p_amount); v_match text := trim(left(coalesce(p_match, ''), 80));
        v_contract int := polo.contract_id(); a polo.accounts; b polo.bonuses; t polo.ledger;
begin
  if length(v_match) < 2 then raise exception 'Name the match the bonus is tied to, e.g. the final.'; end if;
  if p_player = p_patron then raise exception 'You cannot promise a bonus to yourself.'; end if;
  if not exists (select 1 from polo.accounts where id = p_player and kyc = 'verified' and role in ('pro','groom')) then
    raise exception 'The bonus must go to a verified player or groom.';
  end if;
  if not exists (select 1 from polo.accounts where id = p_organizer and kyc = 'verified' and role = 'organizer') then
    raise exception 'Choose the tournament organiser who records the result.';
  end if;
  perform 1 from polo.accounts where id in (p_patron, v_contract) order by id for update;
  select * into a from polo.accounts where id = p_patron;
  if a.pc < v_amt then
    raise exception 'Insufficient PC balance (available: %).', a.pc;
  end if;
  insert into polo.bonuses (patron_id, player_id, organizer_id, amount, match)
  values (p_patron, p_player, p_organizer, v_amt, v_match) returning * into b;
  update polo.accounts set pc = pc - v_amt where id = p_patron;
  update polo.accounts set pc = pc + v_amt where id = v_contract;
  t := polo.append('lock', p_patron, v_contract, v_amt, 0, 'Win bonus #' || b.id || ': ' || v_match);
  update polo.bonuses set lock_block = t.block where id = b.id returning * into b;
  return b;
end $$;

-- Win bonus: the contract pays the player (won) or refunds the patron (lost or cancelled).
create function polo.op_bonus_settle(p_bonus int, p_pay boolean, p_won boolean) returns polo.bonuses
language plpgsql set search_path = '' as $$
declare b polo.bonuses; v_contract int := polo.contract_id(); v_to int; t polo.ledger;
begin
  select * into b from polo.bonuses where id = p_bonus for update;
  if b.id is null then raise exception 'Win bonus not found.'; end if;
  if b.status <> 'locked' then raise exception 'Win bonus #% is already %.', b.id, b.status; end if;
  v_to := case when p_pay then b.player_id else b.patron_id end;
  perform 1 from polo.accounts where id in (v_to, v_contract) order by id for update;
  update polo.accounts set pc = pc - b.amount where id = v_contract;
  update polo.accounts set pc = pc + b.amount where id = v_to;
  t := polo.append(case when p_pay then 'release' else 'refund' end, v_contract, v_to, b.amount, 0,
                   'Win bonus #' || b.id || case when p_pay then ': match won, paid to player'
                                             when p_won is false then ': match lost, refunded'
                                             else ': cancelled by patron, refunded' end);
  update polo.bonuses set status = case when p_pay then 'paid' else 'refunded' end,
         won = p_won, settled_at = now(), settle_block = t.block
   where id = b.id returning * into b;
  return b;
end $$;

-- Standing order: pay the next instalment now and move the due date on by one period.
create function polo.op_standing_run(p_order int) returns polo.ledger
language plpgsql set search_path = '' as $$
declare o polo.standing; t polo.ledger;
begin
  select * into o from polo.standing where id = p_order for update;
  if o.id is null then raise exception 'Standing order not found.'; end if;
  if not o.active then raise exception 'Standing order #% has been cancelled.', o.id; end if;
  t := polo.op_transfer(o.payer_id, o.payee_id, o.amount, coalesce(o.memo, 'Standing order') || ' (standing order #' || o.id || ')');
  update polo.standing set runs = runs + 1, last_block = t.block,
         next_due = next_due + case when every = 'week' then interval '7 days' else interval '1 month' end
   where id = o.id;
  return t;
end $$;

-- Demo seed: fictional people and organisations, plus a short history so every page has data.
create function polo.seed() returns void
language plpgsql set search_path = '' as $$
declare v_pw text := extensions.crypt('polo2026', extensions.gen_salt('bf'));
        v_patron int; v_pro int; v_breeder int; v_vet int; v_groom int; v_org int; v_t polo.ledger; v_e polo.escrows;
        v_b polo.bonuses; v_o int;
begin
  truncate polo.sessions, polo.standing, polo.bonuses, polo.requests, polo.escrows, polo.ledger, polo.accounts, polo.reserve, polo.config restart identity cascade;
  insert into polo.config default values;
  insert into polo.reserve (usd) values (0);
  insert into polo.accounts (username, password_hash, display_name, role, org, country, wallet, usd, pc, kyc) values
    ('patron',  v_pw, 'James Whitfield',   'patron',  'Team Blue Oak',           'United Kingdom', polo.wallet_of('patron'),  250000, 0, 'verified'),
    ('pro',     v_pw, 'Facundo Ríos',      'pro',     '7-goal professional',     'Argentina',      polo.wallet_of('pro'),          0, 0, 'verified'),
    ('breeder', v_pw, 'Estancia La Aurora','breeder', 'Polo pony breeder',       'Argentina',      polo.wallet_of('breeder'),      0, 0, 'verified'),
    ('bank',    v_pw, 'Banco Pampa Sur',   'bank',    'Partner bank (fictional)','Argentina',      polo.wallet_of('bank'),         0, 0, 'verified'),
    ('admin',   v_pw, 'Polo Coin Treasury','admin',   'Issuer & reserve manager','Switzerland',    polo.wallet_of('admin'),        0, 0, 'verified'),
    ('vet',     v_pw, 'Dr. Lucía Ferrer',  'vet',     'Equine vet, Pilar (fictional)', 'Argentina', polo.wallet_of('vet'),         0, 0, 'verified'),
    ('groom',   v_pw, 'Martín Gómez',      'groom',   'Groom, Team Blue Oak',    'Argentina',      polo.wallet_of('groom'),        0, 0, 'verified'),
    ('organizer', v_pw, 'Alpine Polo Events','organizer','Tournament organiser (fictional)','Switzerland', polo.wallet_of('organizer'), 0, 0, 'verified'),
    -- The escrow smart contract holds locked PC. It has a wallet but nobody can log in to it.
    ('escrow', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), 'Polo Coin Escrow Contract', 'contract',
               'Smart contract', 'Switzerland', polo.wallet_of('escrow-contract'), 0, 0, 'verified');
  -- Two open sign-up applications, so the KYC review can be shown right away.
  insert into polo.accounts (username, password_hash, display_name, role, org, country, wallet, usd, pc, kyc, created_at) values
    ('charlotte', v_pw, 'Charlotte Hayes',   'patron', 'Team Hollow Creek',   'United States', polo.wallet_of('charlotte'), 100000, 0, 'pending', now() - interval '2 hours'),
    ('valentina', v_pw, 'Valentina Arrieta', 'pro',    '4-goal professional', 'Argentina',     polo.wallet_of('valentina'),      0, 0, 'pending', now() - interval '25 minutes');
  perform polo.append('genesis', null, null, 0, 0, 'Polo Coin genesis block');

  -- Starting history: the patron has used Polo Coin before the demo begins.
  select id into v_patron  from polo.accounts where username = 'patron';
  select id into v_pro     from polo.accounts where username = 'pro';
  select id into v_breeder from polo.accounts where username = 'breeder';
  select id into v_vet     from polo.accounts where username = 'vet';
  select id into v_groom   from polo.accounts where username = 'groom';
  select id into v_org     from polo.accounts where username = 'organizer';
  perform polo.op_buy(v_patron, 60000);
  perform polo.op_transfer(v_patron, v_pro, 12000, 'Tournament fee, Snow Polo St. Moritz');
  perform polo.op_redeem(v_pro, 4000);
  v_e := polo.op_escrow_lock(v_patron, v_breeder, v_vet, 18000, 'Mare "La Bonita", 7 years');
  v_b := polo.op_bonus_lock(v_patron, v_pro, v_org, 3000, 'Final, Alpine Polo Cup');
  -- The groom's monthly wages: paid once already, next instalment due in a month.
  insert into polo.standing (payer_id, payee_id, amount, memo, every, next_due)
  values (v_patron, v_groom, 2500, 'Monthly wages', 'month', now()) returning id into v_o;
  perform polo.op_standing_run(v_o);
  -- One open payment request: the player asks for the next tournament fee.
  insert into polo.requests (requester_id, payer_id, amount, memo)
  values (v_pro, v_patron, 9500, 'Tournament fee, Polo Gold Cup Gstaad');
end $$;

-- ---------------------------------------------------------------------
-- Public API (called by the website via supabase.rpc)
-- ---------------------------------------------------------------------
create or replace function public.api_login(p_username text, p_password text) returns json
language plpgsql security definer set search_path = '' as $$
declare a polo.accounts; v_token uuid;
begin
  select * into a from polo.accounts where username = lower(trim(p_username)) and role <> 'contract';
  if a.id is null or a.password_hash <> extensions.crypt(p_password, a.password_hash) then
    raise exception 'Wrong username or password.';
  end if;
  delete from polo.sessions where expires_at < now();
  insert into polo.sessions (account_id) values (a.id) returning token into v_token;
  return json_build_object('token', v_token, 'account', polo.account_json(a));
end $$;

create or replace function public.api_logout(p_token uuid) returns void
language sql security definer set search_path = '' as $$
  delete from polo.sessions where token = p_token
$$;

create or replace function public.api_me(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare a polo.accounts;
begin
  select * into a from polo.accounts where id = polo.auth(p_token);
  return polo.account_json(a);
end $$;

-- Directory of counterparties (no balances). The escrow contract is not a counterparty.
create or replace function public.api_directory(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
begin
  perform polo.auth(p_token);
  return (select coalesce(json_agg(json_build_object('id', id, 'display_name', display_name,
            'role', role, 'org', org, 'country', country, 'wallet', wallet) order by id), '[]')
          from polo.accounts where kyc = 'verified' and role <> 'contract');
end $$;

create or replace function public.api_buy(p_token uuid, p_amount numeric) returns json
language plpgsql security definer set search_path = '' as $$
begin
  return polo.tx_json(polo.op_buy(polo.auth_verified(p_token), p_amount));
end $$;

create or replace function public.api_transfer(p_token uuid, p_to int, p_amount numeric, p_memo text) returns json
language plpgsql security definer set search_path = '' as $$
begin
  return polo.tx_json(polo.op_transfer(polo.auth_verified(p_token), p_to, p_amount, p_memo));
end $$;

create or replace function public.api_redeem(p_token uuid, p_amount numeric) returns json
language plpgsql security definer set search_path = '' as $$
begin
  return polo.tx_json(polo.op_redeem(polo.auth_verified(p_token), p_amount));
end $$;

-- ---------------------------------------------------------------------
-- Escrow (smart contract for horse purchases)
-- ---------------------------------------------------------------------
create or replace function public.api_escrow_create(p_token uuid, p_seller int, p_vet int, p_amount numeric, p_item text) returns json
language plpgsql security definer set search_path = '' as $$
begin
  return polo.escrow_json(polo.op_escrow_lock(polo.auth_verified(p_token), p_seller, p_vet, p_amount, p_item));
end $$;

-- The named vet reports the pre-purchase examination; the contract settles immediately.
create or replace function public.api_escrow_vet(p_token uuid, p_escrow int, p_passed boolean) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); e polo.escrows;
begin
  select * into e from polo.escrows where id = p_escrow;
  if e.id is null then raise exception 'Escrow not found.'; end if;
  if e.vet_id <> v_id then raise exception 'Only the veterinarian named in escrow #% can report the examination.', e.id; end if;
  return polo.escrow_json(polo.op_escrow_settle(e.id, p_passed, p_passed));
end $$;

-- The buyer can cancel while the examination is still open; the PC go back to the buyer.
create or replace function public.api_escrow_cancel(p_token uuid, p_escrow int) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); e polo.escrows;
begin
  select * into e from polo.escrows where id = p_escrow;
  if e.id is null then raise exception 'Escrow not found.'; end if;
  if e.buyer_id <> v_id then raise exception 'Only the buyer can cancel escrow #%.', e.id; end if;
  return polo.escrow_json(polo.op_escrow_settle(e.id, false, null));
end $$;

-- Escrows the caller is part of; treasury and partner bank see all.
create or replace function public.api_escrows(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token); v_role text := polo.role_of(v_id);
begin
  return (select coalesce(json_agg(polo.escrow_json(e) order by (e.status = 'locked') desc, e.id desc), '[]')
            from polo.escrows e
           where v_role in ('admin','bank') or v_id in (e.buyer_id, e.seller_id, e.vet_id));
end $$;

-- ---------------------------------------------------------------------
-- Payment requests
-- ---------------------------------------------------------------------
create or replace function public.api_request_create(p_token uuid, p_payer int, p_amount numeric, p_memo text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); v_amt numeric := polo.check_amount(p_amount); r polo.requests;
begin
  if p_payer = v_id then raise exception 'You cannot request money from yourself.'; end if;
  if not exists (select 1 from polo.accounts where id = p_payer and kyc = 'verified' and role not in ('contract')) then
    raise exception 'Payer not found or not verified.';
  end if;
  if (select count(*) from polo.requests where requester_id = v_id and status = 'open') >= 20 then
    raise exception 'Demo limit: max. 20 open requests.';
  end if;
  insert into polo.requests (requester_id, payer_id, amount, memo)
  values (v_id, p_payer, v_amt, nullif(trim(left(p_memo, 120)), '')) returning * into r;
  return polo.request_json(r);
end $$;

create or replace function public.api_request_pay(p_token uuid, p_request int) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); r polo.requests; t polo.ledger;
begin
  select * into r from polo.requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found.'; end if;
  if r.payer_id <> v_id then raise exception 'This request is addressed to someone else.'; end if;
  if r.status <> 'open' then raise exception 'This request is already %.', r.status; end if;
  t := polo.op_transfer(v_id, r.requester_id, r.amount, coalesce(r.memo, 'Payment request #' || r.id));
  update polo.requests set status = 'paid', settled_at = now(), block = t.block where id = r.id returning * into r;
  return polo.request_json(r);
end $$;

-- The payer declines, or the requester withdraws the request.
create or replace function public.api_request_decline(p_token uuid, p_request int) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token); r polo.requests;
begin
  select * into r from polo.requests where id = p_request for update;
  if r.id is null then raise exception 'Request not found.'; end if;
  if v_id not in (r.payer_id, r.requester_id) then raise exception 'This request is not yours.'; end if;
  if r.status <> 'open' then raise exception 'This request is already %.', r.status; end if;
  update polo.requests set status = 'declined', settled_at = now() where id = r.id returning * into r;
  return polo.request_json(r);
end $$;

create or replace function public.api_requests(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token);
begin
  return (select coalesce(json_agg(polo.request_json(r) order by (r.status = 'open') desc, r.id desc), '[]')
            from (select * from polo.requests where v_id in (requester_id, payer_id) order by id desc limit 50) r);
end $$;

-- Own transactions; bank and admin see the whole ledger.
-- ---------------------------------------------------------------------
-- Win bonus (smart contract tied to a match result)
-- ---------------------------------------------------------------------
create or replace function public.api_bonus_create(p_token uuid, p_player int, p_organizer int, p_amount numeric, p_match text) returns json
language plpgsql security definer set search_path = '' as $$
begin
  return polo.bonus_json(polo.op_bonus_lock(polo.auth_verified(p_token), p_player, p_organizer, p_amount, p_match));
end $$;

-- The named organiser records the result; the contract settles immediately.
create or replace function public.api_bonus_result(p_token uuid, p_bonus int, p_won boolean) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); b polo.bonuses;
begin
  select * into b from polo.bonuses where id = p_bonus;
  if b.id is null then raise exception 'Win bonus not found.'; end if;
  if b.organizer_id <> v_id then raise exception 'Only the organiser named in win bonus #% can record the result.', b.id; end if;
  return polo.bonus_json(polo.op_bonus_settle(b.id, p_won, p_won));
end $$;

create or replace function public.api_bonus_cancel(p_token uuid, p_bonus int) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); b polo.bonuses;
begin
  select * into b from polo.bonuses where id = p_bonus;
  if b.id is null then raise exception 'Win bonus not found.'; end if;
  if b.patron_id <> v_id then raise exception 'Only the patron can cancel win bonus #%.', b.id; end if;
  return polo.bonus_json(polo.op_bonus_settle(b.id, false, null));
end $$;

create or replace function public.api_bonuses(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token); v_role text := polo.role_of(v_id);
begin
  return (select coalesce(json_agg(polo.bonus_json(b) order by (b.status = 'locked') desc, b.id desc), '[]')
            from polo.bonuses b
           where v_role in ('admin','bank') or v_id in (b.patron_id, b.player_id, b.organizer_id));
end $$;

-- ---------------------------------------------------------------------
-- Standing orders (recurring payments)
-- ---------------------------------------------------------------------
create or replace function public.api_standing_create(p_token uuid, p_payee int, p_amount numeric, p_memo text, p_every text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); v_amt numeric := polo.check_amount(p_amount); o polo.standing;
begin
  if p_every not in ('week','month') then raise exception 'Choose weekly or monthly.'; end if;
  if p_payee = v_id then raise exception 'You cannot pay yourself.'; end if;
  if not exists (select 1 from polo.accounts where id = p_payee and kyc = 'verified' and role <> 'contract') then
    raise exception 'Recipient not found or not verified.';
  end if;
  if (select count(*) from polo.standing where payer_id = v_id and active) >= 10 then
    raise exception 'Demo limit: max. 10 active standing orders.';
  end if;
  insert into polo.standing (payer_id, payee_id, amount, memo, every, next_due)
  values (v_id, p_payee, v_amt, nullif(trim(left(p_memo, 120)), ''), p_every, now()) returning * into o;
  perform polo.op_standing_run(o.id);    -- the first instalment is paid right away
  select * into o from polo.standing where id = o.id;
  return polo.standing_json(o);
end $$;

-- Pay the next instalment now (the demo cannot wait a month).
create or replace function public.api_standing_pay(p_token uuid, p_order int) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); o polo.standing;
begin
  select * into o from polo.standing where id = p_order;
  if o.id is null or o.payer_id <> v_id then raise exception 'Standing order not found.'; end if;
  perform polo.op_standing_run(o.id);
  select * into o from polo.standing where id = o.id;
  return polo.standing_json(o);
end $$;

create or replace function public.api_standing_cancel(p_token uuid, p_order int) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token); o polo.standing;
begin
  select * into o from polo.standing where id = p_order for update;
  if o.id is null or v_id not in (o.payer_id) then raise exception 'Standing order not found.'; end if;
  update polo.standing set active = false where id = o.id returning * into o;
  return polo.standing_json(o);
end $$;

-- Execute all instalments of the caller that are due. Called whenever the payer's wallet refreshes.
create or replace function public.api_standing_run_due(p_token uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token); v_n int := 0; r record;
begin
  for r in select id from polo.standing
            where payer_id = v_id and active and next_due <= now()
            order by next_due limit 12 loop
    begin
      perform polo.op_standing_run(r.id);
      v_n := v_n + 1;
    exception when others then
      null;   -- e.g. not enough PC: the instalment stays due
    end;
  end loop;
  return v_n;
end $$;

create or replace function public.api_standings(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token);
begin
  return (select coalesce(json_agg(polo.standing_json(o) order by o.active desc, o.id desc), '[]')
            from polo.standing o where v_id in (o.payer_id, o.payee_id));
end $$;

create or replace function public.api_transactions(p_token uuid, p_limit int default 50) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth(p_token); v_role text;
begin
  select role into v_role from polo.accounts where id = v_id;
  return (select coalesce(json_agg(polo.tx_json(l) order by l.block desc), '[]') from (
            select * from polo.ledger
             where kind <> 'genesis'
               and (v_role in ('bank','admin') or from_id = v_id or to_id = v_id)
             order by block desc limit least(greatest(p_limit, 1), 500)) l);
end $$;

-- Public block explorer: pseudonymous (wallet addresses only, no names).
create or replace function public.api_explorer(p_limit int default 25) returns json
language sql security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
           'block', l.block, 'tx_hash', l.tx_hash, 'prev_hash', l.prev_hash, 'kind', l.kind,
           'from_wallet', (select wallet from polo.accounts where id = l.from_id),
           'to_wallet',   (select wallet from polo.accounts where id = l.to_id),
           'amount', l.amount, 'fee', l.fee, 'memo_hash', l.memo_hash, 'ts_us', l.ts_us,
           'created_at', l.created_at) order by l.block desc), '[]')
    from (select * from polo.ledger order by block desc limit least(greatest(p_limit, 1), 2000)) l
$$;

-- Public proof of reserves.
create or replace function public.api_stats() returns json
language sql security definer set search_path = '' as $$
  select json_build_object(
    'reserve_usd',  (select usd from polo.reserve),
    'supply_pc',    (select coalesce(sum(pc), 0) from polo.accounts),
    'tx_count',     (select count(*) from polo.ledger where kind <> 'genesis'),
    'volume_pc',    (select coalesce(sum(amount), 0) from polo.ledger where kind in ('transfer','release')),
    'fees_pc',      (select coalesce(sum(fee), 0) from polo.ledger),
    'fees_usd',     (select coalesce(sum(fee), 0) from polo.ledger where kind = 'mint'),
    'minted_pc',    (select coalesce(sum(amount), 0) from polo.ledger where kind = 'mint'),
    'redeemed_pc',  (select coalesce(sum(amount), 0) from polo.ledger where kind = 'redeem'),
    'escrow_pc',    (select coalesce(sum(pc), 0) from polo.accounts where role = 'contract'),
    'escrows_open', (select count(*) from polo.escrows where status = 'locked'),
    'escrows_done', (select count(*) from polo.escrows where status <> 'locked'),
    'bonuses_open', (select count(*) from polo.bonuses where status = 'locked'),
    'wallets',      (select count(*) from polo.accounts where kyc = 'verified' and role <> 'contract'),
    'fee_rate',     (select fee_rate from polo.config),
    'bank_share',   (select bank_share from polo.config),
    'reserve_yield',(select reserve_yield from polo.config),
    'cash_share',   (select cash_share from polo.config),
    'chain_valid',  (select bool_and(prev_hash = coalesce(lag_hash, repeat('0', 64)))
                       from (select prev_hash, lag(tx_hash) over (order by block) lag_hash
                               from polo.ledger) x)
  )
$$;

-- ---------------------------------------------------------------------
-- Sign-up and KYC review
-- ---------------------------------------------------------------------

-- Open a new account. It starts with KYC 'pending' and is logged in right away.
-- New patrons get a simulated bank account with USD 100,000 to buy PC with.
create or replace function public.api_register(p_username text, p_password text, p_display_name text,
                                               p_role text, p_org text, p_country text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_user text := lower(trim(p_username)); v_name text := trim(p_display_name);
        v_org text := coalesce(nullif(trim(p_org), ''), '—'); v_country text := trim(p_country);
        a polo.accounts; v_token uuid;
begin
  if v_user !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Username: 3 to 20 characters, only letters, digits and _.';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password: at least 6 characters.';
  end if;
  if length(coalesce(v_name, '')) < 2 or length(v_name) > 60 then
    raise exception 'Please enter your full name (max. 60 characters).';
  end if;
  if p_role not in ('patron','pro','breeder','groom') then
    raise exception 'Choose patron, professional player, breeder or groom.';
  end if;
  if length(coalesce(v_country, '')) < 2 or length(v_country) > 40 or length(v_org) > 60 then
    raise exception 'Please enter a country (and an organisation of max. 60 characters).';
  end if;
  if exists (select 1 from polo.accounts where username = v_user) then
    raise exception 'This username is taken. Please choose another one.';
  end if;
  if (select count(*) from polo.accounts) >= 200 then
    raise exception 'Demo limit reached. Ask the treasury to reset the demo.';
  end if;
  insert into polo.accounts (username, password_hash, display_name, role, org, country, wallet, usd, pc, kyc)
  values (v_user, extensions.crypt(p_password, extensions.gen_salt('bf')), v_name, p_role, v_org, v_country,
          polo.wallet_of(v_user || ':' || gen_random_uuid()::text),
          case when p_role = 'patron' then 100000 else 0 end, 0, 'pending')
  returning * into a;
  insert into polo.sessions (account_id) values (a.id) returning token into v_token;
  return json_build_object('token', v_token, 'account', polo.account_json(a));
end $$;

-- Who may review whom: the treasury reviews everyone, the partner bank reviews applicants from Argentina.
create function polo.can_review(p_reviewer polo.accounts, p_applicant polo.accounts) returns boolean
language sql stable set search_path = '' as $$
  select p_applicant.role not in ('bank','admin','vet','organizer','contract')
     and (p_reviewer.role = 'admin' or (p_reviewer.role = 'bank' and p_applicant.country = 'Argentina'))
$$;

-- Open applications plus the latest decisions, for treasury and partner bank.
create or replace function public.api_kyc_queue(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare r polo.accounts;
begin
  select * into r from polo.accounts where id = polo.auth(p_token);
  if r.role not in ('admin','bank') then
    raise exception 'Only the treasury and the partner bank review KYC applications.';
  end if;
  return (select coalesce(json_agg(json_build_object(
            'id', a.id, 'username', a.username, 'display_name', a.display_name, 'role', a.role,
            'org', a.org, 'country', a.country, 'wallet', a.wallet, 'kyc', a.kyc,
            'created_at', a.created_at, 'kyc_at', a.kyc_at,
            'kyc_by_name', (select display_name from polo.accounts where id = a.kyc_by))
          order by (a.kyc = 'pending') desc, coalesce(a.kyc_at, a.created_at) desc), '[]')
          from (select * from polo.accounts a
                 where polo.can_review(r, a)
                   and (a.kyc = 'pending' or a.kyc_by is not null)
                 order by (a.kyc = 'pending') desc, coalesce(a.kyc_at, a.created_at) desc
                 limit 50) a);
end $$;

-- Verify or reject a pending applicant.
create or replace function public.api_kyc_decide(p_token uuid, p_account int, p_approve boolean) returns json
language plpgsql security definer set search_path = '' as $$
declare r polo.accounts; a polo.accounts;
begin
  select * into r from polo.accounts where id = polo.auth(p_token);
  select * into a from polo.accounts where id = p_account for update;
  if a.id is null then raise exception 'Applicant not found.'; end if;
  if not polo.can_review(r, a) then
    raise exception 'You may not review this applicant. The partner bank reviews applicants from Argentina, the treasury reviews everyone.';
  end if;
  if a.kyc <> 'pending' then
    raise exception '% has already been %.', a.display_name, a.kyc;
  end if;
  update polo.accounts
     set kyc = case when p_approve then 'verified' else 'rejected' end, kyc_by = r.id, kyc_at = now()
   where id = a.id returning * into a;
  return polo.account_json(a);
end $$;

-- Admin only: reset the demo to its initial state.
create or replace function public.api_reset(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text;
begin
  select role into v_role from polo.accounts where id = polo.auth(p_token);
  if v_role <> 'admin' then raise exception 'Only the treasury admin can reset the demo.'; end if;
  perform polo.seed();
end $$;

-- Keep-alive endpoint (used by the GitHub Action so the free project never pauses).
create or replace function public.api_ping() returns text
language sql security definer set search_path = '' as $$
  select 'ok ' || (select count(*) from polo.ledger)::text
$$;

-- ---------------------------------------------------------------------
-- Permissions: website (anon) may only execute the api_* functions.
-- ---------------------------------------------------------------------
revoke all on all functions in schema polo from public;
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'api\_%' loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('grant execute on function %s to anon, authenticated', f);
    end if;
  end loop;
end $$;

select polo.seed();
notify pgrst, 'reload schema';
