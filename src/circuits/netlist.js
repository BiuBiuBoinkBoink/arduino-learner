// Netlist: what is joined to what in a circuit table, comparing a learner's
// build with the lesson's reference circuit, and naming mistakes in plain
// words. Pure module.
//
// Keys: 'term:<id>.<terminal>', 'pin:<pin>' (GND.2 and GND.3 are 'GND'),
// 'strip:<n>-top' or 'strip:<n>-bottom', 'rail:<row>'. Each leg joins its
// terminal to the place of its hole; each wire joins its from (a pin, or a
// hole's place) to the place of its to. Comparing works on tokens, the parts
// of a net that matter: pins, and terminals ('led1.anode' for polar parts,
// 'r1.*' for two terminal parts that work either way round, 'pot1.end' and
// 'pot1.wiper' for a potentiometer). Parts are matched by id, after align()
// swaps the ids of interchangeable parts (same value resistors, same colour
// LEDs) to fit the reference best.
import { isHole, holeStrip } from './holes.js'
import { PART_TYPES, TERMINAL_LABELS, legsOf, terminalHoles } from './footprints.js'

const PIN_NAME = /^(D\d{1,2}|A[0-5]|GND(\.[23])?|5V|3\.3V|VIN|AREF|IOREF|RESET|SCL|SDA|NC)$/
const POWER_PINS = ['5V', '3.3V', 'VIN']
const NON_POLAR_PAIRS = ['resistor', 'ldr', 'button', 'buzzer']

export function normalizePin(name) {
  return name === 'GND.2' || name === 'GND.3' ? 'GND' : name
}

export function isPinName(name) {
  return typeof name === 'string' && PIN_NAME.test(name)
}

// The place key of a hole: 'strip:12-top', 'strip:12-bottom' or 'rail:T+'.
export function placeOf(hole) {
  const strip = holeStrip(hole)
  return strip.startsWith('rail-') ? 'rail:' + strip.slice(5) : 'strip:' + strip
}

function endKey(name) {
  if (isHole(name)) return placeOf(name)
  if (isPinName(name)) return 'pin:' + normalizePin(name)
  return null
}

function placed(part) {
  return Object.hasOwn(PART_TYPES, part.type) && legsOf(part).length > 0
}

// buildNetlist(circuit) -> { nets, netOf(key) }; a net is { id, terms, pins,
// places }, each sorted, with the smallest key as its id.
export function buildNetlist(circuit) {
  const parent = new Map()
  function find(key) {
    if (!parent.has(key)) parent.set(key, key)
    let root = key
    while (parent.get(root) !== root) root = parent.get(root)
    while (parent.get(key) !== root) {
      const next = parent.get(key)
      parent.set(key, root)
      key = next
    }
    return root
  }
  function union(a, b) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra < rb ? rb : ra, ra < rb ? ra : rb)
  }

  for (const part of circuit.parts || []) {
    if (!placed(part)) continue
    for (const [terminal, holes] of Object.entries(terminalHoles(part))) {
      const key = `term:${part.id}.${terminal}`
      find(key)
      for (const hole of holes) if (isHole(hole)) union(key, placeOf(hole))
    }
  }
  for (const wire of circuit.wires || []) {
    const from = endKey(wire.from)
    const to = endKey(wire.to)
    if (from && to) union(from, to)
  }

  const groups = new Map()
  for (const key of parent.keys()) {
    const root = find(key)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(key)
  }
  const nets = []
  const byKey = new Map()
  for (const keys of groups.values()) {
    keys.sort()
    const net = {
      id: keys[0],
      terms: keys.filter((key) => key.startsWith('term:')).map((key) => key.slice(5)),
      pins: keys.filter((key) => key.startsWith('pin:')).map((key) => key.slice(4)),
      places: keys.filter((key) => key.startsWith('strip:') || key.startsWith('rail:'))
    }
    nets.push(net)
    for (const key of keys) byKey.set(key, net)
  }
  nets.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  // Any key form, or a plain terminal ('led1.anode'), pin ('GND.2') or hole ('9e').
  function netOf(name) {
    if (typeof name !== 'string') return null
    let key = name
    if (/^(term|pin|strip|rail):/.test(name)) key = name.startsWith('pin:') ? 'pin:' + normalizePin(name.slice(4)) : name
    else if (isHole(name)) key = placeOf(name)
    else if (isPinName(name)) key = 'pin:' + normalizePin(name)
    else key = 'term:' + name
    return byKey.get(key) || null
  }
  return { nets, netOf }
}

