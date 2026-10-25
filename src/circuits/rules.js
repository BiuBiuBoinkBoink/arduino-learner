// Step rules for build and wire checks. Pure module. createRuleContext(build,
// reference) aligns the build once and caches its netlist and diagnosis;
// evaluateRule(rule, ruleContext) -> boolean. Items in rules are a pin ('D13',
// GND pins normalized), a terminal ('led1.anode'), any terminal of a part
// ('r1.*') or either outer leg of a potentiometer ('pot1.end').
// { straddles: id } is true for a button with its legs in rows e and f.
import { isHole } from './holes.js'
import { PART_TYPES, legsOf } from './footprints.js'
import { align, buildNetlist, compare, diagnose, normalizePin, isPinName, straddles } from './netlist.js'

export function createRuleContext(build, reference) {
  const aligned = align(build, reference)
  const netlist = buildNetlist(aligned)
  let diagnosis = null
  return {
    build,
    reference,
    aligned,
    netlist,
    diagnosis() {
      if (diagnosis === null) diagnosis = diagnose(build, reference)
      return diagnosis
    }
  }
}

function placedPart(ctx, id) {
  const part = ctx.aligned.parts.find((item) => item.id === id)
  return part && Object.hasOwn(PART_TYPES, part.type) && legsOf(part).length > 0 ? part : null
}

// The nets an item sits in: a Set of net ids, empty when it is not there.
function netsOf(ctx, item) {
  const nets = new Set()
  if (isPinName(item)) {
    const net = ctx.netlist.netOf('pin:' + normalizePin(item))
    if (net) nets.add(net.id)
    return nets
  }
  const dot = item.indexOf('.')
  const part = placedPart(ctx, item.slice(0, dot))
  if (!part) return nets
  const which = item.slice(dot + 1)
  let terminals = PART_TYPES[part.type].terminals
  if (which === 'end') terminals = terminals.filter((terminal) => terminal === 'end1' || terminal === 'end2')
  else if (which !== '*') terminals = terminals.filter((terminal) => terminal === which)
  for (const terminal of terminals) {
    const net = ctx.netlist.netOf(`term:${part.id}.${terminal}`)
    if (net) nets.add(net.id)
  }
  return nets
}

function shares(a, b) {
  return [...a].some((id) => b.has(id))
}

export function evaluateRule(rule, ctx) {
  if (!rule || typeof rule !== 'object') return false
  if (Object.hasOwn(rule, 'placed')) return Boolean(placedPart(ctx, rule.placed))
  if (Object.hasOwn(rule, 'apart')) {
    const [a, b] = rule.apart.map((item) => netsOf(ctx, item))
    return a.size > 0 && b.size > 0 && !shares(a, b)
  }
  if (Object.hasOwn(rule, 'straddles')) {
    const part = placedPart(ctx, rule.straddles)
    return Boolean(part && part.type === 'button' && straddles(part))
  }
  if (Object.hasOwn(rule, 'allApart')) {
    const part = placedPart(ctx, rule.allApart)
    if (!part) return false
    const nets = PART_TYPES[part.type].terminals.map((terminal) => ctx.netlist.netOf(`term:${part.id}.${terminal}`))
    return nets.every(Boolean) && new Set(nets.map((net) => net.id)).size === nets.length
  }
  if (Object.hasOwn(rule, 'joined')) {
    const sets = rule.joined.map((item) => netsOf(ctx, item))
    if (sets.some((set) => set.size === 0)) return false
    return [...sets[0]].some((id) => sets.every((set) => set.has(id)))
  }
  if (Object.hasOwn(rule, 'wired')) {
    const pin = normalizePin(rule.wired)
    return ctx.aligned.wires.some((wire) =>
      (isPinName(wire.from) && normalizePin(wire.from) === pin && isHole(wire.to)) ||
      (isPinName(wire.to) && normalizePin(wire.to) === pin && isHole(wire.from)))
  }
  if (Object.hasOwn(rule, 'noShorts')) return !ctx.diagnosis().some((item) => item.id === 'short')
  if (Object.hasOwn(rule, 'matches')) {
    if (rule.matches === 'all') return compare(ctx.build, ctx.reference).match
    return compare(ctx.build, ctx.reference, { only: rule.matches }).match
  }
  return false
}
