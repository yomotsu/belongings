import { redirect, fail } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import { lists, items } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

function db( platform: App.Platform ) {

	return drizzle( platform.env.DB, { schema: { lists, items } } );

}

export const load: PageServerLoad = async ( { locals, platform, url } ) => {

	if ( ! locals.user ) throw redirect( 302, '/login' );

	const d = db( platform! );

	const myLists = await d.select().from( lists )
		.where( eq( lists.userId, locals.user.id ) )
		.orderBy( lists.position, lists.createdAt );

	const selectedId = url.searchParams.get( 'list' ) ?? myLists[ 0 ]?.id ?? null;

	let selectedItems: ( typeof items.$inferSelect )[] = [];

	if ( selectedId ) {

		// Verify the selected list belongs to the current user before reading items.
		const owns = myLists.some( ( l ) => l.id === selectedId );

		if ( owns ) {

			selectedItems = await d.select().from( items )
				.where( eq( items.listId, selectedId ) )
				.orderBy( items.position, items.createdAt );

		}

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

		if ( ! listId ) return fail( 400, { message: 'リストが不明です' } );
		if ( kind === 'item' && ! name ) return fail( 400, { message: '持ち物名を入力してください' } );

		const d = db( platform! );

		if ( ! ( await ownedList( d, listId, locals.user.id ) ) ) return fail( 403, { message: '権限がありません' } );

		// Append to the end of the list.
		const last = await d.select( { max: sql<number>`COALESCE(MAX(${items.position}), -1)` } ).from( items )
			.where( eq( items.listId, listId ) )
			.get();

		await d.insert( items ).values( {
			id: crypto.randomUUID(),
			listId,
			name: kind === 'item' ? name : '',
			kind,
			checked: false,
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

		// Reuse the list for the next trip: clear every check.
		await d.update( items ).set( { checked: false } ).where( eq( items.listId, listId ) );

		return { success: true };

	},

};
