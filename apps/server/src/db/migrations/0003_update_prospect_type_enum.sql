-- Migration: Add 'buyer' to prospect_type enum
-- This migration adds 'buyer' as a valid value to the prospect_type enum

-- Add 'buyer' to the enum type
ALTER TYPE prospect_type ADD VALUE IF NOT EXISTS 'buyer';

-- Note: PostgreSQL does not allow removing enum values directly.
-- The enum will now contain: 'tenant', 'owner', and 'buyer'
-- The application code handles converting legacy 'owner' values to 'buyer' when reading
