# Polo Coin – Prototyp

Web-Prototyp für das FinTech & InsurTech Seminar (UZH, HS 2026). Ein USD-gedeckter Stablecoin für Zahlungen von Patrons in Europa/USA an Polospieler und Breeder in Argentinien.

## Demo-Accounts

Passwort für alle: `polo2026`. Am einfachsten startet man die **geführte Demo-Tour** (Startseite oder Login): sieben Schritte durch den ganzen Business Case, der Rollenwechsel passiert per Klick.

| Username | Person (fiktiv) | Rolle | Startzustand |
|---|---|---|---|
| `patron` | James Whitfield | Patron, UK | hat schon PC gekauft und den Spieler bezahlt; ein Escrow für die Stute «La Bonita» ist offen |
| `pro` | Facundo Ríos | Profispieler, AR | hat PC erhalten und teils ausgezahlt; offene Zahlungsanforderung an den Patron (Gstaad) |
| `breeder` | Estancia La Aurora | Pferdezüchterin, AR | Verkäuferin im offenen Escrow |
| `vet` | Dr. Lucía Ferrer | Tierärztin, AR | muss den Vet-Check im offenen Escrow melden |
| `bank` | Banco Pampa Sur | Partnerbank, AR | sieht alle Transaktionen, prüft KYC aus Argentinien |
| `admin` | Polo Coin Treasury | Emittent, CH | Reserve, Erträge, KYC; kann die Demo zurücksetzen |

Zusätzlich gibt es zwei offene Anmeldungen für die KYC-Prüfung: `charlotte` (Patronin, USA) und `valentina` (Spielerin, AR), ebenfalls mit `polo2026`. Das Escrow-Konto (`escrow`, Smart Contract) hat eine Wallet, man kann sich aber nicht einloggen.

In der Wallet kann man oben rechts die Rolle wechseln und die Sprache (EN/ES) umstellen; Konten aus Argentinien starten auf Spanisch.

## Geschäftsregeln (wie im Paper, IM-Version)

| Vorgang | Wirkung | Gebühr |
|---|---|---|
| Kauf (Mint) | USD vom Bankkonto in die Reserve, gleich viel PC wird ausgegeben | 1 % zusätzlich in USD, 50 % an Treasury, 50 % an Partnerbank |
| Transfer | PC von Wallet zu Wallet, sofort | keine |
| Zahlungsanforderung | Spieler/Breeder/Tierärztin fordert Betrag an, Zahler bezahlt per Klick (normaler Transfer) | keine |
| Escrow | PC des Käufers gehen in die Contract-Wallet; die genannte Tierärztin meldet «bestanden» (→ an Verkäufer) oder «nicht bestanden» (→ zurück an Käufer); der Käufer kann vorher abbrechen | keine |
| Auszahlung (Burn) | PC wird vernichtet, USD aus der Reserve aufs Bankkonto | keine |

Reserve: 30 % als USD-Einlagen (MiCA Art. 54), 70 % in T-Bills (≤ 93 Tage, GENIUS Act), angenommene Rendite 4.2 %. Gesperrte PC im Escrow zählen zum Umlauf.

## Registrierung und KYC

Neue Nutzer können sich über „Open an account“ selbst registrieren (Patron, Spieler oder Breeder). Das Konto ist danach „pending“: Man kann sich einloggen, aber weder kaufen, senden, empfangen noch auszahlen. Die Treasury (`admin`) prüft alle Anmeldungen, die Partnerbank (`bank`) die Anmeldungen aus Argentinien. Beide sehen dazu in der Wallet unter „Review“ die Liste „Identity checks (KYC)“ mit „Verify“ und „Reject“. Damit zeigt der Prototyp, dass es keine anonymen Wallets gibt (FINMA-Aufsichtsmitteilung 06/2024: der Emittent muss alle Halter identifizieren). Neue Patrons starten mit einem simulierten Bankkonto von USD 100'000. Ein Reset der Demo löscht alle selbst registrierten Konten.

Invariante: USD-Reserve = PC im Umlauf (100 % Deckung). Jede Transaktion ist ein Block mit SHA-256-Hash, der den Hash des vorherigen Blocks enthält (Hash-Kette wie bei einer Blockchain).

## Architektur

