// Serial Monitor panel: docked above the lesson strip between the side panels,
// shown only on lessons whose sketch uses Serial. A scrolling output that
// sticks to the bottom unless the learner has scrolled up, a Clear button,
// and a text input that sends a line to the running sketch.
const STICK_PX = 24

// True when a lesson's sketch (or its example, if it has no sketch) starts Serial.
export function usesSerial(lesson) {
  const code = lesson.sketch ? lesson.sketch.code : lesson.example.code
  return code.includes('Serial.begin')
}

export function createSerialMonitor({ container, serial }) {
  const panel = document.createElement('section')
  panel.id = 'serial-panel'
  panel.setAttribute('aria-labelledby', 'serial-heading')
  panel.hidden = true

  const header = document.createElement('div')
  header.className = 'serial-header'
  const heading = document.createElement('h2')
  heading.id = 'serial-heading'
  heading.className = 'serial-heading'
  heading.textContent = 'Serial Monitor'
  const clearButton = document.createElement('button')
  clearButton.type = 'button'
  clearButton.className = 'run-button serial-clear'
  clearButton.textContent = 'Clear'
  header.append(heading, clearButton)

  // A log of frequent prints would flood a screen reader, so it is not live.
  const output = document.createElement('pre')
  output.className = 'serial-output'
  output.setAttribute('role', 'log')
  output.setAttribute('aria-live', 'off')
  output.setAttribute('aria-label', 'Serial output')
  output.tabIndex = 0

  const form = document.createElement('form')
  form.className = 'serial-send'
  const label = document.createElement('label')
  label.htmlFor = 'serial-input'
  label.textContent = 'Send'
  const input = document.createElement('input')
  input.type = 'text'
  input.id = 'serial-input'
  input.autocomplete = 'off'
  input.spellcheck = false
  const sendButton = document.createElement('button')
  sendButton.type = 'submit'
  sendButton.className = 'run-button'
  sendButton.textContent = 'Send'
  form.append(label, input, sendButton)

  panel.append(header, output, form)
  container.append(panel)

  function render() {
    const atBottom = output.scrollHeight - output.scrollTop - output.clientHeight <= STICK_PX
    output.textContent = serial.getLines().join('\n')
    if (atBottom) output.scrollTop = output.scrollHeight
  }

  serial.subscribe((kind) => {
    if (kind === 'output' && !panel.hidden) render()
  })

  clearButton.addEventListener('click', () => serial.clear())

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    serial.send(input.value)
    input.value = ''
  })

  function setVisible(on) {
    panel.hidden = !on
    document.body.classList.toggle('has-serial', on)
    if (on) render()
  }

  return { setVisible }
}
