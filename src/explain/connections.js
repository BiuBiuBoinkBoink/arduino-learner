// Connections: every net of the learner's build as a list of the things it
// joins, with whether it matches the lesson circuit. Pure module.
//
// describeNets(build, reference) -> [{ id, things: [labels], places: [keys],
//   match: true | false | null }]
// The build is aligned to the reference first (same value parts swap ids), so
// match is whether the net's canonical token string occurs in the reference
// (null without a reference). Things use thingLabel, pins first. Nets with no
// tokens (a wire between two empty strips) are left out.
import { align, buildNetlist, canonical, terminalToken, thingLabel } from '../circuits/netlist.js'

export function describeNets(build, reference) {
  const aligned = reference ? align(build, reference) : { parts: build.parts || [], wires: build.wires || [] }
  const parts = aligned.parts || []
  const byId = new Map(parts.map((part) => [part.id, part]))
  const wanted = reference ? canonical(buildNetlist(reference), reference.parts) : null
  const rows = []
  for (const net of buildNetlist(aligned).nets) {
    const terms = []
    for (const term of net.terms) {
      const dot = term.indexOf('.')
      const token = terminalToken(byId.get(term.slice(0, dot)), term.slice(dot + 1))
      if (token) terms.push(token)
    }
    const tokens = [...net.pins, ...terms].sort()
    if (tokens.length === 0) continue
    const things = [...new Set([...net.pins, ...terms.sort()].map((token) => thingLabel(token, parts)))]
    rows.push({ id: net.id, things, places: net.places.slice(), match: wanted ? wanted.includes(tokens.join(',')) : null })
  }
  return rows
}
