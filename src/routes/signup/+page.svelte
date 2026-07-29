<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { authErrorMessage } from '$lib/auth-errors';
	import { goto } from '$app/navigation';

	let name = $state( '' );
	let email = $state( '' );
	let password = $state( '' );
	let error = $state( '' );
	let loading = $state( false );

	async function submit( event: SubmitEvent ) {

		event.preventDefault();
		error = '';
		loading = true;

		try {

			const { error: err } = await authClient.signUp.email( { name, email, password } );

			if ( err ) {

				error = authErrorMessage( err, '登録に失敗しました' );
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

<h1>新規登録</h1>

<form class="card" onsubmit={submit}>
	{#if error}<p class="error">{error}</p>{/if}

	<label for="name">名前</label>
	<input id="name" type="text" bind:value={name} required />

	<label for="email">メールアドレス</label>
	<input id="email" type="email" bind:value={email} required />

	<label for="password">パスワード（8文字以上）</label>
	<input id="password" type="password" bind:value={password} minlength="8" required />

	<button type="submit" disabled={loading}>{loading ? '登録中…' : '登録する'}</button>
	<p class="muted" style="margin-top:12px;">すでにアカウントをお持ちですか？ <a href="/login">ログイン</a></p>
</form>
