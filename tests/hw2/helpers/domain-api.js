import { expect } from 'vitest';

export async function loadDomainApi() {
	const mod = await import('../../../src/domain/index.js');

	expect(typeof mod.createSudoku).toBe('function');
	expect(typeof mod.createGame).toBe('function');

	return mod;
}

// 与 hw1/helpers 相同的经典题面
export function makePuzzle() {
	return [
		[5, 3, 0, 0, 7, 0, 0, 0, 0],
		[6, 0, 0, 1, 9, 5, 0, 0, 0],
		[0, 9, 8, 0, 0, 0, 0, 6, 0],
		[8, 0, 0, 0, 6, 0, 0, 0, 3],
		[4, 0, 0, 8, 0, 3, 0, 0, 1],
		[7, 0, 0, 0, 2, 0, 0, 0, 6],
		[0, 6, 0, 0, 0, 0, 2, 8, 0],
		[0, 0, 0, 4, 1, 9, 0, 0, 5],
		[0, 0, 0, 0, 8, 0, 0, 7, 9],
	];
}

// 一个几乎填满、剩 1 个 naked-single 的题面:第 (8,8) 格只能填 1
// 行 8: [9,8,7,6,5,4,3,2,?] 缺 1
// 列 8: [9,8,7,6,5,4,3,2,?] 缺 1
// 宫(6-8, 6-8): 3,2,9,1,4,5,2,3,? — 故意让多余冲突外格化
// 简化:用一个填满到只缺一个 naked-single 的局面
export function makeAlmostSolved() {
	return [
		[5, 3, 4, 6, 7, 8, 9, 1, 2],
		[6, 7, 2, 1, 9, 5, 3, 4, 8],
		[1, 9, 8, 3, 4, 2, 5, 6, 7],
		[8, 5, 9, 7, 6, 1, 4, 2, 3],
		[4, 2, 6, 8, 5, 3, 7, 9, 1],
		[7, 1, 3, 9, 2, 4, 8, 5, 6],
		[9, 6, 1, 5, 3, 7, 2, 8, 4],
		[2, 8, 7, 4, 1, 9, 6, 3, 5],
		[3, 4, 5, 2, 8, 6, 1, 7, 0],
	];
}
