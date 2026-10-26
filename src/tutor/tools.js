// Help chat tool runner: checks each tool call against its definition
// (toolDefs.js) and the limits strict schemas cannot say, then runs it.
// run(name, input) -> Promise<{ content, isError, chip?, card? }>: content is
// the tool result text for the model, isError marks a call the model got
// wrong (one sentence it can act on), chip is the short text the chat shows
// under the reply, and card is a quiz, guess or recall card for the chat log.
// The phase 8 explain tools are called, not copied; their "cannot work right
// now" texts come back as normal results. No tool changes the build, the code
// or progress: hints only go up to Show me, and inputs come back after a demo.
//
// createTutorTools(deps) -> { run(name, input), has(name) }
// deps: { explain (createExplainTools result), getBuild(), getStep() -> { lesson,
//   step, hintLevel, passed, scope, canSuggest } | null, lessons, stepsFor,
//   raiseHint(level), showPlacement(), highlight({ kind: 'place' | 'pin' | 'part',
//   value, label }), pinLabel({ kind: 'hole' | 'pin' | 'part', value, text }),
//   moveCamera({ kind: 'hole' | 'pin' | 'part' | 'board', value, view }),
//   codeLineCount() -> number (0 without a sketch), pointToCode(line, note),
//   offerLine(line, text, why), isRunning(), beginDemo(), inputTargets() ->
//   { buttons, knobs, light, temp }, getInput(target), setInput(target, value),
//   openReference(tab), setTimer(fn, ms) }
import { TOOL_DEFINITIONS } from './toolDefs.js'
import { isHole, BREADBOARD_COLUMNS } from '../circuits/holes.js'
import { placeOf, placeLabel } from '../circuits/netlist.js'
import { legsOf } from '../circuits/footprints.js'

const DEFS = Object.fromEntries(TOOL_DEFINITIONS.map((definition) => [definition.name, definition]))
const UNO_PIN = /^(D([0-9]|1[0-3])|A[0-5]|GND(\.[23])?|5V|3\.3V|VIN|AREF|IOREF|RESET|SCL|SDA)$/
const STRIP = /^(\d{1,2})-(top|bottom)$/
const RAIL = /^rail-(T\+|T-|B\+|B-)$/
const SERIAL_LINE = /^\s*Serial\.(print|println)\(.*\);\s*$/
export const LABEL_MAX = 40
export const NOTE_MAX = 80
export const CODE_LINE_MAX = 120
export const SHOW_ME_FIRST = 'Show me is not available yet. Give a hint in words first.'
export const TOO_MANY = 'Too many tools in one reply.'
export const WAIT_FOR_ANSWER = 'Shown. Wait for the learner to answer.'
const REFERENCE_TABS = { overview: 'Overview', pinout: 'Pinout', example: 'Example', specs: 'Specs' }

// Printable ASCII only, trimmed and cut to max characters.
export function plainText(value, max) {
  return String(value).replace(/[^\x20-\x7e]/g, '').trim().slice(0, max)
}

const typeOk = {
  string: (value) => typeof value === 'string',
  integer: (value) => Number.isInteger(value),
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value)
}
const typeWords = { string: 'text', integer: 'a whole number', number: 'a number', boolean: 'true or false', array: 'a list of texts' }

// One sentence when the input does not fit the schema, else null.
export function checkInput(name, input) {
  const definition = DEFS[name]
  if (!definition) return `There is no tool called ${String(name)}.`
  const { properties, required } = definition.input_schema
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return `The input for ${name} must be an object.`
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(properties, key)) return `${name} has no input called ${key}.`
  }
  for (const key of required) {
    const schema = properties[key]
    const value = input[key]
    if (value === undefined) return `${name} needs ${key}.`
    if (!typeOk[schema.type](value)) return `${name} needs ${key} as ${typeWords[schema.type]}.`
    if (schema.enum && !schema.enum.includes(value)) return `${name} needs ${key} to be one of ${schema.enum.join(', ')}.`
    if (schema.type === 'array' && !value.every((item) => typeof item === 'string')) return `${name} needs ${key} as a list of texts.`
  }
  return null
}

const ok = (content, extra = {}) => ({ content, isError: false, ...extra })
const wrong = (content) => ({ content, isError: true })

