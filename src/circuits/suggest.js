// Suggestions for the hint ladder: where the parts of a build step, or the
// wires of a wire step, could go so the step passes. Pure module.
//
// suggest(build, reference, step, scope) -> [
//   { kind: 'part', id, legs } | { kind: 'wire', from, to } | { kind: 'unwire', id }
// ]
// in the order to apply them; [] when nothing is found or nothing is needed.
// Build steps: each part of step.parts that is not placed, or placed but not
// right, tries its reference legs, then the reference legs shifted the way the
// nearest related placed part was shifted, then a search of the board (at most
// SEARCH_LIMIT candidates, nearest to the reference legs first). Wire steps:
// each reference wire from a pin whose net is not what the reference joins it
// to gets a wire to the free hole nearest the reference end, in a build place
// holding the parts that wire reaches; a learner wire from that pin going
// somewhere wrong, or from a pin no reference wire uses, is taken out first.
//
// Also: joinPlaces (the build places a build step's parts must join),
// pendingPins (reference wire pins not joined yet) and suggestionLabels (the
// text pinned at each suggested leg or wire end).
import { ALL_HOLES, ALL_ROWS, BREADBOARD_ROWS, RAIL_ROWS, isHole, parseHole, holeName } from './holes.js'
import { PART_TYPES, TERMINAL_LABELS, legsOf, terminalHoles, footprint, orientationCount, bendLegs } from './footprints.js'
import { align, buildNetlist, compare, normalizePin, isPinName, placeOf, terminalToken } from './netlist.js'
import { createRuleContext, evaluateRule } from './rules.js'

export const SEARCH_LIMIT = 3000

const POSITION_FIELDS = ['legs', 'anode', 'cathode', 'from', 'to', 'at']

function partsById(parts) {
  return new Map((parts || []).map((part) => [part.id, part]))
}

function isPlaced(build, id) {
  const part = (build.parts || []).find((item) => item.id === id)
  return Boolean(part && legsOf(part).length > 0)
}

// Holes in use, leaving out one part's own legs.
function usedHoles(build, except = null) {
  const used = new Set()
  for (const part of build.parts || []) {
    if (part.id !== except) legsOf(part).forEach((hole) => used.add(hole))
  }
  for (const wire of build.wires || []) {
    if (isHole(wire.from)) used.add(wire.from)
    if (isHole(wire.to)) used.add(wire.to)
  }
  return used
}

// A copy of the build with part id at legs (added from the reference when it
// is not in the build yet).
function withPart(build, reference, id, legs) {
  const parts = (build.parts || []).map((part) => ({ ...part }))
  const index = parts.findIndex((part) => part.id === id)
  const base = index === -1 ? { ...(reference.parts || []).find((part) => part.id === id) } : parts[index]
  for (const field of POSITION_FIELDS) delete base[field]
  const next = { ...base, legs: legs.slice() }
  if (index === -1) parts.push(next)
  else parts[index] = next
  return { ...build, parts, wires: (build.wires || []).map((wire) => ({ ...wire })) }
}

function rowIndex(row) {
  return ALL_ROWS.indexOf(row)
}

function holeDistance(a, b) {
  const pa = parseHole(a)
  const pb = parseHole(b)
  return Math.abs(pa.column - pb.column) + Math.abs(rowIndex(pa.row) - rowIndex(pb.row))
}

// Columns plus rows from each leg to its reference leg; a part that works
// either way round takes the better of the two orders.
function legDistance(type, legs, refLegs) {
  if (refLegs.length !== legs.length) return 0
  const sum = (list) => list.reduce((total, hole, i) => total + holeDistance(hole, refLegs[i]), 0)
  const spec = PART_TYPES[type]
  if (spec && !spec.polar && legs.length === 2) return Math.min(sum(legs), sum([legs[1], legs[0]]))
  return sum(legs)
}

function stepPasses(step, build, reference) {
  const check = step.check || {}
  const rules = createRuleContext(build, reference)
  if (check.pass) return evaluateRule(check.pass, rules)
  return (check.items || []).every((item) => evaluateRule(item.rule, rules))
}

