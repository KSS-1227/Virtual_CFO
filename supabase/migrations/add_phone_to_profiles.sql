-- Add phone column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS phone VARCHAR(15);

-- Add index for phone lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- Add comment for documentation
COMMENT ON COLUMN profiles.phone IS 'User phone number for notifications and support';

-- Update RLS policy to include phone field (if needed)
-- This ensures phone field is accessible in existing policies