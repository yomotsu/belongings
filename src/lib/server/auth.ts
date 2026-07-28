import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';

/**
 * Cloudflare exposes bindings (D1, secrets) per request via `platform.env`,
 * so the auth instance must be built per request rather than at module load.
 */
export function createAuth( env: App.Platform['env'] ) {

	const db = drizzle( env.DB, { schema } );

	return betterAuth( {
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		database: drizzleAdapter( db, {
			provider: 'sqlite',
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		} ),
		emailAndPassword: {
			enabled: true,
		},
	} );

}

export type Auth = ReturnType<typeof createAuth>;
