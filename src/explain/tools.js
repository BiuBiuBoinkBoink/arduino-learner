// Explain tools: one async function per tool, shared by the Explain menu and
// (phase 9) the help chat. Each returns { ok, text }: text is one or two plain
// sentences saying what is now on screen or what was found. Arguments are
// checked, and a tool that cannot work returns { ok: false, text: <reason> }
// instead of throwing. No tool changes the learner's build, steps or progress.
//
// Not a pure module in the strict sense: the scene and the cards are reached
// only through the injected deps, so the tools themselves stay testable.
//
// createExplainTools(deps) -> { xray(on), trace(pin), scope(pin, seconds), reasons(),
//   wiredPins(), signalPins() }
// deps: { setXray(on), getBuild(), hasReference(), getPressed(), showTrace(path),
//   isRunning(), openScope(pin, seconds) -> summary text }
import { buildNetlist, isPinName, normalizePin, partLabel, placeLabel } from '../circuits/netlist.js'
import { tracePath } from './currentPath.js'

export const XRAY_ON = 'The breadboard is see-through. Each metal bar joins the holes above it.'
export const XRAY_OFF = 'X-ray is off.'
export const NO_CIRCUIT = 'This lesson has no circuit to explain.'
export const WIRE_FIRST = 'Wire a pin first.'
export const RUN_FIRST = 'Run the sketch first.'

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
  async function xray(on = true) {
    const value = Boolean(on)
    deps.setXray(value)
    return { ok: true, text: value ? XRAY_ON : XRAY_OFF }
  }

  async function trace(pin) {
    if (!deps.hasReference()) return { ok: false, text: NO_CIRCUIT }
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

  // Why each tool cannot work right now, or null when it can.
  function reasons() {
    const reference = deps.hasReference()
    const pins = reference ? wiredPins(deps.getBuild()) : []
    return {
      xray: null,
      trace: !reference ? NO_CIRCUIT : pins.length === 0 ? WIRE_FIRST : null,
      scope: !deps.isRunning() ? RUN_FIRST : signalPins(deps.getBuild()).length === 0 ? WIRE_FIRST : null
    }
  }

  return { xray, trace, scope, reasons, wiredPins: () => wiredPins(deps.getBuild()), signalPins: () => signalPins(deps.getBuild()) }
}
