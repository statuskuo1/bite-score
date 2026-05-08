-- Prevent duplicate taste_buds notifications between the same pair.
-- A mutual follow can re-trigger if someone unfollows then follows again.

CREATE UNIQUE INDEX IF NOT EXISTS notifications_taste_buds_dedup
  ON notifications (user_id, from_user_id)
  WHERE type = 'taste_buds';

-- Also deduplicate plain follow notifications (same reason).
CREATE UNIQUE INDEX IF NOT EXISTS notifications_follow_dedup
  ON notifications (user_id, from_user_id)
  WHERE type = 'follow';

-- Update trigger to silently skip duplicate inserts.
CREATE OR REPLACE FUNCTION public.handle_follow_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reverse_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = new.following_id
      AND following_id = new.follower_id
  ) INTO reverse_exists;

  IF reverse_exists THEN
    INSERT INTO public.notifications (user_id, from_user_id, type) VALUES
      (new.follower_id,  new.following_id, 'taste_buds'),
      (new.following_id, new.follower_id,  'taste_buds')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.notifications (user_id, from_user_id, type)
    VALUES (new.following_id, new.follower_id, 'follow')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN new;
END;
$$;