// The token of one terminal of a part, or null for an unknown type.
export function terminalToken(part, terminal) {
  if (!part || !Object.hasOwn(PART_TYPES, part.type)) return null
  if (NON_POLAR_PAIRS.includes(part.type)) return part.id + '.*'
  if (part.type === 'potentiometer') return part.id + (terminal === 'wiper' ? '.wiper' : '.end')
  return part.id + '.' + terminal
}

function partsById(parts) {
  return new Map((parts || []).map((part) => [part.id, part]))
}

// The tokens of a net: its pins (unless dropped) and its terminals, limited to
// the parts in ids when given.
function netTokens(net, byId, { ids = null, pins = true } = {}) {
  const tokens = pins ? net.pins.slice() : []
  for (const term of net.terms) {
    const dot = term.indexOf('.')
    const id = term.slice(0, dot)
    if (ids && !ids.includes(id)) continue
    const token = terminalToken(byId.get(id), term.slice(dot + 1))
    if (token) tokens.push(token)
  }
  return tokens.sort()
}

function canonicalOf(netlist, parts, options) {
  const byId = partsById(parts)
  return netlist.nets
    .map((net) => netTokens(net, byId, options))
    .filter((tokens) => tokens.length > 0)
    .map((tokens) => tokens.join(','))
    .sort()
}

// One sorted token string per net, the list sorted. With only (part ids):
// tokens of those parts alone, and no pins.
export function canonical(netlist, parts, { only } = {}) {
  return only ? canonicalOf(netlist, parts, { ids: only, pins: false }) : canonicalOf(netlist, parts, {})
}

// Multiset difference: what is in a but not in b.
function minus(a, b) {
  const counts = new Map()
  for (const item of b) counts.set(item, (counts.get(item) || 0) + 1)
  const out = []
  for (const item of a) {
    const n = counts.get(item) || 0
    if (n > 0) counts.set(item, n - 1)
    else out.push(item)
  }
  return out
}

function overlap(a, b) {
  return a.length - minus(a, b).length
}

export function interchangeKey(part) {
  if (part.type === 'resistor') return 'resistor:' + part.ohms
  if (part.type === 'led') return 'led:' + part.color
  return part.type
}

function permutations(items) {
  if (items.length <= 1) return [items.slice()]
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]))
}

// A copy of the build with the ids of interchangeable parts swapped so it
// matches the reference best; ties keep the original ids.
export function align(build, reference) {
  let parts = (build.parts || []).map((part) => ({ ...part }))
  const refCanon = canonical(buildNetlist(reference), reference.parts)
  const score = (candidate) => overlap(canonical(buildNetlist({ parts: candidate, wires: build.wires }), candidate), refCanon)
  const groups = new Map()
  for (const part of reference.parts || []) {
    const key = interchangeKey(part)
    groups.set(key, (groups.get(key) || 0) + 1)
  }
  for (const [key, count] of groups) {
    if (count < 2 || count > 4) continue
    const members = parts.map((part, i) => (interchangeKey(part) === key ? i : -1)).filter((i) => i !== -1)
    if (members.length < 2 || members.length > 4) continue
    const ids = members.map((i) => parts[i].id)
    let best = parts
    let bestScore = score(parts)
    for (const order of permutations(ids).slice(1)) {
      const candidate = parts.map((part) => ({ ...part }))
      members.forEach((index, n) => { candidate[index].id = order[n] })
      const value = score(candidate)
      if (value > bestScore) {
        best = candidate
        bestScore = value
      }
    }
    parts = best
  }
  return { ...build, parts, wires: (build.wires || []).slice() }
}

// { match, missing, extra }: the canonical nets of the reference missing from
// the aligned build, and those in the build but not the reference.
export function compare(build, reference, { only } = {}) {
  const aligned = align(build, reference)
  const mine = canonical(buildNetlist(aligned), aligned.parts, { only })
  const theirs = canonical(buildNetlist(reference), reference.parts, { only })
  const missing = minus(theirs, mine)
  const extra = minus(mine, theirs)
  return { match: missing.length === 0 && extra.length === 0, missing, extra }
}

