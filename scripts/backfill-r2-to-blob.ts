/**
 * One-off backfill: migrate ship attachments from Cloudflare R2 to Vercel Blob.
 *
 * For every ship row, look at each attachment JSON entry:
 *   - if `url` is already set, skip.
 *   - if `key` is set, fetch the R2 object, upload to Blob, rewrite the entry
 *     as `{ url, type, filename, width?, height? }`.
 *
 * Writes the updated attachments JSON back to Turso. Idempotent: re-running is
 * a no-op for fully migrated rows.
 *
 * Usage (env must have TURSO_*, R2_*, BLOB_READ_WRITE_TOKEN set):
 *   bun run scripts/backfill-r2-to-blob.ts [--dry-run] [--limit N] [--verbose]
 *
 * Delete this file once R2 is retired.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { put } from '@vercel/blob';
import { createClient } from '@libsql/client';

interface OldAttachment {
	key?: string;
	url?: string;
	type: string;
	filename: string;
	width?: number;
	height?: number;
}

interface NewAttachment {
	url: string;
	type: string;
	filename: string;
	width?: number;
	height?: number;
}

interface Args {
	dryRun: boolean;
	limit: number | null;
	verbose: boolean;
}

function parseArgs(argv: string[]): Args {
	const args: Args = { dryRun: false, limit: null, verbose: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') args.dryRun = true;
		else if (a === '--verbose') args.verbose = true;
		else if (a === '--limit') {
			const n = parseInt(argv[++i] ?? '', 10);
			if (Number.isNaN(n)) throw new Error('--limit needs a number');
			args.limit = n;
		}
	}
	return args;
}

function need(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`Missing env ${name}`);
	return v;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const turso = createClient({
		url: need('TURSO_DATABASE_URL'),
		authToken: need('TURSO_AUTH_TOKEN')
	});

	const r2 = new S3Client({
		region: 'auto',
		endpoint: `https://${need('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: need('R2_ACCESS_KEY_ID'),
			secretAccessKey: need('R2_SECRET_ACCESS_KEY')
		}
	});
	const bucket = need('R2_BUCKET_NAME');

	need('BLOB_READ_WRITE_TOKEN');

	const rows = await turso.execute({
		sql: `SELECT id, message_id, attachments FROM ship ORDER BY shipped_at DESC ${args.limit ? `LIMIT ${args.limit}` : ''}`
	});

	let shipsTouched = 0;
	let attachmentsMigrated = 0;
	const failures: Array<{ shipId: string; key: string; err: string }> = [];

	for (const row of rows.rows) {
		const id = row.id as string;
		const messageId = row.message_id as string;
		let list: OldAttachment[] = [];
		try {
			list = JSON.parse((row.attachments as string) ?? '[]');
		} catch {
			console.warn(`ship ${id}: bad JSON in attachments, skipping`);
			continue;
		}

		if (!Array.isArray(list) || list.length === 0) continue;
		if (list.every((a) => a.url)) {
			if (args.verbose) console.log(`ship ${id}: already migrated, skip`);
			continue;
		}

		const next: NewAttachment[] = [];
		let dirty = false;
		for (const a of list) {
			if (a.url) {
				next.push({
					url: a.url,
					type: a.type,
					filename: a.filename,
					width: a.width,
					height: a.height
				});
				continue;
			}
			if (!a.key) {
				console.warn(`ship ${id}: attachment has neither key nor url`, a);
				continue;
			}
			try {
				const obj = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: a.key }));
				if (!obj.Body) throw new Error('empty body');
				const bytes = Buffer.from(await obj.Body.transformToByteArray());
				const pathname = `ships/${messageId}-${a.filename}`;
				if (args.dryRun) {
					if (args.verbose)
						console.log(`[dry-run] ship ${id}: would migrate ${a.key} -> ${pathname}`);
					next.push({
						url: `DRY_RUN://blob/${pathname}`,
						type: a.type,
						filename: a.filename,
						width: a.width,
						height: a.height
					});
				} else {
					const { url } = await put(pathname, bytes, {
						access: 'public',
						contentType: a.type,
						addRandomSuffix: false,
						allowOverwrite: true
					});
					next.push({
						url,
						type: a.type,
						filename: a.filename,
						width: a.width,
						height: a.height
					});
					if (args.verbose) console.log(`ship ${id}: migrated ${a.key} -> ${url}`);
				}
				attachmentsMigrated += 1;
				dirty = true;
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				failures.push({ shipId: id, key: a.key, err: msg });
				console.warn(`ship ${id}: FAILED ${a.key}: ${msg}`);
			}
		}

		if (dirty && !args.dryRun) {
			await turso.execute({
				sql: 'UPDATE ship SET attachments = ? WHERE id = ?',
				args: [JSON.stringify(next), id]
			});
		}
		shipsTouched += 1;
	}

	console.log('\n— summary —');
	console.log(`ships touched: ${shipsTouched}`);
	console.log(`attachments migrated: ${attachmentsMigrated}`);
	console.log(`failures: ${failures.length}`);
	if (failures.length) {
		console.log('failed keys (for retry):');
		for (const f of failures) console.log(`  ${f.shipId} ${f.key}: ${f.err}`);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
