import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { requirePrivacyApiKey } from '$lib/server/auth';
import { parseAttachments } from '$lib/server/attachments';
import { deleteShipAttachment } from '$lib/server/blob';

export const POST: RequestHandler = async ({ params, request }) => {
	requirePrivacyApiKey(request);

	const { userId } = params;

	const userShips = await db.select().from(ship).where(eq(ship.userId, userId));

	const urls = userShips.flatMap((s) => parseAttachments(s.attachments).map((a) => a.url));

	await Promise.all(
		urls.map((url) =>
			deleteShipAttachment(url).catch((err) => {
				console.warn(`Failed to delete blob ${url}:`, err);
			})
		)
	);

	await db.delete(ship).where(eq(ship.userId, userId));

	return json({ ok: true, deleted: userShips.length });
};
