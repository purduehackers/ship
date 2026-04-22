import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { requireShipApiKey } from '$lib/server/auth';
import { parseAttachments } from '$lib/server/attachments';
import { deleteShipAttachment } from '$lib/server/blob';

export const DELETE: RequestHandler = async ({ params, request }) => {
	requireShipApiKey(request);

	const { messageId } = params;

	const deleted = await db
		.delete(ship)
		.where(eq(ship.messageId, messageId))
		.returning({ id: ship.id, attachments: ship.attachments });

	if (deleted.length === 0) {
		return json({ ok: false, reason: 'not found' }, { status: 404 });
	}
	if (deleted.length > 1) {
		// Should never happen: messageId isn't unique-indexed but should be in practice.
		return json({ ok: false, reason: 'multiple ships for message' }, { status: 500 });
	}

	const [{ id, attachments }] = deleted;
	const stored = parseAttachments(attachments);

	let attachmentsRemoved = 0;
	for (const a of stored) {
		try {
			await deleteShipAttachment(a.url);
			attachmentsRemoved += 1;
		} catch (err) {
			console.warn(`Failed to delete blob ${a.url} for ship ${id}:`, err);
		}
	}

	return json({ ok: true, id, attachmentsRemoved });
};
