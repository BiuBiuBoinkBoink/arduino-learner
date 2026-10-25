// Workbench: the learner's own circuit for the current lesson, built from the
// lesson kit. Pure module (storage is passed in).
//
// createWorkbench({ storage }) -> { load(lessonId, { kit, reference }), getBuild(),
//   tray(), occupancy(), canPlace(id, legs), place(id, legs), remove(id),
//   canWire(from, to), addWire(from, to, color), removeWire(id), canUndo(),
//   undo(), reset(), placeReference(ids), kitPart(id), subscribe(fn) }
//
// The build has the circuit table shape with legs: { parts: [{ id, type, legs,
// ...meta }], wires: [{ id, from, to, color }] }; only placed parts are in it.
// A hole takes one leg or one wire end, a pin one wire. Saved after every
// change under robo-learn:build, keyed by lesson id; loading validates the
// saved record and drops what fails.
import { legsOf, legsValid } from '../circuits/footprints.js'
import { isHole } from '../circuits/holes.js'
import { isPinName } from '../circuits/netlist.js'
import { autoWireColor, WIRE_COLOR_NAMES } from './wireColor.js'

export const BUILD_KEY = 'robo-learn:build'
export const UNDO_LIMIT = 50

export const REASONS = {
  holeUsed: 'That hole is already used.',
  noFit: 'That part does not fit there.',
  wireEnds: 'Wires go from a pin or a hole to a hole.',
  sameEnds: 'A wire needs two different ends.',
  noWires: 'You have used every wire in the kit.'
}

const NO = (reason) => ({ ok: false, reason })
const YES = { ok: true }

