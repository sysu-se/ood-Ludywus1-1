import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 explore - enter / commit / abandon', () => {
	it('enterExplore 后 isExploring 为 true', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		expect(game.isExploring()).toBe(false);
		expect(game.enterExplore()).toBe(true);
		expect(game.isExploring()).toBe(true);

		// 重复 enter 应返回 false(已在 explore 中)
		expect(game.enterExplore()).toBe(false);
	});

	it('explore 期间 guess 不进入主栈', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		// 先在主局面做一步,主栈有 1 条
		game.guess({ row: 0, col: 2, value: 4 });
		expect(game.canUndo()).toBe(true);

		game.enterExplore();
		// explore 中再做几步——这些不应出现在主栈
		game.guess({ row: 1, col: 1, value: 7 });
		game.guess({ row: 2, col: 0, value: 1 });

		// 在 explore 中 canUndo 反映子栈
		expect(game.canUndo()).toBe(true);

		// abandon 后回主局面
		game.exitExplore('abandon');
		expect(game.isExploring()).toBe(false);

		// 主局面仅保留入 explore 前的 1 步,且子局面的 (1,1)/(2,0) 改动不见
		const grid = game.getSudoku().getGrid();
		expect(grid[0][2]).toBe(4); // 主步保留
		expect(grid[1][1]).toBe(0); // 子步丢弃
		expect(grid[2][0]).toBe(0);
	});

	it('commitExplore 后主栈 undo 一次撤销整段 explore', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 });
		game.guess({ row: 1, col: 1, value: 7 });
		game.exitExplore('commit');

		expect(game.isExploring()).toBe(false);
		// 主局面已纳入 explore 期间的所有改动
		const after = game.getSudoku().getGrid();
		expect(after[0][2]).toBe(4);
		expect(after[1][1]).toBe(7);

		// 主栈 undo 一次,所有 explore 期间的改动都应该回退
		expect(game.canUndo()).toBe(true);
		game.undo();
		const reverted = game.getSudoku().getGrid();
		expect(reverted[0][2]).toBe(0);
		expect(reverted[1][1]).toBe(0);

		// redo 应能恢复整段
		game.redo();
		const redone = game.getSudoku().getGrid();
		expect(redone[0][2]).toBe(4);
		expect(redone[1][1]).toBe(7);
	});

	it('commit 时无差异(未填任何数)不应入主栈', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.exitExplore('commit');

		expect(game.canUndo()).toBe(false);
	});

	it('explore 内独立的 undo/redo 不影响主栈', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 });
		game.guess({ row: 1, col: 1, value: 7 });
		game.undo();
		expect(game.getSudoku().getGrid()[1][1]).toBe(0);
		game.redo();
		expect(game.getSudoku().getGrid()[1][1]).toBe(7);

		game.exitExplore('abandon');
		expect(game.canUndo()).toBe(false); // 主栈空
	});
});
