import { useEffect, useState } from "react";

/**
 * Paginated rendering of a long list with a "Show 20 more" tail. The hook
 * owns the visible-count state and resets it back to `pageSize` whenever
 * `resetKey` changes — pass a stringified summary of every sort/filter/
 * search piece of state so changing the underlying ordering scrolls the
 * user back to the top of the new results.
 *
 * Pair with `<ShowMoreButton remaining onClick pageSize />` for the matching
 * tail UI; section headers should keep reading off `total` (or the source
 * array's `.length`), never `visible.length`.
 */
export function usePaginatedList(items, resetKey, pageSize = 20) {
  const [count, setCount] = useState(pageSize);
  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);
  const total = items.length;
  const visible = items.slice(0, count);
  const remaining = Math.max(0, total - count);
  const showMore = () => setCount((c) => c + pageSize);
  return { visible, remaining, total, showMore, pageSize };
}
