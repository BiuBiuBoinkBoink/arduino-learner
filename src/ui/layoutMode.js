// Pure helper: the screen layout for an app width in px. Wide keeps the guide,
// workbench and code panel side by side; medium turns the code panel into a
// drawer; compact puts the guide and code in a bottom sheet.
export const MEDIUM_MIN = 900
export const WIDE_MIN = 1200
export const LAYOUTS = ['wide', 'medium', 'compact']

// layoutFor(width) -> 'wide' (>= 1200) | 'medium' (900 to 1199) | 'compact' (< 900)
export function layoutFor(width) {
  const w = Number(width)
  if (!Number.isFinite(w)) return 'wide'
  if (w >= WIDE_MIN) return 'wide'
  if (w >= MEDIUM_MIN) return 'medium'
  return 'compact'
}
