import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const ship = sqliteTable('ship', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	userId: text('user_id').notNull(),
	username: text('username').notNull(),
	avatarUrl: text('avatar_url'),
	messageId: text('message_id'),
	title: text('title'),
	content: text('content'),
	attachments: text('attachments').default('[]'),
	shippedAt: text('shipped_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
});
