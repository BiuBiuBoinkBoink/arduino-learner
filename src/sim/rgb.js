// Lesson 1.8 colour mixing board: the sketch writes red, green and blue with
// analogWrite on D9, D10 and D11. Pure module, no DOM. Goal: since Run, all
// three channels (0 to 255) have been within TOLERANCE of TARGET at once.
export const TARGET = { name: 'orange', red: 255, green: 128, blue: 0 }
export const TOLERANCE = 25
const CHANNELS = [['red', 'D9'], ['green', 'D10'], ['blue', 'D11']]

export function createRgbSim({ pins }) {
  let matched = false

  const current = () => Object.fromEntries(CHANNELS.map(([channel, pin]) => [channel, Math.round(pins.get(pin) * 255)]))

  function update() {
    const now = current()
    if (CHANNELS.every(([channel]) => Math.abs(now[channel] - TARGET[channel]) <= TOLERANCE)) matched = true
  }

  function checkGoal() {
    return matched
  }

  function readout() {
    const now = current()
    return `Now ${now.red}, ${now.green}, ${now.blue}. Target ${TARGET.name} ${TARGET.red}, ${TARGET.green}, ${TARGET.blue}`
  }

  return { levels: () => ({}), update, checkGoal, readout, progress: () => ({}) }
}
