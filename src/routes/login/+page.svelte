<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { authErrorMessage } from '$lib/auth-errors';
	import { goto } from '$app/navigation';

	let email = $state( '' );
	let password = $state( '' );
	let error = $state( '' );
	let loading = $state( false );

	async function submit( event: SubmitEvent ) {

		event.preventDefault();
		error = '';
		loading = true;

		try {

			const { error: err } = await authClient.signIn.email( { email, password } );

			if ( err ) {

				error = authErrorMessage( err, 'ログインに失敗しました' );
				return;

			}

			await goto( '/app' );

		} catch {

			error = '通信エラーが発生しました。接続を確認して再度お試しください';

		} finally {

			loading = false;

		}

	}
</script>

<h1>ログイン</h1>

<form class="card" onsubmit={submit}>
	{#if error}<p class="error">{error}</p>{/if}

	<label for="email">メールアドレス</label>
	<input id="email" type="email" bind:value={email} required />

	<label for="password">パスワード</label>
	<input id="password" type="password" bind:value={password} required />

	<button type="submit" disabled={loading}>{loading ? 'ログイン中…' : 'ログイン'}</button>
	<p class="muted" style="margin-top:12px;">アカウントがありませんか？ <a href="/signup">新規登録</a></p>
</form>
