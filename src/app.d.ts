import type { Auth } from '$lib/server/auth';

type AuthSession = Auth['$Infer']['Session'];

declare global {

	namespace App {

		// interface Error {}

		interface Locals {
			user: AuthSession['user'] | null;
			session: AuthSession['session'] | null;
		}

		// interface PageData {}
		// interface PageState {}

		interface Platform {
			env: {
				DB: import('@cloudflare/workers-types').D1Database;
				BETTER_AUTH_SECRET: string;
				BETTER_AUTH_URL: string;
			};
			context: {
				waitUntil( promise: Promise<unknown> ): void;
			};
			caches: CacheStorage;
		}

	}

}

export {};
