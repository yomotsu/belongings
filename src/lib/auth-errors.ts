// Better Auth のエラーコードを分かりやすい日本語メッセージに変換する。

const MESSAGES: Record<string, string> = {
	USER_ALREADY_EXISTS: 'このメールアドレスは既に登録されています',
	USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'このメールアドレスは既に登録されています。別のメールアドレスをお使いください',
	PASSWORD_TOO_SHORT: 'パスワードは8文字以上で入力してください',
	PASSWORD_TOO_LONG: 'パスワードが長すぎます',
	INVALID_EMAIL: 'メールアドレスの形式が正しくありません',
	INVALID_EMAIL_OR_PASSWORD: 'メールアドレスまたはパスワードが正しくありません',
	INVALID_PASSWORD: 'パスワードが正しくありません',
	USER_NOT_FOUND: 'アカウントが見つかりません',
	FAILED_TO_CREATE_USER: '登録に失敗しました。時間をおいて再度お試しください',
	FAILED_TO_CREATE_SESSION: 'セッションの作成に失敗しました。再度お試しください',
	INVALID_TOKEN: 'リンクが無効か、有効期限が切れています。再度お試しください',
};

type AuthError = { code?: string; message?: string } | null | undefined;

export function authErrorMessage( err: AuthError, fallback: string ): string {

	if ( ! err ) return fallback;
	if ( err.code && MESSAGES[ err.code ] ) return MESSAGES[ err.code ];

	// zod 由来のバリデーションエラーは英語メッセージなので、内容から推定して和訳する。
	if ( err.code === 'VALIDATION_ERROR' ) {

		if ( err.message && /email/i.test( err.message ) ) return 'メールアドレスの形式が正しくありません';
		return '入力内容を確認してください';

	}

	// 未知のコードでもサーバーのメッセージがあれば見せる（無ければ汎用）。
	return err.message ?? fallback;

}
