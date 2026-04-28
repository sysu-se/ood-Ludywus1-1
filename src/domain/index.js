// ====== 领域层:纯 JS,不依赖任何框架 ======
// HW1.1 基线 + HW2 扩展:候选数提示、嵌套子会话(Explore Mode)、失败路径记忆

const SUDOKU_SIZE = 9;
const BOX_SIZE = 3;

function normalizeCellValue(value) {
	const normalized = Number(value ?? 0);

	if (!Number.isInteger(normalized) || normalized < 0 || normalized > 9) {
		throw new TypeError('Sudoku cell values must be integers between 0 and 9');
	}

	return normalized;
}

function assertGridShape(grid, name = 'grid') {
	if (!Array.isArray(grid) || grid.length !== SUDOKU_SIZE) {
		throw new TypeError(`${name} must be a 9x9 grid`);
	}

	for (const row of grid) {
		if (!Array.isArray(row) || row.length !== SUDOKU_SIZE) {
			throw new TypeError(`${name} must be a 9x9 grid`);
		}
	}

	return grid;
}

function cloneGrid(grid) {
	assertGridShape(grid);
	return grid.map((row) => row.map((value) => normalizeCellValue(value)));
}

function createEmptyGrid() {
	return Array.from({ length: SUDOKU_SIZE }, () => Array(SUDOKU_SIZE).fill(0));
}

function normalizeIndex(index, name) {
	if (!Number.isInteger(index) || index < 0 || index >= SUDOKU_SIZE) {
		throw new TypeError(`${name} must be an integer between 0 and 8`);
	}

	return index;
}

function normalizeMove(move) {
	if (!move || typeof move !== 'object') {
		throw new TypeError('move must be an object');
	}

	return {
		row:   normalizeIndex(move.row, 'row'),
		col:   normalizeIndex(move.col, 'col'),
		value: normalizeCellValue(move.value),
	};
}

function normalizeSudokuInput(input) {
	if (Array.isArray(input)) {
		const grid = cloneGrid(input);
		return {
			initialGrid: grid,
			currentGrid: cloneGrid(grid),
		};
	}

	if (!input || typeof input !== 'object') {
		throw new TypeError('Sudoku input must be a 9x9 grid or a serialized snapshot');
	}

	const initialSource = Array.isArray(input.initialGrid) ? input.initialGrid : input.grid;
	const currentSource = Array.isArray(input.currentGrid) ? input.currentGrid : initialSource;

	if (!initialSource || !currentSource) {
		throw new TypeError('Serialized sudoku must include initialGrid/currentGrid or grid');
	}

	return {
		initialGrid: cloneGrid(initialSource),
		currentGrid: cloneGrid(currentSource),
	};
}

// 在一组单元格中找出重复数字,将冲突坐标加入 invalidKeys
function collectConflicts(cells, invalidKeys) {
	const grouped = new Map();

	for (const cell of cells) {
		if (cell.value === 0) continue;

		if (!grouped.has(cell.value)) {
			grouped.set(cell.value, []);
		}

		grouped.get(cell.value).push(cell);
	}

	for (const duplicates of grouped.values()) {
		if (duplicates.length < 2) continue;

		for (const duplicate of duplicates) {
			invalidKeys.add(`${duplicate.row},${duplicate.col}`);
		}
	}
}

function toCellList(cellKeys) {
	return Array.from(cellKeys, (key) => {
		const [row, col] = key.split(',').map(Number);
		return { row, col };
	});
}

function createFormattedBoard(grid) {
	const border = '+-------+-------+-------+';
	const lines = [border];

	for (let row = 0; row < SUDOKU_SIZE; row += 1) {
		const parts = [];

		for (let col = 0; col < SUDOKU_SIZE; col += 1) {
			if (col % BOX_SIZE === 0) {
				parts.push('|');
			}

			parts.push(grid[row][col] === 0 ? '.' : String(grid[row][col]));
		}

		parts.push('|');
		lines.push(parts.join(' '));

		if ((row + 1) % BOX_SIZE === 0) {
			lines.push(border);
		}
	}

	return lines.join('\n');
}

