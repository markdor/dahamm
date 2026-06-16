# Dahamm

Selbst gehostete Familien-App mit Dashboard, Einkaufsliste, Essensplaner,
Todos und Notizen – bedienbar per Web-PWA und Telegram-Bot mit
Spracheingabe (Whisper + Claude AI).

git commit -m "Initial SvelteKit setup with typescript, prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter"

## Architektur

Monorepo via npm Workspaces, drei Docker-Container hinter Traefik v3:

```
packages/
├── app/        SvelteKit PWA + API-Endpunkte + Auth
├── bot/        Telegram Bot (grammy)
├── whisper/    Speech-to-Text REST-Service (FastAPI)
└── shared/     Geteilte TypeScript-Types
```

```
Telegram ──► bot ──► whisper (STT)
                │
                ▼
              Claude Haiku (Intent-Parsing)
                │
                ▼
              app  ◄──► Browser (PWA)
                │
                ▼
              SQLite (Drizzle ORM, named Docker Volume)
```

## Stack

| Bereich | Technologie |
|---|---|
| Frontend + API | SvelteKit (PWA-fähig) |
| Datenbank | SQLite via Drizzle ORM (better-sqlite3) |
| Auth | Better Auth (Magic Link, kein Sign-up) |
| Bot | grammy (TypeScript) |
| Speech-to-Text | OpenAI Whisper (small, lokal) |
| Intent-Parsing | Claude Haiku |
| Mail | nodemailer (Hetzner SMTP) |
| Deployment | Docker Compose + Traefik v3 (Hetzner VPS) |
| Monorepo | npm Workspaces |

## Zugriff

Closed App – keine anonyme Nutzung. Initial ist nur die in `.env`
hinterlegte Admin-Mailadresse freigeschaltet; weitere User legt der Admin
auf einer eigenen Admin-Seite an. Login erfolgt per Magic Link, ohne
Passwort.

Der Bot authentifiziert sich gegen die App-API mit einem vom Admin
generierten Bearer-Token.

## Entwicklung

```bash
# Repo klonen
git clone <repo-url> dahamm && cd dahamm

# Workspace-Dependencies installieren
npm install

# App im Dev-Mode starten (Magic Link wird in die Konsole geloggt,
# SMTP-Konfiguration nicht nötig)
npm run dev --workspace packages/app
```

`.env` aus `.env.example` ableiten und mindestens `BETTER_AUTH_SECRET`,
`ADMIN_EMAIL`, `ADMIN_USERNAME` setzen.

## Deployment

Docker Compose auf Hetzner VPS, TLS via Traefik + Let's Encrypt.
Persistente Daten (SQLite) liegen in einem named Docker Volume.

```bash
docker compose up -d
```

DB-Migrationen laufen automatisch beim Container-Start, ebenso der
Admin-Bootstrap.

## Lizenz

[AGPL-3.0-only](./LICENSE)
