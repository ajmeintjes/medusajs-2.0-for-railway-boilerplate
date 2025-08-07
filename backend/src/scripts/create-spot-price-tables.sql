-- Create Spot Price Tables for Medusa
-- Run this SQL script to create the required database tables for the spot price module

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create spot_price table
CREATE TABLE IF NOT EXISTS public.spot_price (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Metal information
    metal_type VARCHAR(10) NOT NULL CHECK (metal_type IN ('XAU', 'XAG', 'XPT')),
    symbol VARCHAR(10) NOT NULL,
    
    -- Price information
    price_per_ounce DECIMAL(15,6) NOT NULL CHECK (price_per_ounce > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Data source and integrity
    source VARCHAR(20) NOT NULL CHECK (source IN ('api_primary', 'api_backup', 'manual')),
    source_timestamp TIMESTAMPTZ NOT NULL,
    api_response_hash VARCHAR(64) NULL,
    
    -- Validation and status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_validated BOOLEAN NOT NULL DEFAULT FALSE,
    validation_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- API metadata
    bid_price DECIMAL(15,6) NULL,
    ask_price DECIMAL(15,6) NULL,
    spread DECIMAL(15,6) NULL,
    
    -- Change tracking
    change_24h DECIMAL(15,6) NULL,
    change_percentage_24h DECIMAL(10,6) NULL,
    
    -- Medusa standard fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Create indexes for spot_price table
CREATE INDEX IF NOT EXISTS IDX_SPOT_PRICE_METAL_CREATED ON public.spot_price(metal_type, created_at);
CREATE INDEX IF NOT EXISTS IDX_SPOT_PRICE_ACTIVE_METAL ON public.spot_price(is_active, metal_type);
CREATE INDEX IF NOT EXISTS IDX_SPOT_PRICE_SOURCE ON public.spot_price(source);
CREATE INDEX IF NOT EXISTS IDX_SPOT_PRICE_TIMESTAMP ON public.spot_price(source_timestamp);

-- Create unique constraint for active prices per metal
CREATE UNIQUE INDEX IF NOT EXISTS UNQ_ACTIVE_SPOT_PRICE_PER_METAL 
ON public.spot_price(metal_type) 
WHERE is_active = TRUE AND deleted_at IS NULL;

-- Create spot_price_api_key table
CREATE TABLE IF NOT EXISTS public.spot_price_api_key (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Key identification
    name VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(50) NOT NULL,
    key_hash VARCHAR(256) NOT NULL,
    
    -- Key properties
    scopes JSONB NOT NULL DEFAULT '["read"]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
    
    -- Expiration
    expires_at TIMESTAMPTZ NULL,
    
    -- Usage tracking
    last_used_at TIMESTAMPTZ NULL,
    usage_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    created_by VARCHAR(255) NULL,
    notes TEXT NULL,
    
    -- Medusa standard fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Create indexes for api_key table
CREATE INDEX IF NOT EXISTS IDX_API_KEY_STATUS_CREATED ON public.spot_price_api_key(status, created_at);
CREATE INDEX IF NOT EXISTS IDX_API_KEY_EXPIRES ON public.spot_price_api_key(expires_at) WHERE expires_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS UNQ_API_KEY_HASH ON public.spot_price_api_key(key_hash) WHERE deleted_at IS NULL;

-- Create spot_price_product_pricing table
CREATE TABLE IF NOT EXISTS public.spot_price_product_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Product reference
    product_id VARCHAR(255) NOT NULL,
    variant_id VARCHAR(255) NULL,
    
    -- Metal and pricing configuration
    metal_type VARCHAR(10) NOT NULL,
    weight_oz DECIMAL(12,6) NOT NULL CHECK (weight_oz > 0),
    purity DECIMAL(5,4) NOT NULL DEFAULT 1.0 CHECK (purity > 0 AND purity <= 1),
    
    -- Pricing strategy
    pricing_strategy VARCHAR(30) NOT NULL DEFAULT 'spot_plus_premium' 
        CHECK (pricing_strategy IN ('spot_plus_premium', 'spot_times_multiplier', 'spot_plus_fixed', 'custom_formula')),
    
    -- Premium configuration
    premium_percentage DECIMAL(8,4) NOT NULL DEFAULT 0,
    premium_fixed DECIMAL(12,2) NOT NULL DEFAULT 0,
    multiplier DECIMAL(8,4) NOT NULL DEFAULT 1.0,
    
    -- Custom formula
    custom_formula TEXT NULL,
    
    -- Price bounds
    min_price DECIMAL(12,2) NULL,
    max_price DECIMAL(12,2) NULL,
    
    -- Pricing schedule
    update_frequency VARCHAR(20) NOT NULL DEFAULT 'real_time',
    last_updated TIMESTAMPTZ NULL,
    next_update TIMESTAMPTZ NULL,
    
    -- Status and metadata
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused')),
    auto_update BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Current calculated price cache
    current_spot_price DECIMAL(12,2) NULL,
    current_calculated_price DECIMAL(12,2) NULL,
    price_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Audit fields
    created_by VARCHAR(255) NULL,
    updated_by VARCHAR(255) NULL,
    notes TEXT NULL,
    
    -- Medusa standard fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Create indexes for product_pricing table
CREATE INDEX IF NOT EXISTS IDX_PRODUCT_PRICING_PRODUCT_STATUS ON public.spot_price_product_pricing(product_id, status);
CREATE INDEX IF NOT EXISTS IDX_PRODUCT_PRICING_VARIANT_STATUS ON public.spot_price_product_pricing(variant_id, status);
CREATE INDEX IF NOT EXISTS IDX_PRODUCT_PRICING_METAL_STATUS ON public.spot_price_product_pricing(metal_type, status);
CREATE INDEX IF NOT EXISTS IDX_PRODUCT_PRICING_AUTO_UPDATE ON public.spot_price_product_pricing(auto_update, next_update);

-- Create update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to all tables
CREATE TRIGGER update_spot_price_updated_at 
    BEFORE UPDATE ON public.spot_price 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spot_price_api_key_updated_at 
    BEFORE UPDATE ON public.spot_price_api_key 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spot_price_product_pricing_updated_at 
    BEFORE UPDATE ON public.spot_price_product_pricing 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- INSERT INTO public.spot_price (metal_type, symbol, price_per_ounce, currency, source, source_timestamp, is_active) 
-- VALUES 
--     ('XAU', 'XAU', 2000.00, 'USD', 'manual', NOW(), true),
--     ('XAG', 'XAG', 25.00, 'USD', 'manual', NOW(), true),
--     ('XPT', 'XPT', 1000.00, 'USD', 'manual', NOW(), true);

-- Verify tables were created
SELECT 'spot_price table created' as status, COUNT(*) as columns 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'spot_price'

UNION ALL

SELECT 'spot_price_api_key table created' as status, COUNT(*) as columns 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'spot_price_api_key'

UNION ALL

SELECT 'spot_price_product_pricing table created' as status, COUNT(*) as columns 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'spot_price_product_pricing';

COMMIT;
