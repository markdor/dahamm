import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { TASTING_TOKEN_RE } from '@dahamm/shared';
import { match } from '../../params/tastingToken';
import { generateTastingToken, hashTastingToken } from './tastingToken';

describe('generateTastingToken', () => {
	it('returns 32 base64url characters (192 bits) that the route matcher accepts', () => {
		for (let i = 0; i < 1000; i++) {
			const { token } = generateTastingToken();
			expect(token).toMatch(TASTING_TOKEN_RE);
			expect(match(token)).toBe(true);
		}
	});

	it('does not repeat tokens in a large sample', () => {
		const tokens = new Set(Array.from({ length: 10_000 }, () => generateTastingToken().token));
		expect(tokens.size).toBe(10_000);
	});

	it('returns the hash of the token, never the token itself', () => {
		const { token, tokenHash } = generateTastingToken();
		expect(tokenHash).toBe(hashTastingToken(token));
		expect(tokenHash).not.toContain(token);
	});
});

describe('hashTastingToken', () => {
	it('is the hex SHA-256 digest of the token', () => {
		const token = 'A'.repeat(32);
		expect(hashTastingToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
		expect(hashTastingToken(token)).toMatch(/^[0-9a-f]{64}$/);
	});

	it('is deterministic and distinguishes tokens', () => {
		expect(hashTastingToken('a'.repeat(32))).toBe(hashTastingToken('a'.repeat(32)));
		expect(hashTastingToken('a'.repeat(32))).not.toBe(hashTastingToken('b'.repeat(32)));
	});
});
