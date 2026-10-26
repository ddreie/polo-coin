# Polo Coin – Prototyp

Web-Prototyp für das FinTech & InsurTech Seminar (UZH, HS 2026). Ein USD-gedeckter Stablecoin für Zahlungen von Patrons in Europa/USA an Polospieler und Breeder in Argentinien.

## Demo-Accounts

Passwort für alle: `polo2026`

| Username | Person (fiktiv) | Rolle | Startguthaben |
|---|---|---|---|
| `patron` | James Whitfield | Patron, UK | USD 250'000 (Bankkonto) |
| `pro` | Facundo Ríos | Profispieler, AR | 0 |
| `breeder` | Estancia La Aurora | Pferdezüchter, AR | 0 |
| `bank` | Banco Pampa Sur | Partnerbank, AR | 0 |
| `admin` | Polo Coin Treasury | Emittent, CH | 0, kann die Demo zurücksetzen |

Typischer Ablauf: Als Patron PC kaufen, dem Spieler das Turniersalär schicken. Danach als Spieler einloggen, das Geld ist da. Weiter an den Breeder zahlen oder bei der Partnerbank in USD auszahlen. Bank und Treasury sehen alle Transaktionen, Reserve und Gebühreneinnahmen.

## Geschäftsregeln

| Vorgang | Wirkung | Gebühr |
|---|---|---|
| Kauf (Mint) | USD vom Bankkonto in die Reserve, gleich viel PC wird ausgegeben | keine |
| Transfer | PC von Wallet zu Wallet, sofort | 1 % vom Sender, 50 % an Treasury, 50 % an Partnerbank |
| Auszahlung (Burn) | PC wird vernichtet, USD aus der Reserve aufs Bankkonto | keine |

Invariante: USD-Reserve = PC im Umlauf (100 % Deckung). Jede Transaktion ist ein Block mit SHA-256-Hash, der den Hash des vorherigen Blocks enthält (Hash-Kette wie bei einer Blockchain).

## Architektur

| Schicht | Technologie | Aufgabe |
|---|---|---|
| Frontend | React + TypeScript (Vite), gehostet auf Vercel | Landingpage, Login, Dashboards pro Rolle, öffentlicher Ledger |
| API | Postgres-Funktionen (`api_*`) via Supabase RPC | Login, Kauf, Transfer, Auszahlung, Statistiken. Jede Funktion prüft das Session-Token und läuft als atomare Transaktion. |
| Datenbank | Supabase Postgres, Schema `polo` | Accounts, Sessions, Reserve, Ledger. Das Schema ist von aussen nicht erreichbar, nur über die API-Funktionen. |
| Keep-alive | GitHub Actions | Ruft alle 3 Tage `api_ping` auf, damit das Gratis-Projekt nicht pausiert |

Die Blockchain wird simuliert (zentrale Datenbank mit Hash-Kette). In einer echten Umsetzung würde der Ledger auf einer öffentlichen Chain laufen (Token-Contract), siehe Kapitel „Solution design“ der Arbeit.

## Projektstruktur

```
supabase/setup.sql      Datenbank: Tabellen, Regeln, API-Funktionen, Demo-Daten
src/api/                Zugriff auf die API (Supabase) und lokaler Demo-Modus
src/pages/              Home, Login, Dashboard, Explorer
src/components/         Aktionen (Kaufen/Senden/Auszahlen), Rollen-Panels, Aktivität
.github/workflows/      Keep-alive für Supabase
```

## Lokal starten

```
npm install
npm run dev        # mit Supabase-Datenbank
npm run dev:demo   # ohne Datenbank, Daten im Browser (zum Entwickeln)
```

## Setup (einmalig)

1. Supabase: Inhalt von `supabase/setup.sql` im SQL Editor einfügen und auf „Run“ klicken. Das Skript kann jederzeit erneut ausgeführt werden, dann ist alles zurückgesetzt.
2. GitHub: Code in ein Repository hochladen.
3. Vercel: „Add New → Project“, das Repository importieren, „Deploy“. Es braucht keine weiteren Einstellungen, die Supabase-URL und der öffentliche Key stehen in `src/config.ts`.

Der „publishable key“ in `src/config.ts` ist öffentlich und darf im Code stehen. Den geheimen `service_role`-Key nie in den Code oder ins Repository legen.
