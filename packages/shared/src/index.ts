/**
 * Längengrenzen für den Namen eines Einkaufslisten-Postens.
 *
 * Geteilte Domänen-Invariante (keine reine API-Detailfrage): genutzt von der
 * Web-UI (`maxlength`/Button-Freigabe), der Server-Validierung in
 * `/api/shopping` und später vom Bot – eine einzige Quelle, damit die Grenzen
 * nicht an drei Stellen auseinanderdriften.
 */
export const SHOPPING_ITEM_NAME_LENGTH = {
	min: 3,
	max: 64
} as const;

/**
 * Ein einzelner Posten der Einkaufsliste.
 *
 * Geteilter Domänen-Typ: genutzt von der App (Dashboard-Karte, Detailseite,
 * `/api/shopping`, Drizzle-Schema) und später vom Telegram-Bot, damit alle
 * Seiten dieselbe Definition teilen.
 *
 * Bewusst **ohne** Menge – die Familie hakt Posten nur ab; eine Stückzahl wird
 * bei Bedarf einfach in den Namen geschrieben ("2x Milch").
 */
export interface ShoppingItem {
	id: string;
	/** Anzeigename des Postens (entspricht dem API-Feld `item`). Länge: siehe {@link SHOPPING_ITEM_NAME_LENGTH}. */
	name: string;
	/** Offen (`false`) oder erledigt/abgehakt (`true`) – speist die „offen"-Zählung. */
	done: boolean;
	/** Erstellzeitpunkt als ISO-String, für stabile Sortierung der Vorschau. */
	createdAt: string;
}

/** Ein Ziel, an das der Dashboard-Quick-Add einen Eintrag posten kann. */
export interface QuickAddTarget {
	id: string;
	label: string;
	/** SvelteKit-Form-Action, an die das Quick-Add-Formular postet. */
	action: string;
}

/**
 * Verfügbare Quick-Add-Ziele.
 *
 * Geteilte Liste statt lokal in `QuickAdd.svelte`, damit spätere Module
 * (Todos, Essensplaner) hier ergänzt werden und Web-UI wie Bot dieselbe
 * Quelle nutzen. Aktuell nur die Einkaufsliste.
 */
export const QUICK_ADD_TARGETS: QuickAddTarget[] = [
	{ id: 'shopping', label: 'Einkaufsliste', action: '?/addShoppingItem' }
];

/**
 * Längenlimit für E-Mail-Adressen.
 *
 * Geteilte Validierungs-Constraint: genutzt vom Login-Formular
 * (`login/+page.svelte`) und der Admin-Nutzerverwaltung (`admin/+page.server.ts`),
 * damit Client- und Server-Validierung nicht auseinanderdriften.
 */
export const EMAIL_LENGTH = { max: 254 } as const;

/** Regex für ein grob plausibles E-Mail-Format (kein vollständiger RFC-5322-Parser). */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Prüft Format ({@link EMAIL_REGEX}) und Länge ({@link EMAIL_LENGTH}) in einem Schritt. */
export function isValidEmail(value: string): boolean {
	return EMAIL_REGEX.test(value) && value.length <= EMAIL_LENGTH.max;
}

/**
 * Regex für gültige Usernamen.
 *
 * Geteilte Validierungs-Constraint: aktuell nur von der Admin-Nutzerverwaltung
 * genutzt, liegt aber zusammen mit den anderen Auth-Validierungs-Constraints hier.
 */
export const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,40}$/;

/**
 * Regex für eine gültige Telegram-User-ID (rein numerisch; das Feld ist beim Anlegen optional).
 *
 * Geteilte Validierungs-Constraint: aktuell nur von der Admin-Nutzerverwaltung
 * genutzt, liegt aber zusammen mit den anderen Auth-Validierungs-Constraints hier
 * – sobald der Bot dieselbe ID prüft, teilen sich beide Seiten diese Quelle.
 */
export const TELEGRAM_RE = /^\d{1,20}$/;
