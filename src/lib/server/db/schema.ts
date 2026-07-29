import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ---- Better Auth core tables (sqlite provider defaults) ----

export const user = sqliteTable( 'user', {
	id: text( 'id' ).primaryKey(),
	name: text( 'name' ).notNull(),
	email: text( 'email' ).notNull().unique(),
	emailVerified: integer( 'email_verified', { mode: 'boolean' } ).notNull().default( false ),
	image: text( 'image' ),
	// 最後に選んだリスト。ログイン・再訪時に前回のリストを復元するために保持する。
	// 削除済みリストの id が残ることがあるので、読み出し側で所有チェックしてから使う。
	lastListId: text( 'last_list_id' ),
	createdAt: integer( 'created_at', { mode: 'timestamp' } ).notNull(),
	updatedAt: integer( 'updated_at', { mode: 'timestamp' } ).notNull(),
} );

export const session = sqliteTable( 'session', {
	id: text( 'id' ).primaryKey(),
	expiresAt: integer( 'expires_at', { mode: 'timestamp' } ).notNull(),
	token: text( 'token' ).notNull().unique(),
	createdAt: integer( 'created_at', { mode: 'timestamp' } ).notNull(),
	updatedAt: integer( 'updated_at', { mode: 'timestamp' } ).notNull(),
	ipAddress: text( 'ip_address' ),
	userAgent: text( 'user_agent' ),
	userId: text( 'user_id' ).notNull().references( () => user.id, { onDelete: 'cascade' } ),
} );

export const account = sqliteTable( 'account', {
	id: text( 'id' ).primaryKey(),
	accountId: text( 'account_id' ).notNull(),
	providerId: text( 'provider_id' ).notNull(),
	userId: text( 'user_id' ).notNull().references( () => user.id, { onDelete: 'cascade' } ),
	accessToken: text( 'access_token' ),
	refreshToken: text( 'refresh_token' ),
	idToken: text( 'id_token' ),
	accessTokenExpiresAt: integer( 'access_token_expires_at', { mode: 'timestamp' } ),
	refreshTokenExpiresAt: integer( 'refresh_token_expires_at', { mode: 'timestamp' } ),
	scope: text( 'scope' ),
	password: text( 'password' ),
	createdAt: integer( 'created_at', { mode: 'timestamp' } ).notNull(),
	updatedAt: integer( 'updated_at', { mode: 'timestamp' } ).notNull(),
} );

export const verification = sqliteTable( 'verification', {
	id: text( 'id' ).primaryKey(),
	identifier: text( 'identifier' ).notNull(),
	value: text( 'value' ).notNull(),
	expiresAt: integer( 'expires_at', { mode: 'timestamp' } ).notNull(),
	createdAt: integer( 'created_at', { mode: 'timestamp' } ),
	updatedAt: integer( 'updated_at', { mode: 'timestamp' } ),
} );

// ---- Application tables ----
// A list is a reusable packing list per destination or purpose
// (e.g. 沖縄 / 出張 / キャンプ). Its check state is reset between trips.

export const lists = sqliteTable( 'lists', {
	id: text( 'id' ).primaryKey(),
	userId: text( 'user_id' ).notNull().references( () => user.id, { onDelete: 'cascade' } ),
	name: text( 'name' ).notNull(),
	position: integer( 'position' ).notNull().default( 0 ),
	createdAt: integer( 'created_at', { mode: 'timestamp' } ).notNull(),
} );

// kind: 'item' = 通常の持ち物, 'divider' = 罫線（グルーピング用）
export const items = sqliteTable( 'items', {
	id: text( 'id' ).primaryKey(),
	listId: text( 'list_id' ).notNull().references( () => lists.id, { onDelete: 'cascade' } ),
	name: text( 'name' ).notNull(),
	kind: text( 'kind' ).notNull().default( 'item' ),
	checked: integer( 'checked', { mode: 'boolean' } ).notNull().default( false ),
	important: integer( 'important', { mode: 'boolean' } ).notNull().default( false ),
	// divider only: 折りたたみ状態。true のとき次の罫線までの項目を隠す。
	collapsed: integer( 'collapsed', { mode: 'boolean' } ).notNull().default( false ),
	position: integer( 'position' ).notNull().default( 0 ),
	createdAt: integer( 'created_at', { mode: 'timestamp' } ).notNull(),
} );

export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
