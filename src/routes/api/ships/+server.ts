import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${env.SHIP_API_KEY}`) {
		throw error(401, 'Unauthorized');
	}

	const body = await request.json();

	const { userId, username, avatarUrl, messageId, title, content, attachments } = body;

	if (!userId || !username || !messageId || !content) {
		throw error(400, 'Missing required fields: userId, username, messageId, content');
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
			attachments: JSON.stringify(attachments ?? [])
		})
		.returning({ id: ship.id });

	return json({ ok: true, id: inserted.id }, { status: 201 });
};
