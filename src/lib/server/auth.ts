import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export function requireShipApiKey(request: Request): void {
	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${env.SHIP_API_KEY}`) {
		throw error(401, 'Unauthorized');
	}
}

export function requirePrivacyApiKey(request: Request): void {
	const auth = request.headers.get('authorization');
	if (auth !== `Bearer ${env.PRIVACYDB_API_KEY}`) {
		throw error(401, 'Unauthorized');
	}
}
