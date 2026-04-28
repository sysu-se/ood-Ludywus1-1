import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 explore - failed path memory', () => {
	it('explore 中产生冲突时 hasVisitedFailedState 立刻为 true', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		// makePuzzle 的 (0,0)=5 固定,但 (0,2) 是空格;故意填 5 与同行 (0,0) 冲突
		game.guess({ row: 0, col: 2, value: 5 });

		expect(game.getInvalidCells().length).toBeGreaterThan(0);
		expect(game.hasVisitedFailedState()).toBe(true);
	});

	it('abandon 后再次 explore 走到相同冲突局面时立刻提示', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		// 第一次:进入 explore,产生冲突,abandon
		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 5 });
		expect(game.hasVisitedFailedState()).toBe(true);
		game.exitExplore('abandon');

		// 主局面应没有冲突,且不算"失败状态"
		expect(game.hasVisitedFailedState()).toBe(false);

		// 第二次:再 enter,走到同样棋盘
		game.enterExplore();
		expect(game.hasVisitedFailedState()).toBe(false); // 入口与上次冲突局面不同
		game.guess({ row: 0, col: 2, value: 5 });
		expect(game.hasVisitedFailedState()).toBe(true);
	});

	it('failedFingerprints 跨多次 explore 持续累积', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 5 });
		game.exitExplore('abandon');

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 3 });  // 也冲突(同行有 3)
		game.exitExplore('abandon');

		// 至少 2 个不同的失败指纹
		const failed = game.getFailedFingerprints();
		expect(failed.length).toBeGreaterThanOrEqual(2);
	});

	it('正常的 explore(无冲突)abandon 不留下失败记忆', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 }); // 4 是合法候选
		expect(game.getInvalidCells()).toEqual([]);
		game.exitExplore('abandon');

		expect(game.getFailedFingerprints()).toEqual([]);
	});
});
