import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 加分项 #1 - tree-shaped nested explore', () => {
	it('enterExplore 在已有 explore 中再调用形成嵌套', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		expect(game.getExploreDepth()).toBe(0);

		game.enterExplore();
		expect(game.getExploreDepth()).toBe(1);

		game.enterExplore();
		expect(game.getExploreDepth()).toBe(2);

		game.enterExplore();
		expect(game.getExploreDepth()).toBe(3);
	});

	it('嵌套深处的 guess 不影响上层局面', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		// 主局面填 (0,2)=4
		game.guess({ row: 0, col: 2, value: 4 });
		const mainGridBefore = game.getSudoku().getGrid();

		// 进入第一层 explore,在 (1,1) 填 7
		game.enterExplore();
		game.guess({ row: 1, col: 1, value: 7 });

		// 进入第二层 explore,在 (2,0) 填 1(在第二层局面上)
		game.enterExplore();
		game.guess({ row: 2, col: 0, value: 1 });

		// 此时 game.getSudoku() 看到第二层(最深)局面:三处全部填了
		const deepest = game.getSudoku().getGrid();
		expect(deepest[0][2]).toBe(4);
		expect(deepest[1][1]).toBe(7);
		expect(deepest[2][0]).toBe(1);

		// 放弃最深一层 → 深度 1,(2,0) 应消失,但 (1,1)=7 仍保留
		game.exitExplore('abandon');
		expect(game.getExploreDepth()).toBe(1);
		const layer1 = game.getSudoku().getGrid();
		expect(layer1[0][2]).toBe(4);
		expect(layer1[1][1]).toBe(7);
		expect(layer1[2][0]).toBe(0);

		// 再放弃一层 → 回主局面,(1,1) 也消失
		game.exitExplore('abandon');
		expect(game.getExploreDepth()).toBe(0);
		const main = game.getSudoku().getGrid();
		expect(main).toEqual(mainGridBefore);
	});

	it('最深层 commit 把变化写到它的父层(不直接到主)', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();          // 层 1
		game.enterExplore();          // 层 2
		game.guess({ row: 0, col: 2, value: 4 }); // 在层 2 填值

		// 在层 2 commit → 变化写到层 1,深度 1
		game.exitExplore('commit');
		expect(game.getExploreDepth()).toBe(1);

		// 此时 game.getSudoku() 看到层 1,(0,2) 应该已经是 4
		expect(game.getSudoku().getGrid()[0][2]).toBe(4);

		// 但主局面应该还没变(层 1 还没 commit)
		// 通过再 abandon 回到主验证
		game.exitExplore('abandon');
		expect(game.getExploreDepth()).toBe(0);
		// 主局面 (0,2) 仍是 0(从未在主层填过)
		expect(game.getSudoku().getGrid()[0][2]).toBe(0);
	});

	it('两次 commit 把变化逐层传递到主局面', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 });

		// 层 2 commit → 层 1
		game.exitExplore('commit');
		// 层 1 commit → 主
		game.exitExplore('commit');

		expect(game.getExploreDepth()).toBe(0);
		expect(game.getSudoku().getGrid()[0][2]).toBe(4);

		// 主栈应该有 1 条复合 transition(层 1 commit 时入栈)
		expect(game.canUndo()).toBe(true);
		game.undo();
		expect(game.getSudoku().getGrid()[0][2]).toBe(0);
	});

	it('嵌套时 undo/redo 只影响最深层 history', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 }); // 进入层 1 history

		game.enterExplore();
		game.guess({ row: 1, col: 1, value: 7 }); // 进入层 2 history

		// 此时最深层(层 2)可 undo;undo 应只动层 2
		expect(game.canUndo()).toBe(true);
		game.undo();
		expect(game.getSudoku().getGrid()[1][1]).toBe(0); // 层 2 撤销
		expect(game.getSudoku().getGrid()[0][2]).toBe(4); // 层 1 不动

		// 在层 2 没有更多可 undo 时,canUndo 为 false(不会跨层 undo 到层 1)
		expect(game.canUndo()).toBe(false);
	});

	it('resetExplore 在嵌套时只重置最深层', async () => {
		const { createGame, createSudoku } = await loadDomainApi();
		const game = createGame({ sudoku: createSudoku(makePuzzle()) });

		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 });

		game.enterExplore();
		game.guess({ row: 1, col: 1, value: 7 });

		game.resetExplore();
		// 最深层重置 → (1,1) 消失,但仍在 explore(深度仍 2)
		expect(game.getExploreDepth()).toBe(2);
		expect(game.getSudoku().getGrid()[1][1]).toBe(0);
		// 层 1 的 (0,2)=4 仍保留(从主层进入层 1 时拷贝过来,层 2 重置回到层 1 起点)
		expect(game.getSudoku().getGrid()[0][2]).toBe(4);
	});
});
