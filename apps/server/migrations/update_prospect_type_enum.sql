-- Migration: Update prospect_type enum to include 'buyer' instead of 'owner'
-- Run this migration to update your database schema

-- Step 1: Add 'buyer' to the enum type
ALTER TYPE prospect_type ADD VALUE IF NOT EXISTS 'buyer';

-- Step 2: Update existing 'owner' records to 'buyer' (if you want to migrate data)
-- Uncomment the following line if you want to convert all existing 'owner' records to 'buyer':
-- UPDATE prospects SET type = 'buyer' WHERE type = 'owner';

-- Note: PostgreSQL does not allow removing enum values directly.
-- If you want to remove 'owner' from the enum, you would need to:
-- 1. Create a new enum type without 'owner'
-- 2. Alter the column to use the new enum
-- 3. Drop the old enum
-- 
-- However, for now, we'll keep both 'owner' and 'buyer' in the enum
-- to maintain backward compatibility. The application code will handle
-- converting 'owner' to 'buyer' when reading data.
