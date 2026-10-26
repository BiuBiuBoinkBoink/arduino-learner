// Help chat tool definitions: pure data, sent to the API by the tutor server
// (server/tutor.mjs) and used by the client (src/tutor/tools.js) to check and
// run each call. Every tool is strict: an object schema with
// additionalProperties false and every property required. Strict schemas take
// no number or length limits, so the limits in the descriptions are checked
// in src/tutor/tools.js instead.

function tool(name, description, properties = {}) {
  return {
    name,
    description,
    strict: true,
    input_schema: {
      type: 'object',
      properties,
      required: Object.keys(properties),
      additionalProperties: false
    }
  }
}

const text = (description) => ({ type: 'string', description })
const integer = (description) => ({ type: 'integer', description })

export const TOOL_DEFINITIONS = [
  tool('highlight', 'Light up a hole (9e), a strip (9-top), a rail (rail-T+), an Uno pin (D13) or a placed part (led1) for a few seconds.', {
    target: text('A hole, strip, rail, Uno pin or placed part id.')
  }),
  tool('pin_label', 'Pin a short note (40 characters at most) to a hole, pin or placed part.', {
    target: text('A hole, Uno pin or placed part id.'),
    text: text('The note, 40 characters at most.')
  }),
  tool('move_camera', 'Point the camera at a hole, pin, part, breadboard or uno.', {
    target: text('A hole, Uno pin, placed part id, breadboard or uno.'),
    view: { type: 'string', enum: ['top', '3d'], description: 'Look from above or at an angle.' }
  }),
  tool('point_to_code', 'Mark a line of the sketch with a short note and open the code.', {
    line: integer('The line number, from 1.'),
    note: text('A short note shown after the line.')
  }),
  tool('show_placement', 'Show a see-through copy of one working placement for a part of the current build or wire step. Only works after the learner has had a hint.', {
    part: text('A part id from the current step.')
  }),
  tool('trace_current', "Animate the current from an Uno pin through the learner's circuit and report where it goes or stops.", {
    from: text('An Uno pin such as D13.')
  }),
  tool('xray', 'Make the breadboard see-through to show the metal strips.', {
    on: { type: 'boolean', description: 'True shows the strips, false hides them.' }
  }),
  tool('connections', "Show every connection in the learner's circuit, optionally ticked against the lesson circuit.", {
    compare: { type: 'boolean', description: 'True ticks each connection that matches the lesson circuit.' }
  }),
  tool('part_card', 'Show a card about a part (a part id or type): its legs and key numbers.', {
    part: text('A part id such as led1, or a type such as led.')
  }),
  tool('scope', "Plot a pin's level over the last 1 to 5 seconds while the sketch runs, and report the timing.", {
    pin: text('A pin the sketch drives or reads, such as D13 or A0.'),
    seconds: integer('1 to 5.')
  }),
  tool('measure', 'Read the voltage at a hole, pin or part leg (led1.anode).', {
    target: text('A hole, Uno pin or part leg.')
  }),
  tool('what_if', "Run a pretend copy with one change and report the difference. For code, target is the line number and value the new line. The learner's work is not changed.", {
    kind: { type: 'string', enum: ['code', 'flip', 'remove', 'ohms'], description: 'The kind of change.' },
    target: text('The line number for code, else a placed part id.'),
    value: text('The new line for code, the ohms for ohms, else an empty string.')
  }),
  tool('slow_motion', 'Run the sketch slowly with the running line lit up. Pauses goals until the learner presses Run again.', {
    speed: { type: 'string', enum: ['0.1', '0.25'], description: 'The share of normal speed.' }
  }),
  tool('demo_input', 'Press a button (btn1, value 1), turn a knob (pot1, 0 to 1), or set room-light (0 to 1) or room-temp (0 to 40 deg C) for 1 to 5 seconds. Pauses goals until the learner presses Run again.', {
    target: text('A button or knob id, room-light or room-temp.'),
    value: { type: 'number', description: 'The value to set.' },
    seconds: integer('1 to 5.')
  }),
  tool('suggest_code', 'Offer one Serial.print or Serial.println line, added after a line only if the learner clicks Add.', {
    line: integer('The line to add it after.'),
    text: text('One Serial.print or Serial.println statement.'),
    why: text('One short sentence on what it shows.')
  }),
  tool('quick_check', "Show a one question quiz with 2 to 4 options. The learner's answer comes back as their next message.", {
    question: text('The question.'),
    options: { type: 'array', items: { type: 'string' }, description: '2 to 4 short options.' },
    answer: integer('The index of the right option, from 0.'),
    why: text('One sentence on why it is right.')
  }),
  tool('predict', "Ask the learner to guess before you show something. Their guess comes back as their next message.", {
    question: text('The question.'),
    options: { type: 'array', items: { type: 'string' }, description: '2 to 4 short options.' }
  }),
  tool('open_reference', 'Open a tab of the lesson reference.', {
    tab: { type: 'string', enum: ['overview', 'pinout', 'example', 'specs'], description: 'The tab to open.' }
  }),
  tool('recall', 'Show the card of an earlier lesson step (ids as in the state).', {
    lesson: text('A lesson id such as 1.2.'),
    step: text('A step id of that lesson.')
  }),
  tool('next_hint', 'Show the next hint of the current step, at most up to Show me.')
]

export const TOOL_NAMES = TOOL_DEFINITIONS.map((definition) => definition.name)