// Wording helpers.

export function formatOhms(ohms) {
  if (ohms >= 1000000) return `${ohms / 1000000} Mohm`
  if (ohms >= 1000) return `${ohms / 1000} kohm`
  return `${ohms} ohm`
}

export function partLabel(part, parts = []) {
  const base = PART_TYPES[part.type] ? PART_TYPES[part.type].label : part.type
  const same = parts.filter((other) => other.id !== part.id && other.type === part.type)
  if (same.length === 0) return base
  const detailed = (item) => {
    if (item.type === 'resistor') return `${formatOhms(item.ohms)} resistor`
    if (item.type === 'led') return `${item.color} LED`
    return base
  }
  const label = detailed(part)
  if (same.some((other) => detailed(other) === label)) return `${base} ${part.id}`
  return label
}

export function thingLabel(token, parts = []) {
  if (isPinName(token)) return normalizePin(token)
  const dot = token.indexOf('.')
  const part = parts.find((item) => item.id === token.slice(0, dot))
  if (!part) return token
  const terminal = token.slice(dot + 1)
  const label = partLabel(part, parts)
  if (terminal === '*') return label
  if (terminal === 'end') return `outer leg of the ${label}`
  const words = (TERMINAL_LABELS[part.type] || {})[terminal] || terminal
  return `${words} of the ${label}`
}

const RAIL_LABELS = { 'T+': 'the top + rail', 'T-': 'the top - rail', 'B-': 'the bottom - rail', 'B+': 'the bottom + rail' }

export function placeLabel(key) {
  if (key.startsWith('rail:')) return RAIL_LABELS[key.slice(5)] || key
  const match = /^strip:(\d+)-(top|bottom)$/.exec(key)
  if (!match) return key
  return `strip ${match[1]} (rows ${match[2] === 'top' ? 'a to e' : 'f to j'})`
}

// Diagnosing mistakes.

const REVERSED_TEXT = {
  led: 'The LED is in backwards. Pick it up and press R to turn it round.',
  rgbLed: 'The RGB LED is the wrong way round. Pick it up and press R to flip it.',
  tmp36: '5V and GND go to the wrong TMP36 legs. With its flat face towards you, the legs are +Vs, Vout and GND from left to right.'
}
const COLOUR_LEGS = { led: ['anode'], rgbLed: ['red', 'green', 'blue'] }

function mistake(id, text, { parts = [], holes = [], pins = [], places = [] } = {}) {
  return { id, text, targets: { parts, holes, pins, places } }
}

function straddles(part) {
  const legs = legsOf(part)
  return legs.length === 4 && legs[0].endsWith('e') && legs[2].endsWith('f')
}

