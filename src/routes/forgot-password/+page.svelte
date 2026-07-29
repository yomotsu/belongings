<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let email = $state( '' );
	let loading = $state( false );
	let sent = $state( false );
	let error = $state( '' );

	async function submit( event: SubmitEvent ) {

		event.preventDefault();
		error = '';
		loading = true;

		try {

			// 送信元URLに戻す。リンク先は /reset-password?token=... になる。
			await authClient.requestPasswordReset( {
				email,
				redirectTo: `${location.origin}/reset-password`,
			} );

			// ユーザー列挙を防ぐため、アカウントの有無に関わらず同じ結果を見せる。
			sent = true;

		} catch {

			error = '通信エラーが発生しました。接続を確認して再度お試しください';

		} finally {

			loading = false;

		}

	}
</script>

<h1>パスワード再設定</h1>

{#if sent}
	<div class="card">
		<p>入力されたメールアドレスが登録済みであれば、再設定用のリンクを送信しました。メールをご確認ください。</p>
		<p class="muted" style="margin-top:12px;">メールが届かない場合は迷惑メールフォルダもご確認ください。</p>
		<p class="muted"><a href="/login">ログインに戻る</a></p>
	</div>
{:else}
	<form class="card" onsubmit={submit}>
		{#if error}<p class="error">{error}</p>{/if}

		<p class="muted">登録済みのメールアドレスに、パスワード再設定用のリンクを送ります。</p>

		<label for="email">メールアドレス</label>
		<input id="email" type="email" bind:value={email} required />

		<button type="submit" disabled={loading}>{loading ? '送信中…' : '再設定リンクを送る'}</button>
		<p class="muted" style="margin-top:12px;"><a href="/login">ログインに戻る</a></p>
	</form>
{/if}
