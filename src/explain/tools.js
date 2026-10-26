// Explain tools: one async function per tool, shared by the Explain menu and
// (phase 9) the help chat. Each returns { ok, text }: text is one or two plain
// sentences saying what is now on screen or what was found. Arguments are
// checked, and a tool that cannot work returns { ok: false, text: <reason> }
// instead of throwing. No tool changes the learner's build, steps or progress.
//
// Not a pure module in the strict sense: the scene and the cards are reached
// only through the injected deps, so the tools themselves stay testable.
//
// createExplainTools(deps) -> { xray(on), trace(pin), scope(pin, seconds),
//   connections(compare), part_card(part), measure(target), slow_motion(speed),
//   reasons(), wiredPins(), signalPins() }
// deps: { setXray(on), getBuild(), getReference(), getPressed(), showTrace(path),
//   isRunning(), openScope(pin, seconds) -> summary text, showConnections(rows),
//   getKit() -> [{ id, type, label }], openPartCard(type), hasCircuit(),
//   getLevels() -> { pinLevels, inputLevels }, showMeasure({ at, text }),
//   setSlowMotion(speed | null) -> boolean, getSlowMotion() -> speed | null }
import { buildNetlist, isPinName, normalizePin, partLabel, placeLabel } from '../circuits/netlist.js'
import { PART_TYPES, TERMINAL_LABELS, terminalHoles } from '../circuits/footprints.js'
import { isHole } from '../circuits/holes.js'
import { netVoltages, pinVoltage } from './voltages.js'
import { tracePath } from './currentPath.js'
import { describeNets } from './connections.js'
import { PART_INFO } from '../course/partInfo.js'

export const XRAY_ON = 'The breadboard is see-through. Each metal bar joins the holes above it.'
export const XRAY_OFF = 'X-ray is off.'
export const NO_CIRCUIT = 'This lesson has no circuit to explain.'
export const WIRE_FIRST = 'Wire a pin first.'
export const RUN_FIRST = 'Run the sketch first.'
export const SLOW_SPEEDS = { 0.1: 'a tenth', 0.25: 'a quarter' }
export const SLOW_OFF = 'Slow motion is off. Goals stay paused until you press Run again.'

// Pins the build wires to something, GND left out: the places current can start.
export function wiredPins(build) {
  const pins = buildNetlist(build).nets.flatMap((net) => net.pins)
  return [...new Set(pins.map(normalizePin))].filter((pin) => pin !== 'GND')
}

// Wired pins a sketch can drive or read: no power pins.
export function signalPins(build) {
  return wiredPins(build).filter((pin) => /^(D\d{1,2}|A[0-5])$/.test(pin))
}

// 'the resistor, then the LED'
function partList(ids, parts) {
  return ids.map((id) => 'the ' + partLabel(parts.find((part) => part.id === id), parts)).join(', then ')
}