// The reference legs moved like a placed part moved: the same column offset,
// and rows shifted by the same number within their half (rails keep their row).
function shifted(refLegs, fromHole, toHole) {
  const from = parseHole(fromHole)
  const to = parseHole(toHole)
  const halfIndex = (row) => BREADBOARD_ROWS.indexOf(row) % 5
  const dColumn = to.column - from.column
  const fromRail = RAIL_ROWS.includes(from.row)
  const toRail = RAIL_ROWS.includes(to.row)
  if (fromRail !== toRail) return null
  const dRow = fromRail ? 0 : halfIndex(to.row) - halfIndex(from.row)
  const out = []
  for (const hole of refLegs) {
    const { column, row } = parseHole(hole)
    let nextRow = row
    if (!RAIL_ROWS.includes(row)) {
      const index = BREADBOARD_ROWS.indexOf(row)
      const inHalf = index % 5 + dRow
      if (inHalf < 0 || inHalf > 4) return null
      nextRow = BREADBOARD_ROWS[index - (index % 5) + inHalf]
    }
    const name = holeName(column + dColumn, nextRow)
    if (!name) return null
    out.push(name)
  }
  return out
}

// Placed parts (other than id) that share a reference net with id.
function relatedPlaced(build, reference, id, scope) {
  const refNet = buildNetlist(reference)
  const out = new Set()
  for (const net of refNet.nets) {
    const ids = net.terms.map((term) => term.slice(0, term.indexOf('.')))
    if (!ids.includes(id)) continue
    for (const other of ids) {
      if (other !== id && scope.includes(other) && isPlaced(build, other)) out.add(other)
    }
  }
  return [...out]
}

// The build places of the placed terminals that share a reference net with a
// terminal of id, for the parts in scope.
function placesToJoin(build, reference, ids, scope) {
  const refNet = buildNetlist(reference)
  const byId = partsById(build.parts)
  const places = []
  for (const net of refNet.nets) {
    const termIds = net.terms.map((term) => term.slice(0, term.indexOf('.')))
    if (!termIds.some((item) => ids.includes(item))) continue
    for (const term of net.terms) {
      const dot = term.indexOf('.')
      const other = term.slice(0, dot)
      if (ids.includes(other) || !scope.includes(other) || !isPlaced(build, other)) continue
      const holes = terminalHoles(byId.get(other))[term.slice(dot + 1)] || []
      for (const hole of holes) {
        const place = placeOf(hole)
        if (!places.includes(place)) places.push(place)
      }
    }
  }
  return places
}

function holesOfPlace(place) {
  return ALL_HOLES.filter((hole) => placeOf(hole) === place)
}

// Every hole a bending part could reach from one end.
function bendPartners(type, from) {
  const { column, row } = parseHole(from)
  const spec = PART_TYPES[type]
  const out = []
  for (let span = spec.minSpan; span <= spec.maxSpan; span++) {
    for (const other of [holeName(column - span, row), holeName(column + span, row)]) {
      if (other && bendLegs(type, from, other)) out.push(other)
    }
  }
  for (const other of ALL_ROWS) {
    const hole = holeName(column, other)
    if (hole && hole !== from && bendLegs(type, from, hole)) out.push(hole)
  }
  return out
}

function searchCandidates(build, reference, id, type, scope) {
  const spec = PART_TYPES[type]
  const out = []
  if (spec.shape === 'bend') {
    const join = placesToJoin(build, reference, [id], scope)
    const firsts = join.length > 0 ? join.flatMap(holesOfPlace) : ALL_HOLES
    for (const first of firsts) {
      for (const second of bendPartners(type, first)) out.push([first, second])
    }
  } else {
    for (const anchor of ALL_HOLES) {
      for (let orientation = 0; orientation < orientationCount(type); orientation++) {
        const legs = footprint(type, anchor, orientation)
        if (legs) out.push(legs)
      }
    }
  }
  return out
}

// Legs for part id that make wins(build) true, or null.
function findLegs(build, reference, id, scope, wins) {
  const refPart = (reference.parts || []).find((part) => part.id === id)
  if (!refPart || !PART_TYPES[refPart.type]) return null
  const type = refPart.type
  const refLegs = legsOf(refPart)
  const used = usedHoles(build, id)
  const free = (legs) => legs && legs.every((hole) => !used.has(hole))
  const tryLegs = (legs) => free(legs) && wins(withPart(build, reference, id, legs))

  // 1. The reference legs.
  if (tryLegs(refLegs)) return refLegs

  // 2. The reference legs shifted like the nearest related placed part.
  const byId = partsById(build.parts)
  const related = relatedPlaced(build, reference, id, scope)
    .map((other) => {
      const otherRef = legsOf((reference.parts || []).find((part) => part.id === other))
      const near = Math.min(...otherRef.flatMap((a) => refLegs.map((b) => holeDistance(a, b))))
      return { other, otherRef, near }
    })
    .sort((a, b) => a.near - b.near)
  if (related.length > 0) {
    const { other, otherRef } = related[0]
    const moved = shifted(refLegs, otherRef[0], legsOf(byId.get(other))[0])
    if (moved && tryLegs(moved)) return moved
  }

  // 3. A search, nearest to the reference legs first.
  const candidates = searchCandidates(build, reference, id, type, scope)
    .filter(free)
    .map((legs) => ({ legs, distance: legDistance(type, legs, refLegs) }))
    .sort((a, b) => a.distance - b.distance)
  for (const { legs } of candidates.slice(0, SEARCH_LIMIT)) {
    if (wins(withPart(build, reference, id, legs))) return legs
  }
  return null
}

