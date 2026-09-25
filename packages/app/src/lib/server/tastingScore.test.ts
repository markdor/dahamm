import { describe, it, expect } from 'vitest';
import type { TastingBottle } from '@dahamm/shared';
import { scoreBottle, sortPourOrder } from './tastingScore';

function bottle(
	name: string,
	values: Pick<TastingBottle, 'smoke' | 'cask' | 'abv' | 'value'>
): TastingBottle {
	return { alias: name, name, ...values };
}

// Reference bottles from the issue specification.
const speysider = bottle('Unsherried Speysider', { smoke: 0, cask: 1, abv: 40, value: 2 });
const sherryBomb = bottle('Sherry-Bombe', { smoke: 1, cask: 5, abv: 46, value: 4 });
const islay = bottle('Islay Cask Strength', { smoke: 5, cask: 2, abv: 58, value: 3 });

const names = (bottles: TastingBottle[]) => bottles.map((b) => b.name);

describe('scoreBottle', () => {
	it('matches the reference scores of the specification', () => {
		expect(scoreBottle(speysider).score).toBe(10);
		expect(scoreBottle(sherryBomb).score).toBe(52);
		expect(scoreBottle(islay).score).toBe(76);
	});

	it('breaks the score down into the points of each factor', () => {
		expect(scoreBottle(islay).breakdown).toEqual({ smoke: 40, cask: 12, abv: 18, value: 6 });
	});

	it('clamps the ABV factor below 40 % and above 60 %', () => {
		const base = { smoke: 0, cask: 0, value: 0 };
		expect(scoreBottle(bottle('low', { ...base, abv: 35 })).breakdown.abv).toBe(0);
		expect(scoreBottle(bottle('floor', { ...base, abv: 40 })).breakdown.abv).toBe(0);
		expect(scoreBottle(bottle('ceiling', { ...base, abv: 60 })).breakdown.abv).toBe(20);
		expect(scoreBottle(bottle('high', { ...base, abv: 75 })).breakdown.abv).toBe(20);
	});

	it('scores 0 when every value is at its minimum', () => {
		expect(scoreBottle(bottle('min', { smoke: 0, cask: 0, abv: 35, value: 0 })).score).toBe(0);
	});

	it('scores 100 when every value is at its maximum', () => {
		expect(scoreBottle(bottle('max', { smoke: 5, cask: 5, abv: 75, value: 5 })).score).toBe(100);
	});

	it('rounds score and breakdown to one decimal place (no float noise)', () => {
		// Unrounded, these come out as 23.299999999999997 and 0.7000000000000028.
		const a = scoreBottle(bottle('a', { smoke: 0, cask: 3, abv: 43.3, value: 1 }));
		expect(a.score).toBe(23.3);
		expect(a.breakdown.abv).toBe(3.3);
		expect(scoreBottle(bottle('b', { smoke: 0, cask: 0, abv: 40.7, value: 0 })).score).toBe(0.7);
	});
});

describe('sortPourOrder', () => {
	it('pours the reference bottles light → heavy → smoky', () => {
		const order = sortPourOrder([islay, sherryBomb, speysider]);
		expect(names(order)).toEqual(['Unsherried Speysider', 'Sherry-Bombe', 'Islay Cask Strength']);
		expect(order.map((b) => b.score)).toEqual([10, 52, 76]);
	});

	it('pours a smoky but otherwise weak bottle after the unsmoky ones', () => {
		const smokyWeak = bottle('smoky weak', { smoke: 4, cask: 0, abv: 40, value: 0 }); // 32
		const unsmokyStrong = bottle('unsmoky strong', { smoke: 1, cask: 5, abv: 60, value: 5 }); // 68
		const middleGroup = bottle('middle group', { smoke: 2, cask: 0, abv: 40, value: 0 }); // 16

		expect(names(sortPourOrder([smokyWeak, middleGroup, unsmokyStrong]))).toEqual([
			'unsmoky strong',
			'middle group',
			'smoky weak'
		]);
	});

	it('sorts by score alone when smoke groups are disabled', () => {
		const smokyWeak = bottle('smoky weak', { smoke: 4, cask: 0, abv: 40, value: 0 }); // 32
		const unsmokyStrong = bottle('unsmoky strong', { smoke: 1, cask: 5, abv: 60, value: 5 }); // 68

		expect(names(sortPourOrder([unsmokyStrong, smokyWeak], { smokeGroups: false }))).toEqual([
			'smoky weak',
			'unsmoky strong'
		]);
	});

	describe('tie-breakers on identical scores', () => {
		it('pours less smoke first', () => {
			const more = bottle('more smoke', { smoke: 1, cask: 0, abv: 40, value: 0 }); // 8
			const less = bottle('less smoke', { smoke: 0, cask: 1, abv: 42, value: 0 }); // 8
			expect(names(sortPourOrder([more, less]))).toEqual(['less smoke', 'more smoke']);
		});

		it('then less cask influence', () => {
			const more = bottle('more cask', { smoke: 0, cask: 1, abv: 40, value: 0 }); // 6
			const less = bottle('less cask', { smoke: 0, cask: 0, abv: 44, value: 1 }); // 6
			expect(names(sortPourOrder([more, less]))).toEqual(['less cask', 'more cask']);
		});

		it('then lower ABV (also when both are clamped to 0)', () => {
			const higher = bottle('higher abv', { smoke: 0, cask: 0, abv: 38, value: 0 }); // 0
			const lower = bottle('lower abv', { smoke: 0, cask: 0, abv: 35, value: 0 }); // 0
			expect(names(sortPourOrder([higher, lower]))).toEqual(['lower abv', 'higher abv']);
		});

		it('then the name', () => {
			const values = { smoke: 0, cask: 2, abv: 43, value: 1 };
			const b = bottle('Balvenie', values);
			const a = bottle('Aberlour', values);
			expect(names(sortPourOrder([b, a]))).toEqual(['Aberlour', 'Balvenie']);
		});
	});

	it('keeps extra fields of the input bottles', () => {
		const [scored] = sortPourOrder([{ ...speysider, slot: 2 }]);
		expect(scored).toMatchObject({ slot: 2, score: 10, alias: speysider.alias });
	});
});