export function createExplainTools(deps) {
  const hasReference = () => Boolean(deps.getReference())

  async function xray(on = true) {
    const value = Boolean(on)
    deps.setXray(value)
    return { ok: true, text: value ? XRAY_ON : XRAY_OFF }
  }

  async function trace(pin) {
    if (!hasReference()) return { ok: false, text: NO_CIRCUIT }
    if (!isPinName(pin) || normalizePin(pin) === 'GND') return { ok: false, text: `There is no pin called ${String(pin)} to trace from.` }
    const build = deps.getBuild()
    const path = tracePath(build, { from: pin, pressed: deps.getPressed() })
    const parts = build.parts || []
    deps.showTrace(path)
    if (path.hops.length === 0 && !path.stop) return { ok: true, text: `Nothing is wired to ${pin} yet.` }
    if (path.reachesGround) {
      if (path.parts.length === 0) return { ok: true, text: `Current flows from ${pin} straight to GND.` }
      return { ok: true, text: `Current flows from ${pin} through ${partList(path.parts, parts)}, to GND.` }
    }
    if (path.blocked) {
      const label = partLabel(parts.find((part) => part.id === path.blocked.id), parts)
      return { ok: true, text: `Current reaches the ${label} but cannot get through: the ${label} is in backwards.` }
    }
    return { ok: true, text: `The current stops at ${placeLabel(path.stop.place)}. Nothing there leads on to GND.` }
  }

  async function scope(pin, seconds = 5) {
    if (!deps.isRunning()) return { ok: false, text: RUN_FIRST }
    if (typeof pin !== 'string' || !/^(D\d{1,2}|A[0-5])$/.test(pin)) return { ok: false, text: `There is no pin called ${String(pin)} to watch.` }
    const span = Number(seconds)
    if (!Number.isInteger(span) || span < 1 || span > 5) return { ok: false, text: 'Pick 1 to 5 seconds for the scope.' }
    return { ok: true, text: deps.openScope(pin, span) }
  }

  async function connections(compare = true) {
    if (!hasReference()) return { ok: false, text: NO_CIRCUIT }
    const rows = describeNets(deps.getBuild(), compare ? deps.getReference() : null)
    deps.showConnections(rows)
    const count = `${rows.length} ${rows.length === 1 ? 'connection' : 'connections'}.`
    if (!compare) return { ok: true, text: count }
    return { ok: true, text: `${count} ${rows.filter((row) => row.match).length} match the lesson circuit.` }
  }

  // A kit id ('led1') or a part type ('led').
  async function part_card(part) {
    const kitPart = deps.getKit().find((item) => item.id === part)
    const type = kitPart ? kitPart.type : part
    if (typeof type !== 'string' || !Object.hasOwn(PART_INFO, type)) return { ok: false, text: `There is no part called ${String(part)}.` }
    deps.openPartCard(type)
    return { ok: true, text: PART_INFO[type].summary }
  }

  // A hole ('9e'), a pin ('D13') or a leg ('led1.anode'): its voltage now,
  // pinned as a label there. Outputs read 0 V while the sketch is stopped.
  async function measure(target) {
    if (!deps.hasCircuit()) return { ok: false, text: 'This lesson has no circuit to measure.' }
    const name = typeof target === 'string' ? target.trim() : ''
    const build = deps.getBuild()
    const parts = build.parts || []
    let label = name
    let at = name
    if (!isHole(name) && !isPinName(name)) {
      const [id, terminal] = name.split('.')
      const part = parts.find((item) => item.id === id)
      const holes = part && PART_TYPES[part.type].terminals.includes(terminal) ? terminalHoles(part)[terminal] : null
      if (!holes || holes.length === 0) return { ok: false, text: `There is no hole, pin or leg called ${name || String(target)}.` }
      label = `${TERMINAL_LABELS[part.type][terminal]} of the ${partLabel(part, parts)}`
      at = holes[0]
    }
    const levels = deps.getLevels()
    const net = buildNetlist(build).netOf(name)
    const volts = net ? netVoltages(build, levels).get(net.id) : isPinName(name) ? pinVoltage(name, levels) : null
    deps.showMeasure({ at, text: volts === null ? `${label}: not set` : `${label}: ${volts.toFixed(1)} V` })
    const sentence = label.charAt(0).toUpperCase() + label.slice(1)
    if (volts === null) return { ok: true, text: `${sentence} has no fixed voltage right now.` }
    return { ok: true, text: `${sentence} reads ${volts.toFixed(1)} V.` }
  }

  // speed 0.1 or 0.25 slows the running sketch; 1 turns slow motion off.
  async function slow_motion(speed = 0.1) {
    const value = Number(speed)
    if (value === 1) {
      deps.setSlowMotion(null)
      return { ok: true, text: SLOW_OFF }
    }
    if (!Object.hasOwn(SLOW_SPEEDS, String(value))) return { ok: false, text: 'Slow motion runs at 0.1 or 0.25 of the speed.' }
    if (!deps.isRunning()) return { ok: false, text: RUN_FIRST }
    if (!deps.setSlowMotion(value)) return { ok: false, text: RUN_FIRST }
    return { ok: true, text: `The sketch now runs at ${SLOW_SPEEDS[value]} of its speed, with the running line lit up. Goals are paused.` }
  }

  // Why each tool cannot work right now, or null when it can.
  function reasons() {
    const reference = hasReference()
    const pins = reference ? wiredPins(deps.getBuild()) : []
    return {
      xray: null,
      trace: !reference ? NO_CIRCUIT : pins.length === 0 ? WIRE_FIRST : null,
      connections: reference ? null : NO_CIRCUIT,
      part: deps.getKit().length > 0 ? null : 'This lesson has no parts.',
      measure: deps.hasCircuit() ? null : 'This lesson has no circuit to measure.',
      slow: deps.isRunning() || deps.getSlowMotion() !== null ? null : RUN_FIRST,
      scope: !deps.isRunning() ? RUN_FIRST : signalPins(deps.getBuild()).length === 0 ? WIRE_FIRST : null
    }
  }

  return { xray, trace, scope, connections, part_card, measure, slow_motion, reasons, wiredPins: () => wiredPins(deps.getBuild()), signalPins: () => signalPins(deps.getBuild()) }
}
