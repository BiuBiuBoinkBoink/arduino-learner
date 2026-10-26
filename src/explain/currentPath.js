// Trace the current: the path current would take from a pin through the
// learner's circuit to GND, or where it stops. Pure module.
//
// tracePath(build, { from, pressed = {} }) -> {
//   hops: [{ kind: 'wire' | 'strip' | 'part', id, from, to }],  // from and to are pin or hole names
//   parts: [ids in order],
//   reachesGround: boolean,
//   stop: { place, hole } | null,
//   blocked: { id, reason: 'reversed' } | null
// }
//
// The nets come from buildNetlist; the parts are the edges between them:
// resistor, ldr and buzzer both ways; an LED only from its anode net to its
// cathode net, an RGB LED from each colour leg's net to its cathode net; a
// button between its two sides only while pressed[id]; a potentiometer between
// each pair of its legs; a TMP36 or servo none (powered loads, not part of a
// Level 1 current path). The search runs breadth first from the net of from to
// the GND net, so the path goes through the fewest parts. When GND cannot be
// reached it follows the longest path instead; stop is the place where it
// ends with the free hole there nearest to where the current arrived, and
// blocked names an LED that is in backwards when that is the only way on.
// Inside a net the current moves along wires and strips: a strip hop runs from
// the hole where it arrives to the hole where it leaves.
import { buildNetlist, normalizePin, placeOf } from '../circuits/netlist.js'
import { PART_TYPES, legsOf, terminalHoles } from '../circuits/footprints.js'
import { ALL_HOLES, isHole, parseHole } from '../circuits/holes.js'

const COLOUR_LEGS = ['red', 'green', 'blue']

// The ways current can cross a part, as terminal pairs [in, out].
export function partEdges(part, pressed = {}) {
  switch (part.type) {
    case 'resistor':
    case 'ldr':
    case 'buzzer':
      return [['a', 'b'], ['b', 'a']]
    case 'led':
      return [['anode', 'cathode']]
    case 'rgbLed':
      return COLOUR_LEGS.map((leg) => [leg, 'cathode'])
    case 'button':
      return pressed[part.id] ? [['a', 'b'], ['b', 'a']] : []
    case 'potentiometer': {
      const legs = ['end1', 'wiper', 'end2']
      return legs.flatMap((a) => legs.filter((b) => b !== a).map((b) => [a, b]))
    }
    default:
      return []
  }
}

// The ways an LED would conduct if it were turned round.
function reversedEdges(part) {
  if (part.type === 'led') return [['cathode', 'anode']]
  if (part.type === 'rgbLed') return COLOUR_LEGS.map((leg) => ['cathode', leg])
  return []
}

function placedParts(build) {
  return (build.parts || []).filter((part) => Object.hasOwn(PART_TYPES, part.type) && legsOf(part).length > 0)
}

// Edges between different nets: { part, in, out, a, b } with a and b net ids.
function netEdges(parts, netlist, pick) {
  const edges = []
  for (const part of parts) {
    for (const [inTerm, outTerm] of pick(part)) {
      const a = netlist.netOf(`${part.id}.${inTerm}`)
      const b = netlist.netOf(`${part.id}.${outTerm}`)
      if (a && b && a.id !== b.id) edges.push({ part, in: inTerm, out: outTerm, a: a.id, b: b.id })
    }
  }
  return edges
}

// Breadth first over nets: the edges of the path with the fewest parts, or null.
function shortest(edges, start, goal) {
  if (start === goal) return []
  const prev = new Map([[start, null]])
  const queue = [start]
  while (queue.length > 0) {
    const net = queue.shift()
    for (const edge of edges) {
      if (edge.a !== net || prev.has(edge.b)) continue
      prev.set(edge.b, edge)
      if (edge.b === goal) {
        const path = []
        for (let step = edge; step; step = prev.get(step.a)) path.unshift(step)
        return path
      }
      queue.push(edge.b)
    }
  }
  return null
}

// The longest simple path of edges from start (the first one found on a tie).
function longest(edges, start) {
  let best = []
  const seen = new Set([start])
  function walk(net, path) {
    if (path.length > best.length) best = path.slice()
    for (const edge of edges) {
      if (edge.a !== net || seen.has(edge.b)) continue
      seen.add(edge.b)
      path.push(edge)
      walk(edge.b, path)
      path.pop()
      seen.delete(edge.b)
    }
  }
  walk(start, [])
  return best
}

