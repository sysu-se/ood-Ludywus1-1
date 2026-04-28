import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 hint - candidates', () => {
	it('Sudoku.getCandidates 返回非固定空格的合法候选数', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		// makePuzzle 的 (0,2) 是空格;
		// 行 0 已用 [5,3,7], 列 2 已用 [8], 宫 0 已用 [5,3,6,9,8] → 排除 {3,5,6,7,8,9}
		// 合法候选:{1,2,4}
		const cands = sudoku.getCandidates(0, 2);
		expect(cands).toEqual([1, 2, 4]);
	});

	it('固定格(题面已给)返回空数组', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		// (0,0) = 5 是固定格
		expect(sudoku.getCandidates(0, 0)).toEqual([]);
	});

	it('用户已填但非固定的格也返回空数组', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		sudoku.guess({ row: 0, col: 2, value: 4 });
		expect(sudoku.getCandidates(0, 2)).toEqual([]);
	});

	it('getAllCandidates 返回 9×9 二维数组,固定格为空', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makePuzzle());

		const all = sudoku.getAllCandidates();
		expect(all).toHaveLength(9);
		expect(all[0]).toHaveLength(9);
		// 固定格 (0,0)=5
		expect(all[0][0]).toEqual([]);
		// 空格 (0,2) 的候选与单独查询一致
		expect(all[0][2]).toEqual([1, 2, 4]);
	});

	it('Game.getCandidates 通过 facade 转发到 Sudoku', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		expect(game.getCandidates(0, 2)).toEqual([1, 2, 4]);
		expect(game.getCandidates(0, 0)).toEqual([]);
	});
});
