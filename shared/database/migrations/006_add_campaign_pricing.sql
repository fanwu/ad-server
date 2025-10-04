-- Add pricing configuration to campaigns table
-- This allows advertisers to specify their pricing model and rates

-- Add pricing model column (CPM, CPC, CPV, or Flat)
ALTER TABLE campaigns
ADD COLUMN pricing_model VARCHAR(20) NOT NULL DEFAULT 'cpm',
ADD CONSTRAINT campaigns_pricing_model_check
CHECK (pricing_model IN ('cpm', 'cpc', 'cpv', 'flat'));

-- Add pricing rate columns
ALTER TABLE campaigns
ADD COLUMN cpm_rate NUMERIC(10,2) DEFAULT NULL,  -- Cost per 1000 impressions
ADD COLUMN cpc_rate NUMERIC(10,2) DEFAULT NULL,  -- Cost per click
ADD COLUMN cpv_rate NUMERIC(10,2) DEFAULT NULL;  -- Cost per view/completion

-- Update existing campaigns to have default CPM pricing BEFORE adding constraint
UPDATE campaigns
SET cpm_rate = 5.00
WHERE cpm_rate IS NULL;

-- Add constraints to ensure the correct rate is set based on pricing model
-- We'll enforce this in application logic, but add check that at least one rate exists
ALTER TABLE campaigns
ADD CONSTRAINT campaigns_pricing_rate_check
CHECK (
  (pricing_model = 'cpm' AND cpm_rate IS NOT NULL AND cpm_rate > 0) OR
  (pricing_model = 'cpc' AND cpc_rate IS NOT NULL AND cpc_rate > 0) OR
  (pricing_model = 'cpv' AND cpv_rate IS NOT NULL AND cpv_rate > 0) OR
  (pricing_model = 'flat')
);

-- Add comment explaining pricing models
COMMENT ON COLUMN campaigns.pricing_model IS 'Pricing model: cpm (cost per thousand impressions), cpc (cost per click), cpv (cost per view/completion), flat (fixed budget)';
COMMENT ON COLUMN campaigns.cpm_rate IS 'Cost per 1000 impressions in dollars';
COMMENT ON COLUMN campaigns.cpc_rate IS 'Cost per click in dollars';
COMMENT ON COLUMN campaigns.cpv_rate IS 'Cost per view/completion in dollars';
