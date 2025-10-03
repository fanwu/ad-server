-- Migration: Add device and location tracking fields to impressions table
-- Description: Add columns needed for impression tracking from Go ad server

-- Up Migration
ALTER TABLE impressions
ADD COLUMN IF NOT EXISTS device_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS location_country VARCHAR(2),
ADD COLUMN IF NOT EXISTS location_region VARCHAR(100),
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS session_id VARCHAR(255);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_impressions_device_type ON impressions(device_type);
CREATE INDEX IF NOT EXISTS idx_impressions_location_country ON impressions(location_country);
CREATE INDEX IF NOT EXISTS idx_impressions_session_id ON impressions(session_id);

-- Down Migration
-- ALTER TABLE impressions DROP COLUMN IF EXISTS session_id;
-- ALTER TABLE impressions DROP COLUMN IF EXISTS ip_address;
-- ALTER TABLE impressions DROP COLUMN IF EXISTS user_agent;
-- ALTER TABLE impressions DROP COLUMN IF EXISTS location_region;
-- ALTER TABLE impressions DROP COLUMN IF EXISTS location_country;
-- ALTER TABLE impressions DROP COLUMN IF EXISTS device_type;
