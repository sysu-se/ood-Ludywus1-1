# EVOLUTION.md

---

## 1. 你如何实现提示功能?

提示分两个原语,都建立在领域对象的纯函数之上:

**候选数提示**(`Sudoku.getCandidates(row, col)`,`src/domain/index.js:144-173`):扫描该格所在行/列/3×3 宫已经使用的数字,返回剩余的合法候选。空格返回数组,固定格或已填格返回 `[]`。底层算法是 `computeCandidates`,与 `getInvalidCells` 共用同一套行/列/宫枚举模式。

**下一步提示**(`Sudoku.findNextDeducible()`,`src/domain/index.js:303-321`):遍历整个棋盘找第一个 naked-single(只剩一个候选数的格),返回 `{row, col, value, reason: 'naked-single'}` 或 `null`。

`Game` 通过 facade 转发这两个只读方法,并新增写操作 `Game.applyHint(position?)`(`src/domain/index.js:467-491`):

不传 position → 调用 `findNextDeducible` 自动找一个 naked-single 落子并入主栈

传 position → 仅在该格只有 1 个候选时落子,否则返回 `null`(此时由上层 session 决定是否回退到外部求解器)

UI 上 Hint 按钮(`src/components/Controls/ActionBar/Actions.svelte:14-22`)走 `userGrid.applyHint($cursor)` → `gameSession.applyHint(pos)`(`src/node_modules/@sudoku/stores/session.js:90-111`)。session 内部先尝试领域层 hint(纯推理,不依赖求解器),失败时回退到 `solveSudoku` 求解器,无论哪条路都最终走 `Game.guess` 入主栈。这样 Hint 也是可被 Undo 撤销的一步。

## 2. 你认为提示功能更属于 Sudoku 还是 Game?为什么?

数据在 Sudoku,动作在 Game,两者协作。

候选数计算是"对当前 grid 的纯函数",与"是否赢了"、"哪些格冲突"是同一类问题——它们的输入都是当前局面(grid + fixedCells),输出都是无副作用的查询结果。把它放在 `Sudoku` 满足 SRP:`Sudoku` 已经是局面规则的中心,候选数也是规则的派生信息,放在一起复用同一套行/列/宫扫描代码。

但"使用一次提示并能撤销"是会话层的事件:它必须写入 history,必须可被 `undo()` 回退,必须扣 hint 计数。这些只有 `Game` 能感知。所以 `applyHint` 是 `Game` 的写操作。

如果把候选数也塞进 `Game`,`Game` 就变成"领域规则 + 会话状态"两件事——这正是 HW1 中要避免的耦合。如果反过来把 `applyHint` 也塞进 `Sudoku`,`Sudoku` 就要直接操作 `pastTransitions`,变成"局面 + 历史"两件事,等价于把 `Game` 拆解。

`Sudoku.getCandidates` / `findNextDeducible` 是数据,`Game.applyHint` 是动作。`Game.getCandidates` / `getNextHint` 仅作为 facade 转发,不重复实现。

---

## 3. 你如何实现探索模式?

**嵌套子会话**:进入 explore 时 `Sudoku.clone()` 形成深拷贝子局面,创建一个独立的子 `Game` 持有它(`src/domain/index.js:592-602`)。父 `Game` 的字段 `exploreSession` 持有这个子 Game。

```js
function enterExplore() {
    if (exploreSession) return false;
    const childSudoku = sudoku.clone();
    exploreOrigin = { originGrid: sudoku.getGrid(), ... };
    exploreSession = buildGame({ sudoku: childSudoku });
    return true;
}
```

进入后,父 Game 的所有写操作(`guess` / `undo` / `redo`)与读操作(`getGrid` / `getCandidates` / `getInvalidCells` / `isSolved`)都检查 `exploreSession`,若不为 null 则委托给它(`src/domain/index.js:417-462`,`501-527`)。子 Game 拥有自己独立的 `pastTransitions` / `futureTransitions`,完全不影响主栈。

退出 explore 有两种方式:

**commit**(`src/domain/index.js:618-637`):遍历主局面与子局面差异(只算非 fixed 格),对每个差异在主 Sudoku 上落子,然后把所有差异折叠为一条 `{type: 'explore', entries: [...]}` 复合 transition 入主栈。

**abandon**(`src/domain/index.js:638-643`):若子局面当下有冲突,把子局面 fingerprint 加入 `failedFingerprints`;直接丢弃 `exploreSession`,主局面零变化。

