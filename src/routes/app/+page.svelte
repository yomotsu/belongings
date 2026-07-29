<script lang="ts">
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import { goto, beforeNavigate } from '$app/navigation';
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
	let newImportant = $state( false );
	let newList = $state( '' );

	// --- チェックのDB同期をdebounce ---------------------------------------
	// トグルはUIに即反映し、DB書き込みだけ遅延させる。連打しても項目ごとに
	// 最終状態が1回だけ書き込まれる。
	const pendingChecks = new Map<string, boolean>();
	let flushTimer: ReturnType<typeof setTimeout> | undefined;

	function toggleCheck( item: Item, next: boolean ) {

		item.checked = next;
		pendingChecks.set( item.id, next );

		clearTimeout( flushTimer );
		flushTimer = setTimeout( flushChecks, 1000 );

	}

	async function flushChecks( useBeacon = false ) {

		clearTimeout( flushTimer );

		if ( pendingChecks.size === 0 ) return;

		const changes = [ ...pendingChecks.entries() ];
		pendingChecks.clear();

		const jobs = [];

		for ( const [ itemId, checked ] of changes ) {

			const body = new FormData();
			body.set( 'itemId', itemId );
			body.set( 'checked', checked.toString() );

			if ( useBeacon && navigator.sendBeacon ) {

				navigator.sendBeacon( '?/toggleItem', body );

			} else {

				jobs.push( fetch( '?/toggleItem', {
					method: 'POST',
					body,
					headers: { 'x-sveltekit-action': 'true' },
				} ) );

			}

		}

		await Promise.all( jobs );

	}

	// 画面遷移・タブを閉じる前に未同期のチェックを確実に書き込む。
	beforeNavigate( () => flushChecks( true ) );

	$effect( () => {

		const handler = () => flushChecks( true );
		window.addEventListener( 'pagehide', handler );
		return () => window.removeEventListener( 'pagehide', handler );

	} );

	// --- 持ち物カードは楽観的更新 + fire-and-forget --------------------------
	// 追加・削除・全部外すは即座にローカルへ反映し、DB書き込みは投げっぱなし。
	// invalidateAll で再取得しないので往復待ちが無く、体感が即時になる。
	function nextPosition() {

		return items.reduce( ( max, i ) => Math.max( max, i.position ), -1 ) + 1;

	}

	function post( action: string, fields: Record<string, string> ) {

		const body = new FormData();
		for ( const [ key, value ] of Object.entries( fields ) ) body.set( key, value );

		return fetch( `?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true' },
		} );

	}

	function addItem( e: SubmitEvent ) {

		e.preventDefault();

		const name = newItem.trim();
		if ( ! name || ! selectedList ) return;

		const id = crypto.randomUUID();
		const important = newImportant;
		items = [ ...items, { id, listId: selectedList.id, name, kind: 'item', checked: false, important, position: nextPosition(), createdAt: new Date() } ];
		newItem = '';
		newImportant = false;

		post( 'createItem', { id, listId: selectedList.id, name, important: important.toString() } );

	}

	function addDivider() {

		if ( ! selectedList ) return;

		const id = crypto.randomUUID();
		items = [ ...items, { id, listId: selectedList.id, name: '', kind: 'divider', checked: false, important: false, position: nextPosition(), createdAt: new Date() } ];

		post( 'createItem', { id, listId: selectedList.id, kind: 'divider' } );

	}

	function renameDivider( item: Item ) {

		item.name = item.name.trim();
		post( 'renameItem', { itemId: item.id, name: item.name } );

	}

	function deleteRow( item: Item ) {

		items = items.filter( ( i ) => i.id !== item.id );
		pendingChecks.delete( item.id );

		post( 'deleteItem', { itemId: item.id } );

	}

	function resetAllChecks() {

		if ( ! selectedList ) return;

		items = items.map( ( i ) => i.kind === 'item' ? { ...i, checked: false } : i );
		pendingChecks.clear();
		clearTimeout( flushTimer );

		post( 'resetChecks', { listId: selectedList.id } );

	}

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

	<form
		method="POST"
		action="?/createList"
		use:enhance={() => async ( { result, update } ) => {

			if ( result.type !== 'failure' ) newList = '';
			await update();

		}}
		class="inline-form"
	>
		<input type="text" name="name" bind:value={newList} placeholder="新しいリスト（例：海外旅行 / 出張 / キャンプ）" required />
		<button type="submit">追加</button>
	</form>

	<div class="reorder-link">
		<a href="/app/lists">リストの並び替え</a>
	</div>

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
						<input
							class="divider-label"
							placeholder="ラベル（任意）"
							bind:value={item.name}
							onchange={() => renameDivider( item )}
						/>
						<button class="ghost" type="button" aria-label="削除" onclick={() => deleteRow( item )}>✕</button>
					</div>
				{:else}
					<div class="row" class:done={item.checked}>
						<span class="drag-handle" use:dragHandle aria-label="ドラッグして並び替え">⠿</span>
						<label class="item-label">
							<input
								type="checkbox"
								checked={item.checked}
								onchange={( e ) => toggleCheck( item, ( e.currentTarget as HTMLInputElement ).checked )}
							/>
							<span class="item-name" class:important={item.important}>{item.name}</span>
						</label>
						<button class="ghost" type="button" aria-label="削除" onclick={() => deleteRow( item )}>✕</button>
					</div>
				{/if}
			{/each}
		</section>

		<form onsubmit={addItem} class="inline-form">
			<input type="text" bind:value={newItem} placeholder="持ち物を追加（例：パスポート）" required />
			<button
				type="button"
				class="important-toggle"
				class:on={newImportant}
				aria-pressed={newImportant}
				title="大事なもの"
				onclick={() => ( newImportant = ! newImportant )}
			>★ 大事</button>
			<button type="submit">追加</button>
		</form>

		<div class="add-extras">
			<button class="ghost" type="button" onclick={addDivider}>＋ 罫線</button>
		</div>

		<div class="list-footer">
			<button class="ghost" type="button" onclick={resetAllChecks} disabled={checkedCount === 0}>✓ 全部外す（旅行後にリセット）</button>
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
