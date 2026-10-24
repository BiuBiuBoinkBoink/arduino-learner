// Board tour goal check: which zones have been opened. Pure module, no DOM.
export function createTour(zoneIds) {
  const ids = zoneIds.slice()
  const opened = new Set()

  function isComplete() {
    return opened.size === ids.length
  }

  // Returns true only on the call that completes the tour.
  function open(id) {
    if (!ids.includes(id) || opened.has(id)) return false
    opened.add(id)
    return isComplete()
  }

  return {
    total: ids.length,
    open,
    isOpened: (id) => opened.has(id),
    openedCount: () => opened.size,
    isComplete
  }
}
