-- Prevent duplicate group-visit notifications.
-- group_visit_tagged: one per (recipient, group_visit).
-- group_visit_all_logged: one per (recipient, group_visit).
-- Both use a partial unique index on the JSONB meta field so only the
-- specific notification types are constrained.

CREATE UNIQUE INDEX IF NOT EXISTS notifications_group_visit_tagged_dedup
  ON notifications (user_id, (meta->>'group_visit_id'))
  WHERE type = 'group_visit_tagged';

CREATE UNIQUE INDEX IF NOT EXISTS notifications_group_visit_all_logged_dedup
  ON notifications (user_id, (meta->>'group_visit_id'))
  WHERE type = 'group_visit_all_logged';
