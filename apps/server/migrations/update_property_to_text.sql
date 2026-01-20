-- Migration: Change property column from enum to text
-- Run this migration if you get errors about property_type enum

-- Step 1: Create a new text column
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS property_new TEXT;

-- Step 2: Migrate existing data (convert enum values to readable text)
UPDATE prospects 
SET property_new = CASE 
    WHEN property = 'property_developer' THEN 'Property Developer'
    WHEN property = 'secondary_market_owner' THEN 'Secondary Market Owner'
    ELSE property::TEXT
END
WHERE property_new IS NULL;

-- Step 3: Make the new column NOT NULL (after data migration)
ALTER TABLE prospects ALTER COLUMN property_new SET NOT NULL;

-- Step 4: Drop the old column
ALTER TABLE prospects DROP COLUMN property;

-- Step 5: Rename the new column to the original name
ALTER TABLE prospects RENAME COLUMN property_new TO property;

-- Note: After running this migration, you may want to drop the old enum type:
-- DROP TYPE IF EXISTS property_type;
-- However, check if it's used elsewhere before dropping it.
