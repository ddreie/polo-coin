# Polo Coin prototype – instructions for Claude

Student prototype for the FinTech & InsurTech seminar (University of Zurich, HS 2026). A USD-backed stablecoin
("Polo Coin", PC) for payments from polo patrons in Europe/US to players and breeders in Argentina.
Several team members work on it, each in their own Claude chat. Talk to them in German (Swiss spelling, no ß)
unless they write in another language; the website itself is in English.

## Architecture

| Part | Where | Notes |
|---|---|---|
| Frontend | `src/` – React + TypeScript (Vite) | Hosted on Vercel, project `polo-coin`, live at https://polo-coin-eight.vercel.app |
| Backend | `supabase/setup.sql` – Postgres functions `api_*` | Supabase project id `fllxsypsclizpjpypnqv`. All tables live in the private schema `polo`; the browser only calls `api_*` via RPC. Custom session tokens, not Supabase Auth. |
| Ledger | `polo.ledger`, `src/verify.ts` | Hash chain: `tx_hash = '0x' || sha256(prev_hash|kind|from_wallet|to_wallet|amount|fee|memo_hash|ts_us)`. `polo.append()` in SQL and `blockPayload()` in `src/verify.ts` must stay identical, or "Verify chain" flags every block. |
| Deploy | `.github/workflows/deploy.yml` | GitHub Actions deploys every push with Dario's Vercel token (repo is private; Vercel's own Git deploys are switched off in `vercel.json`). `main` = production, other branches = preview URL in the Actions run summary. |
| Keep-alive | `.github/workflows/keepalive.yml` | Pings `api_ping` every 3 days so the free Supabase project never pauses. |
| Offline mode | `src/api/localApi.ts` | `npm run dev:demo` runs the same rules in the browser without Supabase. Keep it in sync with the SQL rules. |

Business rules (as in the paper): 1 PC = 1 USD; buying (mint) costs a 1% fee on top, paid in USD and split 50/50
between treasury (`admin`) and partner bank (`bank`); transfers, payment requests and cash-out (burn) are free.
Escrow: buyer locks PC in the contract wallet (role `contract`) and proposes a verified vet (role `vet`); the seller must
accept the escrow and the vet (`api_escrow_accept`) or decline it (refund); after acceptance the buyer can no longer
cancel; the vet reports the examination and the contract pays the seller or refunds the buyer. Deadlines
(`polo.config.escrow_days` = 14): seller acceptance within 14 days of locking, vet report within 14 days of acceptance,
otherwise the contract refunds the buyer at the next call that touches escrows (`polo.op_escrow_expire_due`).
Vets sign up with licence number, licensing authority, liability insurer and a declaration of independence; only the
treasury (`admin`) verifies them, never the partner bank. Win bonus: the patron locks PC for a player; the named
organiser (role `organizer`) records won/lost and the contract pays or refunds. Standing orders pay weekly/monthly;
due instalments run when the payer's wallet refreshes (`api_standing_run_due`). Invariant: USD reserve = PC in
circulation (incl. PC locked in contracts).
Business logic lives in `polo.op_*` (SQL) and the `op*` functions in `localApi.ts`; the seed uses them too.
Demo accounts: `patron`, `pro`, `breeder`, `groom`, `vet`, `organizer`, `bank`, `admin`, password `polo2026` (all fictional).

## How to deliver a change

1. `git pull --rebase origin main` first – other team members push to the same repository.
2. Change the code. Run `npx tsc --noEmit` and `npm run build`. For UI changes, test the flow with Playwright
   against `npm run build:demo && npx vite preview --mode demo` and look at screenshots.
3. Database changes: edit `supabase/setup.sql` (it is the single source of truth and must stay re-runnable),
   then run it on the Supabase project with the Supabase connector (`execute_sql`). Re-running it **resets all
   demo data** – tell the user before doing so. Small, data-preserving changes (e.g. `create or replace
   function`) can be run on their own, but must also be added to `setup.sql`.
4. Commit with a clear message and push to `main`. The GitHub Action deploys it in about two minutes.
   For larger redesigns, push to a branch first: the Action deploys a preview URL the user can check before merging.
5. After testing on the live site, reset the demo (`select polo.seed();` via the connector) so the next person
   and the professor start clean.

## Conventions

- Never put secrets in the repo. The publishable key in `src/config.ts` is public by design; the
  `service_role` key must never appear anywhere.
- All people, banks and organisations in the demo are fictional; keep it that way.
- Keep the corporate identity (decided 24.11.2026): tokens at the top of `src/styles.css` – Forest Green `#0F4027`
  (base, ~60%), Old Cream `#EBCFAD` (secondary, ~30%), Burnt Orange `#F26A1E` (accent, ≤10%, never as text on
  cream); Arial throughout. Use the logo files in `public/brand/` (logo 1A: coin ring, crossed
  mallets, orange ball; simplified `icon-*` version at 32 px and below). Regenerate them with
  `python3 scripts/brand/generate.py`, never hand-edit the SVGs. The old token names (`--turf`, `--brass`,
  `--celeste`, …) are aliases for the redesign transition; new code uses `--forest`, `--cream`, `--orange`.
- The redesign (multi-page site, new features) happens on the branch `redesign`; plan: "Polo Coin – Plan zum finalen
  Prototyp" (Claude doc of the team).
- Frontend v2 rules (Nov 2026): square corners, 1px hairlines instead of shadowed cards, no all-caps labels, no `→` in
  link text, no decorative motion (the 3D coin on the home page is the one exception). Section heads come from `<Section
  title intro>` (title left, intro right). Cite sources with `<Cite id>` inside `<Notes ids>`; references live in
  `src/sources.ts`. The v2 layer is at the end of `src/styles.css` and restyles the shared classes above it.
- Writing style for all website and app text: no semicolons between clauses (write two sentences or use a comma),
  and no space before the percent sign (`30%`, not `30 %`).
- The README (German) explains the project for the team; update it when the setup changes.