**重置探索**(`resetExplore`,加分项):保留在 explore 中,但子局面回到 enter 时的 `exploreOrigin.originGrid`,子栈清空——等价于"重新选另一候选"。

---

## 4. 主局面与探索局面的关系是什么?

**复制关系,深拷贝,无引用共享。**

进入 explore 时调用 `sudoku.clone()`(`src/domain/index.js:382-387`),这个方法已经在 HW1.1 实现为完全独立的副本——内部 `currentGrid` / `initialGrid` / `fixedCells` 都是新数组。所以子 Sudoku 与主 Sudoku 之间没有任何共享内存,主局面在 explore 期间永远不会被无意修改。

提交时(`exitExplore('commit')`):

遍历两个局面的所有非 fixed 格

找到 `before !== after` 的位置

对每条差异调用主 `sudoku.guess({row, col, value: after})`(逐个修改主局面)

把全部差异打包成单条复合 transition `{type:'explore', entries:[...]}`,push 到主 `pastTransitions`,清空 `futureTransitions`

放弃时(`exitExplore('abandon')`):

若子局面有冲突,把子局面 fingerprint 加入失败记忆集合(详见 Q5/Q6)

把 `exploreSession` 与 `exploreOrigin` 设为 null

主局面零变化(从未被写过)

无深拷贝问题——HW1.1 的 `Sudoku.clone()` 已经过 `tests/hw1/03-clone.test.js` 验证。这次我也加了 `tests/hw2/08-explore-basic.test.js > explore 期间 guess 不进入主栈` 来验证子步丢弃后主局面干净。

---

## 5. 你的 history 结构在本次作业中是否发生了变化?

**仍是线性栈,但条目从原子结构升级为判别联合(sum type),且 explore 期间存在两层独立的栈。**

HW1.1 的 transition 是 `{row, col, before, after}` 单一结构。HW2 升级为:

`{type: 'guess', row, col, before, after}`(单步落子,等同 HW1.1)

`{type: 'explore', entries: [{row, col, before, after}, ...]}`(一段 explore 折叠后的复合操作)

`undoMain` / `redoMain`(`src/domain/index.js:380-415`)按 `transition.type` 分发:

`'guess'`:走原 HW1.1 路径,sudoku.guess(before) / sudoku.guess(after)

`'explore'`:反向遍历 `entries`,逐格回到 before / after

这样主栈一次 `undo` 就能整段撤销 explore——语义上把"一次探索决策"看作一个原子事务,符合用户心智(用户花 5 分钟探索后 commit,他撤销时期望"撤销那段探索",不是"撤销最后一格")。

**向后兼容**:旧 JSON(只有 `{row,col,before,after}`)在 `cloneTransition` 中被识别为 `'guess'`(`src/domain/index.js:200-205`),`tests/hw1/04` 与 `05` 全部仍通过。`serializeTransition` 输出旧 'guess' 时不带 `type` 字段(`src/domain/index.js:223-241`),保持 hw1 fixture 干净。

**两层栈**:explore 期间,父 Game 的栈不动,子 Game 在 `exploreSession` 内部用自己的栈处理子步的 guess/undo/redo。这是天然隔离——父子是不同的 buildGame 闭包,各自的栈互不可见。`tests/hw2/08 > explore 内独立的 undo/redo 不影响主栈` 验证了这一点。

---

## 6. Homework 1 中的哪些设计,在 Homework 2 中暴露出了局限?

**1. `guess` 没有"事务/批量"语义,导致 commit 必须靠应用层折叠差异。**

HW1.1 里 `guess` 是一次单格写入,直接 push 一条 transition。HW2 的 commit 需要把"一段 explore 中的多格写入"作为整体原子地入栈,我只能在 `exitExplore('commit')` 里手动遍历两个 grid 的差异,逐格 `sudoku.guess` 然后整体 push。这是个临时拼接——如果 HW1 一开始就把 guess 抽象成 `Command`/`Transaction` 概念,commit 就是自然的"提交一个 transaction"。

**2. transition 是裸对象,扩展 type 字段需要兜底兼容。**

HW1.1 的 transition 没有 type 字段。HW2 升级到判别联合后,所有处理 transition 的代码(`cloneTransition` / `serializeTransition` / `undoMain` / `redoMain`)都要做 type 分发。旧 JSON 的反序列化也要兜底——把无 type 的当 'guess'。如果 HW1 一开始就有 `{type, ...}` 框架,后续扩展是无痛的。

