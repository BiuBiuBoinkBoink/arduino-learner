// Lesson 1.5 pull down board: btn1 joins D2 to 5V, so held reads HIGH.
// Released, D2 reads LOW with the pull down fitted (pull 'down', a circuit
// param), or floats with it removed (pull 'none'): a random level that changes
// every 40 to 160 ms. Pure module, no DOM; random is injectable for tests.
// Goal: GOAL_PRESSES full presses while the pull down is fitted, each with the
// D13 LED on while held. Removing it resets the count.
const BUTTON = 'btn1'
const GOAL_PRESSES = 3
const FLOAT_MIN_MS = 40
const FLOAT_SPAN_MS = 120

export function createPullDownSim({ pins, inputs, getValues, random = Math.random }) {
  let wasPressed = null
  let lit = false
  let presses = 0
  let floatLevel = 0
  let nextFloat = null
  // Changes of the floating level seen while the pull down is removed.
  let lastFloat = null
  let floatChanges = 0

  function levels(now) {
    const fitted = getValues().pull === 'down'
    if (inputs.isPressed(BUTTON)) {
      nextFloat = null
      lastFloat = null
      return { D2: 1 }
    }
    if (fitted) {
      nextFloat = null
      lastFloat = null
      return { D2: 0 }
    }
    if (nextFloat === null || now >= nextFloat) {
      floatLevel = random() < 0.5 ? 0 : 1
      nextFloat = now + FLOAT_MIN_MS + random() * FLOAT_SPAN_MS
      if (lastFloat !== null && floatLevel !== lastFloat) floatChanges += 1
      lastFloat = floatLevel
    }
    return { D2: floatLevel }
  }

  function update() {
    const fitted = getValues().pull === 'down'
    const pressed = inputs.isPressed(BUTTON)
    if (pressed && pins.get('D13') >= 0.5) lit = true
    if (!fitted) {
      lit = false
      presses = 0
    } else if (wasPressed !== null && pressed !== wasPressed) {
      if (pressed) lit = pins.get('D13') >= 0.5
      else if (lit) presses += 1
    }
    wasPressed = pressed
  }

  function checkGoal() {
    return presses >= GOAL_PRESSES
  }

  function progress() {
    return { floated: floatChanges >= 2, pressedOnce: presses >= 1 }
  }

  function readout() {
    const fitted = getValues().pull === 'down'
    return `Pull down ${fitted ? 'fitted' : 'removed'}, LED ${pins.get('D13') >= 0.5 ? 'on' : 'off'}. Presses: ${Math.min(presses, GOAL_PRESSES)} of ${GOAL_PRESSES}`
  }

  return { levels, update, checkGoal, readout, progress }
}
