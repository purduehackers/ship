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

	const deleted = await db.delete(ship).where(eq(ship.messageId, messageId)).returning({ id: ship.id });

	if (deleted.length == 0) {
		return json({ ok: false, reason: "not found" }, { status: 404 });
	} else if (deleted.length > 1) {
		// This should never happen but if it somehow does, we want to know.
		return json({ ok: false, reason: "multiple ships for message" }, { status: 500 });
	}
	const [{ id }] = deleted;

	return json({ ok: true, id });
};
