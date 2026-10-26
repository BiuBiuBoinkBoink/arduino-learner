// Shared pin levels: 0 is LOW, 1 is HIGH, unset pins read 0. Pure module, no DOM.
// snapshot() gives the pins that were ever set, by name (the voltage meter
// treats the others as having no fixed level).
export function createPins() {
  const levels = new Map()
  const listeners = new Set()

  function get(name) {
    return levels.has(name) ? levels.get(name) : 0
  }

  // Notifies subscribers only when the level actually changes.
  function set(name, level) {
    if (get(name) === level) return
    levels.set(name, level)
    listeners.forEach((fn) => fn(name, level))
  }

  function reset() {
    for (const name of Array.from(levels.keys())) set(name, 0)
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { get, set, reset, subscribe, snapshot: () => Object.fromEntries(levels) }
}
