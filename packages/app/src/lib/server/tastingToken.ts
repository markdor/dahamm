import { randomBytes } from 'node:crypto';
import { sha256 } from './botToken';

// Participant links of the blind tasting (`/glenidunno/<token>`). Only the
// SHA-256 hash is stored: the links never expire, so a DB backup must not
// contain usable links, and the admin – who tastes blind as well – must not be
// able to reopen foreign links later. The plaintext only ever exists in the
// response of the create / regenerate action and is shown exactly once.

/** 24 random bytes = 192 bits → 32 base64url characters (see TASTING_TOKEN_RE). */
const TOKEN_BYTES = 24;

export function hashTastingToken(token: string): string {
	return sha256(token).toString('hex');
}

export function generateTastingToken(): { token: string; tokenHash: string } {
	const token = randomBytes(TOKEN_BYTES).toString('base64url');
	return { token, tokenHash: hashTastingToken(token) };
}
