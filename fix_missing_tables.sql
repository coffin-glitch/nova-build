-- Fix missing tables in Supabase
-- This script creates all missing tables with proper structure

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create missing tables
CREATE TABLE IF NOT EXISTS admin_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    admin_user_id text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS assignments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    load_id uuid NOT NULL,
    carrier_user_id text NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'assigned',
    notes text,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS carrier_chat_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    admin_user_id text NOT NULL,
    message text NOT NULL,
    is_from_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS carrier_favorites (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    load_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS carrier_notification_preferences (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    notification_type text NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS conversations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    admin_user_id text NOT NULL,
    subject text NOT NULL,
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS dedicated_lanes (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    origin_city text NOT NULL,
    origin_state text NOT NULL,
    destination_city text NOT NULL,
    destination_state text NOT NULL,
    rate_per_mile numeric,
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS load_offers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    load_id uuid NOT NULL,
    carrier_user_id text NOT NULL,
    offer_amount numeric NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS message_reads (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    user_id text NOT NULL,
    read_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_messages_carrier_user_id ON admin_messages(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_admin_user_id ON admin_messages(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_load_id ON assignments(load_id);
CREATE INDEX IF NOT EXISTS idx_assignments_carrier_user_id ON assignments(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_carrier_user_id ON carrier_chat_messages(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_favorites_carrier_user_id ON carrier_favorites(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_favorites_load_id ON carrier_favorites(load_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_carrier_user_id ON conversations(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_admin_user_id ON conversations(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_load_id ON load_offers(load_id);
CREATE INDEX IF NOT EXISTS idx_load_offers_carrier_user_id ON load_offers(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);

