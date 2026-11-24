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

Business rules: 1 PC = 1 USD; buy (mint) and cash-out (burn) are free; transfers cost 1 % paid by the sender,
split 50/50 between treasury (`admin`) and partner bank (`bank`). Invariant: USD reserve = PC in circulation.
Demo accounts: `patron`, `pro`, `breeder`, `bank`, `admin`, password `polo2026` (all fictional).

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
  (base, ~60 %), Old Cream `#EBCFAD` (secondary, ~30 %), Burnt Orange `#F26A1E` (accent, ≤10 %, never as text on
  cream); Helvetica family with Arial fallback. Use the logo files in `public/brand/` (logo 1A: coin ring, crossed
  mallets, orange ball; simplified `icon-*` version at 32 px and below). Regenerate them with
  `python3 scripts/brand/generate.py`, never hand-edit the SVGs. The old token names (`--turf`, `--brass`,
  `--celeste`, …) are aliases for the redesign transition; new code uses `--forest`, `--cream`, `--orange`.
- The redesign (multi-page site, new features) happens on the branch `redesign`; plan: "Polo Coin – Plan zum finalen
  Prototyp" (Claude doc of the team).
- The README (German) explains the project for the team; update it when the setup changes.
