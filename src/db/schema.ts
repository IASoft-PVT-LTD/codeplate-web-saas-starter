// The database schema. Every change here needs a migration:
//   npm run db:generate   (writes drizzle/NNNN_*.sql; commit it)
// The auth tables (user, session, account, verification) are the ones
// Better Auth expects; keep their columns.
import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// --- Auth (Better Auth) -------------------------------------------------------

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (t) => [index('session_user_idx').on(t.userId)]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('account_user_idx').on(t.userId)]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- The core resource ------------------------------------------------------------
// "Projects" is a placeholder for the product's main thing. Rename it with
// docs/recipes/rename-the-core-resource.md.

export const project = pgTable('project', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['planned', 'active', 'done'] }).notNull().default('planned'),
  dueDate: text('due_date'), // ISO date (YYYY-MM-DD) or null
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('project_owner_idx').on(t.ownerId)]);

// --- Billing (Paddle) -----------------------------------------------------------------

/** One row per Paddle subscription, kept up to date by the webhook. */
export const subscription = pgTable('subscription', {
  id: text('id').primaryKey(), // Paddle subscription id (sub_...)
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  paddleCustomerId: text('paddle_customer_id').notNull(),
  priceId: text('price_id').notNull(),
  plan: text('plan').notNull(), // a PlanId from config/plans.ts
  status: text('status').notNull(), // active, trialing, past_due, paused, canceled
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('subscription_user_idx').on(t.userId)]);

/** Paddle event ids already handled, so a retried webhook is applied once. */
export const webhookEvent = pgTable('webhook_event', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});

// --- Dev outbox ----------------------------------------------------------------------------
/** Emails sent while no email provider is configured (dev and tests). /dev/outbox lists them. */
export const outbox = pgTable('outbox', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  text: text('text').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
});
