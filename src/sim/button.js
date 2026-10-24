// Lesson 1.4 button sim: D2 uses the internal pull up, so it reads 0 while btn1
// is held and 1 when released; D13 lights the LED while held. Pure module, no DOM.
// Goal: GOAL_PRESSES full presses (press then release) seen by update since Run.
const BUTTON = 'btn1'
const GOAL_PRESSES = 3

export function createButtonSim({ pins, inputs }) {
  let wasPressed = null
  let armed = false
  let presses = 0

  function update() {
    const pressed = inputs.isPressed(BUTTON)
    // The first update only records the state, so a press from before Run never counts.
    if (wasPressed !== null && pressed !== wasPressed) {
      if (pressed) armed = true
      else if (armed) {
        armed = false
        presses += 1
      }
    }
    wasPressed = pressed
    pins.set('D2', pressed ? 0 : 1)
    pins.set('D13', pressed ? 1 : 0)
  }

  function stop() {
    pins.set('D13', 0)
  }

  function checkGoal() {
    return presses >= GOAL_PRESSES
  }

  return { update, stop, checkGoal }
}
