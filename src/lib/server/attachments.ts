export interface StoredAttachment {
	url: string;
	type: string;
	filename: string;
	width?: number;
	height?: number;
}

export function parseAttachments(raw: string | null | undefined): StoredAttachment[] {
	try {
		const parsed = JSON.parse(raw ?? '[]');
		return Array.isArray(parsed) ? (parsed as StoredAttachment[]) : [];
	} catch {
		return [];
	}
}
