/** Whether a single visit row can be edited/deleted by the current user (RLS-aligned UX). */
export function canMutateVisit(row, user, isAdmin) {
  if (isAdmin) return true;
  if (!user?.id) return false;
  return row.ownerId != null && row.ownerId === user.id;
}

/** Swipe / bulk row actions when all visits in the group are owned by the user (or admin). */
export function canSwipeGroup(group, user, isAdmin) {
  if (isAdmin) return true;
  if (!user?.id) return false;
  return group.every((v) => v.ownerId && v.ownerId === user.id);
}