// Every mistake in the build, most important first; callers show the first.
// With only (part ids), part mistakes and joins look at those parts alone.
export function diagnose(build, reference, { only } = {}) {
  const aligned = align(build, reference)
  const net = buildNetlist(aligned)
  const refNet = buildNetlist(reference)
  const refParts = reference.parts || []
  const refById = partsById(refParts)
  const byId = partsById(aligned.parts)
  // Labels come from the reference parts, plus any build parts it does not have.
  const labelParts = [...refParts, ...aligned.parts.filter((part) => !refById.has(part.id))]
  const label = (part) => partLabel(part, labelParts)
  const inScope = (id) => !only || only.includes(id)
  const placedParts = aligned.parts.filter((part) => placed(part) && inScope(part.id))
  const termNet = (graph, id, terminal) => graph.netOf(`term:${id}.${terminal}`)
  const holesOf = (part, terminals) => {
    const map = terminalHoles(part)
    return (terminals || Object.keys(map)).flatMap((terminal) => map[terminal] || [])
  }
  const out = []

  // short: two different pins in one net.
  for (const item of net.nets) {
    if (item.pins.length < 2) continue
    const pins = [...item.pins.filter((pin) => POWER_PINS.includes(pin)), ...item.pins.filter((pin) => !POWER_PINS.includes(pin) && pin !== 'GND'), ...item.pins.filter((pin) => pin === 'GND')]
    out.push(mistake('short', `This joins ${pins[0]} straight to ${pins[1]}. On a real board that is a short circuit.`, { pins: item.pins, places: item.places }))
  }

  // button-gap: both sides of a button in one net, or a button that does not
  // straddle the channel where the reference one does, with the circuit wrong.
  const scopeIds = only || refParts.map((part) => part.id)
  for (const part of placedParts.filter((item) => item.type === 'button')) {
    const a = termNet(net, part.id, 'a')
    const joined = a && a === termNet(net, part.id, 'b')
    const refPart = refById.get(part.id)
    const offGap = refPart && placed(refPart) && straddles(refPart) && !straddles(part) &&
      !compare(aligned, reference, only ? { only } : {}).match
    if (joined || offGap) {
      out.push(mistake('button-gap', 'Put the button across the centre gap so each side gets its own strips.', { parts: [part.id], holes: legsOf(part) }))
    }
  }

  // same-net: two terminals of one part share a net that they do not share in
  // the reference. A part the reference does not have (1.1, with an empty
  // reference) must never have two terminals in one net.
  for (const part of placedParts) {
    const refPart = refById.get(part.id)
    if (part.type === 'button' || (refPart && !placed(refPart))) continue
    const terminals = PART_TYPES[part.type].terminals
    let found = null
    for (let i = 0; i < terminals.length && !found; i++) {
      for (let j = i + 1; j < terminals.length && !found; j++) {
        const shared = termNet(net, part.id, terminals[i])
        if (!shared || shared !== termNet(net, part.id, terminals[j])) continue
        const refShared = refPart ? termNet(refNet, part.id, terminals[i]) : null
        if (refShared && refShared === termNet(refNet, part.id, terminals[j])) continue
        found = [terminals[i], terminals[j], shared]
      }
    }
    if (!found) continue
    const [t1, t2, shared] = found
    const hole = holesOf(part, [t1])[0]
    const place = hole && isHole(hole) ? placeOf(hole) : shared.places[0]
    const text = terminals.length === 2
      ? `Both legs of the ${label(part)} are in ${placeLabel(place)}, so the current goes round it.`
      : `Two legs of the ${label(part)} share ${placeLabel(place)}. Give each leg its own strip.`
    out.push(mistake('same-net', text, { parts: [part.id], holes: holesOf(part, [t1, t2]), places: [place] }))
  }

  // reversed: turning a polar part round fits the reference better.
  const refCanonPins = canonicalOf(refNet, refParts, { ids: scopeIds, pins: true })
  const scoreOf = (parts) => {
    const mine = canonicalOf(buildNetlist({ parts, wires: aligned.wires }), parts, { ids: scopeIds, pins: true })
    return { match: minus(mine, refCanonPins).length === 0 && minus(refCanonPins, mine).length === 0, score: overlap(mine, refCanonPins) }
  }
  const original = scoreOf(aligned.parts)
  if (!original.match) {
    for (const part of placedParts) {
      if (!Object.hasOwn(REVERSED_TEXT, part.type) || !refById.has(part.id)) continue
      const turned = aligned.parts.map((item) => (item === part ? { ...item, legs: legsOf(item).reverse() } : item))
      const result = scoreOf(turned)
      if (result.match || result.score > original.score) {
        out.push(mistake('reversed', REVERSED_TEXT[part.type], { parts: [part.id], holes: legsOf(part) }))
      }
    }
  }

  // wrong-pin: a net with one pin P fits a reference net with one other pin Q,
  // and no reference net with the same other tokens uses P.
  const refByOthers = new Map()
  for (const item of refNet.nets) {
    if (item.pins.length !== 1) continue
    const others = netTokens(item, refById, { ids: only, pins: false }).join(',')
    if (!others) continue
    if (!refByOthers.has(others)) refByOthers.set(others, [])
    refByOthers.get(others).push(item.pins[0])
  }
  for (const item of net.nets) {
    if (item.pins.length !== 1) continue
    const others = netTokens(item, byId, { ids: only, pins: false }).join(',')
    const choices = (others && refByOthers.get(others)) || []
    const expected = choices.includes(item.pins[0]) ? undefined : choices[0]
    if (expected) {
      const holes = aligned.wires.filter((wire) => isPinName(wire.from) && normalizePin(wire.from) === item.pins[0]).map((wire) => wire.to)
      out.push(mistake('wrong-pin', `This wire goes to ${item.pins[0]}. The sketch uses ${expected}.`, { pins: [item.pins[0]], holes, places: item.places }))
    }
  }

  // no-resistor: an LED anode or RGB colour leg meets a pin straight away.
  for (const part of placedParts) {
    if (!Object.hasOwn(COLOUR_LEGS, part.type)) continue
    for (const terminal of COLOUR_LEGS[part.type]) {
      const item = termNet(net, part.id, terminal)
      const pin = item && item.pins.find((name) => name !== 'GND')
      const refItem = termNet(refNet, part.id, terminal)
      if (!pin || !refItem || refItem.pins.length > 0) continue
      out.push(mistake('no-resistor', `Nothing limits the current. Put the resistor between ${pin} and the ${label(part)}.`, { parts: [part.id], holes: holesOf(part, [terminal]), pins: [pin], places: item.places }))
    }
  }

  // loose-wire: a wire from a pin ends in places with nothing else in them. Not
  // counted while the parts it should meet are still in the tray, nor with an
  // empty reference, where power on a bare rail is the point (1.1).
  for (const item of refParts.length === 0 ? [] : net.nets) {
    if (item.pins.length !== 1 || item.terms.length > 0 || item.places.length === 0) continue
    const pin = item.pins[0]
    const refItems = refNet.nets.filter((other) => other.pins.includes(pin))
    const waiting = refItems.length > 0 && refItems.every((other) =>
      other.terms.every((term) => {
        const part = byId.get(term.slice(0, term.indexOf('.')))
        return !part || !placed(part)
      }))
    if (waiting) continue
    out.push(mistake('loose-wire', `The wire from ${pin} ends in ${placeLabel(item.places[0])}, which has nothing else in it.`, { pins: [pin], places: item.places }))
  }

  // missing: a reference part that is not placed.
  for (const part of refParts) {
    if (!inScope(part.id)) continue
    const mine = byId.get(part.id)
    if (mine && placed(mine)) continue
    out.push(mistake('missing', `Place the ${label(part)} from the tray.`, { parts: [part.id] }))
  }

  // not-joined: a reference net with no equal build net; name the first two of
  // its tokens that sit in different build nets.
  const tokenNets = new Map()
  for (const item of net.nets) {
    for (const token of netTokens(item, byId, { ids: only, pins: !only })) {
      if (!tokenNets.has(token)) tokenNets.set(token, new Set())
      tokenNets.get(token).add(item.id)
    }
  }
  const mineCanon = canonical(net, aligned.parts, { only })
  const unmatched = minus(canonical(refNet, refParts, { only }), mineCanon)
  for (const line of unmatched) {
    const tokens = [...new Set(line.split(','))]
    let pair = null
    for (let i = 0; i < tokens.length && !pair; i++) {
      for (let j = i + 1; j < tokens.length && !pair; j++) {
        const a = tokenNets.get(tokens[i]) || new Set()
        const b = tokenNets.get(tokens[j]) || new Set()
        if (![...a].some((id) => b.has(id))) pair = [tokens[i], tokens[j]]
      }
    }
    if (!pair) continue
    const targets = { parts: [], holes: [], pins: [] }
    for (const token of pair) {
      if (isPinName(token)) targets.pins.push(token)
      else {
        const part = byId.get(token.slice(0, token.indexOf('.')))
        if (part) {
          targets.parts.push(part.id)
          targets.holes.push(...holesOf(part))
        }
      }
    }
    out.push(mistake('not-joined', `The ${thingLabel(pair[0], labelParts)} and the ${thingLabel(pair[1], labelParts)} are not joined yet.`, targets))
  }

  // loose: a terminal alone in its net that the reference joins to something.
  for (const part of placedParts) {
    if (!refById.has(part.id)) continue
    for (const terminal of PART_TYPES[part.type].terminals) {
      const item = termNet(net, part.id, terminal)
      if (!item || item.terms.length > 1 || item.pins.length > 0) continue
      const refItem = termNet(refNet, part.id, terminal)
      const refJoins = refItem ? refItem.terms.filter((term) => inScope(term.slice(0, term.indexOf('.')))).length + (only ? 0 : refItem.pins.length) : 0
      if (refJoins < 2) continue
      const words = TERMINAL_LABELS[part.type][terminal]
      out.push(mistake('loose', `The ${words} of the ${label(part)} is not joined to anything yet.`, { parts: [part.id], holes: holesOf(part, [terminal]), places: item.places }))
    }
  }

  return out
}
