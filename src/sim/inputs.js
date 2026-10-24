// Shared learner inputs: which circuit buttons are held, by part id. Pure module, no DOM.
export function createInputs() {
  const pressed = new Set()
  const listeners = new Set()

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

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { isPressed, setPressed, subscribe }
}
