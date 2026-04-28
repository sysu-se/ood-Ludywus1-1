import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// vitest 的 vite resolver 默认不识别 src/node_modules/@sudoku 这个项目内本地命名空间
// 配置 alias 让 hw2 测试能直接 import session.js / 其它 @sudoku/* 模块
export default defineConfig({
	resolve: {
		alias: {
			'@sudoku': path.resolve(__dirname, 'src/node_modules/@sudoku'),
		},
	},
});
