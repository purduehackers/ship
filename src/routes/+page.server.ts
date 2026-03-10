import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';

interface StoredAttachment {
	key: string;
	type: string;
	filename: string;
}

export async function load() {
	const ships = await db.select().from(ship).orderBy(desc(ship.shippedAt));

	return {
		ships: ships.map((s) => {
			const stored = JSON.parse(s.attachments ?? '[]') as StoredAttachment[];
			return {
				...s,
				attachments: stored.map((a) => ({
					url: `/api/attachment/${a.key}`,
					type: a.type,
					filename: a.filename
				}))
			};
		})
	};
}