// Points (holes and pin names) joined by wires and by strips, for the hops
// inside a net.
function pointGraph(build, parts) {
  const adjacent = new Map()
  const link = (a, b, kind, id) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!adjacent.has(x)) adjacent.set(x, [])
      adjacent.get(x).push({ to: y, kind, id })
    }
  }
  const holes = new Set()
  for (const wire of build.wires || []) {
    if (!wire.from || !wire.to || wire.from === wire.to) continue
    link(wire.from, wire.to, 'wire', wire.id)
    for (const end of [wire.from, wire.to]) if (isHole(end)) holes.add(end)
  }
  for (const part of parts) {
    for (const hole of legsOf(part)) if (isHole(hole)) holes.add(hole)
    // A button's facing legs are joined inside it.
    for (const list of Object.values(terminalHoles(part))) {
      for (let i = 1; i < list.length; i++) link(list[0], list[i], 'part', part.id)
    }
  }
  const byPlace = new Map()
  for (const hole of holes) {
    const place = placeOf(hole)
    if (!byPlace.has(place)) byPlace.set(place, [])
    byPlace.get(place).push(hole)
  }
  for (const [place, list] of byPlace) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) link(list[i], list[j], 'strip', place)
  }
  return { adjacent, used: holes }
}

// Wire and strip hops from point to the nearest of targets (breadth first).
function route(graph, point, targets) {
  if (targets.has(point)) return { hops: [], end: point }
  const prev = new Map([[point, null]])
  const queue = [point]
  while (queue.length > 0) {
    const at = queue.shift()
    for (const step of graph.adjacent.get(at) || []) {
      if (prev.has(step.to)) continue
      prev.set(step.to, { at, step })
      if (targets.has(step.to)) {
        const hops = []
        for (let node = step.to; prev.get(node); node = prev.get(node).at) {
          const { at: from, step: via } = prev.get(node)
          hops.unshift({ kind: via.kind, id: via.id, from, to: node })
        }
        return { hops, end: step.to }
      }
      queue.push(step.to)
    }
  }
  return { hops: [], end: point }
}

// The holes of a place key ('strip:9-top' or 'rail:T+').
function placeHoles(place) {
  return ALL_HOLES.filter((hole) => placeOf(hole) === place)
}

// The free hole of a place nearest to a hole in it (that hole when none is free).
function nearestFree(place, hole, used) {
  const at = parseHole(hole)
  let best = null
  for (const candidate of placeHoles(place)) {
    if (used.has(candidate)) continue
    const p = parseHole(candidate)
    const distance = Math.abs(p.column - at.column) + Math.abs(p.row.charCodeAt(p.row.length - 1) - at.row.charCodeAt(at.row.length - 1))
    if (!best || distance < best.distance) best = { hole: candidate, distance }
  }
  return best ? best.hole : hole
}

export function tracePath(build, { from, pressed = {} } = {}) {
  const result = { hops: [], parts: [], reachesGround: false, stop: null, blocked: null }
  if (typeof from !== 'string') return result
  const netlist = buildNetlist(build)
  const start = netlist.netOf(from)
  if (!start) return result
  const parts = placedParts(build)
  const edges = netEdges(parts, netlist, (part) => partEdges(part, pressed))
  const ground = netlist.netOf('GND')
  let path = ground ? shortest(edges, start.id, ground.id) : null
  result.reachesGround = path !== null
  if (!path) path = longest(edges, start.id)
  result.parts = path.map((edge) => edge.part.id)

  const graph = pointGraph(build, parts)
  // The current starts at the wire end of the pin (GND.2 counts as GND).
  const pinEnds = (name) => new Set((build.wires || []).flatMap((wire) => [wire.from, wire.to]).filter((end) => !isHole(end) && normalizePin(end) === normalizePin(name)))
  let point = [...pinEnds(from)][0] || from
  for (const edge of path) {
    const holes = terminalHoles(edge.part)
    const into = route(graph, point, new Set(holes[edge.in]))
    result.hops.push(...into.hops)
    const out = holes[edge.out][0]
    result.hops.push({ kind: 'part', id: edge.part.id, from: into.end, to: out })
    point = out
  }

  if (result.reachesGround) {
    result.hops.push(...route(graph, point, pinEnds('GND')).hops)
    return result
  }
  // A path that never left the pin ends at the hole its wire goes to.
  if (!isHole(point)) {
    const onward = route(graph, point, new Set([...graph.used]))
    result.hops.push(...onward.hops)
    point = onward.end
  }
  if (isHole(point)) {
    const place = placeOf(point)
    result.stop = { place, hole: nearestFree(place, point, graph.used) }
  }
  const end = path.length > 0 ? path[path.length - 1].b : start.id
  const backwards = netEdges(parts, netlist, reversedEdges).find((edge) => edge.a === end)
  if (backwards) result.blocked = { id: backwards.part.id, reason: 'reversed' }
  return result
}
