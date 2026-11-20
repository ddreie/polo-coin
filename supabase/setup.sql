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
-- Business rules (from the business case)
--   * 1 PC = 1 USD, 100 % backed by the USD reserve.
--   * Buying PC (mint) and redeeming PC at the partner bank (burn) are free.
--   * Transfers cost 1 %, paid by the sender, split 50/50 between the
--     Polo Coin treasury and the partner bank.
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
  role          text not null check (role in ('patron','pro','breeder','bank','admin')),
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
  kind       text not null check (kind in ('genesis','mint','transfer','redeem')),
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
  fee_rate      numeric not null default 0.01,   -- 1 % per transfer
  bank_share    numeric not null default 0.5,    -- share of fee to partner bank
  reserve_yield numeric not null default 0.04    -- assumed yield on USD reserve (T-bills)
);

-- Row Level Security as a second safety net. The schema is not exposed to the
-- API anyway; the api_* functions run as table owner and are not affected.
alter table polo.accounts enable row level security;
alter table polo.sessions enable row level security;
alter table polo.reserve  enable row level security;
alter table polo.ledger   enable row level security;
alter table polo.config   enable row level security;

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

-- Demo seed: fictional people and organisations.
create function polo.seed() returns void
language plpgsql set search_path = '' as $$
declare v_pw text := extensions.crypt('polo2026', extensions.gen_salt('bf'));
begin
  truncate polo.sessions, polo.ledger, polo.accounts, polo.reserve, polo.config restart identity cascade;
  insert into polo.config default values;
  insert into polo.reserve (usd) values (0);
  insert into polo.accounts (username, password_hash, display_name, role, org, country, wallet, usd, pc, kyc) values
    ('patron',  v_pw, 'James Whitfield',  'patron',  'Team Blue Oak',          'United Kingdom', polo.wallet_of('patron'),  250000, 0, 'verified'),
    ('pro',     v_pw, 'Facundo Ríos',     'pro',     '7-goal professional',    'Argentina',      polo.wallet_of('pro'),          0, 0, 'verified'),
    ('breeder', v_pw, 'Estancia La Aurora','breeder','Polo pony breeder',      'Argentina',      polo.wallet_of('breeder'),      0, 0, 'verified'),
    ('bank',    v_pw, 'Banco Pampa Sur',  'bank',    'Partner bank (fictional)','Argentina',     polo.wallet_of('bank'),         0, 0, 'verified'),
    ('admin',   v_pw, 'Polo Coin Treasury','admin',  'Issuer & reserve manager','Switzerland',   polo.wallet_of('admin'),        0, 0, 'verified');
  -- Two open sign-up applications, so the KYC review can be shown right away.
  insert into polo.accounts (username, password_hash, display_name, role, org, country, wallet, usd, pc, kyc, created_at) values
    ('charlotte', v_pw, 'Charlotte Hayes',    'patron', 'Team Hollow Creek',     'United States', polo.wallet_of('charlotte'), 100000, 0, 'pending', now() - interval '2 hours'),
    ('valentina', v_pw, 'Valentina Arrieta',  'pro',    '4-goal professional',   'Argentina',     polo.wallet_of('valentina'),      0, 0, 'pending', now() - interval '25 minutes');
  perform polo.append('genesis', null, null, 0, 0, 'Polo Coin genesis block');
end $$;

-- ---------------------------------------------------------------------
-- Public API (called by the website via supabase.rpc)
-- ---------------------------------------------------------------------
create or replace function public.api_login(p_username text, p_password text) returns json
language plpgsql security definer set search_path = '' as $$
declare a polo.accounts; v_token uuid;
begin
  select * into a from polo.accounts where username = lower(trim(p_username));
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

-- Directory of counterparties (no balances).
create or replace function public.api_directory(p_token uuid) returns json
language plpgsql security definer set search_path = '' as $$
begin
  perform polo.auth(p_token);
  return (select coalesce(json_agg(json_build_object('id', id, 'display_name', display_name,
            'role', role, 'org', org, 'country', country, 'wallet', wallet) order by id), '[]')
          from polo.accounts where kyc = 'verified');
end $$;

-- Patron buys PC with USD from his bank account (mint, 1:1, free).
create or replace function public.api_buy(p_token uuid, p_amount numeric) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); v_amt numeric := polo.check_amount(p_amount);
        a polo.accounts; t polo.ledger;
