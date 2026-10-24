// Lesson 1.4 button board: btn1 joins D2 to GND while held; released, nothing
// drives D2, so it reads HIGH with the sketch's INPUT_PULLUP. Pure module, no
// DOM. Goal: GOAL_PRESSES full presses (press then release) since Run, each
// with the D13 LED on at some point while held.
const BUTTON = 'btn1'
const GOAL_PRESSES = 3

export function createButtonSim({ pins, inputs }) {
  let wasPressed = null
  let lit = false
  let presses = 0

  function levels() {
    return { D2: inputs.isPressed(BUTTON) ? 0 : null }
  }

  function update() {
    const pressed = inputs.isPressed(BUTTON)
    if (pressed && pins.get('D13') >= 0.5) lit = true
    // The first update only records the state, so a press from before Run never counts.
    if (wasPressed !== null && pressed !== wasPressed) {
      if (pressed) lit = pins.get('D13') >= 0.5
      else if (lit) presses += 1
    }
    wasPressed = pressed
  }

  function checkGoal() {
    return presses >= GOAL_PRESSES
  }

  function readout() {
    return `D2 ${inputs.isPressed(BUTTON) ? 'LOW' : 'HIGH'}, LED ${pins.get('D13') >= 0.5 ? 'on' : 'off'}. Presses: ${Math.min(presses, GOAL_PRESSES)} of ${GOAL_PRESSES}`
  }

  return { levels, update, checkGoal, readout }
}
