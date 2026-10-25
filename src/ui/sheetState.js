// Pure state helper for the compact layout's bottom sheet: 'peek', 'half' or
// 'full'. Heights are in px for a workbench of the given height.
export const SHEET_STATES = ['peek', 'half', 'full']
export const PEEK_PX = 132
export const FULL_GAP_PX = 8

// sheetHeights(height) -> { peek, half, full } in px.
export function sheetHeights(height) {
  const h = Number.isFinite(height) && height > 0 ? height : 0
  return { peek: PEEK_PX, half: h * 0.5, full: Math.max(PEEK_PX, h - FULL_GAP_PX) }
}

// nextSheetState(state, action) with action 'expand' (one state up), 'collapse'
// (one state down) or { type: 'drag', dy, height }: the sheet was dragged dy px
// (positive is down) in a workbench height px tall; it snaps to the state whose
// height is nearest to where it was let go. An unknown state counts as peek.
export function nextSheetState(state, action) {
  const index = Math.max(0, SHEET_STATES.indexOf(state))
  const current = SHEET_STATES[index]
  if (action === 'expand') return SHEET_STATES[Math.min(SHEET_STATES.length - 1, index + 1)]
  if (action === 'collapse') return SHEET_STATES[Math.max(0, index - 1)]
  if (action && action.type === 'drag') {
    const heights = sheetHeights(action.height)
    const dy = Number.isFinite(action.dy) ? action.dy : 0
    const released = heights[current] - dy
    let best = current
    for (const name of SHEET_STATES) {
      if (Math.abs(heights[name] - released) < Math.abs(heights[best] - released)) best = name
    }
    return best
  }
  return current
}
