// Pure keyboard helper for the info panel tabs. Returns the next tab index
// for an arrow, Home or End key, or null for any other key.
export function nextTabIndex(key, current, count) {
  if (key === 'ArrowRight') return (current + 1) % count
  if (key === 'ArrowLeft') return (current - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
