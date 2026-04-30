-- Extend the notifications type check to include 'heart_reaction'.
--
-- Pairs with the feed_reactions table (added 20260514): when someone hearts
-- another user's bite, the client inserts a 'heart_reaction' notification
-- so the post owner sees it in the bell. Removing a heart leaves any
-- existing notification untouched (matches IG / Strava convention).

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type in (
      'follow',
      'taste_buds',
      'dine_tag',
      'dine_tag_back',
      'dine_tag_accepted',
      'dine_tag_mutual',
      'heart_reaction'
    ));
