-- Highway User Cookies Table
-- Stores cookies extracted from user's browser session for automatic authentication

CREATE TABLE IF NOT EXISTS highway_user_cookies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    cookies_data JSONB NOT NULL,
    extracted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    source_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_highway_user_cookies_user_id ON highway_user_cookies(user_id);

-- Index for checking freshness
CREATE INDEX IF NOT EXISTS idx_highway_user_cookies_extracted_at ON highway_user_cookies(extracted_at);

COMMENT ON TABLE highway_user_cookies IS 'Stores Highway.com cookies extracted from user browser sessions for automatic authentication in Playwright scraping';
COMMENT ON COLUMN highway_user_cookies.cookies_data IS 'JSON array of cookie objects with name, value, domain, path, etc.';
COMMENT ON COLUMN highway_user_cookies.user_id IS 'User ID from auth system - links cookies to specific admin user';

