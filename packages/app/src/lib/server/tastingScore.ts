import { TASTING_RATING_RANGE, type TastingBottle } from '@dahamm/shared';

// Pour order for the blind tasting: light → heavy → smoky. The weights, the ABV
// normalization and the smoke groups are starting values that get tuned after
// the first tasting with real bottles – that's why they all live here.

/** Share of each normalized factor (0–1) in the score; they add up to 1. */
export const SCORE_WEIGHTS = { smoke: 0.4, cask: 0.3, abv: 0.2, value: 0.1 } as const;

/** ABV at or below `floor` counts as 0, at or above `floor + span` as 1. */
export const ABV_NORMALIZATION = { floor: 40, span: 20 } as const;

/**
 * Inclusive upper `smoke` bound of each smoke group, in pour order
 * (0–1, 2–3, 4–5): a smoky bottle is poured after all less smoky ones, however
 * weak it is otherwise.
 */
export const SMOKE_GROUP_UPPER_BOUNDS = [1, 3, 5] as const;

/** Default for `sortPourOrder`; when off, only the score and the tie-breakers decide. */
export const SMOKE_GROUPS_ENABLED = true;

/** Contribution of each factor to the score, in score points (0–100 in total). */
export type ScoreBreakdown = Record<keyof typeof SCORE_WEIGHTS, number>;

export type ScoredBottle<T extends TastingBottle> = T & {
	score: number;
	breakdown: ScoreBreakdown;
};

function roundToTenth(value: number): number {
	return Math.round(value * 10) / 10;
}

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/**
 * score = 100 · (0.4·S + 0.3·C + 0.2·A + 0.1·W), each factor normalized to 0–1.
 * Rounded to one decimal place *before* any sorting: float noise such as
 * 52.00000000000001 would otherwise defeat the tie-breakers.
 */
export function scoreBottle(bottle: TastingBottle): { score: number; breakdown: ScoreBreakdown } {
	const normalized: ScoreBreakdown = {
		smoke: bottle.smoke / TASTING_RATING_RANGE.max,
		cask: bottle.cask / TASTING_RATING_RANGE.max,
		abv: clamp01((bottle.abv - ABV_NORMALIZATION.floor) / ABV_NORMALIZATION.span),
		value: bottle.value / TASTING_RATING_RANGE.max
	};
	const points = (factor: keyof ScoreBreakdown) => 100 * SCORE_WEIGHTS[factor] * normalized[factor];

	return {
		score: roundToTenth(points('smoke') + points('cask') + points('abv') + points('value')),
		breakdown: {
			smoke: roundToTenth(points('smoke')),
			cask: roundToTenth(points('cask')),
			abv: roundToTenth(points('abv')),
			value: roundToTenth(points('value'))
		}
	};
}

/** 0-based smoke group: the number of group bounds the bottle's smoke exceeds. */
function smokeGroup(smoke: number): number {
	return SMOKE_GROUP_UPPER_BOUNDS.filter((bound) => smoke > bound).length;
}

/**
 * Scores the bottles and sorts them in pour order (ascending): smoke group →
 * score → smoke → cask → abv → name. The sort is stable, so identical bottles
 * keep their input order.
 */
export function sortPourOrder<T extends TastingBottle>(
	bottles: readonly T[],
	{ smokeGroups = SMOKE_GROUPS_ENABLED }: { smokeGroups?: boolean } = {}
): ScoredBottle<T>[] {
	const group = (smoke: number) => (smokeGroups ? smokeGroup(smoke) : 0);

	return bottles
		.map((bottle) => ({ ...bottle, ...scoreBottle(bottle) }))
		.sort(
			(a, b) =>
				group(a.smoke) - group(b.smoke) ||
				a.score - b.score ||
				a.smoke - b.smoke ||
				a.cask - b.cask ||
				a.abv - b.abv ||
				a.name.localeCompare(b.name, 'de')
		);
}
