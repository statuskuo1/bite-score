-- One-time: attach all existing restaurant and café visit rows to the account for "bitescore1".
-- Resolves auth.users by email local-part "bitescore1" or full address like bitescore1@domain.com
-- Adjust the WHERE in the subquery if your account email differs.
--
-- Run in Supabase SQL Editor (postgres) after other BITE migrations. New rows from the app already
-- set user_id to the signed-in user on insert.

DO $$
DECLARE
  owner_id uuid;
  n_rest int;
  n_cafe int;
BEGIN
  SELECT id INTO owner_id
  FROM auth.users
  WHERE lower(split_part(email, '@', 1)) = 'bitescore1'
     OR lower(email) = 'bitescore1'
     OR email ILIKE 'bitescore1@%'
  ORDER BY created_at ASC
  LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row matched bitescore1 — check email in Dashboard → Authentication → Users';
  END IF;

  UPDATE public.restaurants SET user_id = owner_id;
  GET DIAGNOSTICS n_rest = ROW_COUNT;

  UPDATE public.cafes SET user_id = owner_id;
  GET DIAGNOSTICS n_cafe = ROW_COUNT;

  RAISE NOTICE 'Assigned owner % : restaurants rows updated %, cafes rows updated %', owner_id, n_rest, n_cafe;
END $$;
