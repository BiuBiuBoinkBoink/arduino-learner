// The help chat's state block: what the learner has on screen, sent as the
// first text block of every learner turn so the tutor sees the step, the
// checklist, the mistake, the circuit, the code and the run. Tool result
// turns carry none. Pure module.
//
// buildState({ lesson, step, view, hintLevel, build, connections, code,
//   codeError, run }) -> plain object (keys always in the same order)
//   lesson: the lesson; step: the current step; view: the flow entry of the
//   step ({ result, passed }); hintLevel: 0 to 3; build: the learner's build
//   ({ parts, wires }) or null; connections: describeNets rows or null; code:
//   the sketch text or null; codeError: { line, message } or null; run:
//   { phase, readout, progress }.
// formatState(state) -> '<workbench_state>\n{json}\n</workbench_state>'
import { partLabel } from '../circuits/netlist.js'
import { legsOf, terminalHoles, TERMINAL_LABELS } from '../circuits/footprints.js'

export const MAX_CODE_LINES = 150

// The sketch with 'N: ' before each line, cut to its first 150 lines.
export function numberedCode(source) {
  if (typeof source !== 'string') return null
  const lines = source.split('\n')
  const shown = lines.slice(0, MAX_CODE_LINES).map((line, i) => `${i + 1}: ${line}`)
  if (lines.length > MAX_CODE_LINES) shown.push(`(${lines.length - MAX_CODE_LINES} more lines)`)
  return shown.join('\n')
}

// Each leg named with its terminal, so the tutor never guesses which hole is
// the long leg: [{ leg: 'long leg (anode)', hole: '9e' }, ...] in leg order.
export function namedLegs(part) {
  const terminals = terminalHoles(part)
  const words = TERMINAL_LABELS[part.type] || {}
  const legs = []
  for (const [terminal, holes] of Object.entries(terminals)) {
    const label = words[terminal] || terminal
    const leg = terminal === 'anode' || terminal === 'cathode' ? `${label} (${terminal})` : label
    for (const hole of holes) legs.push({ leg, hole })
  }
  if (legs.length === 0) return legsOf(part).map((hole, i) => ({ leg: `leg ${i + 1}`, hole }))
  const order = legsOf(part)
  return legs.sort((x, y) => order.indexOf(x.hole) - order.indexOf(y.hole))
}

function circuitOf(build, connections) {
  if (!build) return null
  const parts = build.parts || []
  return {
    parts: parts.map((part) => ({ id: part.id, label: partLabel(part, parts), legs: namedLegs(part) })),
    wires: (build.wires || []).map((wire) => ({ from: wire.from, to: wire.to })),
    connections: (connections || []).map((row) => row.things.slice())
  }
}

export function buildState({ lesson, step, view = null, hintLevel = 0, build = null, connections = null, code = null, codeError = null, run = null }) {
  const result = view && view.result
  const feedback = result && result.feedback
  const level = Number.isInteger(hintLevel) ? hintLevel : 0
  return {
    lesson: { id: lesson.id, title: lesson.title, project: Boolean(lesson.project) },
    step: {
      id: step.id,
      kind: step.kind,
      title: step.title,
      text: (step.body || []).join('\n'),
      checklist: result ? result.items.map((item) => ({ text: item.text, ok: Boolean(item.ok) })) : [],
      passed: Boolean(view && view.passed)
    },
    hints: { level, exact_positions_allowed: level >= 2 },
    mistake: feedback && feedback.tone === 'bad' ? feedback.text : null,
    circuit: circuitOf(build, connections),
    code: numberedCode(code),
    code_error: codeError ? { line: codeError.line, message: codeError.message } : null,
    run: {
      phase: run ? run.phase : 'idle',
      readout: run && run.readout ? run.readout : '',
      progress: run && run.progress ? { ...run.progress } : {}
    }
  }
}

export function formatState(state) {
  return '<workbench_state>\n' + JSON.stringify(state) + '\n</workbench_state>'
}
