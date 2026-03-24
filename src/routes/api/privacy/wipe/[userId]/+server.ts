import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { r2, BUCKET } from '$lib/server/r2';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface StoredAttachment {
	key: string;
	type: string;
	filename: string;
}

export const POST: RequestHandler = async ({ params, request }) => {
	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${env.PRIVACYDB_API_KEY}`) {
		throw error(401, 'Unauthorized');
	}

	const { userId } = params;

	// Find all ships by this user
	const userShips = await db.select().from(ship).where(eq(ship.userId, userId));

	// Delete all R2 attachments
	const attachmentKeys = userShips.flatMap((s) => {
		const stored = JSON.parse(s.attachments ?? '[]') as StoredAttachment[];
		return stored.map((a) => a.key);
	});

	await Promise.all(
		attachmentKeys.map((key) =>
			r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
		)
	);

	// Delete all ship records
	await db.delete(ship).where(eq(ship.userId, userId));

	return json({ ok: true, deleted: userShips.length });
};
