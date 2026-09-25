import { describe, it, expect } from 'vitest';
import { match } from './tastingToken';

describe('tastingToken param matcher', () => {
	it('accepts 32 characters from the base64url alphabet', () => {
		expect(match('abcdefghijklmnopqrstuvwxyzABCD01')).toBe(true);
		expect(match('0123456789_-ABCDEFGHIJKLMNOPQRST')).toBe(true);
	});

	it('rejects the static sibling segments', () => {
		expect(match('admin')).toBe(false);
		expect(match('new')).toBe(false);
	});

	it('rejects wrong lengths', () => {
		expect(match('')).toBe(false);
		expect(match('a'.repeat(31))).toBe(false);
		expect(match('a'.repeat(33))).toBe(false);
	});

	it('rejects characters outside base64url', () => {
		for (const char of ['+', '/', '=', '.', ' ', 'ä', '%']) {
			expect(match(char + 'a'.repeat(31))).toBe(false);
		}
	});
});
