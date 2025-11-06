-- PostgreSQL Migration: Create bid_documents table
-- Description: Stores documents submitted by carriers for awarded bids (CDL, BOL, POD, etc.)

CREATE TABLE IF NOT EXISTS bid_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bid_number TEXT NOT NULL,
    carrier_user_id TEXT NOT NULL,
    document_type TEXT NOT NULL, -- 'cdl', 'bol', 'pod', 'invoice', 'other'
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL, -- URL to the stored file (Supabase Storage or similar)
    file_size INTEGER, -- Size in bytes
    mime_type TEXT, -- e.g., 'image/jpeg', 'application/pdf'
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT, -- Optional notes from carrier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bid_documents_bid_number ON bid_documents(bid_number);
CREATE INDEX IF NOT EXISTS idx_bid_documents_carrier_user_id ON bid_documents(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_bid_documents_document_type ON bid_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_bid_documents_uploaded_at ON bid_documents(uploaded_at);

-- Add comment to table
COMMENT ON TABLE bid_documents IS 'Stores documents submitted by carriers for awarded bids';