// HW2:候选数计算(纯函数,可独立测试)
// 扫描该格所在行/列/3×3 宫已经使用的数字,返回剩余合法候选
// 已填或固定格返回 []
function computeCandidates(grid, fixedCells, row, col) {
	if (fixedCells[row][col] || grid[row][col] !== 0) {
		return [];
	}

	const used = new Set();

	for (let i = 0; i < SUDOKU_SIZE; i += 1) {
		used.add(grid[row][i]);
		used.add(grid[i][col]);
	}

	const boxRow = Math.floor(row / BOX_SIZE) * BOX_SIZE;
	const boxCol = Math.floor(col / BOX_SIZE) * BOX_SIZE;

	for (let dr = 0; dr < BOX_SIZE; dr += 1) {
		for (let dc = 0; dc < BOX_SIZE; dc += 1) {
			used.add(grid[boxRow + dr][boxCol + dc]);
		}
	}

	const result = [];

	for (let value = 1; value <= 9; value += 1) {
		if (!used.has(value)) {
			result.push(value);
		}
	}

	return result;
}

// HW2:局面指纹(81 字符 0-9 串),供失败路径记忆使用
function gridFingerprint(grid) {
	let fp = '';

	for (let row = 0; row < SUDOKU_SIZE; row += 1) {
		for (let col = 0; col < SUDOKU_SIZE; col += 1) {
			fp += String(grid[row][col]);
		}
	}

	return fp;
}

// 历史记录条目深拷贝,格式:{type:'guess', row, col, before, after}
function cloneGuessTransition(entry) {
	if (!entry || typeof entry !== 'object') {
		throw new TypeError('History entry must be an object');
	}

	return {
		type:   'guess',
		row:    normalizeIndex(entry.row, 'row'),
		col:    normalizeIndex(entry.col, 'col'),
		before: normalizeCellValue(entry.before),
		after:  normalizeCellValue(entry.after),
	};
}

// HW2:复合 transition 深拷贝
// 一段 explore 期间的多步差异折叠为单条历史记录,主栈 undo 一次即可整段回退
function cloneExploreTransition(entry) {
	if (!Array.isArray(entry?.entries)) {
		throw new TypeError('Explore transition must have entries array');
	}

	return {
		type:    'explore',
		entries: entry.entries.map((e) => ({
			row:    normalizeIndex(e.row, 'row'),
			col:    normalizeIndex(e.col, 'col'),
			before: normalizeCellValue(e.before),
			after:  normalizeCellValue(e.after),
		})),
	};
}

// 通用 transition 克隆器,根据 type 字段分发
// 旧条目无 type 视为 'guess'(向后兼容旧序列化数据)
function cloneTransition(entry) {
	if (entry && entry.type === 'explore') {
		return cloneExploreTransition(entry);
	}
	return cloneGuessTransition(entry);
}

// 序列化时:'guess' 输出扁平结构(向后兼容,不带 type 字段);'explore' 输出 type + entries
function serializeTransition(entry) {
	if (entry && entry.type === 'explore') {
		return {
			type:    'explore',
			entries: entry.entries.map((e) => ({
				row:    e.row,
				col:    e.col,
				before: e.before,
				after:  e.after,
			})),
		};
	}
	return {
		row:    entry.row,
		col:    entry.col,
		before: entry.before,
		after:  entry.after,
	};
}

