import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, request }) => {
	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${env.SHIP_API_KEY}`) {
		throw error(401, 'Unauthorized');
	}

	const { messageId } = params;

	await db.delete(ship).where(eq(ship.messageId, messageId));

	return json({ ok: true });
};
