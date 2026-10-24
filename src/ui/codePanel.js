// Code panel: heading, lesson line, param controls and the coloured sketch.
// Lessons with a sketch get controls that fill its {{name}} slots and a trace
// that loops a line highlight; other lessons show their example code.
// Returns { toolbar, getValues }: an empty slot after the lesson line for the
// run controls, and a copy of the current param values.
import { tokenize } from './highlight.js'
import { defaultValues, fillSketch, stepDuration } from './sketch.js'

export function createCodePanel(panel, course) {
  const heading = document.createElement('h2')
  heading.className = 'panel-heading'
  heading.textContent = 'Code'
  const lessonLine = document.createElement('p')
  lessonLine.className = 'panel-text'
  const toolbar = document.createElement('div')
  const controls = document.createElement('div')
  controls.className = 'code-params'
  const pre = document.createElement('pre')
  pre.className = 'info-code code-sketch'
  const code = document.createElement('code')
  pre.append(code)
  panel.append(heading, lessonLine, toolbar, controls, pre)

  let lessonId = null
  let source = ''
  let values = {}
  let lines = []
  let activeLine = -1
  let timer = null

  function renderCode() {
    lines = toLines(tokenize(fillSketch(source, values)))
    code.replaceChildren(...lines)
    setActive(activeLine)
  }

  function setActive(index) {
    activeLine = index
    lines.forEach((line, i) => line.classList.toggle('is-active', i === index))
  }

  function playTrace(trace, step) {
    setActive(trace[step].line - 1)
    timer = setTimeout(
      () => playTrace(trace, (step + 1) % trace.length),
      stepDuration(trace[step], values)
    )
  }

  function render({ lesson }) {
    if (lesson.id === lessonId) return
    lessonId = lesson.id
    clearTimeout(timer)
    timer = null
    activeLine = -1
    lessonLine.textContent = lesson.id + ' ' + lesson.title

    const sketch = lesson.sketch
    const params = sketch && sketch.params ? sketch.params : []
    source = sketch ? sketch.code : lesson.example.code
    values = defaultValues(params)
    controls.replaceChildren(...params.map((param) => buildControl(param)))
    controls.hidden = params.length === 0
    renderCode()
    if (sketch && sketch.trace && sketch.trace.length > 0) playTrace(sketch.trace, 0)
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
    const input = document.createElement('input')
    input.type = 'range'
    input.id = id
    input.min = String(param.min)
    input.max = String(param.max)
    input.step = String(param.step)
    input.value = String(param.value)

    function showValue() {
      const text = param.unit ? values[param.name] + ' ' + param.unit : String(values[param.name])
      output.textContent = text
      input.setAttribute('aria-valuetext', text)
    }
    input.addEventListener('input', () => {
      values[param.name] = Number(input.value)
      showValue()
      renderCode()
    })
    showValue()

    const top = document.createElement('div')
    top.className = 'code-param-top'
    top.append(label, output)
    row.append(top, input)
    return row
  }

  function buildChoice(param) {
    const fieldset = document.createElement('fieldset')
    fieldset.className = 'code-param code-choice'
    const legend = document.createElement('legend')
    legend.textContent = param.label
    fieldset.append(legend)
    param.options.forEach((option, i) => {
      const id = 'code-param-' + param.name + '-' + i
      const input = document.createElement('input')
      input.type = 'radio'
      input.id = id
      input.name = 'code-param-' + param.name
      input.value = String(option.value)
      input.checked = option.value === param.value
      input.addEventListener('change', () => {
        if (!input.checked) return
        values[param.name] = option.value
        renderCode()
      })
      const label = document.createElement('label')
      label.htmlFor = id
      label.textContent = option.label
      const item = document.createElement('div')
      item.className = 'code-choice-option'
      item.append(input, label)
      fieldset.append(item)
    })
    return fieldset
  }

  render(course.getState())
  course.subscribe(render)

  return { toolbar, getValues: () => ({ ...values }) }
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
