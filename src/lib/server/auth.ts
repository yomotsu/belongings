import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './db/schema';
import { sendMail } from './email';

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
			// パスワード再設定。forgetPassword でメールを送り、リンク先の
			// /reset-password?token=... で resetPassword を呼ぶ。
			resetPasswordTokenExpiresIn: 60 * 60, // 1時間
			sendResetPassword: async ( { user, url } ) => {

				const text = [
					'パスワード再設定のリクエストを受け付けました。',
					'以下のリンクを開いて新しいパスワードを設定してください（1時間有効）。',
					'',
					url,
					'',
					'心当たりがない場合は、このメールは無視してください。',
				].join( '\n' );

				await sendMail( env, {
					to: user.email,
					subject: '【持ち物チェック】パスワード再設定',
					text,
				} );

			},
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
