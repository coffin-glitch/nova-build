-- Add use_timing_relevance column to carrier_notification_preferences
-- This column controls whether timing relevance filtering is applied to notifications

ALTER TABLE public.carrier_notification_preferences
ADD COLUMN IF NOT EXISTS use_timing_relevance BOOLEAN DEFAULT true;

-- Update existing records to default to true (backward compatibility)
UPDATE public.carrier_notification_preferences
SET use_timing_relevance = true
WHERE use_timing_relevance IS NULL;

-- Add comment
COMMENT ON COLUMN public.carrier_notification_preferences.use_timing_relevance IS 'Whether to apply timing relevance window filtering to notifications (default: true)';

