// Shared learner inputs by part id: which circuit buttons are held and where
// each knob is turned (0 to 1, 0.5 when never set). Pure module, no DOM.
// Subscribers get (id, on) for a press and (id, value) for a knob. The meter
// probe (the part id the multimeter reads, or null) is stored without notifying.
const DEFAULT_VALUE = 0.5

export function createInputs() {
  const pressed = new Set()
  const values = new Map()
  const listeners = new Set()
  let probe = null

  function isPressed(id) {
    return pressed.has(id)
  }

  // Notifies subscribers only when the state actually changes.
  function setPressed(id, on) {
    if (isPressed(id) === on) return
    if (on) pressed.add(id)
    else pressed.delete(id)
    listeners.forEach((fn) => fn(id, on))
  }

  function getValue(id) {
    return values.has(id) ? values.get(id) : DEFAULT_VALUE
  }

  // Clamped to 0 to 1; notifies only when the value actually changes.
  function setValue(id, v) {
    const value = Math.min(1, Math.max(0, v))
    const changed = getValue(id) !== value
    values.set(id, value)
    if (!changed) return
    listeners.forEach((fn) => fn(id, value))
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return {
    isPressed,
    setPressed,
    getValue,
    setValue,
    getProbe: () => probe,
    setProbe: (id) => { probe = id || null },
    subscribe
  }
}
