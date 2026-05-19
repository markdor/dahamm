# Dahamm – CLAUDE.md

Selbst gehostete Familien-App mit Dashboard, Einkaufsliste, Essensplaner und Todos –
steuerbar per Telegram-Bot mit Spracheingabe via Whisper und Claude AI.

---

## Architektur-Überblick

```
packages/
├── app/        # SvelteKit PWA + API-Endpunkte + Auth
├── bot/        # Telegram Bot (TypeScript, grammy)
├── whisper/    # Speech-to-Text REST-Service (Python, FastAPI)
└── shared/     # Geteilte TypeScript-Types
```

3 Docker Container, orchestriert via Docker Compose, deployed auf Hetzner VPS hinter Traefik v3.

---

## Stack

| Bereich | Technologie |
|---|---|
| Frontend + API | SvelteKit (PWA-fähig) |
| Datenbank | SQLite via Drizzle ORM |
| Bot | grammy (TypeScript) |
| Speech-to-Text | OpenAI Whisper (small-Modell, lokal) |
| Intent-Parsing | Claude Haiku (claude-haiku-4-5-20251001) |
| Auth | Magic Link via nodemailer (Hetzner SMTP) |
| Deployment | Docker Compose + Traefik v3 (Hetzner VPS) |
| Monorepo | npm Workspaces (kein Nx, kein Turborepo) |

---

## Services (Docker Compose)

### `app` – SvelteKit
- Dashboard mit den Modulen: Einkaufsliste, Todos, Essensplaner, Notizen
- API-Endpunkte für den Bot:
  - `POST /api/shopping` – `{ items: [{ item, quantity }] }`
  - `POST /api/todos`    – `{ todos: [{ title, dueDate? }] }`
  - `POST /api/meals`    – `{ meals: [{ day, meal }] }`
- Auth: Magic Link per Mail (nodemailer + Hetzner SMTP)
- Session-Dauer: 30 Tage Cookie
- SQLite-Datei liegt in einem Named Docker Volume unter `/app/data/dahamm.db`

### `bot` – Telegram Bot
- Bibliothek: grammy
- Sprachnachrichten: Telegram .ogg → Whisper → Transkript → Claude Haiku → App API
- Textnachrichten: direkt → Claude Haiku → App API
- Sicherheit: Whitelist via `ALLOWED_USER_IDS` (kommagetrennte Telegram-IDs)
- Claude Haiku parst natürliche Sprache zu strukturiertem JSON (shoppingItems / todos / mealPlan)

### `whisper` – STT-Service
- FastAPI (Python)
- Modell: `small` (lädt beim Docker Build, nicht beim Start)
- Endpunkt: `POST /transcribe` – nimmt Audiodatei, gibt `{ text, language }` zurück
- Sprache fixiert auf `de` für bessere Performance

---

## Authentifizierung

- User kann sich optional über einen neuen Button im Nav Menü einloggen
- Der Login erfolgt via Angabe der Mailadresse an die dann ein Magic Link geschickt wird
- Eine Registrierung im herkömmlichen Sinne ist nicht notwendig, sobald ein User angemeldet ist, wird im Header seine Username angezeigt
- Ein initialer Admin User wird über das .env File mit Username und Mailadresse angegeben
- Dieser Admin User ist in der DB als für den Login freigebener User aufgeführt (Whitelist) und kann sich im Login Formular anmelden
- Es gibt eine Admin-Seite, auf der der Admin weitere Mail-Adressen (mit Username und Telegram User-ID) angeben kann, auch diese können sich dann in Zukunft einloggen
- Magic Link Flow:
  - Nutzer gibt E-Mail-Adresse ein
  - befindet sich die Adresse nicht in der Whitelist in der DB, dann passiert nichts. Ansonsten fahre fort.
  - SvelteKit generiert signierten Token, speichert ihn in SQLite
  - nodemailer schickt Link via Hetzner SMTP
  - Klick auf Link → Session Cookie (30 Tage)
  - Keine Passwörter, kein OTP-Abtippen

---

## Environment Variables

```env
# Telegram
TELEGRAM_BOT_TOKEN=

# Anthropic
ANTHROPIC_API_KEY=

# SMTP (Hetzner Mail)
SMTP_HOST=mail.your-server.de
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=dahamm@deine-domain.de

# App
DATABASE_URL=file:/app/data/dahamm.db
SESSION_SECRET=            # zufälliger langer String

# Interne Service-URLs (Docker-intern, nicht ändern)
WHISPER_URL=http://whisper:8000
APP_API_URL=http://app:3000
```

---

## Konventionen

- **Sprache:** Deutsch im UI, Englisch im Code (Variablen, Funktionen, Kommentare)
- **Fehlerbehandlung:** Immer try/catch in Bot-Handlern, Nutzer bekommt lesbare Fehlermeldung
- **Claude Haiku** für Intent-Parsing (günstig, schnell) – kein Sonnet für diese Aufgabe
- **Kein Nx, kein Turborepo** – plain npm Workspaces reichen
- **Kein Postgres** – SQLite ist für diesen Use Case ausreichend, einfacher zu backupen
- **Named Docker Volume** für SQLite, kein Bind Mount

---

## Deployment

- Hetzner VPS mit Docker + Traefik v3
- Bestehendes Traefik-Netzwerk: `traefik` (external)
- Internes Netzwerk: `internal` (nur zwischen den drei Containern)
- TLS via Let's Encrypt (DNS-01 Challenge mit Hetzner DNS)
- App erreichbar unter `dahamm.deine-domain.de`
### Compose-Konventionen

