# 🧳 Belongings — 旅行の持ち物チェックアプリ

旅行ごとに持ち物リストを作り、当日チェックしながら準備できる Web アプリ。

## スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | SvelteKit (Svelte 5) |
| ホスティング | Cloudflare Workers (`@sveltejs/adapter-cloudflare`) |
| DB | Cloudflare D1 (SQLite) |
| ORM / マイグレーション | Drizzle ORM + drizzle-kit |
| 認証 | Better Auth（メール＋パスワード、セッション） |

## データモデル

```
user (Better Auth)
 ├─ session / account / verification (Better Auth)
 └─ lists (id, user_id, name)                           行き先・目的ごとの再利用リスト
      └─ items (id, list_id, name, kind, checked, position)   持ち物 / 区切り
```

- リストは行き先/目的ごと（例：沖縄 / 出張 / キャンプ）の持ち物マスター。
- `kind`: `item`（通常の持ち物）/ `divider`（罫線）。罫線はグルーピング用の区切りで、チェックや進捗の対象外。
- `position`: リスト内の並び順。ドラッグ（`svelte-dnd-action`）で並べ替え、`reorderItems` で永続化。
- 旅行のたびにチェックし、終わったら「全部外す」(`resetChecks`) で `checked` を戻して再利用する。
- リスト内の変更（追加・チェック・削除・リセット・並べ替え）はリダイレクトせず success を返し、`enhance` の `invalidateAll` で画面を更新する（スクロール位置を保つため）。
- すべての読み書きはログイン中ユーザーの `user_id` にスコープされる（他人のデータは 403）。

## ローカル開発

```bash
npm install
npm run db:migrate:local   # ローカル D1 にスキーマ適用（初回のみ）
npm run dev                # http://localhost:5173
```

`.dev.vars` に開発用の `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` が入っている（git 管理外）。

パスワード再設定メール用に `SENDGRID_API_KEY` / `MAIL_FROM` も使う。**未設定なら実送信せず、再設定リンクをサーバのコンソールに出力する**（ローカルではこれで確認できる）。

## スキーマ変更の流れ

1. `src/lib/server/db/schema.ts` を編集
2. `npm run db:generate` でマイグレーション SQL を生成（`drizzle/` に出力）
3. `npm run db:migrate:local`（本番は `db:migrate:remote`）

## Cloudflare へのデプロイ

初回のみ：

```bash
wrangler login                                   # Cloudflare にログイン
wrangler d1 create belongings-db                 # D1 を作成
# → 出力された database_id を wrangler.jsonc の "database_id" に貼り付け
npm run db:migrate:remote                        # 本番 D1 にスキーマ適用

# 本番用シークレットを設定（32文字以上のランダム値）
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL              # 例: https://belongings.<account>.workers.dev

# パスワード再設定メール（SendGrid）。独自ドメインが無くても
# Single Sender Verification で送信元アドレス1件を認証すれば送れる。
wrangler secret put SENDGRID_API_KEY             # SendGrid の Mail Send 権限付き API Key
wrangler secret put MAIL_FROM                    # 認証済みの送信元アドレス（例: you@example.com）
```

以降は：

```bash
npm run deploy
```

## 構成メモ

- Cloudflare の bindings（D1・シークレット）はリクエストごとに `platform.env` 経由で渡るため、
  Better Auth は `createAuth(env)` でリクエストごとに生成している（`src/lib/server/auth.ts`）。
- 認証 API は `/api/auth/*`（`src/routes/api/auth/[...all]/+server.ts`）にマウント。
- セッション判定は `src/hooks.server.ts` で行い、`locals.user` / `locals.session` に格納。
