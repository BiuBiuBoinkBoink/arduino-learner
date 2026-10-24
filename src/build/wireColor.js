// Automatic jumper wire colours, pure. A wire from a pin takes the pin's
// colour: power red, GND black, analog inputs green, other pins yellow. A wire
// from a hole takes the colour of the first pin in that hole's net, else red
// on a + rail, black on a - rail, else blue.
import { buildNetlist, normalizePin, isPinName } from '../circuits/netlist.js'
import { isHole, parseHole } from '../circuits/holes.js'

// Every colour a wire can have; the same names as WIRE_COLORS in src/parts/wire.js.
export const WIRE_COLOR_NAMES = ['red', 'black', 'yellow', 'green', 'blue', 'orange', 'white']

export function pinColor(pin) {
  const name = normalizePin(pin)
  if (['5V', '3.3V', 'VIN'].includes(name)) return 'red'
  if (name === 'GND') return 'black'
  if (/^A[0-5]$/.test(name)) return 'green'
  return 'yellow'
}

export function autoWireColor(from, build) {
  if (isPinName(from)) return pinColor(from)
  if (!isHole(from)) return 'blue'
  const net = buildNetlist(build || { parts: [], wires: [] }).netOf(from)
  if (net && net.pins.length > 0) return pinColor(net.pins[0])
  const { row } = parseHole(from)
  if (row === 'T+' || row === 'B+') return 'red'
  if (row === 'T-' || row === 'B-') return 'black'
  return 'blue'
}
