import { describe, expect, it } from 'vitest';
import { loadDomainApi, makePuzzle } from './helpers/domain-api.js';

describe('HW2 review fix #1 - clue immutability', () => {
	it('createSudokuFromJSON 拒绝 currentGrid 篡改了固定格的 snapshot', async () => {
		const { createSudokuFromJSON } = await loadDomainApi();

		const initial = makePuzzle();
		// 故意把 (0,0)=5 这个固定格在 currentGrid 上改成 9
		const tampered = makePuzzle();
		tampered[0][0] = 9;

		expect(() =>
			createSudokuFromJSON({ initialGrid: initial, currentGrid: tampered }),
		).toThrow(/clue immutability/);
	});

	it('currentGrid 仅在空格上填值的 snapshot 通过', async () => {
		const { createSudokuFromJSON } = await loadDomainApi();

		const initial = makePuzzle();
		const filled = makePuzzle();
		filled[0][2] = 4; // (0,2) 原本是 0,填值合法

		const sudoku = createSudokuFromJSON({ initialGrid: initial, currentGrid: filled });
		expect(sudoku.getGrid()[0][2]).toBe(4);
		expect(sudoku.getGrid()[0][0]).toBe(5); // 固定格未变
	});

	it('toJSON round-trip 不会触发 clue 校验失败', async () => {
		const { createSudoku, createSudokuFromJSON } = await loadDomainApi();

		const sudoku = createSudoku(makePuzzle());
		sudoku.guess({ row: 0, col: 2, value: 4 });
		sudoku.guess({ row: 1, col: 1, value: 7 });

		// 合法 toJSON 输出反序列化必须仍能通过新增的 clue 校验
		const restored = createSudokuFromJSON(JSON.parse(JSON.stringify(sudoku.toJSON())));
		expect(restored.getGrid()).toEqual(sudoku.getGrid());
	});

	it('Sudoku.clone() 在固定格上不变,内部走 createSudoku 也满足校验', async () => {
		const { createSudoku } = await loadDomainApi();

		const sudoku = createSudoku(makePuzzle());
		sudoku.guess({ row: 0, col: 2, value: 4 });

		expect(() => sudoku.clone()).not.toThrow();
		expect(sudoku.clone().getGrid()[0][2]).toBe(4);
	});
});
