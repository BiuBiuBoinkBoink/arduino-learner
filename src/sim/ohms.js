// Lesson 1.3 resistor board: the sketch drives D9; the LED current follows the
// fitted resistor (the ohms circuit param), I = (5 - 2) / R while D9 is HIGH.
// Pure module, no DOM. The readout shows what the meter probe reads. Goal:
// since Run, the meter has read the LED or resistor current, with D9 HIGH,
// with each resistor value.
import { ledCurrentMa } from './ohm.js'

export const METER_LABELS = { led: 'LED', resistor: 'Resistor' }
const GOAL_OHMS = [220, 1000, 10000]

export function createOhmsSim({ pins, inputs, getValues }) {
  const measured = new Set()
  let probe = null
  let current = 0

  function update() {
    const ohms = getValues().ohms
    probe = inputs.getProbe()
    current = pins.get('D9') * ledCurrentMa(ohms)
    if (Object.hasOwn(METER_LABELS, probe || '') && current > 0) measured.add(ohms)
  }

  function checkGoal() {
    return GOAL_OHMS.every((value) => measured.has(value))
  }

  function readout() {
    if (!Object.hasOwn(METER_LABELS, probe || '')) return 'Meter: pick a part to measure'
    return `Meter on ${METER_LABELS[probe]}: ${current.toFixed(1)} mA`
  }

  function progress() {
    return { measured220: measured.has(220), measured1000: measured.has(1000), measured10000: measured.has(10000) }
  }

  return { levels: () => ({}), update, checkGoal, readout, progress }
}