export function createWorkbench({ storage }) {
  let lessonId = null
  let kit = { parts: [], wires: 0, prebuilt: { parts: [], wires: [] } }
  let reference = { parts: [], wires: [] }
  // Placed parts: id -> legs. Wires in the order they were added.
  let legs = new Map()
  let wires = []
  let history = []
  const listeners = new Set()

  const kitPart = (id) => kit.parts.find((part) => part.id === id) || null
  const refPart = (id) => (reference.parts || []).find((part) => part.id === id) || null
  const refWire = (id) => (reference.wires || []).find((wire) => wire.id === id) || null

  function emit(type, id = null) {
    listeners.forEach((fn) => fn({ type, id }))
  }

  function readAll() {
    try {
      const data = JSON.parse(storage.getItem(BUILD_KEY))
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {}
    } catch {
      return {}
    }
  }

  function save() {
    if (lessonId === null) return
    try {
      const all = readAll()
      all[lessonId] = {
        parts: kit.parts.filter((part) => legs.has(part.id)).map((part) => ({ id: part.id, legs: legs.get(part.id).slice() })),
        wires: wires.map((wire) => ({ ...wire }))
      }
      storage.setItem(BUILD_KEY, JSON.stringify(all))
    } catch {
      // Storage full or blocked: the build still works for this visit.
    }
  }

  // Holes and pins in use, leaving out one part or wire id.
  function used(except = null) {
    const holes = new Map()
    const pins = new Set()
    for (const [id, list] of legs) {
      if (id === except) continue
      for (const hole of list) holes.set(hole, { kind: 'leg', id })
    }
    for (const wire of wires) {
      if (wire.id === except) continue
      if (isHole(wire.from)) holes.set(wire.from, { kind: 'wire', id: wire.id })
      else pins.add(wire.from)
      holes.set(wire.to, { kind: 'wire', id: wire.id })
    }
    return { holes, pins }
  }

  function snapshot() {
    history.push({ legs: new Map([...legs].map(([id, list]) => [id, list.slice()])), wires: wires.map((wire) => ({ ...wire })) })
    if (history.length > UNDO_LIMIT) history.shift()
  }

  function getBuild() {
    return {
      parts: kit.parts
        .filter((part) => legs.has(part.id))
        .map((part) => ({ id: part.id, type: part.type, legs: legs.get(part.id).slice(), ...structuredClone(part.meta) })),
      wires: wires.map((wire) => ({ ...wire }))
    }
  }

  function canPlace(id, list) {
    const part = kitPart(id)
    if (!part || !legsValid(part.type, list)) return NO(REASONS.noFit)
    const { holes } = used(id)
    if (list.some((hole) => holes.has(hole))) return NO(REASONS.holeUsed)
    return YES
  }

  function canWire(from, to, { except = null } = {}) {
    if (!isHole(to) || !(isHole(from) || isPinName(from))) return NO(REASONS.wireEnds)
    if (from === to) return NO(REASONS.sameEnds)
    const count = wires.filter((wire) => wire.id !== except).length
    if (count >= kit.wires) return NO(REASONS.noWires)
    const { holes, pins } = used(except)
    if (holes.has(to) || (isHole(from) ? holes.has(from) : pins.has(from))) return NO(REASONS.holeUsed)
    return YES
  }

  function nextWireId() {
    for (let n = 1; ; n++) {
      const id = 'u' + n
      if (!wires.some((wire) => wire.id === id)) return id
    }
  }

  // The prebuilt start: prebuilt parts and wires at their reference positions.
  function startState() {
    legs = new Map()
    wires = []
    for (const id of kit.prebuilt.parts) {
      const ref = refPart(id)
      if (!ref || !kitPart(id)) continue
      const list = legsOf(ref)
      if (canPlace(id, list).ok) legs.set(id, list)
    }
    for (const id of kit.prebuilt.wires) {
      const ref = refWire(id)
      if (ref && canWire(ref.from, ref.to).ok) wires.push({ id, from: ref.from, to: ref.to, color: ref.color })
    }
  }

  // A saved record, validated item by item against the kit and free holes.
  function restore(record) {
    legs = new Map()
    wires = []
    for (const item of Array.isArray(record.parts) ? record.parts : []) {
      if (!item || typeof item.id !== 'string' || legs.has(item.id) || !Array.isArray(item.legs)) continue
      const list = item.legs.filter((hole) => typeof hole === 'string')
      if (list.length !== item.legs.length) continue
      if (canPlace(item.id, list).ok) legs.set(item.id, list)
    }
    for (const item of Array.isArray(record.wires) ? record.wires : []) {
      if (!item || typeof item.id !== 'string' || wires.some((wire) => wire.id === item.id)) continue
      if (!/^u\d+$/.test(item.id) && !refWire(item.id)) continue
      if (typeof item.from !== 'string' || typeof item.to !== 'string' || !WIRE_COLOR_NAMES.includes(item.color)) continue
      if (canWire(item.from, item.to).ok) wires.push({ id: item.id, from: item.from, to: item.to, color: item.color })
    }
  }

  function load(id, { kit: nextKit, reference: nextReference }) {
    lessonId = id
    kit = nextKit
    reference = nextReference || { parts: [], wires: [] }
    history = []
    const saved = readAll()[id]
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) restore(saved)
    else startState()
    emit('load', id)
  }

  function place(id, list) {
    if (!canPlace(id, list).ok) return false
    const moved = legs.has(id)
    snapshot()
    legs.set(id, list.slice())
    save()
    emit(moved ? 'move' : 'place', id)
    return true
  }

  function remove(id) {
    if (!legs.has(id)) return false
    snapshot()
    legs.delete(id)
    save()
    emit('remove', id)
    return true
  }

  function addWire(from, to, color) {
    if (!canWire(from, to).ok) return null
    snapshot()
    const id = nextWireId()
    const wireColor = WIRE_COLOR_NAMES.includes(color) ? color : autoWireColor(from, getBuild())
    wires.push({ id, from, to, color: wireColor })
    save()
    emit('wire', id)
    return id
  }

  function removeWire(id) {
    if (!wires.some((wire) => wire.id === id)) return false
    snapshot()
    wires = wires.filter((wire) => wire.id !== id)
    save()
    emit('unwire', id)
    return true
  }

  function undo() {
    const last = history.pop()
    if (!last) return false
    legs = last.legs
    wires = last.wires
    save()
    emit('undo')
    return true
  }

  function reset() {
    history = []
    startState()
    save()
    emit('reset')
  }

  // Places kit parts and reference wires where the reference has them, all or
  // nothing; false when a hole is taken or the kit runs out of wires.
  function placeReference(ids) {
    const nextLegs = new Map([...legs].map(([id, list]) => [id, list.slice()]))
    const nextWires = wires.map((wire) => ({ ...wire }))
    const keep = { legs, wires }
    const changed = []
    let ok = true
    legs = nextLegs
    wires = nextWires
    for (const id of ids) {
      const part = refPart(id)
      const wire = refWire(id)
      if (part && kitPart(id)) {
        const list = legsOf(part)
        if (!canPlace(id, list).ok) { ok = false; break }
        legs.set(id, list)
        changed.push(['place', id])
      } else if (wire) {
        if (wires.some((item) => item.id === id)) continue
        if (!canWire(wire.from, wire.to).ok) { ok = false; break }
        wires.push({ id, from: wire.from, to: wire.to, color: wire.color })
        changed.push(['wire', id])
      } else {
        ok = false
        break
      }
    }
    legs = keep.legs
    wires = keep.wires
    if (!ok) return false
    if (changed.length === 0) return true
    snapshot()
    legs = nextLegs
    wires = nextWires
    save()
    for (const [type, id] of changed) emit(type, id)
    return true
  }

  function tray() {
    return {
      parts: kit.parts.map((part) => {
        const placed = legs.has(part.id)
        const ref = refPart(part.id)
        const atReference = placed && ref && legsOf(ref).join() === legs.get(part.id).join()
        return { id: part.id, type: part.type, placed, prebuilt: Boolean(atReference && kit.prebuilt.parts.includes(part.id)) }
      }),
      wires: { total: kit.wires, used: wires.length }
    }
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return {
    load,
    getBuild,
    tray,
    occupancy: () => used().holes,
    canPlace,
    place,
    remove,
    canWire,
    addWire,
    removeWire,
    canUndo: () => history.length > 0,
    undo,
    reset,
    placeReference,
    // A kit part as a part table entry without legs: { id, type, ...meta }, or null.
    kitPart: (id) => {
      const part = kitPart(id)
      return part ? { id: part.id, type: part.type, ...structuredClone(part.meta) } : null
    },
    subscribe,
    lessonId: () => lessonId
  }
}
