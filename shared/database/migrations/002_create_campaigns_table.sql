-- Migration: Create campaigns table for MVP
-- Description: Basic campaign management without complex targeting

-- Up Migration
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    budget_total DECIMAL(12,2) NOT NULL CHECK (budget_total > 0),
    budget_spent DECIMAL(12,2) DEFAULT 0.00,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date > start_date),
    CONSTRAINT valid_budget CHECK (budget_spent <= budget_total)
);

-- Create indexes for common queries
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE
    ON campaigns FOR EACH ROW EXECUTE PROCEDURE
    update_updated_at_column();

-- Down Migration
-- DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP TABLE IF EXISTS campaigns;