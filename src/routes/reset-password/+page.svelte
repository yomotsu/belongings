<script lang="ts">
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { authErrorMessage } from '$lib/auth-errors';
	import { goto } from '$app/navigation';

	// メールのリンクは /reset-password?token=... （無効・期限切れなら ?error=INVALID_TOKEN）。
	let token = $derived( page.url.searchParams.get( 'token' ) ?? '' );
	let linkError = $derived( page.url.searchParams.get( 'error' ) ?? '' );

	let password = $state( '' );
	let confirm = $state( '' );
	let error = $state( '' );
	let loading = $state( false );
	let done = $state( false );

	async function submit( event: SubmitEvent ) {

		event.preventDefault();
		error = '';

		if ( password.length < 8 ) {

			error = 'パスワードは8文字以上で入力してください';
			return;

		}

		if ( password !== confirm ) {

			error = 'パスワードが一致しません';
			return;

		}

		loading = true;

		try {

			const { error: err } = await authClient.resetPassword( { newPassword: password, token } );

			if ( err ) {

				error = authErrorMessage( err, 'パスワードの再設定に失敗しました' );
				return;

			}

			done = true;
			setTimeout( () => goto( '/login' ), 1500 );

		} catch {

			error = '通信エラーが発生しました。接続を確認して再度お試しください';

		} finally {

			loading = false;

		}

	}
</script>

<h1>新しいパスワードの設定</h1>

{#if done}
	<div class="card">
		<p>パスワードを再設定しました。ログイン画面に移動します…</p>
		<p class="muted"><a href="/login">すぐにログインする</a></p>
	</div>
{:else if linkError || ! token}
	<div class="card">
		<p class="error">リンクが無効か、有効期限が切れています。お手数ですが再度お試しください。</p>
		<p class="muted"><a href="/forgot-password">再設定リンクを送り直す</a></p>
	</div>
{:else}
	<form class="card" onsubmit={submit}>
		{#if error}<p class="error">{error}</p>{/if}

		<label for="password">新しいパスワード</label>
		<input id="password" type="password" bind:value={password} required />

		<label for="confirm">新しいパスワード（確認）</label>
		<input id="confirm" type="password" bind:value={confirm} required />

		<button type="submit" disabled={loading}>{loading ? '設定中…' : 'パスワードを再設定'}</button>
	</form>
{/if}
