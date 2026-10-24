// Lesson 1.3 resistor sim: D9 is HIGH and the LED current follows the chosen
// resistor, I = (5 - 2) / R. Pure module, no DOM. The readout shows what the
// meter probe reads. Goal: since Run, the meter has read the LED or resistor
// current with each resistor value.
import { ledCurrentMa } from './ohm.js'

export const METER_LABELS = { led: 'LED', resistor: 'Resistor' }
const GOAL_OHMS = [220, 1000, 10000]

export function createOhmsSim({ pins, inputs, getValues }) {
  const measured = new Set()
  let probe = null
  let ohms = GOAL_OHMS[0]

  function update() {
    ohms = getValues().ohms
    probe = inputs.getProbe()
    if (Object.hasOwn(METER_LABELS, probe || '')) measured.add(ohms)
    pins.set('D9', 1)
  }

  function stop() {
    pins.set('D9', 0)
  }

  function checkGoal() {
    return GOAL_OHMS.every((value) => measured.has(value))
  }

  function readout() {
    if (!Object.hasOwn(METER_LABELS, probe || '')) return 'Meter: pick a part to measure'
    return `Meter on ${METER_LABELS[probe]}: ${ledCurrentMa(ohms).toFixed(1)} mA`
  }

  return { update, stop, checkGoal, readout }
}
