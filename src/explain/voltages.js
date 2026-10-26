// Measure voltage: the voltage of each net of the learner's build, from the
// Uno pins and the simple LED and resistor rules of Level 1. Pure module.
//
// netVoltages(build, { pinLevels, inputLevels }) -> Map(netId -> volts | null)
// - A net with an Uno pin: GND 0, 5V 5, 3.3V 3.3, VIN 9; an output pin its
//   level times 5 (PWM is the average, as the level already is); an input pin
//   with a level from the board times 5. pinLevels and inputLevels are 0 to 1
//   per pin name; a pin in neither has no fixed voltage.
// - A net joined through one resistor to a known net and to LED anodes (or
//   RGB colour legs) whose cathode net is at 0 V: the LED forward voltage when
//   the known net is above it, else the known voltage.
// - A net joined through one resistor to a known net and to nothing else that
//   conducts: the known voltage.
// - Anything else: null.
// pinVoltage(pin, levels) is the first rule for one pin.
import { buildNetlist, normalizePin } from '../circuits/netlist.js'
import { PART_TYPES, legsOf } from '../circuits/footprints.js'

export const FORWARD_VOLTS = { red: 2.0, yellow: 2.1, green: 2.2, blue: 3.0 }
export const RGB_FORWARD_VOLTS = { red: 2.0, green: 3.0, blue: 3.0 }
const FIXED = { GND: 0, '5V': 5, '3.3V': 3.3, VIN: 9 }
const RESISTIVE = ['resistor', 'ldr']

export function pinVoltage(pin, { pinLevels = {}, inputLevels = {} } = {}) {
  const name = normalizePin(pin)
  if (Object.hasOwn(FIXED, name)) return FIXED[name]
  if (Number.isFinite(inputLevels[name])) return inputLevels[name] * 5
  if (Number.isFinite(pinLevels[name])) return pinLevels[name] * 5
  return null
}

// The forward voltage of an LED leg that lets current in, or null.
function forwardVolts(part, terminal) {
  if (part.type === 'led' && terminal === 'anode') return FORWARD_VOLTS[part.color] || FORWARD_VOLTS.red
  if (part.type === 'rgbLed' && Object.hasOwn(RGB_FORWARD_VOLTS, terminal)) return RGB_FORWARD_VOLTS[terminal]
  return null
}

export function netVoltages(build, levels = {}) {
  const netlist = buildNetlist(build)
  const parts = new Map((build.parts || []).filter((part) => Object.hasOwn(PART_TYPES, part.type) && legsOf(part).length > 0).map((part) => [part.id, part]))
  const volts = new Map()
  for (const net of netlist.nets) {
    let value = null
    for (const pin of net.pins) {
      value = pinVoltage(pin, levels)
      if (value !== null) break
    }
    volts.set(net.id, value)
  }
  const known = (net) => (net ? volts.get(net.id) : null)
  const terminalNet = (id, terminal) => netlist.netOf(`${id}.${terminal}`)

  // Each pass can fix nets next to ones fixed in the last pass.
  for (let pass = 0; pass < netlist.nets.length; pass++) {
    let changed = false
    for (const net of netlist.nets) {
      if (volts.get(net.id) !== null) continue
      const terms = net.terms.map((term) => {
        const dot = term.indexOf('.')
        return { part: parts.get(term.slice(0, dot)), terminal: term.slice(dot + 1) }
      }).filter((term) => term.part)
      const resistors = terms.filter((term) => RESISTIVE.includes(term.part.type))
      if (resistors.length !== 1) continue
      const [resistor] = resistors
      const otherEnd = resistor.terminal === 'a' ? 'b' : 'a'
      const supply = known(terminalNet(resistor.part.id, otherEnd))
      if (supply === null || supply === undefined) continue
      const rest = terms.filter((term) => term !== resistor)
      let value = null
      if (rest.length === 0) value = supply
      else {
        const drops = rest.map((term) => {
          const vf = forwardVolts(term.part, term.terminal)
          const cathode = known(terminalNet(term.part.id, 'cathode'))
          return vf !== null && cathode === 0 ? vf : null
        })
        if (drops.every((vf) => vf !== null)) {
          const vf = Math.min(...drops)
          value = supply > vf ? vf : supply
        }
      }
      if (value !== null) {
        volts.set(net.id, value)
        changed = true
      }
    }
    if (!changed) break
  }
  return volts
}
