// Lesson 1.5 pull down sim: btn1 joins D2 to 5V, so held reads 1. Released, D2
// reads 0 with the pull down fitted (pull 'down'), or floats with it removed
// (pull 'none'): a random level that changes every 40 to 160 ms. D13 copies D2.
// Pure module, no DOM; random is injectable for tests.
// Goal: GOAL_PRESSES full presses while the pull down is fitted. Removing it resets the count.
const BUTTON = 'btn1'
const GOAL_PRESSES = 3
const FLOAT_MIN_MS = 40
const FLOAT_SPAN_MS = 120

export function createPullDownSim({ pins, inputs, getValues, random = Math.random }) {
  let wasPressed = null
  let armed = false
  let presses = 0
  let floatLevel = 0
  let nextFloat = null

  function update(now) {
    const fitted = getValues().pull === 'down'
    const pressed = inputs.isPressed(BUTTON)
    if (!fitted) {
      armed = false
      presses = 0
    } else if (wasPressed !== null && pressed !== wasPressed) {
      if (pressed) armed = true
      else if (armed) {
        armed = false
        presses += 1
      }
    }
    wasPressed = pressed

    let level
    if (pressed) level = 1
    else if (fitted) level = 0
    else {
      if (nextFloat === null || now >= nextFloat) {
        floatLevel = random() < 0.5 ? 0 : 1
        nextFloat = now + FLOAT_MIN_MS + random() * FLOAT_SPAN_MS
      }
      level = floatLevel
    }
    if (pressed || fitted) nextFloat = null
    pins.set('D2', level)
    pins.set('D13', level)
  }

  function stop() {
    pins.set('D13', 0)
  }

  function checkGoal() {
    return presses >= GOAL_PRESSES
  }

  return { update, stop, checkGoal }
}
