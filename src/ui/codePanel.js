// Code panel: header with a hide button, param controls and the sketch editor.
// Lessons with a sketch get controls that fill its {{name}} slots and an
// editor: a transparent textarea over the coloured code, so the learner can
// type while the colours, the trace highlight and an error line stay visible.
// Once the text differs from the filled template the code counts as edited:
// the trace stops and the controls switch off, except circuit params (a part
// on the breadboard, not a number in the code), until Reset code. Lessons
// without a sketch show their example code read only.
// The Full screen button (top right of the editor, also Escape to close)
// expands the editor, its error line and the serial slot to fill the window;
// the same textarea moves along, so the text, caret and highlights stay.
// The panel does not own its open state: the chevron in the header calls
// setOpen(false) and the Code rail (shown only while closed) calls setOpen(true).
// Returns { serialSlot, getValues, subscribe, getSource, isEdited, setError }:
// an empty slot under the editor for the Serial Monitor, a copy of the param
// values, subscribe(fn) calling fn(values) on every control change and lesson
// change, the code to run, and setError({ line, message } | null).
import { tokenize } from './highlight.js'
import { defaultValues, fillSketch, slotValues, stepDuration } from './sketch.js'

export function createCodePanel(panel, course, { setOpen }) {
  const rail = document.createElement('button')
  rail.type = 'button'
  rail.className = 'code-rail'
  rail.setAttribute('aria-label', 'Show code')
  rail.setAttribute('aria-expanded', 'false')
  const railText = document.createElement('span')
  railText.className = 'code-rail-text'
  railText.textContent = 'Code'
  rail.append(railText)
  // Focus follows to the control that is visible after the change.
  rail.addEventListener('click', () => {
    setOpen(true)
    collapseButton.focus()
  })

  const header = document.createElement('div')
  header.className = 'code-header'
  const heading = document.createElement('h2')
  heading.className = 'panel-heading'
  heading.textContent = 'Code'
  const collapseButton = document.createElement('button')
  collapseButton.type = 'button'
  collapseButton.className = 'run-button code-collapse'
  collapseButton.setAttribute('aria-label', 'Hide code')
  collapseButton.title = 'Hide code'
  collapseButton.append(icon('M6 3l5 5-5 5'))
  collapseButton.addEventListener('click', () => {
    setOpen(false)
    rail.focus()
  })
  header.append(heading, collapseButton)

  const body = document.createElement('div')
  body.className = 'code-body'
  const controls = document.createElement('div')
  controls.className = 'code-params'
  const editedNote = document.createElement('p')
  editedNote.className = 'code-edited-note'
  editedNote.textContent = 'You changed the code, so the sliders are off. Reset code to use them again.'
  editedNote.hidden = true

  const editorBar = document.createElement('div')
  editorBar.className = 'code-editor-bar'
  const editorLabel = document.createElement('label')
  editorLabel.htmlFor = 'code-input'
  editorLabel.className = 'code-editor-label'
  editorLabel.textContent = 'Sketch'
  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.className = 'run-button code-reset'
  resetButton.textContent = 'Reset code'
  const fullButton = document.createElement('button')
  fullButton.type = 'button'
  fullButton.className = 'run-button code-full'
  fullButton.setAttribute('aria-pressed', 'false')
  fullButton.setAttribute('aria-label', 'Full screen editor')
  fullButton.title = 'Full screen editor'
  fullButton.append(expandIcon())
  const barActions = document.createElement('div')
  barActions.className = 'code-editor-actions'
  barActions.append(resetButton, fullButton)
  editorBar.append(editorLabel, barActions)

  const editor = document.createElement('div')
  editor.className = 'code-editor'
  const inner = document.createElement('div')
  inner.className = 'code-editor-inner'
  const pre = document.createElement('pre')
  pre.className = 'info-code code-sketch'
  const code = document.createElement('code')
  pre.append(code)
  const input = document.createElement('textarea')
  input.id = 'code-input'
  input.className = 'code-input'
  input.spellcheck = false
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('autocapitalize', 'off')
  input.setAttribute('wrap', 'off')
  inner.append(pre, input)
  editor.append(inner)

  const errorLine = document.createElement('p')
  errorLine.className = 'code-error'
  errorLine.setAttribute('role', 'alert')
  errorLine.hidden = true
  const serialSlot = document.createElement('div')
  serialSlot.className = 'code-serial-slot'

  // Everything that goes full screen together; the backdrop dims the page behind.
  const workspace = document.createElement('div')
  workspace.className = 'code-workspace'
  workspace.setAttribute('aria-label', 'Sketch editor')
  const fullTitle = document.createElement('p')
  fullTitle.className = 'code-full-title'
  fullTitle.hidden = true
  workspace.append(fullTitle, editorBar, editor, errorLine, serialSlot)
  const backdrop = document.createElement('div')
  backdrop.className = 'code-backdrop'
  backdrop.hidden = true
  body.append(header, controls, editedNote, workspace)
  panel.append(rail, body)
  document.body.append(backdrop)

  let lessonId = null
  let template = ''
  let params = []
  let values = {}
  let trace = null
  let lines = []
  let activeLine = -1
  let errorAt = -1
  let timer = null
  let edited = false
  let editable = false
  let full = false
  const listeners = new Set()
  const paramInputs = []

  function notify() {
    listeners.forEach((fn) => fn({ ...values }))
  }

  const filled = () => fillSketch(template, slotValues(params, values))

  function renderCode(text) {
    lines = toLines(tokenize(text))
    code.replaceChildren(...lines)
    lines.forEach((line, i) => {
      line.classList.toggle('is-active', i === activeLine)
      line.classList.toggle('has-error', i === errorAt)
    })
  }

  function setActive(index) {
    activeLine = index
    lines.forEach((line, i) => line.classList.toggle('is-active', i === index))
  }

  function stopTrace() {
    clearTimeout(timer)
    timer = null
    setActive(-1)
  }

  function playTrace(step) {
    setActive(trace[step].line - 1)
    timer = setTimeout(() => playTrace((step + 1) % trace.length), stepDuration(trace[step], values))
  }

  function startTrace() {
    stopTrace()
    if (trace && trace.length > 0) playTrace(0)
  }

  function setError(error) {
    errorAt = error && error.line ? error.line - 1 : -1
    lines.forEach((line, i) => line.classList.toggle('has-error', i === errorAt))
    errorLine.hidden = !error
    errorLine.textContent = error ? error.message : ''
  }

  // Controls follow the edited state; circuit params always stay on.
  function setEdited(on) {
    if (on === edited) return
    edited = on
    editedNote.hidden = !on
    for (const { param, element } of paramInputs) element.disabled = on && !param.circuit
    if (on) stopTrace()
    else startTrace()
  }

  // A control changed: refill the code unless the learner has edited it.
  function changed() {
    if (!edited) {
      input.value = filled()
      renderCode(input.value)
    }
    notify()
  }

  input.addEventListener('input', () => {
    setError(null)
    renderCode(input.value)
    setEdited(input.value !== filled())
  })

  // Full screen moves the workspace to the body, above every panel, and back to
  // its place in the code panel on close; the placeholder keeps that place.
  const placeholder = document.createComment('code workspace')
  function setFull(on) {
    if (on === full) return
    full = on
    if (on) {
      workspace.before(placeholder)
      document.body.append(workspace)
    } else {
      placeholder.replaceWith(workspace)
    }
    workspace.classList.toggle('is-full', on)
    workspace.setAttribute('role', on ? 'dialog' : 'group')
    workspace.setAttribute('aria-modal', String(on))
    backdrop.hidden = !on
    fullTitle.hidden = !on
    fullButton.setAttribute('aria-pressed', String(on))
    const label = on ? 'Exit full screen' : 'Full screen editor'
    fullButton.setAttribute('aria-label', label)
    fullButton.title = label
    fullButton.replaceChildren(on ? collapseIcon() : expandIcon())
    input.focus()
  }

  fullButton.addEventListener('click', () => setFull(!full))
  backdrop.addEventListener('click', () => setFull(false))
  workspace.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && full) {
      event.preventDefault()
      setFull(false)
    }
  })

  resetButton.addEventListener('click', () => {
    input.value = filled()
    setError(null)
    renderCode(input.value)
    setEdited(false)
    notify()
  })

  function render({ lesson }) {
    if (lesson.id === lessonId) return
    lessonId = lesson.id
    stopTrace()
    errorAt = -1
    setError(null)
    fullTitle.textContent = 'Code: ' + lesson.id + ' ' + lesson.title

    const sketch = lesson.sketch
    editable = Boolean(sketch)
    params = sketch && sketch.params ? sketch.params : []
    template = sketch ? sketch.code : lesson.example.code
    trace = sketch ? sketch.trace : null
    values = defaultValues(params)
    paramInputs.length = 0
    controls.replaceChildren(...params.map((param) => buildControl(param)))
    controls.hidden = params.length === 0
    edited = false
    editedNote.hidden = true
    input.value = filled()
    input.hidden = !editable
    editorBar.hidden = !editable
    editor.classList.toggle('is-editable', editable)
    fullButton.hidden = !editable
    if (!editable) setFull(false)
    pre.setAttribute('aria-hidden', String(editable))
    renderCode(input.value)
    startTrace()
    notify()
  }

  function buildControl(param) {
    if (param.type === 'range') return buildRange(param)
    return buildChoice(param)
  }

  function buildRange(param) {
    const id = 'code-param-' + param.name
    const row = document.createElement('div')
    row.className = 'code-param'
    const label = document.createElement('label')
    label.htmlFor = id
    label.textContent = param.label
    const output = document.createElement('output')
    output.className = 'code-param-value'
    output.htmlFor = id
    const range = document.createElement('input')
    range.type = 'range'
    range.id = id
    range.min = String(param.min)
    range.max = String(param.max)
    range.step = String(param.step)
    range.value = String(param.value)
    paramInputs.push({ param, element: range })

    function showValue() {
      const text = param.unit ? values[param.name] + ' ' + param.unit : String(values[param.name])
      output.textContent = text
      range.setAttribute('aria-valuetext', text)
    }
    range.addEventListener('input', () => {
      values[param.name] = Number(range.value)
      showValue()
      changed()
    })
    showValue()

    const top = document.createElement('div')
    top.className = 'code-param-top'
    top.append(label, output)
    row.append(top, range)
    return row
  }

  function buildChoice(param) {
    const fieldset = document.createElement('fieldset')
    fieldset.className = 'code-param code-choice'
    const legend = document.createElement('legend')
    legend.textContent = param.label
    fieldset.append(legend)
    paramInputs.push({ param, element: fieldset })
    param.options.forEach((option, i) => {
      const id = 'code-param-' + param.name + '-' + i
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.id = id
      radio.name = 'code-param-' + param.name
      radio.value = String(option.value)
      radio.checked = option.value === param.value
      radio.addEventListener('change', () => {
        if (!radio.checked) return
        values[param.name] = option.value
        changed()
      })
      const label = document.createElement('label')
      label.htmlFor = id
      label.textContent = option.label
      const item = document.createElement('div')
      item.className = 'code-choice-option'
      item.append(radio, label)
      fieldset.append(item)
    })
    return fieldset
  }

  render(course.getState())
  course.subscribe(render)

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return {
    serialSlot,
    getValues: () => ({ ...values }),
    subscribe,
    getSource: () => input.value,
    isEdited: () => edited,
    setError
  }
}

// Splits tokens into one span per source line; each non plain token gets a
// span with class tok-<type>, plain text stays a bare text node.
function toLines(tokens) {
  const lines = [newLine()]
  for (const { type, text } of tokens) {
    text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push(newLine())
      if (part === '') return
      const line = lines[lines.length - 1]
      if (type === 'plain') {
        line.append(document.createTextNode(part))
      } else {
        const span = document.createElement('span')
        span.className = 'tok-' + type
        span.textContent = part
        line.append(span)
      }
    })
  }
  return lines
}

const SVG_NS = 'http://www.w3.org/2000/svg'

// A 16 px stroke icon from one path, hidden from screen readers (the button has a label).
function icon(d) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', d)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.6')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

// Four corners pointing out.
function expandIcon() {
  return icon('M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4')
}

// Four corners pointing in.
function collapseIcon() {
  return icon('M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4')
}

function newLine() {
  const line = document.createElement('span')
  line.className = 'code-line'
  return line
}
