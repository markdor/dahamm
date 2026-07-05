---
description: Einstieg in die Implementierung eines GitHub Issues – Kontext laden → Codebase-Analyse → Implementierungsplan. Aufruf: /implement <Issue-Nummer>
---

Du bereitest die Implementierung eines GitHub Issues vor. Ziel ist **nicht**, den Code fertig zu schreiben, sondern einen fundierten Implementierungsplan zu erarbeiten und zur Freigabe vorzulegen. Die eigentliche Umsetzung läuft danach wie gewohnt interaktiv im Chat weiter.

**Eingabe:** `$ARGUMENTS` – eine Issue-Nummer (z. B. `12`).

Falls kein Argument übergeben wurde: Frage den User nach der Issue-Nummer und brich dann ab – er soll den Skill mit der Nummer neu aufrufen.

---

## Phase 1 – Kontext laden

Führe **parallel** aus:
1. `gh issue view $ARGUMENTS --json number,title,body,labels,state,comments` – lädt das Issue.
2. Lies `CLAUDE.md` – Architektur, Stack, Konventionen, Teststrategie, Error-Handling-Pattern.

Merke dir Titel, Body und Labels des Issues.

**Vollständigkeits-Check:** Prüfe, ob der Issue-Body Akzeptanzkriterien und technischen Kontext enthält (Sektionen wie „Akzeptanzkriterien", „Technischer Kontext" – typisches Ergebnis von `/refine`). Fehlen diese und ist der Body nur ein kurzer Stichpunkt, weise den User darauf hin und frage per `AskUserQuestion`, ob:
- er das Issue erst mit `/refine $ARGUMENTS` ausformulieren lassen möchte (dann brich hier ab), oder
- direkt mit dem vorhandenen (knappen) Body weitergemacht werden soll.

---

## Phase 2 – Branch sicherstellen

Dieser Skill arbeitet **niemals direkt auf `main`**. Prüfe den aktuellen Branch (`git branch --show-current`):

- **Branch beginnt bereits mit `feat/`**: weiter mit Phase 3, kein Wechsel nötig.
- **Branch ist `main`**: Leite aus dem Issue-Titel einen sprechenden Slug ab (klein geschrieben, Umlaute transkribiert `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`, Nicht-alphanumerische Zeichen durch `-` ersetzt, keine doppelten/führenden/abschließenden Bindestriche) und erstelle daraus `feat/$ARGUMENTS-<slug>` (z. B. Issue #12 „Einkaufsliste ↔ Essensplaner Integration" → `feat/12-einkaufsliste-essensplaner-integration`). Erstelle den Branch mit `git checkout -b feat/$ARGUMENTS-<slug>` und teile dem User kurz mit, welcher Branch angelegt wurde.
- **Branch ist weder `main` noch `feat/*`**: Brich ab und frage den User per `AskUserQuestion`, ob er zu `main` wechseln möchte (damit der Skill automatisch einen passenden `feat/`-Branch anlegt) oder manuell zu einem bestehenden `feat/`-Branch wechselt. Lege selbstständig keinen Branch von einem fremden Branch aus an.

---

## Phase 3 – Codebase-Analyse

Spawne einen **Explore-Agenten** (subagent_type: `Explore`, Breadth: `medium`) mit folgendem Auftrag:

> Analysiere den Code für Issue #$ARGUMENTS ("$ISSUE_TITLE"). Finde:
> 1. Betroffene Routen und SvelteKit-Komponenten (pages, layouts, +page.svelte, +server.ts)
> 2. Betroffenes Drizzle-Datenbankschema (src/lib/server/db/schema.ts) und ob eine neue Migration nötig ist
> 3. Betroffene API-Endpunkte (src/routes/api/) bzw. geteilte Typen/Konstanten in packages/shared
> 4. Bestehende ähnliche Implementierungen, die als Vorlage für Struktur, Error-Handling und Tests dienen können
> 5. Auth/Security-Relevanz: Auth-Guard, Validierung, Rate-Limiting nötig?
> 6. Betroffene Tests: welche `*.svelte.test.ts` (client) bzw. `*.test.ts` (server) müssten neu geschrieben oder angepasst werden, inkl. grober Einschätzung zur Coverage-Gate-Auswirkung (>85 %)
> Gib eine kompakte Liste der betroffenen Dateien mit je einem Satz Erklärung zurück.

Warte auf das Ergebnis des Agenten.

---

## Phase 4 – Implementierungsplan erarbeiten

Kombiniere Issue-Inhalt + Codebase-Analyse zu einem konkreten Schritt-für-Schritt-Plan. Der Plan muss:

- jedes Akzeptanzkriterium des Issues auf mindestens einen Umsetzungsschritt abbilden (nichts darf ohne Abdeckung bleiben),
- neue/geänderte Dateien explizit benennen (Pfad + Zweck),
- Reihenfolge sinnvoll wählen (z. B. Schema/Migration → API-Endpoint → UI → Tests, oder TDD-Reihenfolge falls passend),
- CLAUDE.md-Konventionen respektieren: geteilte Typen/Konstanten in `packages/shared`, typisierte Fehlerklassen mit `userMessage`, pino-Logging, Vitest-Projektaufteilung (client/server), Playwright nur bei kritischen Flows,
- Security-relevante Punkte (Auth-Guard, Validierung, Rate-Limiting) als eigene Schritte ausweisen, falls die Analyse sie identifiziert hat,
- am Ende einen Schritt für Tests/Coverage-Check enthalten.

Gehe anschließend über `EnterPlanMode` in den Plan-Mode und lege den Plan dem User zur Freigabe vor (`ExitPlanMode`). Iteriere, falls der User Änderungen wünscht.

---

## Phase 5 – Übergabe an die Implementierung

Nach Freigabe des Plans:
- Lege die Schritte des Plans als Todos via `TodoWrite` an, damit der Fortschritt im weiteren Chat-Verlauf sichtbar bleibt.
- Beginne **nicht automatisch** mit dem Schreiben von Code – warte auf die nächste Nachricht des Users bzw. mache im selben Turn direkt mit dem ersten Todo weiter, falls der User das beim Freigeben so signalisiert (z. B. „leg los").

---

## Grundsätze

- **Nur auf Featurebranches**: Niemals direkt auf `main` arbeiten. Branch heißt immer `feat/<issue-nummer>-<sprechender-slug>`; auf main wird er automatisch angelegt, auf fremden Branches wird abgebrochen und nachgefragt.
- **Kein Scope-Creep**: Der Plan deckt nur ab, was im Issue steht – keine Bonus-Features.
- **Keine Halluzinationen**: Nenne im Plan nur Dateien, die der Explore-Agent tatsächlich gefunden hat oder die laut Issue offensichtlich neu entstehen müssen.
- **Nie committen oder pushen** – auch nicht nach Abschluss der Implementierung. Der User committet selbst.
- **Kompakt**: Der Plan ist eine Anleitung, kein Aufsatz – Stichpunkte statt Fließtext, wo möglich.
