import { createAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

const handler: RequestHandler = ( { request, platform } ) => {

	return createAuth( platform!.env ).handler( request );

};

export const GET = handler;
export const POST = handler;