| Schicht | Technologie | Aufgabe |
|---|---|---|
| Frontend | React + TypeScript (Vite), gehostet auf Vercel | Website mit Unterseiten (`/pricing`, `/escrow`, …), Wallet-App (`/app/…`), öffentlicher Ledger |
| API | Postgres-Funktionen (`api_*`) via Supabase RPC | Login, Kauf, Transfer, Auszahlung, Escrow, Zahlungsanforderungen, Statistiken. Jede Funktion prüft das Session-Token und läuft als atomare Transaktion. |
| Datenbank | Supabase Postgres, Schema `polo` | Accounts, Sessions, Reserve, Ledger, Escrows, Requests. Das Schema ist von aussen nicht erreichbar, nur über die API-Funktionen. |
| Deployment | GitHub Actions + Vercel | Jede Änderung auf GitHub wird automatisch veröffentlicht (`main` = Live-Seite, andere Branches = Vorschau) |
| Keep-alive | GitHub Actions | Ruft alle 3 Tage `api_ping` auf, damit das Gratis-Projekt nicht pausiert |

Die Blockchain wird simuliert (zentrale Datenbank mit Hash-Kette). In einer echten Umsetzung würde der Ledger auf einer öffentlichen Chain laufen (Token-Contract), siehe Kapitel „Solution design“ der Arbeit.

## Projektstruktur

```
supabase/setup.sql      Datenbank: Tabellen, Regeln, API-Funktionen, Demo-Daten
src/api/                Zugriff auf die API (Supabase) und lokaler Demo-Modus
src/App.tsx             Routen (echte URLs wie /pricing; alte #/-Links werden umgeleitet)
src/site.ts             Liste der Website-Seiten: steuert Routen, Navigation und Footer
src/layouts.tsx         Layouts: Website (Header, Footer) und Wallet-App
src/ui.tsx              Design-System-Komponenten (ButtonLink, PageHero, Section, Card, Badge, Stat)
src/session.tsx         Login-Zustand für alle Seiten
src/pages/              Home, Login, Registrierung, Explorer, 404; src/pages/site/ = Inhaltsseiten
src/app/                Wallet-App: Übersicht, Zahlen, Escrow, Aktivität, KYC-Review
src/wallet.tsx          Daten der Wallet (lädt alle 6 s neu)
src/i18n.tsx            Sprache der Wallet (EN/ES)
src/demo.ts             Demo-Konten und Schritte der Demo-Tour
src/components/         Aktionen (Kaufen/Senden/Auszahlen), Rollen-Panels, KYC, Aktivität
.github/workflows/      Keep-alive für Supabase
public/brand/           Logo-Dateien (SVG/PNG), App-Icon, Social-Preview
scripts/brand/          Generator für die Logo-Dateien
```

## Corporate Identity

| Rolle | Farbe | Hex | Einsatz |
|---|---|---|---|
| Basis (ca. 60 %) | Forest Green | `#0F4027` | Hero, Navigation, Text auf hellem Grund |
| Sekundär (ca. 30 %) | Old Cream | `#EBCFAD` | Sektionen, Karten, Text auf Grün |
| Akzent (max. 10 %) | Burnt Orange | `#F26A1E` | Buttons, Highlights, Ball im Logo – nie als Text auf Creme |

Schrift: Helvetica-Familie, auf Windows Arial als Fallback. Die Tokens stehen oben in `src/styles.css`.

Logo 1A (Münzring, gekreuzte Mallets, oranger Ball) liegt in `public/brand/` in vier Farbvarianten (`on-dark`, `on-light`, `black`, `white`) und drei Formen: `mark-*` (Zeichen), `lockup-vertical-*`, `lockup-horizontal-*`. Ab 32 px und kleiner wird die vereinfachte Version `icon-*` verwendet (Favicon, App-Icon). Die Dateien werden mit `python3 scripts/brand/generate.py` erzeugt (braucht `fonttools` und `rsvg-convert`); nicht von Hand bearbeiten.

## Lokal starten

```
npm install
npm run dev        # mit Supabase-Datenbank
npm run dev:demo   # ohne Datenbank, Daten im Browser (zum Entwickeln)
```

## Setup (einmalig)

1. Supabase: Inhalt von `supabase/setup.sql` im SQL Editor einfügen und auf „Run“ klicken. Das Skript kann jederzeit erneut ausgeführt werden, dann ist alles zurückgesetzt.
2. GitHub: Code in ein Repository hochladen.
3. Vercel: Projekt anlegen. Veröffentlicht wird über GitHub Actions (`.github/workflows/deploy.yml`) mit dem Repository-Secret `VERCEL_TOKEN`. Die Supabase-URL und der öffentliche Key stehen in `src/config.ts`.

Der „publishable key“ in `src/config.ts` ist öffentlich und darf im Code stehen. Den geheimen `service_role`-Key nie in den Code oder ins Repository legen.
