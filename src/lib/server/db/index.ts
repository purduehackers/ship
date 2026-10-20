import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const databaseUrl = env.TURSO_DATABASE_URL;
if (!databaseUrl) throw new Error('TURSO_DATABASE_URL is not set');

const client = createClient({
	url: databaseUrl,
	authToken: env.TURSO_AUTH_TOKEN
});

export const db = drizzle(client, { schema });
