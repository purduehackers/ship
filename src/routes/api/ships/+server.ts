import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { requireShipApiKey } from '$lib/server/auth';
import { putShipAttachment } from '$lib/server/blob';
import type { StoredAttachment } from '$lib/server/attachments';

interface IncomingAttachment {
	sourceUrl: string;
	type: string;
	filename: string;
	width?: number;
	height?: number;
}

export const POST: RequestHandler = async ({ request }) => {
	requireShipApiKey(request);

	const body = await request.json();
	const { userId, username, avatarUrl, messageId, title, content, attachments } = body as {
		userId?: string;
		username?: string;
		avatarUrl?: string | null;
		messageId?: string;
		title?: string | null;
		content?: string;
		attachments?: IncomingAttachment[];
	};

	if (!userId || !username || !messageId || !content) {
		throw error(400, 'Missing required fields: userId, username, messageId, content');
	}

	// Idempotent on messageId — return the existing ship on retry.
	const existing = await db.select().from(ship).where(eq(ship.messageId, messageId));
	if (existing[0]) {
		return json({ ok: true, id: existing[0].id, alreadyExists: true });
	}

	const stored: StoredAttachment[] = [];
	for (const a of attachments ?? []) {
		const { url } = await putShipAttachment({
			sourceUrl: a.sourceUrl,
			pathname: `ships/${messageId}-${a.filename}`,
			contentType: a.type
		});
		stored.push({
			url,
			type: a.type,
			filename: a.filename,
			width: a.width,
			height: a.height
		});
	}

	const [inserted] = await db
		.insert(ship)
		.values({
			userId,
			username,
			avatarUrl: avatarUrl ?? null,
			messageId,
			title: title ?? null,
			content,
			attachments: JSON.stringify(stored)
		})
		.returning({ id: ship.id });

	return json({ ok: true, id: inserted.id, attachments: stored }, { status: 201 });
};
