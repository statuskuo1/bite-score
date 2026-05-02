-- Migrate weight preferences from 0–100 percentages to raw 1–10 scale.
-- The UI now stores raw 1–10 sliders and converts to percentages at calc time.
-- Existing rows where (taste + bpb + wait) > 30 are old-format percentages —
-- divide by 10, round, clamp to [1,10]. Anything already on the raw scale is
-- left alone. Defaults are bumped to match the new restaurant defaults.
ALTER TABLE profiles
  ALTER COLUMN pref_weight_taste SET DEFAULT 5,
  ALTER COLUMN pref_weight_bpb   SET DEFAULT 4,
  ALTER COLUMN pref_weight_wait  SET DEFAULT 1;

UPDATE profiles
SET
  pref_weight_taste = GREATEST(1, LEAST(10, ROUND(pref_weight_taste / 10.0)::int)),
  pref_weight_bpb   = GREATEST(1, LEAST(10, ROUND(pref_weight_bpb   / 10.0)::int)),
  pref_weight_wait  = GREATEST(1, LEAST(10, ROUND(pref_weight_wait  / 10.0)::int))
WHERE pref_weight_taste + pref_weight_bpb + pref_weight_wait > 30;
