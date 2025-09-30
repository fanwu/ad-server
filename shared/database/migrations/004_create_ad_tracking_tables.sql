-- Migration: Create ad tracking tables for MVP
-- Description: Basic ad request and impression tracking

-- Up Migration

-- Ad Requests table - tracks incoming ad requests
CREATE TABLE IF NOT EXISTS ad_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(255) UNIQUE NOT NULL,
    pod_duration INTEGER, -- Requested duration in seconds
    ip_address INET,
    user_agent TEXT,
    device_id VARCHAR(255),
    session_id VARCHAR(255),
    referer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Impressions table - tracks served ads
CREATE TABLE IF NOT EXISTS impressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES ad_requests(id),
    campaign_id UUID REFERENCES campaigns(id),
    creative_id UUID REFERENCES creatives(id),
    served_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Basic tracking fields
    duration_watched INTEGER, -- Seconds actually watched
    completed BOOLEAN DEFAULT false,
    clicked BOOLEAN DEFAULT false,
    -- Response metrics
    latency_ms INTEGER, -- Time to serve ad in milliseconds
    -- Additional context
    error_message TEXT
);

-- Campaign daily stats table for quick aggregation
CREATE TABLE IF NOT EXISTS campaign_daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    impressions_count INTEGER DEFAULT 0,
    clicks_count INTEGER DEFAULT 0,
    completions_count INTEGER DEFAULT 0,
    spend_amount DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(campaign_id, date)
);

-- Create indexes for common queries
CREATE INDEX idx_ad_requests_created_at ON ad_requests(created_at);
CREATE INDEX idx_ad_requests_session_id ON ad_requests(session_id);
CREATE INDEX idx_impressions_campaign_id ON impressions(campaign_id);
CREATE INDEX idx_impressions_creative_id ON impressions(creative_id);
CREATE INDEX idx_impressions_served_at ON impressions(served_at);
CREATE INDEX idx_impressions_request_id ON impressions(request_id);
CREATE INDEX idx_campaign_daily_stats_campaign_date ON campaign_daily_stats(campaign_id, date);

-- Add trigger to update campaign_daily_stats updated_at
CREATE TRIGGER update_campaign_daily_stats_updated_at BEFORE UPDATE
    ON campaign_daily_stats FOR EACH ROW EXECUTE PROCEDURE
    update_updated_at_column();

-- Down Migration
-- DROP TRIGGER IF EXISTS update_campaign_daily_stats_updated_at ON campaign_daily_stats;
-- DROP TABLE IF EXISTS campaign_daily_stats;
-- DROP TABLE IF EXISTS impressions;
-- DROP TABLE IF EXISTS ad_requests;