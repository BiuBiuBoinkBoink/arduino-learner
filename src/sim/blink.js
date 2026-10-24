// Lesson 1.2 blink sim: drives D13 HIGH for onMs, then LOW for offMs, from startedAt.
// Reads onMs and offMs live from getValues(). Pure module, no DOM. No goal yet.
const PIN = 'D13'

export function createBlinkSim({ pins, getValues, startedAt }) {
  function update(now) {
    const { onMs, offMs } = getValues()
    const phase = (now - startedAt) % (onMs + offMs)
    pins.set(PIN, phase < onMs ? 1 : 0)
  }

  function stop() {
    pins.set(PIN, 0)
  }

  return { update, stop }
}
