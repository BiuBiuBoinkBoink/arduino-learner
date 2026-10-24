// Lesson 1.4 button board: btn1 joins D2 to GND while held; released, nothing
// drives D2, so it reads HIGH with the sketch's INPUT_PULLUP. Pure module, no
// DOM. Goal: GOAL_PRESSES full presses (press then release) since Run, each
// with the D13 LED on at some point while held. The readout also shows how
// fast the LED reacts to the button, timed on the sketch clock.
import { createResponseTimer } from './responseTimer.js'

const BUTTON = 'btn1'
const GOAL_PRESSES = 3

export function createButtonSim({ pins, inputs }) {
  let wasPressed = null
  let lit = false
  let presses = 0
  const reaction = createResponseTimer({ inputPin: 'D2', outputPin: 'D13' })

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

  function output(event) {
    reaction.output(event)
  }

  function checkGoal() {
    return presses >= GOAL_PRESSES
  }

  function readout() {
    const last = reaction.last()
    const reacts = last === null ? '' : `, reacts in ${last < 1 ? 'under 1' : Math.round(last)} ms`
    return `D2 ${inputs.isPressed(BUTTON) ? 'LOW' : 'HIGH'}, LED ${pins.get('D13') >= 0.5 ? 'on' : 'off'}${reacts}. Presses: ${Math.min(presses, GOAL_PRESSES)} of ${GOAL_PRESSES}`
  }

  function progress() {
    return { pressedOnce: presses >= 1 }
  }

  return { levels, output, update, checkGoal, readout, progress }
}
