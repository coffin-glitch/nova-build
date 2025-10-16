import { boolean, integer, jsonb, pgTable, real, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// User roles table
export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// User roles cache table
export const userRolesCache = pgTable('user_roles_cache', {
  clerkUserId: varchar('clerk_user_id', { length: 255 }).primaryKey(),
  role: varchar('role', { length: 50 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  lastSynced: timestamp('last_synced', { withTimezone: true }).notNull().defaultNow(),
  clerkUpdatedAt: integer('clerk_updated_at').notNull().default(0),
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
