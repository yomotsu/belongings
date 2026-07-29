<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { dragHandleZone, dragHandle, type DndEvent } from 'svelte-dnd-action';
	import type { Item } from '$lib/server/db/schema';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let selectedList = $derived( data.lists.find( ( l ) => l.id === data.selectedId ) ?? null );

	// Local, reorderable copy of the items. Seeded from the server data for SSR,
	// then re-synced by the $effect below whenever it changes (list switch, add,
	// toggle, reset), and mutated in place during drag.
	// svelte-ignore state_referenced_locally
	let items = $state<Item[]>( data.items );

	$effect( () => {

		items = data.items;

	} );

	// Only real items (not dividers) count towards the packing progress.
	let packItems = $derived( items.filter( ( i ) => i.kind === 'item' ) );
	let remaining = $derived( packItems.filter( ( i ) => ! i.checked ).length );
	let checkedCount = $derived( packItems.length - remaining );

	let newItem = $state( '' );
	let newList = $state( '' );

	// Refresh data without navigating (keeps scroll position) and without
	// resetting form controls (avoids a checkbox flicker on toggle).
	const keepScroll = () => async ( { update }: { update: ( o?: { reset?: boolean } ) => Promise<void> } ) => {

		await update( { reset: false } );

	};

	function handleConsider( e: CustomEvent<DndEvent<Item>> ) {

		items = e.detail.items;

	}

	async function handleFinalize( e: CustomEvent<DndEvent<Item>> ) {

		items = e.detail.items;
		await persistOrder();

	}

	async function persistOrder() {

		if ( ! selectedList ) return;

		const body = new FormData();
		body.set( 'listId', selectedList.id );
		for ( const item of items ) body.append( 'ids', item.id );

		await fetch( '?/reorderItems', {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' },
		} );

	}

	async function logout() {

		await authClient.signOut();
		await goto( '/' );

	}
</script>

<div style="display:flex; justify-content:space-between; align-items:center;">
	<h1>持ち物リスト</h1>
	<button class="ghost" onclick={logout}>ログアウト</button>
</div>

<div class="card">
	<label for="list-select">リストを選ぶ（行き先・目的ごと）</label>
	<select
		id="list-select"
		style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);"
		onchange={( e ) => goto( `/app?list=${( e.currentTarget as HTMLSelectElement ).value}` )}
	>
		{#if data.lists.length === 0}
			<option>まだリストがありません</option>
		{/if}
		{#each data.lists as list (list.id)}
			<option value={list.id} selected={list.id === data.selectedId}>{list.name}</option>
		{/each}
	</select>

	<a href="/app/lists">リストの並び替え</a>

	<form
		method="POST"
		action="?/createList"
		use:enhance={() => async ( { result, update } ) => {

			if ( result.type !== 'failure' ) newList = '';
			await update();

		}}
		class="inline-form"
	>
		<input type="text" name="name" bind:value={newList} placeholder="新しいリスト（例：沖縄 / 出張 / キャンプ）" required />
		<button type="submit">追加</button>
	</form>

	{#if form?.message}
		<p class="error">{form.message}</p>
	{/if}
</div>

{#if selectedList}
	<div class="card">
		<div style="display:flex; justify-content:space-between; align-items:center;">
			<h2 style="margin:0;">{selectedList.name}</h2>
			<span class="muted">残り {remaining} 件</span>
		</div>

		{#if items.length === 0}
			<p class="muted">持ち物がまだありません。下から追加してください。</p>
		{/if}

		<section
			class="items"
			use:dragHandleZone={{ items, flipDurationMs: 150 }}
			onconsider={handleConsider}
			onfinalize={handleFinalize}
		>
			{#each items as item (item.id)}
				{#if item.kind === 'divider'}
					<div class="row row-sep">
						<span class="drag-handle" use:dragHandle aria-label="ドラッグして並び替え">⠿</span>
						<hr class="divider-line" />
						<form method="POST" action="?/deleteItem" use:enhance={keepScroll}>
							<input type="hidden" name="itemId" value={item.id} />
							<button class="ghost" type="submit" aria-label="削除">✕</button>
						</form>
					</div>
				{:else}
					<div class="row" class:done={item.checked}>
						<span class="drag-handle" use:dragHandle aria-label="ドラッグして並び替え">⠿</span>
						<form method="POST" action="?/toggleItem" use:enhance={keepScroll}>
							<input type="hidden" name="itemId" value={item.id} />
							<input type="hidden" name="checked" value={( ! item.checked ).toString()} />
							<input
								type="checkbox"
								checked={item.checked}
								onchange={( e ) => ( e.currentTarget as HTMLInputElement ).form?.requestSubmit()}
							/>
						</form>
						<span class="item-name">{item.name}</span>
						<form method="POST" action="?/deleteItem" use:enhance={keepScroll}>
							<input type="hidden" name="itemId" value={item.id} />
							<button class="ghost" type="submit" aria-label="削除">✕</button>
						</form>
					</div>
				{/if}
			{/each}
		</section>

		<form
			method="POST"
			action="?/createItem"
			use:enhance={() => async ( { update } ) => {

				newItem = '';
				await update( { reset: false } );

			}}
			class="inline-form"
		>
			<input type="hidden" name="listId" value={selectedList.id} />
			<input type="text" name="name" bind:value={newItem} placeholder="持ち物を追加（例：パスポート）" required />
			<button type="submit">追加</button>
		</form>

		<div class="add-extras">
			<form method="POST" action="?/createItem" use:enhance={keepScroll}>
				<input type="hidden" name="listId" value={selectedList.id} />
				<input type="hidden" name="kind" value="divider" />
				<button class="ghost" type="submit">＋ 罫線</button>
			</form>
		</div>

		<div class="list-footer">
			<form method="POST" action="?/resetChecks" use:enhance={keepScroll}>
				<input type="hidden" name="listId" value={selectedList.id} />
				<button class="ghost" type="submit" disabled={checkedCount === 0}>✓ 全部外す（旅行後にリセット）</button>
			</form>
			<form
				method="POST"
				action="?/deleteList"
				use:enhance={() => ( { update } ) => {

					update();

				}}
				onsubmit={( e ) => { if ( ! confirm( 'このリストを削除しますか？' ) ) e.preventDefault(); }}
			>
				<input type="hidden" name="listId" value={selectedList.id} />
				<button class="ghost danger" type="submit">リストを削除</button>
			</form>
		</div>
	</div>
{/if}
