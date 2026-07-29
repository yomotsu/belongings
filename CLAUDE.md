# CLAUDE.md — belongings（旅行の持ち物チェックアプリ）

SvelteKit(Svelte 5) + Cloudflare Workers + D1 + Drizzle + Better Auth。概要・データモデル・手順は `README.md` を参照。ここには**コードからは読み取りにくい運用・落とし穴・設計方針**だけを残す。

## デプロイ運用（最重要）

- Cloudflare **Workers Builds（GitHubリポジトリ連携）**で運用。**`git push origin main` すると自動でビルド＆デプロイ**される。ローカルから `wrangler deploy` する必要はない。
- Workers Builds のデプロイコマンドは
  `npx wrangler d1 migrations apply belongings-db --remote && npx wrangler deploy`。
  → **スキーマ変更は「`drizzle/` にマイグレーション追加 → push」だけで本番 D1 に自動適用**される。
- 本番 D1: `belongings-db`（`wrangler.jsonc` の `database_id` は本番のもの）。
- シークレット `BETTER_AUTH_SECRET` は Worker の暗号化 Secret として設定済み。`BETTER_AUTH_URL` は未設定で良い（Better Auth がリクエスト元 URL を自動判定）。

## ローカル開発

- **node/npm/npx は anyenv/nodenv 管理**で、素のシェルの PATH に載っていないことがある。コマンド前に:
  `export PATH="$HOME/.anyenv/envs/nodenv/shims:$PATH"`
- 型チェック: `npx svelte-check --tsconfig ./tsconfig.json`。新規ルート追加後に `./$types` が見つからないエラーが出たら先に `npx svelte-kit sync`。
- `wrangler dev` は**ビルド済み `.svelte-kit/cloudflare/_worker.js` を配信**する（自動ビルドしない）。挙動確認時は**先に `npm run build`**。
- ローカル実行には `.dev.vars`（`BETTER_AUTH_SECRET=...`）と、`npx wrangler d1 migrations apply belongings-db --local` が必要。ローカル D1 は `.wrangler/state/v3/d1`。

## UI の設計方針（壊さない）

- 持ち物カード（追加・削除・チェック・全部外す・並べ替え）は**楽観的更新 + fire-and-forget**。`invalidateAll` での再取得はしない（往復待ち・チラつき・レースを避けるため）。DB は投げっぱなしの `fetch('?/action', …)` で更新し、次回ロードで整合。
- `createItem` は**クライアント生成の `id` を受け取る**。楽観的に追加した行と DB 行の id を一致させ、再取得時のチラつきを防ぐため。
- チェックは**1秒デバウンス**して書き込む（連打対策）。画面遷移・`pagehide` 時は `navigator.sendBeacon` で未同期分を確実に送信。
- ログイン保持: セッション `expiresIn` 180日 + `updateAge` 1日（訪問のたびにスライディング延長）。

## 落とし穴

- **`use:enhance` は `onsubmit` の `preventDefault` を無視して送信する**。確認ダイアログのキャンセルを効かせるには、必ず enhance のコールバック内で `cancel()` を呼ぶこと（`onsubmit` 側で止めても送信される）。
- **`drizzle-kit generate` は列デフォルト変更などで破壊的なテーブル再構築 SQL（`INSERT ... SELECT 新列 FROM 旧`）を吐くことがある**。本番データを壊しうるので、生成 SQL は必ず目視し、`ADD COLUMN` 以外の再構築が出たらスキーマ変更を見直す。
- 認証エラーは `$lib/auth-errors` の `authErrorMessage()` で日本語化する（Better Auth のコードを和訳）。新しいエラーコードはここに追記。
