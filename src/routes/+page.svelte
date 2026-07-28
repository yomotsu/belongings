<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<h1>旅行の持ち物チェック</h1>
<p class="muted">行き先や目的ごとに持ち物リストを作って、旅行のたびにチェック → 終わったら全部外して再利用できます。</p>

<div class="card">
	{#if data.user}
		<p>ようこそ、{data.user.name} さん</p>
		<a href="/app"><button>持ち物リストを開く</button></a>
	{:else}
		<a href="/login"><button>ログイン</button></a>
		<a href="/signup" style="margin-left:12px;">新規登録</a>
	{/if}
</div>
