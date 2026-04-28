import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 explore - serialization round-trip', () => {
	it('包含 explore 复合 transition 的主栈可序列化往返', async () => {
		const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 });
		game.guess({ row: 1, col: 1, value: 7 });
		game.exitExplore('commit');

		const json = JSON.parse(JSON.stringify(game.toJSON()));
		const restored = createGameFromJSON(json);

		expect(restored.getSudoku().getGrid()[0][2]).toBe(4);
		expect(restored.getSudoku().getGrid()[1][1]).toBe(7);

		// 复合 undo 仍然一次撤销整段
		expect(restored.canUndo()).toBe(true);
		restored.undo();
		expect(restored.getSudoku().getGrid()[0][2]).toBe(0);
		expect(restored.getSudoku().getGrid()[1][1]).toBe(0);
	});

	it('failedFingerprints 持久化', async () => {
		const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 5 });
		game.exitExplore('abandon');

		const failedBefore = game.getFailedFingerprints();
		expect(failedBefore.length).toBeGreaterThan(0);

		const json = JSON.parse(JSON.stringify(game.toJSON()));
		const restored = createGameFromJSON(json);

		expect(restored.getFailedFingerprints()).toEqual(failedBefore);
	});

	it('正在探索中的 game 序列化可恢复 explore 状态', async () => {
		const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.guess({ row: 0, col: 2, value: 4 }); // 主步
		game.enterExplore();
		game.guess({ row: 1, col: 1, value: 7 }); // 子步

		const json = JSON.parse(JSON.stringify(game.toJSON()));
		const restored = createGameFromJSON(json);

		expect(restored.isExploring()).toBe(true);
		// 恢复后应看到子局面的状态
		expect(restored.getSudoku().getGrid()[1][1]).toBe(7);

		// abandon 后回到主局面,主步保留
		restored.exitExplore('abandon');
		expect(restored.isExploring()).toBe(false);
		expect(restored.getSudoku().getGrid()[0][2]).toBe(4);
		expect(restored.getSudoku().getGrid()[1][1]).toBe(0);
	});

	it('旧格式 JSON(history 条目无 type 字段)向后兼容', async () => {
		const { createGameFromJSON } = await loadDomainApi();

		const oldJson = {
			sudoku: {
				initialGrid: makePuzzle(),
				currentGrid: (() => {
					const g = makePuzzle();
					g[0][2] = 4;
					return g;
				})(),
			},
			history: {
				past:   [{ row: 0, col: 2, before: 0, after: 4 }],
				future: [],
			},
		};

		const restored = createGameFromJSON(oldJson);
		expect(restored.getSudoku().getGrid()[0][2]).toBe(4);
		expect(restored.canUndo()).toBe(true);

		restored.undo();
		expect(restored.getSudoku().getGrid()[0][2]).toBe(0);
	});
});
