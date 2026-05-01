-- Stores whether the user prefers 0.5-increment taste score steps vs the
-- default 0.1 increments. false = 0.1 (default), true = 0.5.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pref_taste_half_step boolean NOT NULL DEFAULT false;
