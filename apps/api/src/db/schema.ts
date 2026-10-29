import { pgTable, uuid, varchar, text, timestamp, primaryKey, index, check, integer, customType } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
export const users = pgTable('users', {
  id:uuid().defaultRandom().primaryKey(), username:varchar({length:30}).notNull().unique(), email:varchar({length:254}).notNull().unique(),
  passwordHash:text('password_hash').notNull(), displayName:varchar('display_name',{length:60}).notNull(), bio:varchar({length:240}).notNull().default(''),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
});
export const sessions = pgTable('sessions', {
  id:uuid().defaultRandom().primaryKey(),userId:uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  tokenHash:text('token_hash').notNull().unique(),expiresAt:timestamp('expires_at',{withTimezone:true}).notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[index('sessions_user_idx').on(t.userId),index('sessions_expiry_idx').on(t.expiresAt)]);
export const posts = pgTable('posts', {
  id:uuid().defaultRandom().primaryKey(),authorId:uuid('author_id').notNull().references(()=>users.id,{onDelete:'cascade'}),body:varchar({length:2000}).notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[index('posts_feed_idx').on(t.createdAt,t.id),index('posts_author_idx').on(t.authorId),check('posts_body_check',sql`length(trim(${t.body})) > 0`)]);
export const comments = pgTable('comments', {
  id:uuid().defaultRandom().primaryKey(),postId:uuid('post_id').notNull().references(()=>posts.id,{onDelete:'cascade'}),authorId:uuid('author_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  body:varchar({length:500}).notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[index('comments_post_idx').on(t.postId,t.createdAt),check('comments_body_check',sql`length(trim(${t.body})) > 0`)]);
export const likes = pgTable('likes', {
  userId:uuid('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),postId:uuid('post_id').notNull().references(()=>posts.id,{onDelete:'cascade'}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[primaryKey({columns:[t.userId,t.postId]}),index('likes_post_idx').on(t.postId)]);
export const follows = pgTable('follows', {
  followerId:uuid('follower_id').notNull().references(()=>users.id,{onDelete:'cascade'}),followingId:uuid('following_id').notNull().references(()=>users.id,{onDelete:'cascade'}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[primaryKey({columns:[t.followerId,t.followingId]}),index('follows_following_idx').on(t.followingId),check('no_self_follow',sql`${t.followerId} <> ${t.followingId}`)]);
// Evolución 2: notificaciones persistentes, independientes de la conexión SSE.
export const notifications = pgTable('notifications', {
  id:uuid().defaultRandom().primaryKey(),recipientId:uuid('recipient_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  actorId:uuid('actor_id').notNull().references(()=>users.id,{onDelete:'cascade'}),type:varchar({length:16}).notNull(),
  postId:uuid('post_id').references(()=>posts.id,{onDelete:'cascade'}),readAt:timestamp('read_at',{withTimezone:true}),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[index('notifications_recipient_idx').on(t.recipientId,t.createdAt),check('notification_type_check',sql`${t.type} in ('like','comment','follow')`)]);
export const messages = pgTable('messages', {
  id:uuid().defaultRandom().primaryKey(),senderId:uuid('sender_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  recipientId:uuid('recipient_id').notNull().references(()=>users.id,{onDelete:'cascade'}),body:varchar({length:2000}).notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),readAt:timestamp('read_at',{withTimezone:true})
},t=>[index('messages_pair_idx').on(t.senderId,t.recipientId,t.createdAt,t.id),index('messages_recipient_idx').on(t.recipientId,t.createdAt),check('messages_no_self',sql`${t.senderId} <> ${t.recipientId}`)]);
const bytea=customType<{data:Buffer}>({dataType(){return 'bytea';}});
export const attachments = pgTable('attachments', {
  id:uuid().defaultRandom().primaryKey(),ownerId:uuid('owner_id').notNull().references(()=>users.id,{onDelete:'cascade'}),
  postId:uuid('post_id').references(()=>posts.id,{onDelete:'cascade'}),messageId:uuid('message_id').references(()=>messages.id,{onDelete:'cascade'}),
  name:varchar({length:120}).notNull(),mime:varchar({length:50}).notNull(),size:integer().notNull(),data:bytea().notNull(),
  createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow()
},t=>[index('attachments_owner_idx').on(t.ownerId),index('attachments_post_idx').on(t.postId),index('attachments_message_idx').on(t.messageId),
  check('attachments_one_parent',sql`${t.postId} IS NULL OR ${t.messageId} IS NULL`),check('attachments_size_check',sql`${t.size}>0 AND ${t.size}<=2097152`)]);
