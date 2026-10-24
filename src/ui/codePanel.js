// Code panel: heading, lesson line, param controls and the sketch editor.
// Lessons with a sketch get controls that fill its {{name}} slots and an
// editor: a transparent textarea over the coloured code, so the learner can
// type while the colours, the trace highlight and an error line stay visible.
// Once the text differs from the filled template the code counts as edited:
// the trace stops and the controls switch off, except circuit params (a part
// on the breadboard, not a number in the code), until Reset code. Lessons
// without a sketch show their example code read only.
// Returns { toolbar, getValues, subscribe, getSource, isEdited, setError }:
// an empty slot after the lesson line for the run controls, a copy of the
// param values, subscribe(fn) calling fn(values) on every control change and
// lesson change, the code to run, and setError({ line, message } | null).
import { tokenize } from './highlight.js'
import { defaultValues, fillSketch, slotValues, stepDuration } from './sketch.js'

export function createCodePanel(panel, course) {
  const heading = document.createElement('h2')
  heading.className = 'panel-heading'
  heading.textContent = 'Code'
  const lessonLine = document.createElement('p')
  lessonLine.className = 'panel-text'
  const toolbar = document.createElement('div')
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
  editorBar.append(editorLabel, resetButton)

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
  panel.append(heading, lessonLine, toolbar, controls, editedNote, editorBar, editor, errorLine)

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
    errorAt = error ? error.line - 1 : -1
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
    lessonLine.textContent = lesson.id + ' ' + lesson.title

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
    toolbar,
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

function newLine() {
  const line = document.createElement('span')
  line.className = 'code-line'
  return line
}
