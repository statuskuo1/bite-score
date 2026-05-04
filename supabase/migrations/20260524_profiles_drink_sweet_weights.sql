-- Store per-user drink and sweet weight preferences so the community feed
-- can compute an accurate poster BITE score for cafe/sweets entries.
-- Previously these were localStorage-only; other users' feeds fell back to
-- the poster's restaurant weights, producing wrong cafe scores.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pref_weight_drink_taste smallint NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS pref_weight_drink_bpb   smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pref_weight_drink_wait  smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pref_weight_sweet_taste smallint NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS pref_weight_sweet_bpb   smallint NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS pref_weight_sweet_wait  smallint NOT NULL DEFAULT 1;
