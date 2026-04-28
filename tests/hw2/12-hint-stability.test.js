import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

// F2 是 session 层修复——直接断言 session.applyHint 的稳定性
// 通过动态加载 session 模块来测试(它依赖 svelte/store)
async function loadSession() {
	const mod = await import('../../src/node_modules/@sudoku/stores/session.js');
	return mod;
}

describe('HW2 review fix #2 - hint stability based on initialGrid', () => {
	it('用户在某格填错值后,对另一空格的 Hint 仍返回正确解', async () => {
		const { gameSession } = await loadSession();

		gameSession.loadPuzzle(makePuzzle());

		// (0,2) 是空格,合法候选 [1,2,4]。故意填一个非正解的值(2 不与同行 5,3,7 冲突,但不是题面的解)
		// makePuzzle 经典题的正解 (0,2)=4
		gameSession.guess({ row: 0, col: 2, value: 2 });

		// 现在对另一个空格 (1,1)(题面 0,正解 7) 求 Hint
		// 如果实现还用 game.getGrid() 求解,可能因 (0,2)=2 把局面拖入无解(因为正解 (1,1)=7 与 (0,2)=2 是兼容的,但 solver 可能依然找到解)
		// 关键:即便用户局面变成无解,基于 initialGrid 求解必然成功
		const ok = gameSession.applyHint({ row: 1, col: 1 });
		expect(ok).toBe(true);

		// (1,1) 应该被填入正解 7
		// 注意 gameSession 内部状态需要订阅快照
		let snapshot;
		gameSession.subscribe((s) => { snapshot = s; })();
		expect(snapshot.userGrid[1][1]).toBe(7);
	});

	it('故意把题面拖入无解(同行重复填),Hint 仍能基于初始题面给出正解', async () => {
		const { gameSession } = await loadSession();

		gameSession.loadPuzzle(makePuzzle());

		// 在 (0,2) 和 (0,3) 同行填两个相同的数字(2,2),让局面冲突
		gameSession.guess({ row: 0, col: 2, value: 2 });
		gameSession.guess({ row: 0, col: 3, value: 2 });

		// 此时 game.getGrid() 是有冲突的局面,但 game.getInitialGrid() 仍是合法题面
		// 对 (1,1) 求 Hint 必须基于 initialGrid 才能稳定返回 7
		const ok = gameSession.applyHint({ row: 1, col: 1 });
		expect(ok).toBe(true);

		let snapshot;
		gameSession.subscribe((s) => { snapshot = s; })();
		expect(snapshot.userGrid[1][1]).toBe(7);
	});
});
