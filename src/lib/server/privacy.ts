import { env } from '$env/dynamic/private';

if (!env.PRIVACYDB_URL) throw new Error('PRIVACYDB_URL is not set');
if (!env.PRIVACYDB_API_KEY) throw new Error('PRIVACYDB_API_KEY is not set');

const PROJECT = 'ships';

type Mode = 'opt_in' | 'opt_out_privacy' | 'opt_out_collection';

interface PreferencesResponse {
	user_id: string;
	mode: Mode;
	overrides: Record<string, Mode>;
}

/**
 * Fetch a user's effective privacy mode for the ships project.
 * Project override takes priority over global mode.
 */
export async function getUserMode(userId: string): Promise<Mode> {
	const res = await fetch(`${env.PRIVACYDB_URL}/preferences/${userId}`, {
		headers: { Authorization: `Bearer ${env.PRIVACYDB_API_KEY}` }
	});

	if (!res.ok) {
		// If user not found or error, default to opt_in
		return 'opt_in';
	}

	const data: PreferencesResponse = await res.json();
	return data.overrides[PROJECT] ?? data.mode;
}

/**
 * Batch-fetch privacy modes for multiple users.
 * Returns a map of userId -> effective mode for the ships project.
 */
export async function getUserModes(userIds: string[]): Promise<Map<string, Mode>> {
	const unique = [...new Set(userIds)];
	const entries = await Promise.all(
		unique.map(async (id) => [id, await getUserMode(id)] as const)
	);
	return new Map(entries);
}