function suggestParts(build, reference, step, scope) {
  const parts = Array.isArray(step.parts) ? step.parts : []
  if (parts.length === 0 || stepPasses(step, build, reference)) return []
  const before = scope.filter((id) => !parts.includes(id))
  const out = []
  let work = { parts: (build.parts || []).map((part) => ({ ...part })), wires: (build.wires || []).map((wire) => ({ ...wire })) }
  parts.forEach((id, i) => {
    const subset = [...before, ...parts.slice(0, i + 1)]
    const fullScope = [...new Set([...scope, ...parts])]
    // The last part must make the step pass; earlier ones must fit the parts so far.
    const wins = i === parts.length - 1
      ? (candidate) => stepPasses(step, candidate, reference)
      : (candidate) => compare(candidate, reference, { only: subset }).match
    if (isPlaced(work, id) && wins(work)) return
    const legs = findLegs(work, reference, id, fullScope, wins)
    if (!legs) return
    work = withPart(work, reference, id, legs)
    out.push({ kind: 'part', id, legs })
  })
  return out
}

// The part tokens of a net (no pins), as a sorted list without repeats.
function partTokens(net, byId) {
  if (!net) return []
  const tokens = new Set()
  for (const term of net.terms) {
    const dot = term.indexOf('.')
    const token = terminalToken(byId.get(term.slice(0, dot)), term.slice(dot + 1))
    if (token) tokens.add(token)
  }
  return [...tokens].sort()
}

// The reference wires from pins, grouped by pin: for each pin the part tokens
// of its whole net, and for each wire the tokens it reaches by itself (its end's
// net with that wire left out).
function pinGoals(reference) {
  const refNet = buildNetlist(reference)
  const refById = partsById(reference.parts)
  const byPin = new Map()
  for (const wire of reference.wires || []) {
    if (!isPinName(wire.from) || !isHole(wire.to)) continue
    const pin = normalizePin(wire.from)
    if (!byPin.has(pin)) byPin.set(pin, { pin, tokens: partTokens(refNet.netOf('pin:' + pin), refById), wires: [] })
    const without = buildNetlist({ ...reference, wires: reference.wires.filter((other) => other !== wire) })
    const reaches = partTokens(without.netOf(wire.to), refById)
    if (reaches.length > 0) byPin.get(pin).wires.push({ wire, reaches })
  }
  return [...byPin.values()].filter((goal) => goal.wires.length > 0)
}

const subset = (a, b) => a.every((token) => b.includes(token))

// True when the pin's net in the build holds the parts the reference joins to
// it, nothing else and no other pin.
function pinJoined(netlist, byId, goal) {
  const net = netlist.netOf('pin:' + goal.pin)
  return Boolean(net && net.pins.length === 1 && partTokens(net, byId).join() === goal.tokens.join())
}

// The same pin under another name when the reference one is taken (GND, GND.2, GND.3).
const SAME_PIN = { GND: ['GND', 'GND.2', 'GND.3'] }

