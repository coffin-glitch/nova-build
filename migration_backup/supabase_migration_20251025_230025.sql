-- NOVA Build Supabase Migration
-- Generated: TIMESTAMP_PLACEHOLDER

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in Supabase (in reverse dependency order)
DROP TABLE IF EXISTS active_telegram_bids CASCADE;
DROP TABLE IF EXISTS admin_messages CASCADE;
DROP TABLE IF EXISTS admin_profile_actions CASCADE;
DROP TABLE IF EXISTS archived_bids CASCADE;
DROP TABLE IF EXISTS archived_bids_with_metadata CASCADE;
DROP TABLE IF EXISTS auction_awards CASCADE;
DROP TABLE IF EXISTS carrier_bid_history CASCADE;
DROP TABLE IF EXISTS carrier_bids CASCADE;
DROP TABLE IF EXISTS carrier_chat_messages CASCADE;
DROP TABLE IF EXISTS carrier_favorites CASCADE;
DROP TABLE IF EXISTS carrier_notification_preferences CASCADE;
DROP TABLE IF EXISTS carrier_notifications CASCADE;
DROP TABLE IF EXISTS carrier_profile_history CASCADE;
DROP TABLE IF EXISTS carrier_profiles CASCADE;
DROP TABLE IF EXISTS conversation_messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS dedicated_lanes CASCADE;
DROP TABLE IF EXISTS load_lifecycle_events CASCADE;
DROP TABLE IF EXISTS load_offers CASCADE;
DROP TABLE IF EXISTS loads CASCADE;
DROP TABLE IF EXISTS message_reads CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS telegram_bids CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;

-- Create all tables from local database
--
-- PostgreSQL database dump
--

\restrict zDO3SyYFIsYEwffaSwq5AozBgimKsfAGFuuqcahgwHTMuLCjFraC1RNeSLY306t

-- Dumped from database version 15.14 (Homebrew)
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: archive_expired_bids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.archive_expired_bids() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Archive bids that are expired and not already archived
    WITH archived AS (
        INSERT INTO archived_bids (
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, original_id
        )
        SELECT 
            bid_number, distance_miles, 
            COALESCE(pickup_timestamp, NOW()), -- Handle null pickup_timestamp
            COALESCE(delivery_timestamp, NOW()), -- Handle null delivery_timestamp
            stops, tag, source_channel, forwarded_to, received_at, id
        FROM telegram_bids
        WHERE is_archived = false 
        AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
        RETURNING id
    )
    UPDATE telegram_bids 
    SET is_archived = true, archived_at = NOW()
    WHERE id IN (SELECT id FROM archived); -- Fixed: use 'id' instead of 'original_id'
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$;


