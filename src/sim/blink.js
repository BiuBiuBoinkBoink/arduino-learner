// Lesson 1.2 blink sim: drives D13 HIGH for onMs, then LOW for offMs, from startedAt.
// Reads onMs and offMs live from getValues(). Pure module, no DOM.
// Goal: the last two rising edges of D13 were under GOAL_MS apart and onMs + offMs is under GOAL_MS.
const PIN = 'D13'
const GOAL_MS = 500

export function createBlinkSim({ pins, getValues, startedAt }) {
  let level = 0
  let lastRise = null
  let lastGap = null

  function update(now) {
    const { onMs, offMs } = getValues()
    const phase = (now - startedAt) % (onMs + offMs)
    const next = phase < onMs ? 1 : 0
    if (next === 1 && level === 0) {
      if (lastRise !== null) lastGap = now - lastRise
      lastRise = now
    }
    level = next
    pins.set(PIN, level)
  }

  function stop() {
    level = 0
    pins.set(PIN, 0)
  }

  function checkGoal() {
    const { onMs, offMs } = getValues()
    return lastGap !== null && lastGap < GOAL_MS && onMs + offMs < GOAL_MS
  }

  return { update, stop, checkGoal }
}
