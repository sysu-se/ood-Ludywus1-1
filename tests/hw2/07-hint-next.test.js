import { describe, expect, it } from 'vitest';
import { loadDomainApi, makeAlmostSolved, makePuzzle } from './helpers/domain-api.js';

describe('HW2 hint - next deducible', () => {
	it('在只剩一个空格的局面找到 naked-single', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(makeAlmostSolved());

		// 行 8 用了 1-8,列 8 用了 1-8,宫 8 用了 1-8 → 缺 9
		const hint = sudoku.findNextDeducible();
		expect(hint).not.toBeNull();
		expect(hint).toMatchObject({
			row:    8,
			col:    8,
			value:  9,
			reason: 'naked-single',
		});
	});

	it('对完全空的题面返回 null(无 naked-single)', async () => {
		const { createSudoku } = await loadDomainApi();
		const sudoku = createSudoku(Array.from({ length: 9 }, () => Array(9).fill(0)));

		expect(sudoku.findNextDeducible()).toBeNull();
	});

	it('Game.getNextHint 转发到 Sudoku', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makeAlmostSolved()) });

		const hint = game.getNextHint();
		expect(hint).toMatchObject({ row: 8, col: 8, value: 9 });
	});

	it('Game.applyHint(无参) 自动用 next deducible 落子并入主栈', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makeAlmostSolved()) });

		const move = game.applyHint();
		expect(move).toMatchObject({ row: 8, col: 8, value: 9 });
		expect(game.getSudoku().getGrid()[8][8]).toBe(9);
		expect(game.canUndo()).toBe(true);

		// 应用后再 undo 应回到原状态
		game.undo();
		expect(game.getSudoku().getGrid()[8][8]).toBe(0);
	});

	it('Game.applyHint({row,col}) 仅在该格只有 1 个候选时才落子', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makeAlmostSolved()) });

		// (8,8) 只能填 9
		const ok = game.applyHint({ row: 8, col: 8 });
		expect(ok).toMatchObject({ row: 8, col: 8, value: 9 });

		// 反例:在 makePuzzle 上 (0,2) 有 3 个候选,applyHint 应返回 null
		const game2 = createGame({ sudoku: createSudoku(makePuzzle()) });
		expect(game2.applyHint({ row: 0, col: 2 })).toBeNull();
		expect(game2.canUndo()).toBe(false);
	});
});
