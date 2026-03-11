import { getAttachment } from '$lib/server/r2';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, request }) => {
	try {
		const range = request.headers.get('range') || undefined;
		const result = await getAttachment(params.key, range);

		if (!result.Body) {
			throw error(404, 'Attachment not found');
		}

		const contentType = result.ContentType || 'application/octet-stream';
		const headers: Record<string, string> = {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=31536000, immutable',
			'Accept-Ranges': 'bytes'
		};

		if (range && result.ContentRange) {
			headers['Content-Range'] = result.ContentRange;
			if (result.ContentLength != null) {
				headers['Content-Length'] = String(result.ContentLength);
			}
			return new Response(result.Body.transformToWebStream() as ReadableStream, {
				status: 206,
				headers
			});
		}

		if (result.ContentLength != null) {
			headers['Content-Length'] = String(result.ContentLength);
		}
		return new Response(result.Body.transformToWebStream() as ReadableStream, { headers });
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		throw error(500, 'Failed to fetch attachment');
	}
};