Aufbau analog zu den App-Stacks in `C:\Users\Markus\git\vps-config`, insbesondere
`vps-config/tandoor/compose.yaml` (Multi-Service-Stack mit DB-Volume, internem
Netzwerk und Traefik). Konkret:

- **Volumes** als named external Volumes oben deklariert:
  ```yaml
  volumes:
    db:
      external: true
      name: dahamm-db
  ```
- **Netzwerke:**
  - `dahamm-internal` (intern, nicht external) – verbindet `app`, `bot`, `whisper`
  - `web: external: true` – das vorhandene Traefik-Netzwerk
- **Pro Service:** `container_name`, `restart: unless-stopped`, `image` (bzw. `build`),
  `env_file: .env`, `volumes`, `networks`, ggf. `depends_on` mit `condition: service_healthy`.
- **Labels:**
  - `docker-volume-backup.stop-during-backup=true` auf Services mit persistentem Volume
  - Traefik-Labels nach diesem Muster (nur der nach außen erreichbare Service – hier `app`):
    ```yaml
    - "traefik.enable=true"
    - "traefik.http.routers.dahamm.rule=Host(`dahamm.markdor.net`)"
    - "traefik.http.routers.dahamm.entrypoints=websecure"
    - "traefik.http.routers.dahamm.tls.certresolver=le-resolver"
    - "traefik.http.services.dahamm.loadbalancer.server.port=3000"
    ```
- **Healthchecks** für Services, von denen andere abhängen (z. B. `whisper`,
  damit `bot` erst startet, wenn STT bereit ist).
- `bot` und `whisper` hängen **nur** im `dahamm-internal`-Netzwerk, nicht in `web`.

---

## UI Design

- Klar und minimalistisch, kein visuelles Rauschen
- **Mobile-first** – primäres Endgerät ist das Smartphone, Touch-Targets großzügig
- Desktop-Layout darf vorhanden sein, hat aber niedrigere Priorität

---

## Qualität & Tooling

Aufbau analog zu `C:\Users\Markus\git\gritshot`.

### Teststrategie

- **Viele Unit-Tests, Coverage-Gate > 85 %**, wenige E2E-Tests (Playwright nur für kritische Flows).
- **Vitest** mit zwei Projekten (vgl. `gritshot/vite.config.ts`):
  - `client` – `vitest-browser-svelte` + Playwright/Chromium headless, Pattern `**/*.svelte.{test,spec}.ts`
  - `server` – Node-Environment, Pattern `**/*.{test,spec}.ts`, Server-Code (`src/lib/server/**`)
- Coverage via `@vitest/coverage-v8`, Reporter: `text`, `lcov`, `html`, `json`, `json-summary`.
- `expect: { requireAssertions: true }` aktiv – Tests ohne Assertion schlagen fehl.
- E2E via Playwright (`tests/`), nur Smoke- und Critical-Path-Tests.

### GitHub Actions (`.github/workflows/ci.yml`)

Drei Jobs, analog gritshot:

1. **`test`** – Node 24, `npm ci`, `npx playwright install --with-deps`,
   `npm run test:coverage`, `npm run test:e2e`, Coverage als Artefakt hochladen,
   PR-Kommentar via `davelosert/vitest-coverage-report-action`.
2. **`release`** – nur auf `main`, `cycjimmy/semantic-release-action` mit
   `@semantic-release/git`, GitHub App Token (`CICD_CLIENT_ID` / `CICD_PRIVATE_KEY`).
3. **`docker`** – nach erfolgreichem Test (und Release oder Branch ≠ main):
   Build & Push nach `ghcr.io/markdor/dahamm` mit Tags `develop` / `latest` / `<version>`.

### Logging

- **pino** + **pino-pretty** (nur in Dev).
- Zentraler Logger in `src/lib/server/logger.ts`:
  ```ts
  import pino from 'pino';
  import { dev } from '$app/environment';

  export const logger = pino({
    level: dev ? 'debug' : 'info',
    transport: dev ? { target: 'pino-pretty' } : undefined
  });
  ```
- Im Bot- und Whisper-Service eigenes pino-Setup mit denselben Konventionen
  (Level via Env, JSON in Prod, pretty in Dev).

### Error Handling

- **Typisierte Fehlerklassen** mit separater `userMessage` (für UI/Telegram) und
  technischer `message` (für Logs) – Muster wie `FileValidationError`:
  ```ts
  export class ValidationError extends Error {
    constructor(message: string, public readonly userMessage: string) {
      super(message);
      this.name = 'ValidationError';
    }
  }
  ```
- **Handler-Pattern** (SvelteKit Action / Bot-Handler):
  - Validierungsfehler → `fail(422, { error: e.userMessage })` bzw. lesbare Telegram-Antwort
  - Unerwarteter Fehler → `logger.error(...)` + generische User-Meldung (`fail(500, ...)`)
  - `catch (e: unknown)`, dann via `instanceof` verengen
- Niemals interne Fehlertexte oder Stacktraces an den Nutzer durchreichen.

Vor neuen Arbeiten in diesen Bereichen: in `gritshot` (Code) bzw. `vps-config/tandoor` (Compose)
verifizieren, ob die Konvention noch aktuell ist.

---

## Noch nicht implementiert (Reihenfolge empfohlen)

1. SvelteKit App Grundstruktur + Drizzle Schema
2. Magic Link Auth
3. Einkaufsliste (einfachstes Modul, sofortiger Familiennutzen)
4. Todos
5. Essensplaner
6. Einkaufsliste ↔ Essensplaner Integration (Zutaten automatisch übernehmen)
7. Notizen