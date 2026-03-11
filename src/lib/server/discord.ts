import { env } from '$env/dynamic/private';

const DISCORD_API = 'https://discord.com/api/v10';
const GUILD_ID = '772576325897945119';

interface DiscordUser {
	id: string;
	username: string;
	global_name: string | null;
}

interface DiscordChannel {
	id: string;
	name: string;
}

interface DiscordRole {
	id: string;
	name: string;
	color: number;
}

const cache = new Map<string, { data: unknown; expires: number }>();

function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
	const entry = cache.get(key);
	if (entry && entry.expires > Date.now()) return Promise.resolve(entry.data as T);
	return fn().then((data) => {
		cache.set(key, { data, expires: Date.now() + ttlMs });
		return data;
	});
}

async function discordFetch<T>(path: string): Promise<T | null> {
	try {
		const res = await fetch(`${DISCORD_API}${path}`, {
			headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	}
}

const HOUR = 3600_000;

export function getDiscordUser(userId: string): Promise<DiscordUser | null> {
	return cached(`user:${userId}`, HOUR, () => discordFetch<DiscordUser>(`/users/${userId}`));
}

export function getDiscordChannel(channelId: string): Promise<DiscordChannel | null> {
	return cached(`channel:${channelId}`, HOUR, () =>
		discordFetch<DiscordChannel>(`/channels/${channelId}`)
	);
}

export async function getRole(roleId: string): Promise<DiscordRole | null> {
	const roles = await cached(`roles:${GUILD_ID}`, HOUR, () =>
		discordFetch<DiscordRole[]>(`/guilds/${GUILD_ID}/roles`).then((r) => r ?? [])
	);
	return roles.find((r) => r.id === roleId) ?? null;
}
