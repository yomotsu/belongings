<script lang="ts">
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import type { List } from '$lib/server/db/schema';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Local, reorderable copy of the lists. Seeded from the server data for SSR,
	// then re-synced by the $effect below whenever it changes, and mutated in
	// place during drag.
	// svelte-ignore state_referenced_locally
	let items = $state<List[]>( data.lists );

	$effect( () => {

		items = data.lists;

	} );

	function handleConsider( e: CustomEvent<DndEvent<List>> ) {

		items = e.detail.items;

	}

	async function handleFinalize( e: CustomEvent<DndEvent<List>> ) {

		items = e.detail.items;
		await persistOrder();

	}

	async function persistOrder() {

		const body = new FormData();
		for ( const item of items ) body.append( 'ids', item.id );

		await fetch( '?/reorderLists', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' },
		} );

	}
</script>

<div class="card">
	<h1>リストの並び替え</h1>
	<a href="/app">← 戻る</a>

	<section
		class="items"
		use:dragHandleZone={{ items, flipDurationMs: 150 }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
	>
		{#each items as list (list.id)}
			<div class="row">
				<span class="drag-handle" use:dragHandle aria-label="ドラッグして並び替え">⠿</span>
				<span class="item-name">{list.name}</span>
			</div>
		{/each}
	</section>
</div>
