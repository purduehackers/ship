import { put, del } from '@vercel/blob';

const FETCH_TIMEOUT_MS = 15_000;

export interface PutShipAttachmentInput {
	sourceUrl: string;
	pathname: string;
	contentType: string;
}

export async function putShipAttachment(input: PutShipAttachmentInput): Promise<{ url: string }> {
	const res = await fetch(input.sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	if (!res.ok) {
		throw new Error(`Failed to fetch ${input.sourceUrl}: ${res.status} ${res.statusText}`);
	}
	const blob = await res.blob();
	const { url } = await put(input.pathname, blob, {
		access: 'public',
		contentType: input.contentType || blob.type || 'application/octet-stream',
		addRandomSuffix: false,
		allowOverwrite: true
	});
	return { url };
}

export async function deleteShipAttachment(url: string): Promise<void> {
	try {
		await del(url);
	} catch (err) {
		const status = (err as { status?: number }).status;
		if (status === 404) return;
		throw err;
	}
}
