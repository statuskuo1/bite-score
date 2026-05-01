-- Store each user's restaurant weight preferences so compatibility can
-- compare them across users (they're otherwise only in localStorage).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pref_weight_taste smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pref_weight_bpb   smallint NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS pref_weight_wait  smallint NOT NULL DEFAULT 10;
