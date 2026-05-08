-- When a mutual follow is created, delete the stale "follow" notification
-- between the pair before inserting taste_buds. Fixes the double
-- "Taste Buds" notification caused by follow+taste_buds both appearing
-- in the panel after the "Follow back" action.

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
    -- Remove stale follow notifications between this pair so the panel
    -- shows only the taste_buds row, not both.
    DELETE FROM public.notifications
    WHERE type = 'follow'
      AND (
        (user_id = new.follower_id  AND from_user_id = new.following_id)
        OR
        (user_id = new.following_id AND from_user_id = new.follower_id)
      );

    -- Insert taste_buds for both; ON CONFLICT DO NOTHING handles re-follows
    -- (unique index added in 20260531).
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