function suggestWires(build, reference) {
  let work = align(build, reference)
  const out = []
  const goals = pinGoals(reference)
  const refPins = new Set(goals.map((goal) => goal.pin))
  const unwire = (id) => {
    work = { ...work, wires: work.wires.filter((wire) => wire.id !== id) }
    out.push({ kind: 'unwire', id })
  }
  // A learner wire from a pin no reference wire uses can only be in the way.
  for (const wire of work.wires.slice()) {
    if (isPinName(wire.from) && !refPins.has(normalizePin(wire.from))) unwire(wire.id)
  }
  for (const goal of goals) {
    const byId = partsById(work.parts)
    if (pinJoined(buildNetlist(work), byId, goal)) continue
    // A wire from this pin stays only when its end reaches parts the pin should
    // meet and no other pin.
    for (const wire of work.wires.slice()) {
      if (!isPinName(wire.from) || normalizePin(wire.from) !== goal.pin) continue
      const end = buildNetlist({ ...work, wires: work.wires.filter((other) => other !== wire) }).netOf(wire.to)
      const tokens = partTokens(end, byId)
      if (!end || end.pins.length > 0 || tokens.length === 0 || !subset(tokens, goal.tokens)) unwire(wire.id)
    }
    for (const { wire, reaches } of goal.wires) {
      const netlist = buildNetlist(work)
      const pinNet = netlist.netOf('pin:' + goal.pin)
      if (pinNet && subset(reaches, partTokens(pinNet, byId))) continue
      const nets = netlist.nets.filter((net) => net.pins.length === 0 && net.places.length > 0)
      let targets = nets.filter((net) => partTokens(net, byId).join() === reaches.join())
      if (targets.length === 0) targets = nets.filter((net) => subset(reaches, partTokens(net, byId)))
      const used = usedHoles(work)
      const holes = targets.flatMap((net) => net.places.flatMap(holesOfPlace)).filter((hole) => !used.has(hole))
      const taken = new Set(work.wires.map((item) => item.from))
      const names = SAME_PIN[normalizePin(wire.from)] || [wire.from]
      const from = taken.has(wire.from) ? names.find((name) => !taken.has(name)) : wire.from
      if (holes.length === 0 || !from) continue
      holes.sort((a, b) => holeDistance(a, wire.to) - holeDistance(b, wire.to))
      work = { ...work, wires: [...work.wires, { id: 'suggest' + out.length, from, to: holes[0] }] }
      out.push({ kind: 'wire', from, to: holes[0] })
    }
  }
  return out
}

export function suggest(build, reference, step, scope = []) {
  if (!build || !reference || !step) return []
  if (step.kind === 'build') return suggestParts(build, reference, step, scope)
  if (step.kind === 'wire') return suggestWires(build, reference)
  return []
}

// The build places the new parts of a build step must join: for each scoped
// reference net holding a token of step.parts and of a placed earlier part,
// the build place of that placed part's terminal.
export function joinPlaces(build, reference, step, scope = []) {
  if (!build || !reference || !step || step.kind !== 'build') return []
  const parts = Array.isArray(step.parts) ? step.parts : []
  return placesToJoin(build, reference, parts, scope)
}

// The Uno pins of reference wires whose net in the build is not right yet.
export function pendingPins(build, reference) {
  if (!build || !reference) return []
  const aligned = align(build, reference)
  const netlist = buildNetlist(aligned)
  const byId = partsById(aligned.parts)
  const pinNames = []
  for (const goal of pinGoals(reference)) {
    const pinNet = netlist.netOf('pin:' + goal.pin)
    const have = pinNet && pinNet.pins.length === 1 ? partTokens(pinNet, byId) : []
    for (const { wire, reaches } of goal.wires) {
      if (!subset(reaches, have) && !pinNames.includes(wire.from)) pinNames.push(wire.from)
    }
  }
  return pinNames
}

// The text pinned at each suggestion: [{ at: [holes or pins], text }]. An LED
// gets 'long leg: 9e' and 'short leg: 10e', a bending part 'ends: 5c and 9c',
// other parts '<terminal label>: <holes>' per terminal, a wire '<pin> to <hole>'.
export function suggestionLabels(items, reference) {
  const refById = partsById(reference ? reference.parts : [])
  const out = []
  for (const item of items) {
    if (item.kind === 'wire') {
      out.push({ at: [item.to], text: `${item.from} to ${item.to}` })
      continue
    }
    if (item.kind !== 'part') continue
    const part = refById.get(item.id)
    if (!part || !PART_TYPES[part.type]) continue
    if (PART_TYPES[part.type].shape === 'bend') {
      out.push({ at: item.legs.slice(), text: `ends: ${item.legs[0]} and ${item.legs[1]}` })
      continue
    }
    const words = TERMINAL_LABELS[part.type] || {}
    for (const [terminal, holes] of Object.entries(terminalHoles({ ...part, legs: item.legs }))) {
      out.push({ at: holes, text: `${words[terminal] || terminal}: ${holes.join(' and ')}` })
    }
  }
  return out
}
