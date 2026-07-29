import { redirect, fail } from '@sveltejs/kit';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { lists } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

function db( platform: App.Platform ) {

	return drizzle( platform.env.DB, { schema: { lists } } );

}

export const load: PageServerLoad = async ( { locals, platform } ) => {

	if ( ! locals.user ) throw redirect( 302, '/login' );

	const d = db( platform! );

	const myLists = await d.select().from( lists )
		.where( eq( lists.userId, locals.user.id ) )
		.orderBy( lists.position, lists.createdAt );

	return { lists: myLists };

};

export const actions: Actions = {

	reorderLists: async ( { request, locals, platform } ) => {

		if ( ! locals.user ) return fail( 401, { message: 'ログインが必要です' } );

		const form = await request.formData();
		const ids = form.getAll( 'ids' ).map( String );

		const d = db( platform! );

		// Scope every update to this user so a foreign id can never match.
		for ( let i = 0; i < ids.length; i ++ ) {

			await d.update( lists ).set( { position: i } )
				.where( and( eq( lists.id, ids[ i ] ), eq( lists.userId, locals.user.id ) ) );

		}

		return { success: true };

	},

};
