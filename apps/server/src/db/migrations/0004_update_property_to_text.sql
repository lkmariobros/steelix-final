-- Migration: Change property column from enum to text
-- This migration converts the property column from enum type to free text

-- Step 1: Add a new text column (temporary)
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS property_new TEXT;

-- Step 2: Migrate existing data (convert enum values to readable text)
UPDATE prospects 
SET property_new = CASE 
    WHEN property::text = 'property_developer' THEN 'Property Developer'
    WHEN property::text = 'secondary_market_owner' THEN 'Secondary Market Owner'
    ELSE property::TEXT
END
WHERE property_new IS NULL;

-- Step 3: Make the new column NOT NULL (after data migration)
ALTER TABLE prospects ALTER COLUMN property_new SET NOT NULL;

-- Step 4: Drop the old enum column
ALTER TABLE prospects DROP COLUMN property;

-- Step 5: Rename the new column to the original name
ALTER TABLE prospects RENAME COLUMN property_new TO property;

-- Note: The property_type enum type is now unused. You may want to drop it:
-- DROP TYPE IF EXISTS property_type;
-- However, check if it's used elsewhere before dropping it.
