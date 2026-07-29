// SendGrid の HTTP API でメールを送る薄いラッパー。
// SDK は使わず fetch で叩くだけ（Workers から追加依存なしで動く）。
//
// SENDGRID_API_KEY が未設定のローカル開発では、実送信せず本文を console に
// 出力するだけにする。これでメール基盤が無くてもリセットURLを拾って動作確認できる。

type Env = App.Platform['env'];

type Mail = {
	to: string;
	subject: string;
	text: string;
	html?: string;
};

export async function sendMail( env: Env, mail: Mail ): Promise<void> {

	const apiKey = env.SENDGRID_API_KEY;
	const from = env.MAIL_FROM;

	if ( ! apiKey || ! from ) {

		// 開発用フォールバック。件名・宛先・本文（リセットURLを含む）をログに出す。
		console.log( `[email:fallback] to=${mail.to} subject=${mail.subject}\n${mail.text}` );
		return;

	}

	const content = [ { type: 'text/plain', value: mail.text } ];
	if ( mail.html ) content.push( { type: 'text/html', value: mail.html } );

	const res = await fetch( 'https://api.sendgrid.com/v3/mail/send', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify( {
			personalizations: [ { to: [ { email: mail.to } ] } ],
			from: { email: from },
			subject: mail.subject,
			content,
		} ),
	} );

	// 送信失敗でフロー全体を落とさない。ログだけ残し、ユーザーには「送信しました」を返す。
	if ( ! res.ok ) {

		const body = await res.text().catch( () => '' );
		console.error( `[email:sendgrid] failed status=${res.status} body=${body}` );

	}

}
