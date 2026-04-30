import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 加分项 #3 - Hint explanation', () => {
	it('Sudoku.explainCell 返回候选数与各方向已占用数字', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		// makePuzzle (0,2):同行 [5,3,7],同列 [8],同宫 [5,3,6,9,8]
		const explain = sudoku.explainCell(0, 2);

		expect(explain.row).toBe(0);
		expect(explain.col).toBe(2);
		expect(explain.currentValue).toBe(0);
		expect(explain.isFixed).toBe(false);
		expect(explain.candidates).toEqual([1, 2, 4]);

		expect(explain.excludedByRow).toEqual([3, 5, 7]);
		expect(explain.excludedByCol).toEqual([8]);
		// 同宫(行0-2,列0-2)已用:5,3,6,9,8
		expect(explain.excludedByBox).toEqual([3, 5, 6, 8, 9]);
	});

	it('固定格 isFixed 为 true,candidates 为空数组', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		const explain = sudoku.explainCell(0, 0); // (0,0)=5 固定
		expect(explain.isFixed).toBe(true);
		expect(explain.currentValue).toBe(5);
		expect(explain.candidates).toEqual([]);
		// 即便是固定格,excluded 信息仍能告诉用户该格周围的状态
		expect(explain.excludedByRow).toContain(5);
	});

	it('候选数列表与 excluded 集合互补(对空格)', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		const explain = sudoku.explainCell(0, 2);
		const excluded = new Set([
			...explain.excludedByRow,
			...explain.excludedByCol,
			...explain.excludedByBox,
		]);

		// candidates ∪ excluded 必须等于 {1..9}
		const union = new Set([...explain.candidates, ...excluded]);
		for (let v = 1; v <= 9; v += 1) {
			expect(union.has(v)).toBe(true);
		}
		// candidates ∩ excluded = ∅
		for (const v of explain.candidates) {
			expect(excluded.has(v)).toBe(false);
		}
	});

	it('Game.explainCell 通过 facade 转发到 Sudoku', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		const explain = game.explainCell(0, 2);
		expect(explain.candidates).toEqual([1, 2, 4]);
	});

	it('explore 期间 explainCell 路由到子会话(看到子局面)', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		// 在 (0,2) 填 4 后,子局面与主局面差异
		game.guess({ row: 0, col: 2, value: 4 });

		const explain = game.explainCell(0, 2);
		// 此时 (0,2) 已填 4,候选应为空
		expect(explain.currentValue).toBe(4);
		expect(explain.candidates).toEqual([]);

		// 主局面 (0,2) 仍为 0
		game.exitExplore('abandon');
		expect(game.explainCell(0, 2).currentValue).toBe(0);
	});
});
