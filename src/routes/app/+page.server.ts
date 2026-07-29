import { redirect, fail } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import { lists, items, user } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

function db( platform: App.Platform ) {

	return drizzle( platform.env.DB, { schema: { lists, items, user } } );

}

// 上限（クライアントの表示制御と二重で効かせる。ここが権威）。
const MAX_LISTS = 16;
const MAX_ITEMS = 32;
const MAX_DIVIDERS = 8;

export const load: PageServerLoad = async ( { locals, platform, url } ) => {

	if ( ! locals.user ) throw redirect( 302, '/login' );

	const d = db( platform! );

	const myLists = await d.select().from( lists )
		.where( eq( lists.userId, locals.user.id ) )
		.orderBy( lists.position, lists.createdAt );

	// 選択リストの優先順位: URL の ?list= → 前回選択（user.lastListId）→ 先頭。
	// URL 指定がなければ前回選択を復元するので、ログイン・再訪でも維持される。
	const requested = url.searchParams.get( 'list' );
	const owns = ( id: string | null ) => !! id && myLists.some( ( l ) => l.id === id );

	const me = await d.select( { lastListId: user.lastListId } ).from( user )
		.where( eq( user.id, locals.user.id ) )
		.get();

	const selectedId =
		( owns( requested ) && requested ) ||
		( owns( me?.lastListId ?? null ) && me!.lastListId ) ||
		myLists[ 0 ]?.id ||
		null;

	// 解決した選択リストを次回のために保存（変化したときだけ書き込む）。
	if ( selectedId && selectedId !== me?.lastListId ) {

		await d.update( user ).set( { lastListId: selectedId } ).where( eq( user.id, locals.user.id ) );

	}

	let selectedItems: ( typeof items.$inferSelect )[] = [];

	if ( selectedId ) {

		selectedItems = await d.select().from( items )
			.where( eq( items.listId, selectedId ) )
			.orderBy( items.position, items.createdAt );

	}

	return {
		lists: myLists,
		selectedId,
		items: selectedItems,
	};

};

/** Confirms the given list belongs to the current user; returns it or null. */
async function ownedList( d: ReturnType<typeof db>, listId: string, userId: string ) {

	return d.select().from( lists )
		.where( and( eq( lists.id, listId ), eq( lists.userId, userId ) ) )
		.get();

}

