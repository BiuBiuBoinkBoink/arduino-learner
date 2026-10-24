// Lesson 1.8 colour mixing sim: the red, green and blue params (0 to 255, read
// live) are the analogWrite values on D9, D10 and D11, so each pin level is
// value / 255. Pure module, no DOM. Goal: since Run, update has seen all three
// channels within TOLERANCE of TARGET.
export const TARGET = { name: 'orange', red: 255, green: 128, blue: 0 }
export const TOLERANCE = 25
const CHANNELS = [['red', 'D9'], ['green', 'D10'], ['blue', 'D11']]

export function createRgbSim({ pins, getValues }) {
  let current = { red: 0, green: 0, blue: 0 }
  let matched = false

  function update() {
    const values = getValues()
    current = { red: values.red, green: values.green, blue: values.blue }
    for (const [channel, pin] of CHANNELS) pins.set(pin, current[channel] / 255)
    if (CHANNELS.every(([channel]) => Math.abs(current[channel] - TARGET[channel]) <= TOLERANCE)) matched = true
  }

  function stop() {
    for (const [, pin] of CHANNELS) pins.set(pin, 0)
  }

  function checkGoal() {
    return matched
  }

  function readout() {
    return `Now ${current.red}, ${current.green}, ${current.blue}. Target ${TARGET.name} ${TARGET.red}, ${TARGET.green}, ${TARGET.blue}`
  }

  return { update, stop, checkGoal, readout }
}
