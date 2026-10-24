// Lesson 1.2 blink board: the sketch drives D13; nothing feeds the sketch.
// Pure module, no DOM. Goal: the last two rising edges of D13 were under
// GOAL_MS apart, timed by the sketch's own clock.
const PIN = 'D13'
const GOAL_MS = 500

export function createBlinkSim() {
  let level = 0
  let lastRise = null
  let lastGap = null

  function output({ kind, pin, value, at }) {
    if (kind !== 'pin' || pin !== PIN) return
    const next = value >= 0.5 ? 1 : 0
    if (next === 1 && level === 0) {
      if (lastRise !== null) lastGap = at - lastRise
      lastRise = at
    }
    level = next
  }

  function checkGoal() {
    return lastGap !== null && lastGap < GOAL_MS
  }

  function readout() {
    const period = lastGap === null ? 'waiting for two blinks' : `one blink takes ${Math.round(lastGap)} ms`
    return `D13 ${level ? 'HIGH' : 'LOW'}, ${period}`
  }

  // New code starts timing afresh, so a blink across the swap does not count.
  function reload() {
    level = 0
    lastRise = null
  }

  return { levels: () => ({}), output, reload, checkGoal, readout }
}
