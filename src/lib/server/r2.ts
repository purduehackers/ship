import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

if (!env.R2_ACCOUNT_ID) throw new Error('R2_ACCOUNT_ID is not set');
if (!env.R2_ACCESS_KEY_ID) throw new Error('R2_ACCESS_KEY_ID is not set');
if (!env.R2_SECRET_ACCESS_KEY) throw new Error('R2_SECRET_ACCESS_KEY is not set');
if (!env.R2_BUCKET_NAME) throw new Error('R2_BUCKET_NAME is not set');

export const r2 = new S3Client({
	region: 'auto',
	endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY
	}
});

export const BUCKET = env.R2_BUCKET_NAME;

export async function uploadAttachment(
	key: string,
	body: Buffer | Uint8Array,
	contentType: string
): Promise<string> {
	await r2.send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: body,
			ContentType: contentType
		})
	);
	return key;
}

export async function getAttachment(key: string) {
	const result = await r2.send(
		new GetObjectCommand({
			Bucket: BUCKET,
			Key: key
		})
	);
	return result;
}