--
-- Name: FUNCTION archive_expired_bids(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.archive_expired_bids() IS 'Automatically archives expired bids';


--
-- Name: check_cross_carrier_driver(character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_cross_carrier_driver(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) RETURNS TABLE(other_carrier_id character varying, profile_name character varying, similarity_score integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dp.carrier_user_id as other_carrier_id,
        dp.profile_name,
        CASE 
            WHEN dp.driver_name = p_driver_name AND dp.driver_phone = p_driver_phone AND dp.driver_license_number = p_driver_license_number THEN 100
            WHEN dp.driver_name = p_driver_name AND dp.driver_phone = p_driver_phone THEN 80
            WHEN dp.driver_name = p_driver_name AND dp.driver_license_number = p_driver_license_number THEN 70
            WHEN dp.driver_name = p_driver_name THEN 50
            ELSE 0
        END as similarity_score
    FROM driver_profiles dp
    WHERE dp.carrier_user_id != p_carrier_user_id
    AND dp.is_active = true
    AND (
        dp.driver_name = p_driver_name 
        OR dp.driver_phone = p_driver_phone 
        OR dp.driver_license_number = p_driver_license_number
    )
    ORDER BY similarity_score DESC;
END;
$$;


--
-- Name: FUNCTION check_cross_carrier_driver(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.check_cross_carrier_driver(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) IS 'Checks for potential duplicate drivers across different carriers. Returns similarity scores to help identify the same driver working for multiple carriers.';


--
-- Name: cleanup_old_archived_bids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_old_archived_bids() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM archived_bids 
    WHERE archived_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_archived_bids(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cleanup_old_archived_bids() IS 'Cleans up archived bids older than 90 days';


--
-- Name: find_similar_loads(character varying, integer, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.find_similar_loads(p_carrier_user_id character varying, p_distance_threshold integer DEFAULT 50, p_state_preferences text[] DEFAULT NULL::text[]) RETURNS TABLE(bid_number character varying, similarity_score integer, distance_miles integer, pickup_timestamp timestamp with time zone, delivery_timestamp timestamp with time zone, stops jsonb, tag character varying, source_channel character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH carrier_preferences AS (
        SELECT 
            COALESCE(distance_threshold_miles, 50) as dist_threshold,
            COALESCE(state_preferences, ARRAY[]::TEXT[]) as states
        FROM carrier_notification_preferences 
        WHERE carrier_user_id = p_carrier_user_id
        LIMIT 1
    ),
    favorite_routes AS (
        SELECT DISTINCT
            tb.distance_miles,
            tb.stops,
            tb.tag,
            tb.pickup_timestamp,
            tb.delivery_timestamp
        FROM carrier_favorites cf
        JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
        WHERE cf.carrier_user_id = p_carrier_user_id
    )
    SELECT 
        tb.bid_number,
        CASE 
            WHEN ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold THEN 100 - ABS(tb.distance_miles - fr.distance_miles)
            ELSE 0
        END::INTEGER as similarity_score,
        tb.distance_miles,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.stops,
        tb.tag,
        tb.source_channel
    FROM telegram_bids tb
    CROSS JOIN carrier_preferences cp
    CROSS JOIN favorite_routes fr
    WHERE tb.is_archived = false
    AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
    AND (
        cp.states = ARRAY[]::TEXT[] OR 
        tb.tag = ANY(cp.states)
    )
    AND ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$;


--
-- Name: FUNCTION find_similar_loads(p_carrier_user_id character varying, p_distance_threshold integer, p_state_preferences text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.find_similar_loads(p_carrier_user_id character varying, p_distance_threshold integer, p_state_preferences text[]) IS 'Finds similar loads for notification triggers';


--
-- Name: generate_carrier_aware_profile_name(character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_carrier_aware_profile_name(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_name VARCHAR(255);
    counter INTEGER := 1;
    unique_name VARCHAR(255);
    phone_suffix VARCHAR(10);
    license_suffix VARCHAR(10);
    carrier_suffix VARCHAR(20);
BEGIN
    -- Create base name from driver name
    base_name := TRIM(p_driver_name);
    
    -- Add phone suffix if available (last 4 digits)
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        base_name := base_name || ' (' || phone_suffix || ')';
    END IF;
    
    -- Add license suffix if available (last 4 characters)
    IF p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        license_suffix := RIGHT(p_driver_license_number, 4);
        base_name := base_name || ' - ' || license_suffix;
    END IF;
    
    -- Add carrier context suffix (last 6 characters of carrier_user_id)
    IF p_carrier_user_id IS NOT NULL AND LENGTH(p_carrier_user_id) >= 6 THEN
        carrier_suffix := RIGHT(p_carrier_user_id, 6);
        base_name := base_name || ' [' || carrier_suffix || ']';
    END IF;
    
    -- Check if this name already exists and increment counter if needed
    unique_name := base_name;
    
    WHILE EXISTS (
        SELECT 1 FROM driver_profiles 
        WHERE carrier_user_id = p_carrier_user_id 
        AND profile_name = unique_name 
        AND is_active = true
    ) LOOP
        counter := counter + 1;
        unique_name := base_name || ' #' || counter;
    END LOOP;
    
    RETURN unique_name;
END;
$$;


--
-- Name: FUNCTION generate_carrier_aware_profile_name(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_carrier_aware_profile_name(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) IS 'Generates unique profile names with carrier context awareness. Includes phone/license suffixes and carrier identifiers to prevent conflicts across carriers.';


--
-- Name: generate_unique_profile_name(character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_unique_profile_name(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_name VARCHAR(255);
    counter INTEGER := 1;
    unique_name VARCHAR(255);
    phone_suffix VARCHAR(10);
    license_suffix VARCHAR(10);
BEGIN
    -- Create base name from driver name
    base_name := TRIM(p_driver_name);
    
    -- Add phone suffix if available (last 4 digits)
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        base_name := base_name || ' (' || phone_suffix || ')';
    END IF;
    
    -- Add license suffix if available (last 4 characters)
    IF p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        license_suffix := RIGHT(p_driver_license_number, 4);
        base_name := base_name || ' - ' || license_suffix;
    END IF;
    
    -- Check if this name already exists and increment counter if needed
    unique_name := base_name;
    
    WHILE EXISTS (
        SELECT 1 FROM driver_profiles 
        WHERE carrier_user_id = p_carrier_user_id 
        AND profile_name = unique_name 
        AND is_active = true
    ) LOOP
        counter := counter + 1;
        unique_name := base_name || ' #' || counter;
    END LOOP;
    
    RETURN unique_name;
END;
$$;


--
-- Name: FUNCTION generate_unique_profile_name(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.generate_unique_profile_name(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) IS 'Generates unique profile names by combining driver name with phone/license suffixes and adding counters when needed.';


--
-- Name: get_carrier_bid_history(character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_carrier_bid_history(p_user_id character varying) RETURNS TABLE(bid_number character varying, bid_amount_cents integer, bid_status character varying, bid_notes text, created_at timestamp with time zone, updated_at timestamp with time zone, distance_miles integer, pickup_timestamp timestamp with time zone, delivery_timestamp timestamp with time zone, stops jsonb, tag character varying, source_channel character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cb.bid_number,
        cb.amount_cents,
        COALESCE(cb.bid_outcome, 'pending')::VARCHAR(20),
        cb.notes,
        cb.created_at,
        cb.updated_at,
        COALESCE(tb.distance_miles, 0),
        COALESCE(tb.pickup_timestamp, cb.created_at),
        COALESCE(tb.delivery_timestamp, cb.created_at + INTERVAL '1 day'),
        COALESCE(tb.stops, '[]'::JSONB),
        tb.tag,
        COALESCE(tb.source_channel, 'unknown')
    FROM carrier_bids cb
    LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
    WHERE cb.clerk_user_id = p_user_id
    ORDER BY cb.created_at DESC;
END;
$$;


--
-- Name: FUNCTION get_carrier_bid_history(p_user_id character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_carrier_bid_history(p_user_id character varying) IS 'Returns complete bid history for a carrier';


--
-- Name: mark_profile_used(uuid, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_profile_used(p_profile_id uuid, p_carrier_user_id character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE driver_profiles 
    SET last_used_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_profile_id 
    AND carrier_user_id = p_carrier_user_id;
    
    RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION mark_profile_used(p_profile_id uuid, p_carrier_user_id character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.mark_profile_used(p_profile_id uuid, p_carrier_user_id character varying) IS 'Tracks when a profile was last used for better organization and usage analytics.';


--
-- Name: suggest_profile_names(character varying, character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.suggest_profile_names(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) RETURNS TABLE(suggested_name character varying, reason character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    base_name VARCHAR(255);
    phone_suffix VARCHAR(10);
    license_suffix VARCHAR(10);
    carrier_suffix VARCHAR(20);
BEGIN
    base_name := TRIM(p_driver_name);
    
    -- Suggestion 1: Just the driver name
    RETURN QUERY SELECT base_name, 'Simple driver name'::VARCHAR(255);
    
    -- Suggestion 2: Driver name + phone suffix
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        RETURN QUERY SELECT base_name || ' (' || phone_suffix || ')', 'Driver name with phone suffix'::VARCHAR(255);
    END IF;
    
    -- Suggestion 3: Driver name + license suffix
    IF p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        license_suffix := RIGHT(p_driver_license_number, 4);
        RETURN QUERY SELECT base_name || ' - ' || license_suffix, 'Driver name with license suffix'::VARCHAR(255);
    END IF;
    
    -- Suggestion 4: Driver name + phone + license
    IF p_driver_phone IS NOT NULL AND LENGTH(p_driver_phone) >= 4 AND 
       p_driver_license_number IS NOT NULL AND LENGTH(p_driver_license_number) >= 4 THEN
        phone_suffix := RIGHT(p_driver_phone, 4);
        license_suffix := RIGHT(p_driver_license_number, 4);
        RETURN QUERY SELECT base_name || ' (' || phone_suffix || ') - ' || license_suffix, 'Driver name with phone and license suffixes'::VARCHAR(255);
    END IF;
    
    -- Suggestion 5: Driver name + carrier context
    IF p_carrier_user_id IS NOT NULL AND LENGTH(p_carrier_user_id) >= 6 THEN
        carrier_suffix := RIGHT(p_carrier_user_id, 6);
        RETURN QUERY SELECT base_name || ' [' || carrier_suffix || ']', 'Driver name with carrier context'::VARCHAR(255);
    END IF;
END;
$$;


--
-- Name: FUNCTION suggest_profile_names(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.suggest_profile_names(p_carrier_user_id character varying, p_driver_name character varying, p_driver_phone character varying, p_driver_license_number character varying) IS 'Provides multiple profile name suggestions based on driver information. Helps users choose appropriate names that avoid conflicts.';


--
-- Name: update_bid_lifecycle_events_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_bid_lifecycle_events_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_carrier_responses_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_carrier_responses_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE conversations 
    SET last_message_at = NEW.created_at, updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;


--
-- Name: update_conversation_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_driver_profiles_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_driver_profiles_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_offer_comments_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_offer_comments_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_profile_display_order(character varying, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_display_order(p_carrier_user_id character varying, p_profile_orders jsonb) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    profile_item JSONB;
BEGIN
    -- Update display order for each profile
    FOR profile_item IN SELECT * FROM jsonb_array_elements(p_profile_orders)
    LOOP
        UPDATE driver_profiles 
        SET display_order = (profile_item->>'order')::INTEGER,
            updated_at = CURRENT_TIMESTAMP
        WHERE carrier_user_id = p_carrier_user_id 
        AND id = (profile_item->>'id')::UUID;
    END LOOP;
    
    RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION update_profile_display_order(p_carrier_user_id character varying, p_profile_orders jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_profile_display_order(p_carrier_user_id character varying, p_profile_orders jsonb) IS 'Updates the display order of multiple driver profiles for drag-and-drop functionality.';


--
-- Name: update_profile_name(uuid, character varying, character varying); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_profile_name(p_profile_id uuid, p_carrier_user_id character varying, p_new_name character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    existing_count INTEGER;
BEGIN
    -- Check if the new name already exists for this carrier
    SELECT COUNT(*) INTO existing_count
    FROM driver_profiles 
    WHERE carrier_user_id = p_carrier_user_id 
    AND profile_name = p_new_name
    AND id != p_profile_id
    AND is_active = true;
    
    IF existing_count > 0 THEN
        RETURN FALSE; -- Name already exists
    END IF;
    
    -- Update the profile name
    UPDATE driver_profiles 
    SET profile_name = p_new_name,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_profile_id 
    AND carrier_user_id = p_carrier_user_id;
    
    RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION update_profile_name(p_profile_id uuid, p_carrier_user_id character varying, p_new_name character varying); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_profile_name(p_profile_id uuid, p_carrier_user_id character varying, p_new_name character varying) IS 'Updates only the profile name without changing other driver information. Returns false if name already exists.';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: telegram_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_bids (
    id bigint NOT NULL,
    bid_number text NOT NULL,
    distance_miles numeric,
    pickup_timestamp timestamp with time zone,
    delivery_timestamp timestamp with time zone,
    stops jsonb,
    tag text,
    source_channel text NOT NULL,
    forwarded_to text,
    received_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone
);


--
-- Name: active_telegram_bids; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.active_telegram_bids AS
 SELECT telegram_bids.id,
    telegram_bids.bid_number,
    telegram_bids.distance_miles,
    telegram_bids.pickup_timestamp,
    telegram_bids.delivery_timestamp,
    telegram_bids.stops,
    telegram_bids.tag,
    telegram_bids.source_channel,
    telegram_bids.forwarded_to,
    telegram_bids.received_at,
    telegram_bids.expires_at,
    telegram_bids.is_archived,
    telegram_bids.archived_at
   FROM public.telegram_bids
  WHERE ((telegram_bids.is_archived = false) AND (now() <= ((telegram_bids.received_at)::timestamp without time zone + '00:25:00'::interval)));


--
-- Name: admin_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    admin_user_id text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: admin_profile_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_profile_actions (
    id integer NOT NULL,
    carrier_user_id text NOT NULL,
    admin_user_id text NOT NULL,
    action_type text NOT NULL,
    action_data jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT admin_profile_actions_action_type_check CHECK ((action_type = ANY (ARRAY['approve'::text, 'decline'::text, 'enable_edits'::text, 'disable_edits'::text, 'unlock_profile'::text])))
);


--
-- Name: admin_profile_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_profile_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_profile_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_profile_actions_id_seq OWNED BY public.admin_profile_actions.id;


--
-- Name: archive_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archive_bids (
    id integer NOT NULL,
    bid_number text NOT NULL,
    distance_miles integer,
    pickup_timestamp text,
    delivery_timestamp text,
    stops text,
    tag text,
    source_channel text,
    forwarded_to text,
    received_at text NOT NULL,
    expires_at text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    archived_date date DEFAULT CURRENT_DATE NOT NULL
);


--
-- Name: archive_bids_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.archive_bids_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archive_bids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.archive_bids_id_seq OWNED BY public.archive_bids.id;


--
-- Name: archived_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.archived_bids (
    id integer NOT NULL,
    bid_number character varying(50) NOT NULL,
    distance_miles integer NOT NULL,
    pickup_timestamp timestamp with time zone NOT NULL,
    delivery_timestamp timestamp with time zone NOT NULL,
    stops jsonb NOT NULL,
    tag character varying(20),
    source_channel character varying(50) NOT NULL,
    forwarded_to character varying(50),
    received_at timestamp with time zone NOT NULL,
    archived_at timestamp with time zone DEFAULT now(),
    original_id integer
);


--
-- Name: TABLE archived_bids; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.archived_bids IS 'Stores expired bids that have been automatically archived';


--
-- Name: archived_bids_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.archived_bids_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: archived_bids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.archived_bids_id_seq OWNED BY public.archived_bids.id;


--
-- Name: archived_bids_with_metadata; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.archived_bids_with_metadata AS
 SELECT ab.id,
    ab.bid_number,
    ab.distance_miles,
    ab.pickup_timestamp,
    ab.delivery_timestamp,
    ab.stops,
    ab.tag,
    ab.source_channel,
    ab.forwarded_to,
    ab.received_at,
    ab.archived_at,
    ab.original_id,
    (EXTRACT(epoch FROM (ab.archived_at - ab.received_at)) / (3600)::numeric) AS hours_active,
        CASE
            WHEN (ab.tag IS NOT NULL) THEN ab.tag
            ELSE 'UNKNOWN'::character varying
        END AS state_tag
   FROM public.archived_bids ab;


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    rr_number text NOT NULL,
    user_id text NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status text DEFAULT 'assigned'::text NOT NULL,
    CONSTRAINT assignments_status_check CHECK ((status = ANY (ARRAY['assigned'::text, 'picked_up'::text, 'delivered'::text, 'cancelled'::text])))
);


--
-- Name: auction_awards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_awards (
    id integer NOT NULL,
    bid_number text NOT NULL,
    winner_user_id text NOT NULL,
    winner_amount_cents integer NOT NULL,
    awarded_by text NOT NULL,
    awarded_at timestamp without time zone DEFAULT now()
);


--
-- Name: auction_awards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.auction_awards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auction_awards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.auction_awards_id_seq OWNED BY public.auction_awards.id;


--
-- Name: bid_lifecycle_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_lifecycle_events (
    id integer NOT NULL,
    bid_id text NOT NULL,
    event_type text NOT NULL,
    event_data jsonb,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    documents text[],
    location text,
    driver_name text,
    driver_phone text,
    driver_email text,
    driver_license_number text,
    driver_license_state text,
    truck_number text,
    trailer_number text,
    second_driver_name text,
    second_driver_phone text,
    second_driver_email text,
    second_driver_license_number text,
    second_driver_license_state text,
    second_truck_number text,
    second_trailer_number text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    check_in_time timestamp with time zone,
    pickup_time timestamp with time zone,
    departure_time timestamp with time zone,
    check_in_delivery_time timestamp with time zone,
    delivery_time timestamp with time zone
);


--
-- Name: TABLE bid_lifecycle_events; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.bid_lifecycle_events IS 'Tracks lifecycle events for awarded bids';


--
-- Name: COLUMN bid_lifecycle_events.bid_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.bid_id IS 'The bid number this event relates to';


--
-- Name: COLUMN bid_lifecycle_events.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.event_type IS 'Type of event: bid_awarded, load_assigned, checked_in_origin, picked_up, etc.';


--
-- Name: COLUMN bid_lifecycle_events.event_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.event_data IS 'Additional event data as JSON';


--
-- Name: COLUMN bid_lifecycle_events."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events."timestamp" IS 'When the event occurred';


--
-- Name: COLUMN bid_lifecycle_events.notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.notes IS 'Additional notes about the event';


--
-- Name: COLUMN bid_lifecycle_events.documents; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.documents IS 'Array of document URLs related to this event';


--
-- Name: COLUMN bid_lifecycle_events.location; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.location IS 'Location where the event occurred';


--
-- Name: COLUMN bid_lifecycle_events.driver_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.driver_name IS 'Primary driver name for this event';


--
-- Name: COLUMN bid_lifecycle_events.truck_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.truck_number IS 'Truck number for this event';


--
-- Name: COLUMN bid_lifecycle_events.created_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.created_at IS 'When the record was created';


--
-- Name: COLUMN bid_lifecycle_events.updated_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.updated_at IS 'When the record was last updated';


--
-- Name: COLUMN bid_lifecycle_events.check_in_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.check_in_time IS 'The actual check-in time selected by the user (for checked_in_origin events)';


--
-- Name: COLUMN bid_lifecycle_events.pickup_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.pickup_time IS 'The actual pickup time selected by the user (for picked_up events)';


--
-- Name: COLUMN bid_lifecycle_events.departure_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.departure_time IS 'The actual departure time selected by the user (for departed_origin events)';


--
-- Name: COLUMN bid_lifecycle_events.check_in_delivery_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.check_in_delivery_time IS 'The actual check-in time at destination selected by the user (for checked_in_destination events)';


--
-- Name: COLUMN bid_lifecycle_events.delivery_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bid_lifecycle_events.delivery_time IS 'The actual delivery time selected by the user (for delivered events)';


--
-- Name: bid_lifecycle_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bid_lifecycle_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bid_lifecycle_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bid_lifecycle_events_id_seq OWNED BY public.bid_lifecycle_events.id;


--
-- Name: carrier_bid_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_bid_history (
    id integer NOT NULL,
    carrier_user_id character varying(255) NOT NULL,
    bid_number character varying(50) NOT NULL,
    bid_amount_cents integer NOT NULL,
    bid_status character varying(20) NOT NULL,
    bid_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE carrier_bid_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.carrier_bid_history IS 'Tracks complete history of carrier bids for historical analysis';


--
-- Name: carrier_bid_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carrier_bid_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carrier_bid_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carrier_bid_history_id_seq OWNED BY public.carrier_bid_history.id;


--
-- Name: carrier_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_bids (
    id integer NOT NULL,
    bid_number text NOT NULL,
    clerk_user_id text NOT NULL,
    amount_cents integer NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    status text DEFAULT 'awarded'::text,
    lifecycle_notes text,
    driver_name text,
    driver_phone text,
    driver_email text,
    driver_license_number text,
    driver_license_state text,
    truck_number text,
    trailer_number text,
    second_driver_name text,
    second_driver_phone text,
    second_driver_email text,
    second_driver_license_number text,
    second_driver_license_state text,
    second_truck_number text,
    second_trailer_number text,
    driver_info_submitted_at timestamp with time zone,
    bid_outcome character varying(20) DEFAULT 'pending'::character varying,
    final_amount_cents integer
);


--
-- Name: COLUMN carrier_bids.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.status IS 'Current status of the bid (awarded, active, completed, cancelled)';


--
-- Name: COLUMN carrier_bids.lifecycle_notes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.lifecycle_notes IS 'Notes about the bid lifecycle';


--
-- Name: COLUMN carrier_bids.driver_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.driver_name IS 'Primary driver name';


--
-- Name: COLUMN carrier_bids.driver_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.driver_phone IS 'Primary driver phone number';


--
-- Name: COLUMN carrier_bids.driver_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.driver_email IS 'Primary driver email';


--
-- Name: COLUMN carrier_bids.driver_license_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.driver_license_number IS 'Primary driver license number';


--
-- Name: COLUMN carrier_bids.driver_license_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.driver_license_state IS 'Primary driver license state';


--
-- Name: COLUMN carrier_bids.truck_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.truck_number IS 'Primary truck number';


--
-- Name: COLUMN carrier_bids.trailer_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.trailer_number IS 'Primary trailer number';


--
-- Name: COLUMN carrier_bids.second_driver_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_driver_name IS 'Secondary driver name';


--
-- Name: COLUMN carrier_bids.second_driver_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_driver_phone IS 'Secondary driver phone number';


--
-- Name: COLUMN carrier_bids.second_driver_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_driver_email IS 'Secondary driver email';


--
-- Name: COLUMN carrier_bids.second_driver_license_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_driver_license_number IS 'Secondary driver license number';


--
-- Name: COLUMN carrier_bids.second_driver_license_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_driver_license_state IS 'Secondary driver license state';


--
-- Name: COLUMN carrier_bids.second_truck_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_truck_number IS 'Secondary truck number';


--
-- Name: COLUMN carrier_bids.second_trailer_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.second_trailer_number IS 'Secondary trailer number';


--
-- Name: COLUMN carrier_bids.driver_info_submitted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_bids.driver_info_submitted_at IS 'When driver information was submitted';


--
-- Name: carrier_bids_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carrier_bids_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carrier_bids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carrier_bids_id_seq OWNED BY public.carrier_bids.id;


--
-- Name: carrier_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_chat_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone
);


--
-- Name: carrier_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_favorites (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    bid_number text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: carrier_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_notification_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    email_notifications boolean DEFAULT true,
    similar_load_notifications boolean DEFAULT true,
    distance_threshold_miles integer DEFAULT 50,
    state_preferences text[],
    equipment_preferences text[],
    min_distance integer DEFAULT 0,
    max_distance integer DEFAULT 2000,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: carrier_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_notification_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_user_id character varying(255) NOT NULL,
    email_notifications boolean DEFAULT true NOT NULL,
    push_notifications boolean DEFAULT true NOT NULL,
    status_change_notifications boolean DEFAULT true NOT NULL,
    offer_response_notifications boolean DEFAULT true NOT NULL,
    load_update_notifications boolean DEFAULT true NOT NULL,
    system_notifications boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: carrier_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_user_id character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying NOT NULL,
    read boolean DEFAULT false NOT NULL,
    load_id uuid,
    action_url character varying(500),
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    bid_number text
);


--
-- Name: carrier_profile_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_profile_history (
    id integer NOT NULL,
    carrier_user_id text NOT NULL,
    profile_data jsonb NOT NULL,
    profile_status text NOT NULL,
    submitted_at timestamp without time zone NOT NULL,
    reviewed_at timestamp without time zone,
    reviewed_by text,
    review_notes text,
    decline_reason text,
    version_number integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT carrier_profile_history_profile_status_check CHECK ((profile_status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: carrier_profile_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carrier_profile_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carrier_profile_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carrier_profile_history_id_seq OWNED BY public.carrier_profile_history.id;


--
-- Name: carrier_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_profiles (
    id integer NOT NULL,
    clerk_user_id text NOT NULL,
    legal_name text NOT NULL,
    mc_number text NOT NULL,
    dot_number text,
    phone text,
    contact_name text,
    created_at timestamp without time zone DEFAULT now(),
    is_locked boolean DEFAULT false,
    locked_at timestamp with time zone,
    locked_by text,
    lock_reason text,
    company_name text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    profile_status text DEFAULT 'pending'::text,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    reviewed_by text,
    review_notes text,
    decline_reason text,
    is_first_login boolean DEFAULT true,
    profile_completed_at timestamp without time zone,
    edits_enabled boolean DEFAULT false,
    edits_enabled_by text,
    edits_enabled_at timestamp without time zone,
    CONSTRAINT carrier_profiles_profile_status_check CHECK ((profile_status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);


--
-- Name: COLUMN carrier_profiles.legal_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.carrier_profiles.legal_name IS 'Legal name of the company (can be different from company_name)';


--
-- Name: carrier_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carrier_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carrier_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carrier_profiles_id_seq OWNED BY public.carrier_profiles.id;


--
-- Name: carrier_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carrier_responses (
    id integer NOT NULL,
    message_id uuid NOT NULL,
    carrier_user_id text NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone
);


--
-- Name: carrier_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carrier_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carrier_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carrier_responses_id_seq OWNED BY public.carrier_responses.id;


--
-- Name: conversation_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id text NOT NULL,
    sender_type text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT conversation_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['admin'::text, 'carrier'::text])))
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    carrier_user_id text NOT NULL,
    admin_user_id text NOT NULL,
    last_message_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    conversation_type text DEFAULT 'regular'::text,
    CONSTRAINT conversations_conversation_type_check CHECK ((conversation_type = ANY (ARRAY['regular'::text, 'appeal'::text])))
);


--
-- Name: COLUMN conversations.conversation_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conversations.conversation_type IS 'Type of conversation: regular (floating chat) or appeal (profile appeal decisions)';


--
-- Name: dedicated_lanes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dedicated_lanes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title text NOT NULL,
    description text,
    rate text,
    primary_lanes text,
    contract_length text,
    client text,
    requirements text,
    benefits text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT dedicated_lanes_status_check CHECK ((status = ANY (ARRAY['active'::text, 'upcoming'::text, 'completed'::text])))
);


--
-- Name: driver_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    carrier_user_id character varying(255) NOT NULL,
    profile_name character varying(255) NOT NULL,
    driver_name character varying(255) NOT NULL,
    driver_phone character varying(20) NOT NULL,
    driver_email character varying(255),
    driver_license_number character varying(50),
    driver_license_state character varying(10),
    truck_number character varying(50),
    trailer_number character varying(50),
    second_driver_name character varying(255),
    second_driver_phone character varying(20),
    second_driver_email character varying(255),
    second_driver_license_number character varying(50),
    second_driver_license_state character varying(10),
    second_truck_number character varying(50),
    second_trailer_number character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    display_order integer DEFAULT 0,
    last_used_at timestamp with time zone
);


--
-- Name: TABLE driver_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.driver_profiles IS 'Stores reusable driver profiles for carriers';


--
-- Name: COLUMN driver_profiles.profile_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.profile_name IS 'User-defined name for the driver profile (e.g., "John Smith - Primary Driver")';


--
-- Name: COLUMN driver_profiles.driver_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.driver_phone IS '10-digit phone number without formatting';


--
-- Name: COLUMN driver_profiles.truck_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.truck_number IS 'Truck identifier (no length restrictions)';


--
-- Name: COLUMN driver_profiles.trailer_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.trailer_number IS 'Trailer identifier (no length restrictions)';


--
-- Name: COLUMN driver_profiles.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.is_active IS 'Whether the profile is available for selection';


--
-- Name: COLUMN driver_profiles.display_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.display_order IS 'Order for displaying profiles in the UI. Lower numbers appear first.';


--
-- Name: COLUMN driver_profiles.last_used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.driver_profiles.last_used_at IS 'Timestamp when this profile was last used to load driver information.';


--
-- Name: eax_loads_raw; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eax_loads_raw (
    id integer NOT NULL,
    rr_number text NOT NULL,
    tm_number text,
    status_code text,
    pickup_date date,
    pickup_time text,
    pickup_window text,
    delivery_date date,
    delivery_window text,
    revenue numeric(10,2),
    purchase numeric(10,2),
    net numeric(10,2),
    margin numeric(10,2),
    equipment text,
    customer_name text,
    customer_ref text,
    driver_name text,
    total_miles integer,
    origin_city text,
    origin_state text,
    destination_city text,
    destination_state text,
    vendor_name text,
    dispatcher_name text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    delivery_time text,
    weight numeric,
    stops integer,
    load_number text,
    target_buy numeric,
    max_buy numeric,
    spot_bid text,
    fuel_surcharge numeric DEFAULT 0,
    docs_scanned text,
    invoice_date date,
    invoice_audit text,
    purch_tr numeric,
    net_mrg numeric,
    cm numeric,
    nbr_of_stops integer,
    vendor_dispatch text
);


--
-- Name: eax_loads_raw_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.eax_loads_raw_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: eax_loads_raw_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.eax_loads_raw_id_seq OWNED BY public.eax_loads_raw.id;


--
-- Name: load_lifecycle_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.load_lifecycle_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    load_offer_id uuid NOT NULL,
    status character varying(50) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    location character varying(255),
    photos text[],
    documents text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    driver_name text,
    driver_phone text,
    driver_email text,
    driver_license_number text,
    driver_license_state text,
    truck_number text,
    trailer_number text,
    second_driver_name text,
    second_driver_phone text,
    second_driver_email text,
    second_driver_license_number text,
    second_driver_license_state text,
    second_truck_number text,
    second_trailer_number text,
    event_type text DEFAULT 'status_change'::text,
    check_in_time timestamp with time zone,
    pickup_time timestamp with time zone,
    departure_time timestamp with time zone,
    check_in_delivery_time timestamp with time zone
);


--
-- Name: COLUMN load_lifecycle_events."timestamp"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events."timestamp" IS 'When the lifecycle event was created/submitted';


--
-- Name: COLUMN load_lifecycle_events.driver_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.driver_name IS 'Primary driver name for this event';


--
-- Name: COLUMN load_lifecycle_events.second_driver_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.second_driver_name IS 'Secondary driver name if applicable';


--
-- Name: COLUMN load_lifecycle_events.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.event_type IS 'Type of event: status_change, driver_info_update, location_update, etc.';


--
-- Name: COLUMN load_lifecycle_events.check_in_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.check_in_time IS 'The actual check-in time selected by the user (for checked_in events)';


--
-- Name: COLUMN load_lifecycle_events.pickup_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.pickup_time IS 'The actual pickup time selected by the user (for picked_up events)';


--
-- Name: COLUMN load_lifecycle_events.departure_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.departure_time IS 'The actual departure time selected by the user (for departed events)';


--
-- Name: COLUMN load_lifecycle_events.check_in_delivery_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_lifecycle_events.check_in_delivery_time IS 'The actual check-in delivery time selected by the user (for checked_in_delivery events)';


--
-- Name: load_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.load_offers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    load_rr_number text NOT NULL,
    carrier_user_id text NOT NULL,
    offer_amount integer NOT NULL,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    counter_amount integer,
    admin_notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone,
    is_expired boolean DEFAULT false,
    driver_name text,
    driver_phone text,
    driver_email text,
    driver_license_number text,
    driver_license_state text,
    truck_number text,
    trailer_number text,
    driver_info_submitted_at timestamp with time zone,
    driver_info_required boolean DEFAULT false,
    CONSTRAINT load_offers_offer_amount_check CHECK ((offer_amount >= 0)),
    CONSTRAINT load_offers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'assigned'::text, 'checked_in'::text, 'picked_up'::text, 'departed'::text, 'in_transit'::text, 'checked_in_delivery'::text, 'delivered'::text, 'completed'::text, 'rejected'::text, 'countered'::text, 'expired'::text, 'withdrawn'::text])))
);


--
-- Name: COLUMN load_offers.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_offers.status IS 'Offer status: pending -> accepted -> assigned -> checked_in -> picked_up -> departed -> in_transit -> delivered -> completed (or rejected/countered/expired/withdrawn)';


--
-- Name: COLUMN load_offers.driver_info_submitted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_offers.driver_info_submitted_at IS 'Timestamp when carrier submitted driver information';


--
-- Name: COLUMN load_offers.driver_info_required; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.load_offers.driver_info_required IS 'Set to true when admin accepts offer and requires driver info';


--
-- Name: CONSTRAINT load_offers_status_check ON load_offers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT load_offers_status_check ON public.load_offers IS 'Ensures load offer status is one of the predefined values including checked_in_delivery.';


--
-- Name: loads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loads (
    id integer NOT NULL,
    rr_number text NOT NULL,
    tm_number text,
    status_code text DEFAULT 'active'::text,
    origin_city text,
    origin_state text,
    destination_city text,
    destination_state text,
    equipment text,
    revenue numeric(10,2),
    purchase numeric(10,2),
    net numeric(10,2),
    margin numeric(10,2),
    customer_name text,
    driver_name text,
    vendor_name text,
    dispatcher_name text,
    pickup_date date,
    pickup_time text,
    pickup_window text,
    delivery_date date,
    delivery_window text,
    total_miles integer,
    published boolean DEFAULT false,
    archived boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    load_number text,
    target_buy numeric,
    max_buy numeric,
    spot_bid text,
    fuel_surcharge numeric DEFAULT 0,
    docs_scanned text,
    invoice_date date,
    invoice_audit text,
    purch_tr numeric,
    net_mrg numeric,
    cm numeric,
    nbr_of_stops integer,
    vendor_dispatch text,
    delivery_time text,
    weight numeric,
    miles integer,
    stops integer,
    customer_ref text
);


--
-- Name: loads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.loads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: loads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.loads_id_seq OWNED BY public.loads.id;


--
-- Name: message_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    user_id text NOT NULL,
    read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: notification_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_logs (
    id integer NOT NULL,
    carrier_user_id character varying(255) NOT NULL,
    trigger_id integer,
    notification_type character varying(50) NOT NULL,
    bid_number character varying(50),
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now(),
    delivery_status character varying(20) DEFAULT 'sent'::character varying
);


--
-- Name: TABLE notification_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_logs IS 'Logs all notifications sent to carriers';


--
-- Name: notification_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_logs_id_seq OWNED BY public.notification_logs.id;


--
-- Name: notification_triggers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_triggers (
    id integer NOT NULL,
    carrier_user_id character varying(255) NOT NULL,
    trigger_type character varying(50) NOT NULL,
    trigger_config jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE notification_triggers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_triggers IS 'Stores intelligent notification triggers for carriers';


--
-- Name: notification_triggers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_triggers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_triggers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_triggers_id_seq OWNED BY public.notification_triggers.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    data jsonb,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: offer_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    author_id text NOT NULL,
    author_role text NOT NULL,
    comment_text text NOT NULL,
    is_internal boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offer_comments_author_role_check CHECK ((author_role = ANY (ARRAY['admin'::text, 'carrier'::text])))
);


--
-- Name: offer_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offer_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid NOT NULL,
    action character varying(50) NOT NULL,
    old_status character varying(50),
    new_status character varying(50),
    old_amount integer,
    new_amount integer,
    admin_notes text,
    carrier_notes text,
    performed_by character varying(255) NOT NULL,
    performed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offer_history_action_check CHECK (((action)::text = ANY ((ARRAY['created'::character varying, 'accepted'::character varying, 'rejected'::character varying, 'countered'::character varying, 'modified'::character varying, 'withdrawn'::character varying])::text[])))
);


--
-- Name: telegram_bids_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.telegram_bids_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: telegram_bids_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.telegram_bids_id_seq OWNED BY public.telegram_bids.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    user_id text NOT NULL,
    clerk_user_id text,
    role text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT user_roles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'carrier'::text])))
);


--
-- Name: user_roles_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles_cache (
    clerk_user_id text NOT NULL,
    role text NOT NULL,
    email text NOT NULL,
    last_synced timestamp without time zone DEFAULT now() NOT NULL,
    clerk_updated_at bigint DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_roles_cache_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'carrier'::text, 'none'::text])))
);


--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    clerk_user_id text NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    role text DEFAULT 'carrier'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'carrier'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: admin_profile_actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_profile_actions ALTER COLUMN id SET DEFAULT nextval('public.admin_profile_actions_id_seq'::regclass);


--
-- Name: archive_bids id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_bids ALTER COLUMN id SET DEFAULT nextval('public.archive_bids_id_seq'::regclass);


--
-- Name: archived_bids id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_bids ALTER COLUMN id SET DEFAULT nextval('public.archived_bids_id_seq'::regclass);


--
-- Name: auction_awards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_awards ALTER COLUMN id SET DEFAULT nextval('public.auction_awards_id_seq'::regclass);


--
-- Name: bid_lifecycle_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_lifecycle_events ALTER COLUMN id SET DEFAULT nextval('public.bid_lifecycle_events_id_seq'::regclass);


--
-- Name: carrier_bid_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_bid_history ALTER COLUMN id SET DEFAULT nextval('public.carrier_bid_history_id_seq'::regclass);


--
-- Name: carrier_bids id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_bids ALTER COLUMN id SET DEFAULT nextval('public.carrier_bids_id_seq'::regclass);


--
-- Name: carrier_profile_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_profile_history ALTER COLUMN id SET DEFAULT nextval('public.carrier_profile_history_id_seq'::regclass);


--
-- Name: carrier_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_profiles ALTER COLUMN id SET DEFAULT nextval('public.carrier_profiles_id_seq'::regclass);


--
-- Name: carrier_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_responses ALTER COLUMN id SET DEFAULT nextval('public.carrier_responses_id_seq'::regclass);


--
-- Name: eax_loads_raw id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eax_loads_raw ALTER COLUMN id SET DEFAULT nextval('public.eax_loads_raw_id_seq'::regclass);


--
-- Name: loads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loads ALTER COLUMN id SET DEFAULT nextval('public.loads_id_seq'::regclass);


--
-- Name: notification_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs ALTER COLUMN id SET DEFAULT nextval('public.notification_logs_id_seq'::regclass);


--
-- Name: notification_triggers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_triggers ALTER COLUMN id SET DEFAULT nextval('public.notification_triggers_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: telegram_bids id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bids ALTER COLUMN id SET DEFAULT nextval('public.telegram_bids_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: admin_messages admin_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_messages
    ADD CONSTRAINT admin_messages_pkey PRIMARY KEY (id);


--
-- Name: admin_profile_actions admin_profile_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_profile_actions
    ADD CONSTRAINT admin_profile_actions_pkey PRIMARY KEY (id);


--
-- Name: archive_bids archive_bids_bid_number_archived_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_bids
    ADD CONSTRAINT archive_bids_bid_number_archived_date_key UNIQUE (bid_number, archived_date);


--
-- Name: archive_bids archive_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archive_bids
    ADD CONSTRAINT archive_bids_pkey PRIMARY KEY (id);


--
-- Name: archived_bids archived_bids_bid_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_bids
    ADD CONSTRAINT archived_bids_bid_number_key UNIQUE (bid_number);


--
-- Name: archived_bids archived_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.archived_bids
    ADD CONSTRAINT archived_bids_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: auction_awards auction_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_awards
    ADD CONSTRAINT auction_awards_pkey PRIMARY KEY (id);


--
-- Name: bid_lifecycle_events bid_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_lifecycle_events
    ADD CONSTRAINT bid_lifecycle_events_pkey PRIMARY KEY (id);


--
-- Name: carrier_bid_history carrier_bid_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_bid_history
    ADD CONSTRAINT carrier_bid_history_pkey PRIMARY KEY (id);


--
-- Name: carrier_bids carrier_bids_bid_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_bids
    ADD CONSTRAINT carrier_bids_bid_user_unique UNIQUE (bid_number, clerk_user_id);


--
-- Name: carrier_bids carrier_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_bids
    ADD CONSTRAINT carrier_bids_pkey PRIMARY KEY (id);


--
-- Name: carrier_chat_messages carrier_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_chat_messages
    ADD CONSTRAINT carrier_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: carrier_favorites carrier_favorites_carrier_user_id_bid_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_favorites
    ADD CONSTRAINT carrier_favorites_carrier_user_id_bid_number_key UNIQUE (carrier_user_id, bid_number);


--
-- Name: carrier_favorites carrier_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_favorites
    ADD CONSTRAINT carrier_favorites_pkey PRIMARY KEY (id);


--
-- Name: carrier_notification_preferences carrier_notification_preferences_carrier_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_notification_preferences
    ADD CONSTRAINT carrier_notification_preferences_carrier_user_id_key UNIQUE (carrier_user_id);


--
-- Name: carrier_notification_preferences carrier_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_notification_preferences
    ADD CONSTRAINT carrier_notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: carrier_notification_settings carrier_notification_settings_carrier_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_notification_settings
    ADD CONSTRAINT carrier_notification_settings_carrier_user_id_key UNIQUE (carrier_user_id);


--
-- Name: carrier_notification_settings carrier_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_notification_settings
    ADD CONSTRAINT carrier_notification_settings_pkey PRIMARY KEY (id);


--
-- Name: carrier_notifications carrier_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_notifications
    ADD CONSTRAINT carrier_notifications_pkey PRIMARY KEY (id);


--
-- Name: carrier_profile_history carrier_profile_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_profile_history
    ADD CONSTRAINT carrier_profile_history_pkey PRIMARY KEY (id);


--
-- Name: carrier_profiles carrier_profiles_clerk_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_profiles
    ADD CONSTRAINT carrier_profiles_clerk_user_id_key UNIQUE (clerk_user_id);


--
-- Name: carrier_profiles carrier_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_profiles
    ADD CONSTRAINT carrier_profiles_pkey PRIMARY KEY (id);


--
-- Name: carrier_responses carrier_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_responses
    ADD CONSTRAINT carrier_responses_pkey PRIMARY KEY (id);


--
-- Name: conversation_messages conversation_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_carrier_user_id_admin_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_carrier_user_id_admin_user_id_key UNIQUE (carrier_user_id, admin_user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: dedicated_lanes dedicated_lanes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dedicated_lanes
    ADD CONSTRAINT dedicated_lanes_pkey PRIMARY KEY (id);


--
-- Name: driver_profiles driver_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_profiles
    ADD CONSTRAINT driver_profiles_pkey PRIMARY KEY (id);


--
-- Name: eax_loads_raw eax_loads_raw_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eax_loads_raw
    ADD CONSTRAINT eax_loads_raw_pkey PRIMARY KEY (id);


--
-- Name: load_lifecycle_events load_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_lifecycle_events
    ADD CONSTRAINT load_lifecycle_events_pkey PRIMARY KEY (id);


--
-- Name: load_offers load_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_offers
    ADD CONSTRAINT load_offers_pkey PRIMARY KEY (id);


--
-- Name: loads loads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loads
    ADD CONSTRAINT loads_pkey PRIMARY KEY (id);


--
-- Name: loads loads_rr_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loads
    ADD CONSTRAINT loads_rr_number_key UNIQUE (rr_number);


--
-- Name: message_reads message_reads_message_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_user_id_key UNIQUE (message_id, user_id);


--
-- Name: message_reads message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_pkey PRIMARY KEY (id);


--
-- Name: notification_logs notification_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


--
-- Name: notification_triggers notification_triggers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_triggers
    ADD CONSTRAINT notification_triggers_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offer_comments offer_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_comments
    ADD CONSTRAINT offer_comments_pkey PRIMARY KEY (id);


--
-- Name: offer_history offer_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_history
    ADD CONSTRAINT offer_history_pkey PRIMARY KEY (id);


--
-- Name: telegram_bids telegram_bids_bid_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bids
    ADD CONSTRAINT telegram_bids_bid_number_key UNIQUE (bid_number);


--
-- Name: telegram_bids telegram_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_bids
    ADD CONSTRAINT telegram_bids_pkey PRIMARY KEY (id);


--
-- Name: driver_profiles unique_driver_profile_per_carrier; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_profiles
    ADD CONSTRAINT unique_driver_profile_per_carrier UNIQUE (carrier_user_id, driver_name, driver_phone, driver_license_number);


--
-- Name: CONSTRAINT unique_driver_profile_per_carrier ON driver_profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT unique_driver_profile_per_carrier ON public.driver_profiles IS 'Prevents duplicate driver profiles within the same carrier. Allows multiple drivers with the same name as long as they have different phone numbers or license numbers.';


--
-- Name: user_roles_cache user_roles_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles_cache
    ADD CONSTRAINT user_roles_cache_pkey PRIMARY KEY (clerk_user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);


--
-- Name: users users_clerk_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_clerk_user_id_key UNIQUE (clerk_user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_messages_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_messages_carrier_user_id ON public.admin_messages USING btree (carrier_user_id);


--
-- Name: idx_admin_profile_actions_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_profile_actions_admin ON public.admin_profile_actions USING btree (admin_user_id);


--
-- Name: idx_admin_profile_actions_carrier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_profile_actions_carrier ON public.admin_profile_actions USING btree (carrier_user_id);


--
-- Name: idx_admin_profile_actions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_profile_actions_type ON public.admin_profile_actions USING btree (action_type);


--
-- Name: idx_archive_bids_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_bids_bid_number ON public.archive_bids USING btree (bid_number);


--
-- Name: idx_archive_bids_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archive_bids_date ON public.archive_bids USING btree (archived_date);


--
-- Name: idx_archived_bids_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archived_bids_bid_number ON public.archived_bids USING btree (bid_number);


--
-- Name: idx_archived_bids_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archived_bids_date ON public.archived_bids USING btree (archived_at);


--
-- Name: idx_archived_bids_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_archived_bids_received_at ON public.archived_bids USING btree (received_at);


--
-- Name: idx_bid_lifecycle_events_bid_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_bid_id ON public.bid_lifecycle_events USING btree (bid_id);


--
-- Name: idx_bid_lifecycle_events_check_in_delivery_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_check_in_delivery_time ON public.bid_lifecycle_events USING btree (check_in_delivery_time);


--
-- Name: idx_bid_lifecycle_events_check_in_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_check_in_time ON public.bid_lifecycle_events USING btree (check_in_time);


--
-- Name: idx_bid_lifecycle_events_delivery_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_delivery_time ON public.bid_lifecycle_events USING btree (delivery_time);


--
-- Name: idx_bid_lifecycle_events_departure_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_departure_time ON public.bid_lifecycle_events USING btree (departure_time);


--
-- Name: idx_bid_lifecycle_events_driver_info; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_driver_info ON public.bid_lifecycle_events USING btree (driver_name, truck_number);


--
-- Name: idx_bid_lifecycle_events_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_event_type ON public.bid_lifecycle_events USING btree (event_type);


--
-- Name: idx_bid_lifecycle_events_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_location ON public.bid_lifecycle_events USING btree (location);


--
-- Name: idx_bid_lifecycle_events_pickup_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_pickup_time ON public.bid_lifecycle_events USING btree (pickup_time);


--
-- Name: idx_bid_lifecycle_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bid_lifecycle_events_timestamp ON public.bid_lifecycle_events USING btree ("timestamp");


--
-- Name: idx_carrier_bid_history_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bid_history_bid_number ON public.carrier_bid_history USING btree (bid_number);


--
-- Name: idx_carrier_bid_history_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bid_history_created_at ON public.carrier_bid_history USING btree (created_at);


--
-- Name: idx_carrier_bid_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bid_history_status ON public.carrier_bid_history USING btree (bid_status);


--
-- Name: idx_carrier_bid_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bid_history_user ON public.carrier_bid_history USING btree (carrier_user_id);


--
-- Name: idx_carrier_bids_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_bid_number ON public.carrier_bids USING btree (bid_number);


--
-- Name: idx_carrier_bids_clerk_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_clerk_user_id ON public.carrier_bids USING btree (clerk_user_id);


--
-- Name: idx_carrier_bids_driver_info_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_driver_info_submitted ON public.carrier_bids USING btree (driver_info_submitted_at);


--
-- Name: idx_carrier_bids_driver_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_driver_name ON public.carrier_bids USING btree (driver_name);


--
-- Name: idx_carrier_bids_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_outcome ON public.carrier_bids USING btree (bid_outcome);


--
-- Name: idx_carrier_bids_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_status ON public.carrier_bids USING btree (status);


--
-- Name: idx_carrier_bids_truck_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_bids_truck_number ON public.carrier_bids USING btree (truck_number);


--
-- Name: idx_carrier_chat_messages_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_chat_messages_carrier_user_id ON public.carrier_chat_messages USING btree (carrier_user_id);


--
-- Name: idx_carrier_chat_messages_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_chat_messages_is_read ON public.carrier_chat_messages USING btree (is_read);


--
-- Name: idx_carrier_chat_messages_read_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_chat_messages_read_at ON public.carrier_chat_messages USING btree (read_at);


--
-- Name: idx_carrier_favorites_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_favorites_bid_number ON public.carrier_favorites USING btree (bid_number);


--
-- Name: idx_carrier_favorites_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_favorites_carrier_user_id ON public.carrier_favorites USING btree (carrier_user_id);


--
-- Name: idx_carrier_notification_preferences_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notification_preferences_carrier_user_id ON public.carrier_notification_preferences USING btree (carrier_user_id);


--
-- Name: idx_carrier_notification_settings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notification_settings_user_id ON public.carrier_notification_settings USING btree (carrier_user_id);


--
-- Name: idx_carrier_notifications_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notifications_bid_number ON public.carrier_notifications USING btree (bid_number);


--
-- Name: idx_carrier_notifications_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notifications_carrier_user_id ON public.carrier_notifications USING btree (carrier_user_id);


--
-- Name: idx_carrier_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notifications_read ON public.carrier_notifications USING btree (read);


--
-- Name: idx_carrier_notifications_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notifications_timestamp ON public.carrier_notifications USING btree ("timestamp");


--
-- Name: idx_carrier_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_notifications_user_id ON public.carrier_notifications USING btree (carrier_user_id);


--
-- Name: idx_carrier_profile_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profile_history_status ON public.carrier_profile_history USING btree (profile_status);


--
-- Name: idx_carrier_profile_history_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profile_history_submitted_at ON public.carrier_profile_history USING btree (submitted_at);


--
-- Name: idx_carrier_profile_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profile_history_user_id ON public.carrier_profile_history USING btree (carrier_user_id);


--
-- Name: idx_carrier_profiles_clerk_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profiles_clerk_user_id ON public.carrier_profiles USING btree (clerk_user_id);


--
-- Name: idx_carrier_profiles_edits_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profiles_edits_enabled ON public.carrier_profiles USING btree (edits_enabled);


--
-- Name: idx_carrier_profiles_first_login; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profiles_first_login ON public.carrier_profiles USING btree (is_first_login);


--
-- Name: idx_carrier_profiles_is_locked; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profiles_is_locked ON public.carrier_profiles USING btree (is_locked);


--
-- Name: idx_carrier_profiles_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profiles_reviewed_by ON public.carrier_profiles USING btree (reviewed_by);


--
-- Name: idx_carrier_profiles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_profiles_status ON public.carrier_profiles USING btree (profile_status);


--
-- Name: idx_carrier_responses_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_responses_carrier_user_id ON public.carrier_responses USING btree (carrier_user_id);


--
-- Name: idx_carrier_responses_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_responses_created_at ON public.carrier_responses USING btree (created_at);


--
-- Name: idx_carrier_responses_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_responses_is_read ON public.carrier_responses USING btree (is_read);


--
-- Name: idx_carrier_responses_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_responses_message_id ON public.carrier_responses USING btree (message_id);


--
-- Name: idx_carrier_responses_read_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carrier_responses_read_at ON public.carrier_responses USING btree (read_at);


--
-- Name: idx_conversation_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_conversation_id ON public.conversation_messages USING btree (conversation_id);


--
-- Name: idx_conversation_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_created_at ON public.conversation_messages USING btree (created_at);


--
-- Name: idx_conversation_messages_sender_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_messages_sender_id ON public.conversation_messages USING btree (sender_id);


--
-- Name: idx_conversations_admin_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_admin_user_id ON public.conversations USING btree (admin_user_id);


--
-- Name: idx_conversations_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_carrier_user_id ON public.conversations USING btree (carrier_user_id);


--
-- Name: idx_conversations_last_message_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_last_message_at ON public.conversations USING btree (last_message_at);


--
-- Name: idx_conversations_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_type ON public.conversations USING btree (conversation_type);


--
-- Name: idx_driver_profiles_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_profiles_active ON public.driver_profiles USING btree (is_active);


--
-- Name: idx_driver_profiles_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_profiles_carrier_user_id ON public.driver_profiles USING btree (carrier_user_id);


--
-- Name: idx_driver_profiles_composite_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_profiles_composite_unique ON public.driver_profiles USING btree (carrier_user_id, driver_name, driver_phone, driver_license_number);


--
-- Name: idx_driver_profiles_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_profiles_display_order ON public.driver_profiles USING btree (carrier_user_id, display_order);


--
-- Name: idx_driver_profiles_profile_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_driver_profiles_profile_name ON public.driver_profiles USING btree (profile_name);


--
-- Name: idx_load_lifecycle_events_driver_info; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_lifecycle_events_driver_info ON public.load_lifecycle_events USING btree (driver_name, truck_number);


--
-- Name: idx_load_lifecycle_events_load_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_lifecycle_events_load_offer_id ON public.load_lifecycle_events USING btree (load_offer_id);


--
-- Name: idx_load_lifecycle_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_lifecycle_events_timestamp ON public.load_lifecycle_events USING btree ("timestamp");


--
-- Name: idx_load_offers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_active ON public.load_offers USING btree (is_expired, status) WHERE (is_expired = false);


--
-- Name: idx_load_offers_carrier_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_carrier_user_id ON public.load_offers USING btree (carrier_user_id);


--
-- Name: idx_load_offers_driver_info; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_driver_info ON public.load_offers USING btree (driver_info_submitted_at);


--
-- Name: idx_load_offers_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_expires_at ON public.load_offers USING btree (expires_at);


--
-- Name: idx_load_offers_is_expired; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_is_expired ON public.load_offers USING btree (is_expired);


--
-- Name: idx_load_offers_load_rr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_load_rr_number ON public.load_offers USING btree (load_rr_number);


--
-- Name: idx_load_offers_status_withdrawn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_load_offers_status_withdrawn ON public.load_offers USING btree (status) WHERE (status = 'withdrawn'::text);


--
-- Name: idx_loads_customer_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loads_customer_name ON public.loads USING btree (customer_name);


--
-- Name: idx_loads_load_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loads_load_number ON public.loads USING btree (load_number);


--
-- Name: idx_loads_max_buy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loads_max_buy ON public.loads USING btree (max_buy);


--
-- Name: idx_loads_rr_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loads_rr_number ON public.loads USING btree (rr_number);


--
-- Name: idx_loads_target_buy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loads_target_buy ON public.loads USING btree (target_buy);


--
-- Name: idx_loads_vendor_dispatch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loads_vendor_dispatch ON public.loads USING btree (vendor_dispatch);


--
-- Name: idx_message_reads_message_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_reads_message_id ON public.message_reads USING btree (message_id);


--
-- Name: idx_message_reads_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_message_reads_user_id ON public.message_reads USING btree (user_id);


--
-- Name: idx_notification_logs_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_logs_sent_at ON public.notification_logs USING btree (sent_at);


--
-- Name: idx_notification_logs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_logs_status ON public.notification_logs USING btree (delivery_status);


--
-- Name: idx_notification_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_logs_user ON public.notification_logs USING btree (carrier_user_id);


--
-- Name: idx_notification_triggers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_triggers_active ON public.notification_triggers USING btree (is_active);


--
-- Name: idx_notification_triggers_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_triggers_type ON public.notification_triggers USING btree (trigger_type);


--
-- Name: idx_notification_triggers_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_triggers_user ON public.notification_triggers USING btree (carrier_user_id);


--
-- Name: idx_offer_comments_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_comments_author_id ON public.offer_comments USING btree (author_id);


--
-- Name: idx_offer_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_comments_created_at ON public.offer_comments USING btree (created_at);


--
-- Name: idx_offer_comments_is_internal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_comments_is_internal ON public.offer_comments USING btree (is_internal);


--
-- Name: idx_offer_comments_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_comments_offer_id ON public.offer_comments USING btree (offer_id);


--
-- Name: idx_offer_history_offer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_history_offer_id ON public.offer_history USING btree (offer_id);


--
-- Name: idx_offer_history_performed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offer_history_performed_at ON public.offer_history USING btree (performed_at);


--
-- Name: idx_telegram_bids_archived_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_bids_archived_at ON public.telegram_bids USING btree (archived_at);


--
-- Name: idx_telegram_bids_bid_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_bids_bid_number ON public.telegram_bids USING btree (bid_number);


--
-- Name: idx_telegram_bids_is_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_telegram_bids_is_archived ON public.telegram_bids USING btree (is_archived);


--
-- Name: idx_user_roles_cache_clerk_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_cache_clerk_user_id ON public.user_roles_cache USING btree (clerk_user_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON public.user_roles USING btree (user_id);


--
-- Name: carrier_responses trigger_update_carrier_responses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_carrier_responses_updated_at BEFORE UPDATE ON public.carrier_responses FOR EACH ROW EXECUTE FUNCTION public.update_carrier_responses_updated_at();


--
-- Name: conversation_messages trigger_update_conversation_last_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_last_message AFTER INSERT ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: conversation_messages trigger_update_conversation_message_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_message_updated_at BEFORE UPDATE ON public.conversation_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_updated_at();


--
-- Name: conversations trigger_update_conversation_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_conversation_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_conversation_updated_at();


--
-- Name: driver_profiles trigger_update_driver_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_driver_profiles_updated_at BEFORE UPDATE ON public.driver_profiles FOR EACH ROW EXECUTE FUNCTION public.update_driver_profiles_updated_at();


--
-- Name: offer_comments trigger_update_offer_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_offer_comments_updated_at BEFORE UPDATE ON public.offer_comments FOR EACH ROW EXECUTE FUNCTION public.update_offer_comments_updated_at();


--
-- Name: bid_lifecycle_events update_bid_lifecycle_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bid_lifecycle_events_updated_at BEFORE UPDATE ON public.bid_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.update_bid_lifecycle_events_updated_at();


--
-- Name: carrier_notification_settings update_carrier_notification_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carrier_notification_settings_updated_at BEFORE UPDATE ON public.carrier_notification_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: carrier_notifications update_carrier_notifications_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_carrier_notifications_updated_at BEFORE UPDATE ON public.carrier_notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: load_lifecycle_events update_load_lifecycle_events_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_load_lifecycle_events_updated_at BEFORE UPDATE ON public.load_lifecycle_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assignments assignments_rr_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_rr_number_fkey FOREIGN KEY (rr_number) REFERENCES public.loads(rr_number) ON DELETE CASCADE;


--
-- Name: carrier_notifications carrier_notifications_load_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_notifications
    ADD CONSTRAINT carrier_notifications_load_id_fkey FOREIGN KEY (load_id) REFERENCES public.load_offers(id) ON DELETE CASCADE;


--
-- Name: conversation_messages conversation_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_messages
    ADD CONSTRAINT conversation_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: carrier_responses fk_carrier_responses_message_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carrier_responses
    ADD CONSTRAINT fk_carrier_responses_message_id FOREIGN KEY (message_id) REFERENCES public.admin_messages(id) ON DELETE CASCADE;


--
-- Name: load_lifecycle_events load_lifecycle_events_load_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_lifecycle_events
    ADD CONSTRAINT load_lifecycle_events_load_offer_id_fkey FOREIGN KEY (load_offer_id) REFERENCES public.load_offers(id) ON DELETE CASCADE;


--
-- Name: load_offers load_offers_load_rr_number_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.load_offers
    ADD CONSTRAINT load_offers_load_rr_number_fkey FOREIGN KEY (load_rr_number) REFERENCES public.loads(rr_number) ON DELETE CASCADE;


--
-- Name: message_reads message_reads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.conversation_messages(id) ON DELETE CASCADE;


--
-- Name: notification_logs notification_logs_trigger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_logs
    ADD CONSTRAINT notification_logs_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES public.notification_triggers(id);


--
-- Name: offer_comments offer_comments_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_comments
    ADD CONSTRAINT offer_comments_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.load_offers(id) ON DELETE CASCADE;


--
-- Name: offer_history offer_history_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offer_history
    ADD CONSTRAINT offer_history_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.load_offers(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict zDO3SyYFIsYEwffaSwq5AozBgimKsfAGFuuqcahgwHTMuLCjFraC1RNeSLY306t

