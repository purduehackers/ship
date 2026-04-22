import { db } from '$lib/server/db';
import { ship } from '$lib/server/db/schema';
import { desc } from 'drizzle-orm';
import { renderContent } from '$lib/server/markdown';
import { getUserModes } from '$lib/server/privacy';
import { env } from '$env/dynamic/private';
import { parseAttachments } from '$lib/server/attachments';

if (!env.ISR_BYPASS_TOKEN) throw new Error('ISR_BYPASS_TOKEN is not set');

export const config = {
	isr: {
		expiration: 60,
		bypassToken: env.ISR_BYPASS_TOKEN
	}
};

export async function load() {
	const ships = await db.select().from(ship).orderBy(desc(ship.shippedAt));

	// Filter out ships from users who have opted out
	const modes = await getUserModes(ships.map((s) => s.userId));
	const visibleShips = ships.filter((s) => modes.get(s.userId) === 'opt_in');

	const mapped = await Promise.all(
		visibleShips.map(async (s) => {
			const stored = parseAttachments(s.attachments);
			const contentHtml = s.content?.trim() ? await renderContent(s.content) : null;
			return {
				...s,
				contentHtml,
				attachments: stored.map((a) => ({
					url: a.url,
					type: a.type,
					filename: a.filename,
					width: a.width,
					height: a.height
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
