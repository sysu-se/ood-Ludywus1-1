import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 review fix #4 - createGameFromJSON fail-fast', () => {
	it('null 输入抛 TypeError', async () => {
		const { createGameFromJSON } = await loadDomainApi();
		expect(() => createGameFromJSON(null)).toThrow(TypeError);
	});

	it('undefined 输入抛 TypeError', async () => {
		const { createGameFromJSON } = await loadDomainApi();
		expect(() => createGameFromJSON(undefined)).toThrow(TypeError);
	});

	it('非对象输入抛 TypeError', async () => {
		const { createGameFromJSON } = await loadDomainApi();
		expect(() => createGameFromJSON('not an object')).toThrow(TypeError);
		expect(() => createGameFromJSON(42)).toThrow(TypeError);
	});

	it('缺失 sudoku 字段抛 TypeError 而非静默创建空棋盘', async () => {
		const { createGameFromJSON } = await loadDomainApi();
		expect(() => createGameFromJSON({})).toThrow(/sudoku field/);
		expect(() => createGameFromJSON({ history: { past: [], future: [] } })).toThrow(/sudoku field/);
	});

	it('合法 JSON 仍然通过', async () => {
		const { createGame, createGameFromJSON, createSudoku } = await loadDomainApi();

		const game = createGame({ sudoku: createSudoku(makePuzzle()) });
		game.guess({ row: 0, col: 2, value: 4 });

		const restored = createGameFromJSON(JSON.parse(JSON.stringify(game.toJSON())));
		expect(restored.getSudoku().getGrid()[0][2]).toBe(4);
	});
});
