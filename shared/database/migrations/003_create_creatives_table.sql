-- Migration: Create creatives table for MVP
-- Description: Simple creative management for video ads

-- Up Migration
CREATE TABLE IF NOT EXISTS creatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    video_url VARCHAR(500) NOT NULL,
    duration INTEGER NOT NULL CHECK (duration > 0 AND duration <= 120), -- Duration in seconds, max 2 minutes
    file_size BIGINT, -- File size in bytes
    width INTEGER,
    height INTEGER,
    format VARCHAR(20) DEFAULT 'mp4',
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'processing', 'failed')),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_creatives_campaign_id ON creatives(campaign_id);
CREATE INDEX idx_creatives_status ON creatives(status);
CREATE INDEX idx_creatives_duration ON creatives(duration);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_creatives_updated_at BEFORE UPDATE
    ON creatives FOR EACH ROW EXECUTE PROCEDURE
    update_updated_at_column();

-- Down Migration
-- DROP TRIGGER IF EXISTS update_creatives_updated_at ON creatives;
-- DROP TABLE IF EXISTS creatives;