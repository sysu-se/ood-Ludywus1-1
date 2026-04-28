[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/y6xxJB6y)
# [sudoku](https://sudoku.jonasgeiler.com)

This is a very simple sudoku game built with Svelte and TailwindCSS.

Have fun! 😉

---

## HW2 演进:Hint 与 Explore Mode

本作业在 HW1.1 已完成的领域对象(`Sudoku` / `Game`)与 store adapter 之上,新增两个能力:

### Hint(提示)
- **候选数提示**:`Sudoku.getCandidates(row, col)` 给出某格合法候选数。Settings 中的 "Show candidates in empty cells" 开关打开后,UI 在所有空格内显示候选数小字。
- **下一步推定**:`Sudoku.findNextDeducible()` 找全盘第一个 naked-single(只剩一个候选的格)。`Game.applyHint(position?)` 包装为"求解 + 落子 + 入栈",可被 Undo 撤销。

### Explore Mode(探索模式)
通过 ActionBar 的放大镜图标进入。进入后:
- 顶部出现黄色 Banner 提示当前处于探索中
- 棋盘加金色描边,按钮组切换为 [Commit] [Abandon] [Reset]
- 探索期间所有 guess/undo/redo 走子会话独立栈,**不影响主局面**
- **Commit**:把整段探索折叠为单条复合 transition 入主栈;主栈 Undo 一次撤销整段
- **Abandon**:丢弃子会话;若退出时子局面有冲突,记录指纹到失败记忆
- **Reset**:回到探索起点,保留在 explore 中,子栈清空
- 探索中走到已知失败局面时 Banner 立即显示"⚠ 已访问过的失败路径"

### 文档与测试

- **设计反思**:见 [`EVOLUTION.md`](./EVOLUTION.md),回答 7 个 HW2 反思问题
- **测试**:`tests/hw1/` 5 个 HW1.1 套件 + `tests/hw2/` 5 个 HW2 套件,共 38 tests。运行 `npm test` 验证全部通过。

---

## Original notes (pre-HW2)

> [!WARNING]
> Unfortunately not all features are done yet. Specifically:
> - Undoing/redoing moves
> - Creating your own sudoku games