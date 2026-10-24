// Shared room environment the sensors read: light level from 0 (dark) to 1
// (bright) and air temperature in deg C. Pure module, no DOM. Subscribers get
// (name, value) with name 'light' or 'tempC', only on a real change.
export const DEFAULT_LIGHT = 0.8
export const DEFAULT_TEMP_C = 22
export const MIN_TEMP_C = 0
export const MAX_TEMP_C = 40

export function createRoom() {
  let light = DEFAULT_LIGHT
  let tempC = DEFAULT_TEMP_C
  const listeners = new Set()

  function notify(name, value) {
    listeners.forEach((fn) => fn(name, value))
  }

  function setLight(v) {
    const value = Math.min(1, Math.max(0, v))
    if (value === light) return
    light = value
    notify('light', value)
  }

  function setTempC(v) {
    const value = Math.min(MAX_TEMP_C, Math.max(MIN_TEMP_C, v))
    if (value === tempC) return
    tempC = value
    notify('tempC', value)
  }

  function reset() {
    setLight(DEFAULT_LIGHT)
    setTempC(DEFAULT_TEMP_C)
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { getLight: () => light, getTempC: () => tempC, setLight, setTempC, reset, subscribe }
}