// ====== Sudoku 领域对象:持有题面 + 当前棋盘,提供填数、校验、序列化、HW2 候选数 ======
export function createSudoku(input) {
	const normalized = normalizeSudokuInput(input);
	const initialGrid = normalized.initialGrid;
	const currentGrid = normalized.currentGrid;
	const fixedCells = initialGrid.map((row) => row.map((value) => value !== 0));

	function isFixedCell(row, col) {
		normalizeIndex(row, 'row');
		normalizeIndex(col, 'col');
		return fixedCells[row][col];
	}

	function getCell(row, col) {
		normalizeIndex(row, 'row');
		normalizeIndex(col, 'col');
		return currentGrid[row][col];
	}

	// 分别按行、列、3×3 宫检查重复,返回所有冲突格的坐标列表
	function getInvalidCells() {
		const invalidKeys = new Set();

		for (let row = 0; row < SUDOKU_SIZE; row += 1) {
			collectConflicts(
				currentGrid[row].map((value, col) => ({ row, col, value })),
				invalidKeys,
			);
		}

		for (let col = 0; col < SUDOKU_SIZE; col += 1) {
			collectConflicts(
				currentGrid.map((row, rowIndex) => ({ row: rowIndex, col, value: row[col] })),
				invalidKeys,
			);
		}

		for (let boxRow = 0; boxRow < SUDOKU_SIZE; boxRow += BOX_SIZE) {
			for (let boxCol = 0; boxCol < SUDOKU_SIZE; boxCol += BOX_SIZE) {
				const boxCells = [];

				for (let row = boxRow; row < boxRow + BOX_SIZE; row += 1) {
					for (let col = boxCol; col < boxCol + BOX_SIZE; col += 1) {
						boxCells.push({ row, col, value: currentGrid[row][col] });
					}
				}

				collectConflicts(boxCells, invalidKeys);
			}
		}

		return toCellList(invalidKeys);
	}

	function isSolved() {
		for (let row = 0; row < SUDOKU_SIZE; row += 1) {
			for (let col = 0; col < SUDOKU_SIZE; col += 1) {
				if (currentGrid[row][col] === 0) {
					return false;
				}
			}
		}

		return getInvalidCells().length === 0;
	}

	// HW2:获取该格的合法候选数集合
	function getCandidates(row, col) {
		normalizeIndex(row, 'row');
		normalizeIndex(col, 'col');
		return computeCandidates(currentGrid, fixedCells, row, col);
	}

	// HW2:全盘候选数 9×9 二维数组,UI 可一次性消费
	function getAllCandidates() {
		const all = [];
		for (let row = 0; row < SUDOKU_SIZE; row += 1) {
			const rowCandidates = [];
			for (let col = 0; col < SUDOKU_SIZE; col += 1) {
				rowCandidates.push(computeCandidates(currentGrid, fixedCells, row, col));
			}
			all.push(rowCandidates);
		}
		return all;
	}

	// HW2:找全盘第一个 naked-single(只剩一个候选数的格)
	// 返回 {row, col, value, reason} 或 null
	function findNextDeducible() {
		for (let row = 0; row < SUDOKU_SIZE; row += 1) {
			for (let col = 0; col < SUDOKU_SIZE; col += 1) {
				if (currentGrid[row][col] !== 0 || fixedCells[row][col]) continue;

				const cands = computeCandidates(currentGrid, fixedCells, row, col);
				if (cands.length === 1) {
					return {
						row,
						col,
						value:  cands[0],
						reason: 'naked-single',
					};
				}
			}
		}
		return null;
	}

	// HW2:局面指纹,供失败记忆使用
	function fingerprint() {
		return gridFingerprint(currentGrid);
	}

	return {
		getGrid() {
			return cloneGrid(currentGrid);
		},

		getInitialGrid() {
			return cloneGrid(initialGrid);
		},

		getCell,

		isFixedCell,

		getInvalidCells,

		isSolved,

		// HW2 新增
		getCandidates,
		getAllCandidates,
		findNextDeducible,
		fingerprint,

		guess(move) {
			const normalizedMove = normalizeMove(move);

			if (isFixedCell(normalizedMove.row, normalizedMove.col)) {
				return false;
			}

			currentGrid[normalizedMove.row][normalizedMove.col] = normalizedMove.value;
			return true;
		},

		clone() {
			return createSudoku({
				initialGrid,
				currentGrid,
			});
		},

		toJSON() {
			return {
				initialGrid: cloneGrid(initialGrid),
				currentGrid: cloneGrid(currentGrid),
			};
		},

		toString() {
			return createFormattedBoard(currentGrid);
		},
	};
}

export function createSudokuFromJSON(json) {
	return createSudoku(json);
}

