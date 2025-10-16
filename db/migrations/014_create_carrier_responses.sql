-- PostgreSQL Migration: Create carrier_responses table
-- Description: Creates table to store carrier responses to admin messages

CREATE TABLE IF NOT EXISTS carrier_responses (
    id SERIAL PRIMARY KEY,
    message_id UUID NOT NULL,
    carrier_user_id TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint to admin_messages table
ALTER TABLE carrier_responses 
ADD CONSTRAINT fk_carrier_responses_message_id 
FOREIGN KEY (message_id) REFERENCES admin_messages(id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_carrier_responses_carrier_user_id ON carrier_responses(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_responses_message_id ON carrier_responses(message_id);
CREATE INDEX IF NOT EXISTS idx_carrier_responses_created_at ON carrier_responses(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_carrier_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_carrier_responses_updated_at
    BEFORE UPDATE ON carrier_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_carrier_responses_updated_at();