**3. `Sudoku` 不知道"会话派生概念",导致 Hint 写在哪一层是临时决策。**

候选数计算放 Sudoku 是合理的,但"应用 hint 并入栈"是会话事件——它跨了 Sudoku 与 Game 的边界。我的方案是 Sudoku 提供数据 + Game 提供动作,但这种"数据 / 动作分层"的设计模式在 HW1.1 里没有显性出现(只有 `getInvalidCells` 等数据查询,没有"用查询结果驱动动作"的合作模式)。HW2 是第一次引入这种协作。

**4. `getSudoku()` 返回的 clone 与 explore 路由的耦合。**

HW1.1 里 `getSudoku()` 直接返回 `sudoku.clone()`。HW2 引入子会话后,需要让 `getSudoku()` 在 explore 期间返回子 Sudoku 的 clone,否则 UI 永远看不到探索局面(实测发现这个 bug,导致 `tests/hw2/08` 与 `10` 失败,见调试记录)。这暴露了 HW1.1 的 facade 代理没有为"嵌套局面"做好准备——所有读方法都默认 `sudoku` 是唯一的。HW2 的 fix 是给 `getSudoku/getGrid/getCell/getInvalidCells/isSolved` 都加 explore 路由分支,代码有点重复。

**5. Snapshot 字段是单层 plain object,新增字段(如 `nextHint` / `failedHere`)只能继续往上堆。**

HW1.1 的 snapshot 是 6 个字段:`baseGrid, userGrid, invalidCells, canUndo, canRedo, won`。HW2 加了 `isExploring, failedHere, nextHint`,变 9 个。如果继续加新功能(协作、回放、AI 求解器结果),snapshot 会持续膨胀。一种更可扩展的设计是按特性分组:`{game: {...}, hint: {...}, explore: {...}}`,但这次为了改动最小没有动它。

---

## 7. 如果重做一次 Homework 1,你会如何修改原设计?

**1. 引入 Command/Transaction 模式统一 history**

`Game.guess`、`Game.applyHint`、`Game.exitExplore('commit')` 三种入栈操作有相同骨架:"应用变化 → 记录可逆事件 → 清空 redo"。如果一开始就有 `interface Command { apply(); revert(); }` 抽象,history 就是 `Command[]`,undo 就是 `cmd.revert()`,redo 就是 `cmd.apply()`,所有具体操作只需实现这两个钩子。复合 transition 不需要特殊处理——它就是 `CompositeCommand`(组合模式)。

**2. transition 一开始就是判别联合**

`{type: '...', payload: {...}}`,即使 HW1.1 只有一个 type='guess',也留好框架。后续加 'explore'、'hint'、'reset' 都是无破坏的添加。

**3. `Game` 暴露 `subscribe(observer)`,session.js 不再手工 publish**

HW1.1 的 session.js 在每次 guess/undo/redo 后手工调 `publish()`。HW2 的 explore/Hint API 也都重复这个模式(可以看 `src/node_modules/@sudoku/stores/session.js:42-87` 的 if-publish 模式)。如果 `Game` 内部用观察者模式,每次状态变化主动通知订阅者,session.js 就能简化为"订阅 Game,把通知翻译成 snapshot.set"。这也避免漏调 publish 导致 UI 不刷新。

**4. `Sudoku` 内部缓存候选数 map**

候选数是 grid 的纯函数,每次调 `getCandidates(r, c)` 都重新扫描行/列/宫,Board 里 81 格全开候选数显示时一次渲染要算 81 × 9 次。可以在 `Sudoku` 内部维护一个候选数缓存,在 `guess` 时增量失效相关行/列/宫。HW2 没做是因为题面只有 9×9,性能不是瓶颈。

**5. snapshot 按特性分组,而不是平摊字段**

`{game: {grid, baseGrid, won, ...}, hint: {nextHint, candidatesAvailable}, explore: {isExploring, failedHere, originGrid}}`。新功能加新分组,旧组件只读自己关心的分组,变化 propagation 更可控。

**6. `exploreOrigin` 与 `failedFingerprints` 这种"会话级元数据"应该是单独的对象**

现在它们是 `buildGame` 闭包里的局部变量,序列化要手工拼装。如果有一个 `SessionMetadata` 子对象,它自己负责 toJSON/fromJSON,Game 只是聚合它,扩展会更清楚。