// ====== Game 领域对象:包裹 Sudoku,管理撤销/重做历史栈,HW2 引入嵌套子会话与失败记忆 ======
function buildGame({ sudoku, past = [], future = [], failed = [], explore = null }) {
	const pastTransitions = past.map(cloneTransition);
	const futureTransitions = future.map(cloneTransition);
	const failedFingerprints = new Set(failed);

	// HW2:嵌套子会话状态。null 表示主局面,非 null 表示正在探索
	let exploreSession = null;
	let exploreOrigin = null;

	// 应用复合 explore transition:依次以 entries 中的 value 落子(undo 用 before,redo 用 after)
	function applyExploreEntries(entries, useBefore) {
		for (const entry of entries) {
			sudoku.guess({
				row:   entry.row,
				col:   entry.col,
				value: useBefore ? entry.before : entry.after,
			});
		}
	}

	// 主局面 undo:根据 transition 的 type 分发
	function undoMain() {
		if (pastTransitions.length === 0) {
			return false;
		}

		const transition = pastTransitions.pop();

		if (transition.type === 'explore') {
			// 反向遍历 entries,把每格回到 before
			for (let i = transition.entries.length - 1; i >= 0; i -= 1) {
				const e = transition.entries[i];
				sudoku.guess({ row: e.row, col: e.col, value: e.before });
			}
		} else {
			sudoku.guess({
				row:   transition.row,
				col:   transition.col,
				value: transition.before,
			});
		}

		futureTransitions.push(transition);
		return true;
	}

	// 主局面 redo
	function redoMain() {
		if (futureTransitions.length === 0) {
			return false;
		}

		const transition = futureTransitions.pop();

		if (transition.type === 'explore') {
			applyExploreEntries(transition.entries, false);
		} else {
			sudoku.guess({
				row:   transition.row,
				col:   transition.col,
				value: transition.after,
			});
		}

		pastTransitions.push(transition);
		return true;
	}

	const api = {
		// 返回防御性副本,外部无法通过它修改内部状态
		// HW2:explore 期间返回子会话的 Sudoku 副本,UI 看到的是探索局面
		getSudoku() {
			return exploreSession ? exploreSession.getSudoku() : sudoku.clone();
		},

		// 只读查询——Game 作为 facade 代理 Sudoku 的读取接口,
		// adapter 层优先使用这些方法,避免不必要的 clone 开销
		// HW2:explore 期间所有读操作都路由到子会话,UI 看到的就是子局面
		getGrid() {
			return exploreSession ? exploreSession.getGrid() : sudoku.getGrid();
		},
		getInitialGrid() { return sudoku.getInitialGrid(); },
		getCell(row, col) {
			return exploreSession ? exploreSession.getCell(row, col) : sudoku.getCell(row, col);
		},
		isFixedCell(r, c) { return sudoku.isFixedCell(r, c); },
		getInvalidCells() {
			return exploreSession ? exploreSession.getInvalidCells() : sudoku.getInvalidCells();
		},
		isSolved() {
			return exploreSession ? exploreSession.isSolved() : sudoku.isSolved();
		},

		// HW2 facade:Hint 只读数据由 Sudoku 提供;explore 中读子会话
		getCandidates(row, col) {
			return exploreSession
				? exploreSession.getCandidates(row, col)
				: sudoku.getCandidates(row, col);
		},
		getAllCandidates() {
			return exploreSession
				? exploreSession.getAllCandidates()
				: sudoku.getAllCandidates();
		},
		getNextHint() {
			return exploreSession
				? exploreSession.getNextHint()
				: sudoku.findNextDeducible();
		},

		// HW2 动作:applyHint 是写操作,必须经过 history(主或子)
		// 不传 position → 使用 findNextDeducible 自动推定
		// 传 position → 仅用候选数推定该格(若该格只有一个候选则填入,否则失败)
		applyHint(position) {
			if (exploreSession) {
				return exploreSession.applyHint(position);
			}

			let move;
			if (position) {
				const row = normalizeIndex(position.row, 'row');
				const col = normalizeIndex(position.col, 'col');
				const cands = sudoku.getCandidates(row, col);
				if (cands.length !== 1) {
					return null;
				}
				move = { row, col, value: cands[0] };
			} else {
				const next = sudoku.findNextDeducible();
				if (!next) return null;
				move = { row: next.row, col: next.col, value: next.value };
			}

			const ok = api.guess(move);
			return ok ? move : null;
		},

		guess(move) {
			// HW2:explore 期间委托子会话,所有 guess 进入子栈,不影响主栈
			if (exploreSession) {
				const ok = exploreSession.guess(move);
				// 子局面发生冲突时记录失败指纹,供"已访问失败路径"检测
				if (ok && exploreSession.getInvalidCells().length > 0) {
					failedFingerprints.add(exploreSession.getSudoku().fingerprint());
				}
				return ok;
			}

			const normalizedMove = normalizeMove(move);
			const before = sudoku.getCell(normalizedMove.row, normalizedMove.col);

			if (before === normalizedMove.value) {
				return false;
			}

			const applied = sudoku.guess(normalizedMove);
			if (!applied) {
				return false;
			}

			pastTransitions.push({
				type:   'guess',
				row:    normalizedMove.row,
				col:    normalizedMove.col,
				before,
				after:  normalizedMove.value,
			});
			futureTransitions.length = 0;
			return true;
		},

		undo() {
			return exploreSession ? exploreSession.undo() : undoMain();
		},

		redo() {
			return exploreSession ? exploreSession.redo() : redoMain();
		},

		canUndo() {
			return exploreSession ? exploreSession.canUndo() : pastTransitions.length > 0;
		},

		canRedo() {
			return exploreSession ? exploreSession.canRedo() : futureTransitions.length > 0;
		},

		// ====== HW2:Explore Mode ======

		isExploring() {
			return exploreSession !== null;
		},

		// 进入探索:深拷贝当前主局面为子 Sudoku,创建独立子 Game
		// 主局面与探索局面是复制关系(无引用共享);子 Game 拥有独立的撤销/重做栈
		enterExplore() {
			if (exploreSession) return false;

			const childSudoku = sudoku.clone();
			exploreOrigin = {
				originGrid:        sudoku.getGrid(),
				fingerprintAtEntry: sudoku.fingerprint(),
			};
			exploreSession = buildGame({ sudoku: childSudoku });
			return true;
		},

		// 重置到探索起点:保留在 explore 中,但子局面回到 enter 时的状态(加分项)
		resetExplore() {
			if (!exploreSession) return false;

			const childSudoku = createSudoku({
				initialGrid: sudoku.getInitialGrid(),
				currentGrid: exploreOrigin.originGrid,
			});
			exploreSession = buildGame({ sudoku: childSudoku });
			return true;
		},

		// 退出探索:'commit' 把子局面差异折叠为复合 transition 入主栈,'abandon' 直接丢弃
		exitExplore(action) {
			if (!exploreSession) return false;
			if (action !== 'commit' && action !== 'abandon') {
				throw new TypeError('exitExplore action must be "commit" or "abandon"');
			}

			if (action === 'commit') {
				// 计算主局面与子局面差异(只包含非 fixed 格);对每个差异在主 sudoku 上落子
				const childGrid = exploreSession.getSudoku().getGrid();
				const entries = [];

				for (let row = 0; row < SUDOKU_SIZE; row += 1) {
					for (let col = 0; col < SUDOKU_SIZE; col += 1) {
						if (sudoku.isFixedCell(row, col)) continue;

						const before = sudoku.getCell(row, col);
						const after = childGrid[row][col];

						if (before === after) continue;

						sudoku.guess({ row, col, value: after });
						entries.push({ row, col, before, after });
					}
				}

				if (entries.length > 0) {
					pastTransitions.push({ type: 'explore', entries });
					futureTransitions.length = 0;
				}
			} else {
				// abandon:若子局面当下有冲突,把子局面指纹加入失败记忆
				if (exploreSession.getInvalidCells().length > 0) {
					failedFingerprints.add(exploreSession.getSudoku().fingerprint());
				}
			}

			exploreSession = null;
			exploreOrigin = null;
			return true;
		},

		// 查询当前(主或 explore)局面是否落在已知失败路径上
		hasVisitedFailedState() {
			const fp = exploreSession
				? exploreSession.getSudoku().fingerprint()
				: sudoku.fingerprint();
			return failedFingerprints.has(fp);
		},

		getFailedFingerprints() {
			return Array.from(failedFingerprints);
		},

		toJSON() {
			const json = {
				sudoku: sudoku.toJSON(),
				history: {
					past:   pastTransitions.map(serializeTransition),
					future: futureTransitions.map(serializeTransition),
				},
			};

			// 仅在有失败记录时输出 failed 字段,旧 JSON 保持纯净
			if (failedFingerprints.size > 0) {
				json.failed = Array.from(failedFingerprints);
			}

			// 仅在探索中输出 explore 字段
			if (exploreSession) {
				json.explore = {
					origin: {
						originGrid: exploreOrigin.originGrid.map((r) => r.slice()),
					},
					child:  exploreSession.toJSON(),
				};
			}

			return json;
		},
	};

	// 反序列化 explore 状态(若提供)
	if (explore) {
		const childSudoku = createSudokuFromJSON(explore.child?.sudoku ?? createEmptyGrid());
		exploreOrigin = {
			originGrid:        cloneGrid(explore.origin?.originGrid ?? sudoku.getGrid()),
			fingerprintAtEntry: gridFingerprint(explore.origin?.originGrid ?? sudoku.getGrid()),
		};
		exploreSession = buildGame({
			sudoku:  childSudoku,
			past:    explore.child?.history?.past ?? [],
			future:  explore.child?.history?.future ?? [],
			failed:  [],
		});
	}

	return api;
}

export function createGame({ sudoku }) {
	if (!sudoku || typeof sudoku.clone !== 'function') {
		throw new TypeError('createGame expects a Sudoku-like object');
	}

	return buildGame({
		sudoku: sudoku.clone(),
	});
}

export function createGameFromJSON(json) {
	const sudoku = createSudokuFromJSON(json?.sudoku ?? { initialGrid: createEmptyGrid(), currentGrid: createEmptyGrid() });
	const past = json?.history?.past ?? [];
	const future = json?.history?.future ?? [];
	const failed = json?.failed ?? [];
	const explore = json?.explore ?? null;

	return buildGame({
		sudoku,
		past,
		future,
		failed,
		explore,
	});
}
