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
		session: {
			// 旅行アプリは間隔を空けて開くので長めに保持。訪問のたびに
			// 有効期限を延長（スライディング）するので、実質ログインしっぱなし。
			expiresIn: 60 * 60 * 24 * 180, // 180日
			updateAge: 60 * 60 * 24, // 1日ごとに延長
		},
	} );

}

export type Auth = ReturnType<typeof createAuth>;
