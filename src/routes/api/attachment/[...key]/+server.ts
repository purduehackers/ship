import { getAttachment } from '$lib/server/r2';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const result = await getAttachment(params.key);

		if (!result.Body) {
			throw error(404, 'Attachment not found');
		}

		const bytes = await result.Body.transformToByteArray();

		return new Response(bytes as unknown as BodyInit, {
			headers: {
				'Content-Type': result.ContentType || 'application/octet-stream',
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		throw error(500, 'Failed to fetch attachment');
	}
};
