import { boolean, integer, jsonb, pgTable, real, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// User roles table
export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// User roles cache table (Supabase-only)
export const userRolesCache = pgTable('user_roles_cache', {
  supabaseUserId: varchar('supabase_user_id', { length: 255 }).primaryKey(),
  role: varchar('role', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  lastSynced: timestamp('last_synced', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Telegram bids table
export const telegramBids = pgTable('telegram_bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  bidNumber: varchar('bid_number', { length: 255 }).notNull().unique(),
  distanceMiles: real('distance_miles'),
  pickupTimestamp: timestamp('pickup_timestamp', { withTimezone: true }),
  deliveryTimestamp: timestamp('delivery_timestamp', { withTimezone: true }),
  stops: jsonb('stops'),
  tag: varchar('tag', { length: 100 }),
  sourceChannel: varchar('source_channel', { length: 255 }).notNull(),
  forwardedTo: varchar('forwarded_to', { length: 255 }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  published: boolean('published').notNull().default(true),
  isArchived: boolean('is_archived').notNull().default(false),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
});

// Loads table
export const loads = pgTable('loads', {
  id: uuid('id').primaryKey().defaultRandom(),
  rrNumber: varchar('rr_number', { length: 50 }).notNull().unique(),
  tmNumber: varchar('tm_number', { length: 50 }),
  statusCode: varchar('status_code', { length: 50 }).default('active'),
  originCity: varchar('origin_city', { length: 100 }),
  originState: varchar('origin_state', { length: 50 }),
  destinationCity: varchar('destination_city', { length: 100 }),
  destinationState: varchar('destination_state', { length: 50 }),
  equipment: varchar('equipment', { length: 100 }),
  weight: real('weight'),
  revenue: real('revenue'),
  customerName: varchar('customer_name', { length: 255 }),
  customerRef: varchar('customer_ref', { length: 100 }),
  driverName: varchar('driver_name', { length: 255 }),
  pickupDate: timestamp('pickup_date', { withTimezone: true }),
  pickupTime: varchar('pickup_time', { length: 50 }),
  deliveryDate: timestamp('delivery_date', { withTimezone: true }),
  deliveryTime: varchar('delivery_time', { length: 50 }),
  stops: integer('stops'),
  miles: integer('miles'),
  published: boolean('published').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Load offers table
export const loadOffers = pgTable('load_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadRrNumber: varchar('load_rr_number', { length: 50 }).notNull(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  offerAmount: integer('offer_amount').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  counterAmount: integer('counter_amount'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Load lifecycle events table
export const loadLifecycleEvents = pgTable('load_lifecycle_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  loadOfferId: uuid('load_offer_id').notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  notes: text('notes'),
  location: varchar('location', { length: 255 }),
  photos: text('photos').array(),
  documents: text('documents').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier profiles table
export const carrierProfiles = pgTable('carrier_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),
  mcNumber: varchar('mc_number', { length: 50 }),
  dotNumber: varchar('dot_number', { length: 50 }),
  phone: varchar('phone', { length: 20 }),
  dispatchEmail: varchar('dispatch_email', { length: 255 }),
  companyName: varchar('company_name', { length: 255 }),
  contactName: varchar('contact_name', { length: 255 }),
  isLocked: boolean('is_locked').notNull().default(false),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  lockedBy: varchar('locked_by', { length: 255 }),
  lockReason: text('lock_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier bids table
export const carrierBids = pgTable('carrier_bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  bidNumber: varchar('bid_number', { length: 255 }).notNull(),
  bidAmount: integer('bid_amount').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  bidOutcome: varchar('bid_outcome', { length: 20 }).default('pending'),
  finalAmountCents: integer('final_amount_cents'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier chat messages table
export const carrierChatMessages = pgTable('carrier_chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isFromCarrier: boolean('is_from_carrier').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Admin messages table
export const adminMessages = pgTable('admin_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Dedicated lanes table
export const dedicatedLanes = pgTable('dedicated_lanes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  originCity: varchar('origin_city', { length: 100 }),
  originState: varchar('origin_state', { length: 50 }),
  destinationCity: varchar('destination_city', { length: 100 }),
  destinationState: varchar('destination_state', { length: 50 }),
  equipment: varchar('equipment', { length: 100 }),
  frequency: varchar('frequency', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier favorites table
export const carrierFavorites = pgTable('carrier_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  bidNumber: varchar('bid_number', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier notification preferences table
export const carrierNotificationPreferences = pgTable('carrier_notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull().unique(),
  emailNotifications: boolean('email_notifications').notNull().default(true),
  similarLoadNotifications: boolean('similar_load_notifications').notNull().default(true),
  distanceThresholdMiles: integer('distance_threshold_miles').notNull().default(50),
  statePreferences: text('state_preferences').array(),
  equipmentPreferences: text('equipment_preferences').array(),
  minDistance: integer('min_distance').notNull().default(0),
  maxDistance: integer('max_distance').notNull().default(2000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier notifications table
export const carrierNotifications = pgTable('carrier_notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  bidNumber: varchar('bid_number', { length: 255 }),
  isRead: boolean('is_read').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
});

// Archived bids table
export const archivedBids = pgTable('archived_bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  bidNumber: varchar('bid_number', { length: 50 }).notNull().unique(),
  distanceMiles: integer('distance_miles').notNull(),
  pickupTimestamp: timestamp('pickup_timestamp', { withTimezone: true }).notNull(),
  deliveryTimestamp: timestamp('delivery_timestamp', { withTimezone: true }).notNull(),
  stops: jsonb('stops').notNull(),
  tag: varchar('tag', { length: 20 }),
  sourceChannel: varchar('source_channel', { length: 50 }).notNull(),
  forwardedTo: varchar('forwarded_to', { length: 50 }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }).notNull().defaultNow(),
  originalId: integer('original_id'),
});

// Announcements table
export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  priority: varchar('priority', { length: 20 }).notNull().default('normal'),
  createdBy: uuid('created_by').notNull(), // Admin user ID (Supabase auth.users.id)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').notNull().default(true),
  targetAudience: varchar('target_audience', { length: 50 }).default('all'),
  metadata: jsonb('metadata').default('{}'),
});

// Announcement reads table
export const announcementReads = pgTable('announcement_reads', {
  id: uuid('id').primaryKey().defaultRandom(),
  announcementId: uuid('announcement_id').notNull().references(() => announcements.id, { onDelete: 'cascade' }),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
});

// Saved recipient lists table
export const savedRecipientLists = pgTable('saved_recipient_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdBy: uuid('created_by').notNull(),
  recipientUserIds: jsonb('recipient_user_ids').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Auction awards table (admin adjudication results)
// Note: Database uses INTEGER/BIGSERIAL, matching actual schema
export const auctionAwards = pgTable('auction_awards', {
  id: integer('id').primaryKey(),
  bidNumber: varchar('bid_number', { length: 255 }).notNull().unique(),
  winnerUserId: varchar('winner_user_id', { length: 255 }).notNull(),
  winnerAmountCents: integer('winner_amount_cents').notNull(),
  awardedBy: varchar('awarded_by', { length: 255 }).notNull(),
  adminNotes: text('admin_notes'),
  awardedAt: timestamp('awarded_at', { withTimezone: true }).notNull().defaultNow(),
});

// Carrier bid history table
export const carrierBidHistory = pgTable('carrier_bid_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  bidNumber: varchar('bid_number', { length: 50 }).notNull(),
  bidAmountCents: integer('bid_amount_cents').notNull(),
  bidStatus: varchar('bid_status', { length: 20 }).notNull(),
  bidNotes: text('bid_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Notification triggers table
export const notificationTriggers = pgTable('notification_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  triggerType: varchar('trigger_type', { length: 50 }).notNull(),
  triggerConfig: jsonb('trigger_config').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Notification logs table
export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  carrierUserId: varchar('carrier_user_id', { length: 255 }).notNull(),
  triggerId: uuid('trigger_id'),
  notificationType: varchar('notification_type', { length: 50 }).notNull(),
  bidNumber: varchar('bid_number', { length: 50 }),
  message: text('message').notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  deliveryStatus: varchar('delivery_status', { length: 20 }).notNull().default('sent'),
});

// Contact messages table
export const contactMessages = pgTable('contact_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }),
  message: text('message').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('new'),
  adminNotes: text('admin_notes'),
  repliedAt: timestamp('replied_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