begin
  select * into a from polo.accounts where id = v_id for update;
  if a.usd < v_amt then
    raise exception 'Insufficient USD balance (available: %).', a.usd;
  end if;
  update polo.accounts set usd = usd - v_amt, pc = pc + v_amt where id = v_id;
  update polo.reserve set usd = usd + v_amt where id;
  t := polo.append('mint', null, v_id, v_amt, 0, 'USD deposited into reserve, PC minted');
  return polo.tx_json(t);
end $$;

-- Send PC to another wallet. Sender pays amount + 1 % fee.
create or replace function public.api_transfer(p_token uuid, p_to int, p_amount numeric, p_memo text) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); v_amt numeric := polo.check_amount(p_amount);
        c polo.config; v_fee numeric; v_bank_fee numeric; v_bank int; v_admin int;
        a polo.accounts; t polo.ledger;
begin
  if p_to = v_id then raise exception 'You cannot send PC to yourself.'; end if;
  if not exists (select 1 from polo.accounts where id = p_to) then
    raise exception 'Recipient not found.';
  end if;
  if not exists (select 1 from polo.accounts where id = p_to and kyc = 'verified') then
    raise exception 'The recipient has not passed KYC yet and cannot receive PC.';
  end if;
  select * into c from polo.config;
  v_fee := round(v_amt * c.fee_rate, 2);
  v_bank_fee := round(v_fee * c.bank_share, 2);
  select id into v_bank  from polo.accounts where role = 'bank'  order by id limit 1;
  select id into v_admin from polo.accounts where role = 'admin' order by id limit 1;

  -- lock rows in id order to avoid deadlocks
  perform 1 from polo.accounts where id in (v_id, p_to, v_bank, v_admin) order by id for update;
  select * into a from polo.accounts where id = v_id;
  if a.pc < v_amt + v_fee then
    raise exception 'Insufficient PC balance: % needed incl. 1%% fee, % available.', v_amt + v_fee, a.pc;
  end if;

  update polo.accounts set pc = pc - (v_amt + v_fee) where id = v_id;
  update polo.accounts set pc = pc + v_amt where id = p_to;
  update polo.accounts set pc = pc + v_bank_fee where id = v_bank;
  update polo.accounts set pc = pc + (v_fee - v_bank_fee) where id = v_admin;
  t := polo.append('transfer', v_id, p_to, v_amt, v_fee, nullif(trim(left(p_memo, 120)), ''));
  return polo.tx_json(t);
end $$;

-- Redeem PC for USD at the partner bank (burn, 1:1, free).
create or replace function public.api_redeem(p_token uuid, p_amount numeric) returns json
language plpgsql security definer set search_path = '' as $$
declare v_id int := polo.auth_verified(p_token); v_amt numeric := polo.check_amount(p_amount);
        v_bank int; a polo.accounts; t polo.ledger;
begin
  select id into v_bank from polo.accounts where role = 'bank' order by id limit 1;
  select * into a from polo.accounts where id = v_id for update;
  if a.pc < v_amt then
    raise exception 'Insufficient PC balance (available: %).', a.pc;
  end if;
  update polo.accounts set pc = pc - v_amt, usd = usd + v_amt where id = v_id;
  update polo.reserve set usd = usd - v_amt where id;
  t := polo.append('redeem', v_id, v_bank, v_amt, 0, 'PC burned, USD paid out by partner bank');
  return polo.tx_json(t);
end $$;

-- Own transactions; bank and admin see the whole ledger.
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
    'volume_pc',    (select coalesce(sum(amount), 0) from polo.ledger where kind = 'transfer'),
    'fees_pc',      (select coalesce(sum(fee), 0) from polo.ledger),
    'minted_pc',    (select coalesce(sum(amount), 0) from polo.ledger where kind = 'mint'),
    'redeemed_pc',  (select coalesce(sum(amount), 0) from polo.ledger where kind = 'redeem'),
    'fee_rate',     (select fee_rate from polo.config),
    'bank_share',   (select bank_share from polo.config),
    'reserve_yield',(select reserve_yield from polo.config),
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
  if p_role not in ('patron','pro','breeder') then
    raise exception 'Choose patron, professional player or breeder.';
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
  select p_applicant.role not in ('bank','admin')
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
