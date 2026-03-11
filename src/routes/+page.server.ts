import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { renderContent } from '$lib/server/markdown';

interface StoredAttachment {
	key: string;
	type: string;
	filename: string;
}

export async function load() {
	const ships = await db.select().from(ship).orderBy(desc(ship.shippedAt));

	const mapped = await Promise.all(
		ships.map(async (s) => {
			const stored = JSON.parse(s.attachments ?? '[]') as StoredAttachment[];
			const contentHtml = s.content?.trim() ? await renderContent(s.content) : null;
			return {
				...s,
				contentHtml,
				attachments: stored.map((a) => ({
					url: `/api/attachment/${a.key}`,
					type: a.type,
					filename: a.filename
				}))
			};
		})
	);

	return {
		ships: mapped.filter((s) => {
			const hasContent = !!s.contentHtml;
			const hasMedia = s.attachments.some(
				(a) => a.type.startsWith('image') || a.type.startsWith('video')
			);
			return hasContent || hasMedia;
		})
	};
}