export const actions: Actions = {

	createList: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) throw redirect( 302, '/login' );

		const form = await request.formData();
		const name = String( form.get( 'name' ) ?? '' ).trim();

		if ( ! name ) return fail( 400, { message: 'リスト名を入力してください' } );

		const d = db( platform! );

		// Reject a duplicate name for this user (case-insensitive).
		const dup = await d.select( { id: lists.id } ).from( lists )
			.where( and( eq( lists.userId, locals.user.id ), sql`lower(${lists.name}) = lower(${name})` ) )
			.get();

		if ( dup ) return fail( 409, { message: '同じ名前のリストが既にあります' } );

		const listCount = await d.select( { count: sql<number>`COUNT(*)` } ).from( lists )
			.where( eq( lists.userId, locals.user.id ) )
			.get();

		if ( ( listCount?.count ?? 0 ) >= MAX_LISTS ) return fail( 409, { message: `リストは${MAX_LISTS}個までです` } );

		// Append to the end of the user's lists.
		const last = await d.select( { max: sql<number>`COALESCE(MAX(${lists.position}), -1)` } ).from( lists )
			.where( eq( lists.userId, locals.user.id ) )
			.get();

		const id = crypto.randomUUID();
		await d.insert( lists ).values( {
			id,
			userId: locals.user.id,
			name,
			position: ( last?.max ?? -1 ) + 1,
			createdAt: new Date(),
		} );

		throw redirect( 303, `/app?list=${id}` );

	},

	deleteList: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) throw redirect( 302, '/login' );

		const form = await request.formData();
		const listId = String( form.get( 'listId' ) ?? '' );

		const d = db( platform! );

		if ( ! ( await ownedList( d, listId, locals.user.id ) ) ) return fail( 403, { message: '権限がありません' } );

		await d.delete( lists ).where( eq( lists.id, listId ) );

		throw redirect( 303, '/app' );

	},

	createItem: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) throw redirect( 302, '/login' );

		const form = await request.formData();
		const listId = String( form.get( 'listId' ) ?? '' );
		const name = String( form.get( 'name' ) ?? '' ).trim();
		const kindInput = String( form.get( 'kind' ) ?? 'item' );
		const kind = kindInput === 'divider' ? 'divider' : 'item';
		const important = kind === 'item' && form.get( 'important' ) === 'true';

		if ( ! listId ) return fail( 400, { message: 'リストが不明です' } );
		if ( kind === 'item' && ! name ) return fail( 400, { message: '持ち物名を入力してください' } );

		const d = db( platform! );

		if ( ! ( await ownedList( d, listId, locals.user.id ) ) ) return fail( 403, { message: '権限がありません' } );

		const kindCount = await d.select( { count: sql<number>`COUNT(*)` } ).from( items )
			.where( and( eq( items.listId, listId ), eq( items.kind, kind ) ) )
			.get();

		if ( kind === 'item' && ( kindCount?.count ?? 0 ) >= MAX_ITEMS ) return fail( 409, { message: `持ち物は${MAX_ITEMS}個までです` } );
		if ( kind === 'divider' && ( kindCount?.count ?? 0 ) >= MAX_DIVIDERS ) return fail( 409, { message: `区切りは${MAX_DIVIDERS}個までです` } );

		// Append to the end of the list.
		const last = await d.select( { max: sql<number>`COALESCE(MAX(${items.position}), -1)` } ).from( items )
			.where( eq( items.listId, listId ) )
			.get();

		// Accept a client-generated id so optimistic UI and DB rows stay in sync.
		const providedId = String( form.get( 'id' ) ?? '' ).trim();

		await d.insert( items ).values( {
			id: providedId || crypto.randomUUID(),
			listId,
			name,
			kind,
			checked: false,
			important,
			position: ( last?.max ?? -1 ) + 1,
			createdAt: new Date(),
		} );

		// No redirect: returning success lets `enhance` refresh via invalidateAll
		// without navigating, so the page scroll position is preserved.
		return { success: true };

	},

	reorderItems: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) return fail( 401, { message: 'ログインが必要です' } );

		const form = await request.formData();
		const listId = String( form.get( 'listId' ) ?? '' );
		const ids = form.getAll( 'ids' ).map( String );

		const d = db( platform! );

		if ( ! ( await ownedList( d, listId, locals.user.id ) ) ) return fail( 403, { message: '権限がありません' } );

		// Scope every update to this list so a foreign id can never match.
		for ( let i = 0; i < ids.length; i ++ ) {

			await d.update( items ).set( { position: i } )
				.where( and( eq( items.id, ids[ i ] ), eq( items.listId, listId ) ) );

		}

		return { success: true };

	},

	toggleItem: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) throw redirect( 302, '/login' );

		const form = await request.formData();
		const itemId = String( form.get( 'itemId' ) ?? '' );
		const checked = form.get( 'checked' ) === 'true';

		const d = db( platform! );

		// Join guard: only toggle items on lists owned by the user.
		const owned = await d.select( { id: items.id, listId: items.listId } ).from( items )
			.innerJoin( lists, eq( items.listId, lists.id ) )
			.where( and( eq( items.id, itemId ), eq( lists.userId, locals.user.id ) ) )
			.get();

		if ( ! owned ) return fail( 403, { message: '権限がありません' } );

		await d.update( items ).set( { checked } ).where( eq( items.id, itemId ) );

		return { success: true };

	},

	deleteItem: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) throw redirect( 302, '/login' );

		const form = await request.formData();
		const itemId = String( form.get( 'itemId' ) ?? '' );

		const d = db( platform! );

		const owned = await d.select( { id: items.id, listId: items.listId } ).from( items )
			.innerJoin( lists, eq( items.listId, lists.id ) )
			.where( and( eq( items.id, itemId ), eq( lists.userId, locals.user.id ) ) )
			.get();

		if ( ! owned ) return fail( 403, { message: '権限がありません' } );

		await d.delete( items ).where( eq( items.id, itemId ) );

		return { success: true };

	},

	resetChecks: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) throw redirect( 302, '/login' );

		const form = await request.formData();
		const listId = String( form.get( 'listId' ) ?? '' );

		const d = db( platform! );

		if ( ! ( await ownedList( d, listId, locals.user.id ) ) ) return fail( 403, { message: '権限がありません' } );

		// Reuse the list for the next trip: clear every check and expand all sections.
		await d.update( items ).set( { checked: false, collapsed: false } ).where( eq( items.listId, listId ) );

		return { success: true };

	},

	setCollapsed: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) return fail( 401, { message: 'ログインが必要です' } );

		const form = await request.formData();
		const itemId = String( form.get( 'itemId' ) ?? '' );
		const collapsed = form.get( 'collapsed' ) === 'true';

		const d = db( platform! );

		const owned = await d.select( { id: items.id } ).from( items )
			.innerJoin( lists, eq( items.listId, lists.id ) )
			.where( and( eq( items.id, itemId ), eq( lists.userId, locals.user.id ) ) )
			.get();

		if ( ! owned ) return fail( 403, { message: '権限がありません' } );

		await d.update( items ).set( { collapsed } ).where( eq( items.id, itemId ) );

		return { success: true };

	},

};