export function createTutorTools(deps) {
  const setTimer = deps.setTimer || ((fn, ms) => setTimeout(fn, ms))

  // Placed parts of the build, by id.
  function placedPart(id) {
    const build = deps.getBuild ? deps.getBuild() : null
    const part = build && (build.parts || []).find((item) => item.id === id)
    return part && legsOf(part).length > 0 ? part : null
  }

  // A hole, strip, rail, Uno pin or placed part, or null.
  function target(name, { places = false } = {}) {
    if (isHole(name)) return { kind: 'hole', value: name }
    if (UNO_PIN.test(name)) return { kind: 'pin', value: name }
    if (places) {
      const strip = STRIP.exec(name)
      if (strip && Number(strip[1]) >= 1 && Number(strip[1]) <= BREADBOARD_COLUMNS) return { kind: 'place', value: 'strip:' + name }
      const rail = RAIL.exec(name)
      if (rail) return { kind: 'place', value: 'rail:' + rail[1] }
    }
    if (placedPart(name)) return { kind: 'part', value: name }
    return null
  }

  // A phase 8 explain tool: its text is the result either way.
  async function explain(promise, chip) {
    const result = await promise
    return ok(result.text, result.ok ? { chip } : {})
  }

  function options(list) {
    const items = list.map((item) => plainText(item, 80))
    if (items.length < 2 || items.length > 4 || items.some((item) => item.length === 0)) return null
    return items
  }

  const handlers = {
    highlight({ target: name }) {
      const found = target(name, { places: true })
      if (!found) return wrong(`There is no hole, strip, rail, pin or placed part called ${name}.`)
      if (found.kind === 'hole') {
        const place = placeOf(name)
        deps.highlight({ kind: 'place', value: place })
        return ok(`Lit up ${placeLabel(place)}, which holds ${name}, for 4 seconds.`, { chip: `Lit up ${name}` })
      }
      deps.highlight(found)
      const words = found.kind === 'place' ? placeLabel(found.value) : name
      return ok(`Lit up ${words} for 4 seconds.`, { chip: `Lit up ${name}` })
    },

    pin_label({ target: name, text }) {
      const found = target(name)
      if (!found) return wrong(`There is no hole, pin or placed part called ${name}.`)
      const note = plainText(text, LABEL_MAX)
      if (!note) return wrong('The note needs some plain text.')
      deps.pinLabel({ ...found, text: note })
      return ok(`Pinned "${note}" to ${name} for 6 seconds.`, { chip: 'Pinned a note' })
    },

    move_camera({ target: name, view }) {
      const found = name === 'breadboard' || name === 'uno' ? { kind: 'board', value: name } : target(name)
      if (!found) return wrong(`There is no hole, pin, placed part or board called ${name}.`)
      deps.moveCamera({ ...found, view })
      return ok(`The camera now looks at ${name} from ${view === 'top' ? 'above' : 'an angle'}.`, { chip: 'Moved the camera' })
    },

    point_to_code({ line, note }) {
      const count = deps.codeLineCount()
      if (!count) return wrong('This lesson has no sketch to point at.')
      if (line < 1 || line > count) return wrong(`The sketch has lines 1 to ${count}.`)
      const text = plainText(note, NOTE_MAX)
      deps.pointToCode(line, text)
      return ok(`Line ${line} is marked in the open code for 8 seconds.`, { chip: `Line ${line}` })
    },

    show_placement({ part }) {
      const now = deps.getStep()
      if (!now || !['build', 'wire'].includes(now.step.kind)) return wrong('Show placement only works on build and wire steps.')
      if (now.passed) return wrong('This step has passed already.')
      if (!now.canSuggest) return wrong('This step has no placement to show.')
      if (!now.scope.includes(part)) return wrong(`${part} is not a part of this step.`)
      if (now.hintLevel < 1) return wrong(SHOW_ME_FIRST)
      deps.raiseHint(2)
      deps.showPlacement()
      return ok('One working placement shows as see-through parts with labels. Show me is now on for this step.', { chip: 'Showed a placement' })
    },

    trace_current: ({ from }) => explain(deps.explain.trace(from), 'Traced the current'),
    xray: ({ on }) => explain(deps.explain.xray(on), on ? 'X-ray' : 'X-ray off'),
    connections: ({ compare }) => explain(deps.explain.connections(compare), 'Connections'),
    part_card: ({ part }) => explain(deps.explain.part_card(part), 'Part card'),
    scope: ({ pin, seconds }) => explain(deps.explain.scope(pin, seconds), `Scope on ${pin}`),
    measure: ({ target: name }) => explain(deps.explain.measure(name), `Measured ${name}`),
    what_if: ({ kind, target: name, value }) => explain(deps.explain.what_if(kind, name, value), 'What if'),
    slow_motion: ({ speed }) => explain(deps.explain.slow_motion(Number(speed)), 'Slow motion'),

    demo_input({ target: name, value, seconds }) {
      if (seconds < 1 || seconds > 5) return wrong('Pick 1 to 5 seconds.')
      const targets = deps.inputTargets()
      let done
      if (targets.buttons.includes(name)) {
        if (value !== 1) return wrong('Use value 1 to press a button.')
        done = `Pressed ${name}`
      } else if (targets.knobs.includes(name)) {
        if (value < 0 || value > 1) return wrong('A knob goes from 0 to 1.')
        done = `Turned ${name} to ${value}`
      } else if (name === 'room-light' && targets.light) {
        if (value < 0 || value > 1) return wrong('The room light goes from 0 to 1.')
        done = `Set the room light to ${value}`
      } else if (name === 'room-temp' && targets.temp) {
        if (value < 0 || value > 40) return wrong('The room temperature goes from 0 to 40 deg C.')
        done = `Set the room temperature to ${value} deg C`
      } else {
        return wrong(`${name} is not a button, knob or room setting of this circuit.`)
      }
      if (!deps.isRunning()) return wrong('Run the sketch first.')
      const before = deps.getInput(name)
      deps.beginDemo()
      deps.setInput(name, targets.buttons.includes(name) ? true : value)
      setTimer(() => deps.setInput(name, before), seconds * 1000)
      return ok(`${done} for ${seconds} ${seconds === 1 ? 'second' : 'seconds'}. Goals are paused until the learner presses Run again.`, { chip: 'Demo input' })
    },

    suggest_code({ line, text, why }) {
      const count = deps.codeLineCount()
      if (!count) return wrong('This lesson has no sketch to add to.')
      if (line < 1 || line > count) return wrong(`The sketch has lines 1 to ${count}.`)
      if (text.length > CODE_LINE_MAX || !SERIAL_LINE.test(text)) return wrong('suggest_code only takes one Serial.print or Serial.println statement.')
      deps.offerLine(line, text.trim(), plainText(why, NOTE_MAX))
      return ok('Offered the line. The learner can add it.', { chip: 'Suggested a line' })
    },

    quick_check({ question, options: list, answer, why }) {
      const items = options(list)
      if (!items) return wrong('A quick check needs 2 to 4 options.')
      if (answer < 0 || answer >= items.length) return wrong(`answer must be 0 to ${items.length - 1}.`)
      const text = plainText(question, 200)
      if (!text) return wrong('The quick check needs a question.')
      return ok(WAIT_FOR_ANSWER, { chip: 'Quick check', card: { kind: 'quiz', question: text, options: items, answer, why: plainText(why, 200) } })
    },

    predict({ question, options: list }) {
      const items = options(list)
      if (!items) return wrong('A guess needs 2 to 4 options.')
      const text = plainText(question, 200)
      if (!text) return wrong('The guess needs a question.')
      return ok(WAIT_FOR_ANSWER, { chip: 'Guess', card: { kind: 'guess', question: text, options: items } })
    },

    open_reference({ tab }) {
      deps.openReference(tab)
      return ok(`The ${REFERENCE_TABS[tab]} tab of the lesson reference is open.`, { chip: 'Reference' })
    },

    recall({ lesson: lessonId, step: stepId }) {
      const lesson = deps.lessons.find((item) => item.id === lessonId)
      if (!lesson) return wrong(`There is no lesson ${lessonId}.`)
      const step = deps.stepsFor(lesson).find((item) => item.id === stepId)
      if (!step) return wrong(`Lesson ${lessonId} has no step ${stepId}.`)
      const title = `${lesson.id} ${lesson.title}: ${step.title}`
      return ok(`Showing the card of ${title}.`, { chip: 'Earlier step', card: { kind: 'recall', title, body: step.body.slice() } })
    },

    next_hint() {
      const now = deps.getStep()
      if (!now) return wrong('There is no step to give a hint for.')
      if (now.passed) return wrong('This step has passed already.')
      if (now.hintLevel >= 2) return wrong('The hints are at Show me already.')
      const level = now.hintLevel + 1
      deps.raiseHint(level)
      return ok(level === 1 ? 'The hint shows in the step card.' : 'Show me shows in the step card.', { chip: 'Next hint' })
    }
  }

  async function run(name, input) {
    const problem = checkInput(name, input)
    if (problem) return wrong(problem)
    try {
      return await handlers[name](input)
    } catch {
      return wrong(`${name} did not work right now.`)
    }
  }

  return { run, has: (name) => Object.hasOwn(handlers, name) }
}
