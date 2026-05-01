-- Add onboarding flags to profiles.
-- DEFAULT true for all existing rows so current users skip both modals.
-- Then reset default to false so new sign-ups see them.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean DEFAULT true;
ALTER TABLE profiles ALTER COLUMN has_completed_onboarding SET DEFAULT false;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_taste_buds_prompt boolean DEFAULT true;
ALTER TABLE profiles ALTER COLUMN has_seen_taste_buds_prompt SET DEFAULT false;
