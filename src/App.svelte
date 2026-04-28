<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { validateSencode } from '@sudoku/sencode';
	import game from '@sudoku/game';
	import { modal } from '@sudoku/stores/modal';
	import { gameWon } from '@sudoku/stores/game';
	import { gameSession } from '@sudoku/stores/session';
	import Board from './components/Board/index.svelte';
	import Controls from './components/Controls/index.svelte';
	import Header from './components/Header/index.svelte';
	import Modal from './components/Modal/index.svelte';

	gameWon.subscribe(won => {
		if (won) {
			game.pause();
			modal.show('gameover');
		}
	});

	onMount(() => {
		let hash = location.hash;

		if (hash.startsWith('#')) {
			hash = hash.slice(1);
		}

		let sencode;
		if (validateSencode(hash)) {
			sencode = hash;
		}

		modal.show('welcome', { onHide: game.resume, sencode });
	});

	// HW2:从 session 快照派生 explore 状态与失败路径提示
	$: isExploring = $gameSession?.isExploring ?? false;
	$: failedHere  = $gameSession?.failedHere  ?? false;
</script>

<!-- HW2:Explore Mode 顶部 banner;进入探索后显示,abandon/commit 后消失 -->
{#if isExploring}
	<div
		class="fixed top-0 left-0 right-0 z-50 flex items-center justify-center px-4 py-2 text-yellow-900 font-semibold shadow"
		style="background: linear-gradient(90deg, #fef3c7, #fde68a); letter-spacing: 0.04em;"
		transition:fly={{ y: -20, duration: 200 }}
	>
		<span>EXPLORE MODE · 探索中</span>
		{#if failedHere}
			<span class="ml-3 px-3 py-1 rounded-full text-white text-sm" style="background: #f87171;" transition:fly={{ y: -10, duration: 150 }}>
				⚠ 已访问过的失败路径
			</span>
		{/if}
	</div>
{/if}

<!-- Timer, Menu, etc. -->
<header>
	<Header />
</header>

<!-- Sudoku Field;探索时给棋盘加金色描边(inline style 避免 svelte preprocess 解析复杂选择器出错) -->
<section style:filter={isExploring ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))' : 'none'}>
	<Board />
</section>

<!-- Keyboard -->
<footer>
	<Controls />
</footer>

<Modal />

<style global>
	@import "./styles/global.css";
</style>
