// Run controls: Run and Stop buttons plus a status line for lessons with a sim.
// Drives the sim runner with a requestAnimationFrame loop while it is not idle,
// and shows the sim readout line under the status while it runs.
const STATUS_IDLE = 'Press Run to upload the sketch.'
const STATUS_UPLOADING = 'Uploading sketch...'
const STATUS_RUNNING = 'Running.'
const STATUS_STOPPED = 'Stopped.'
const STATUS_GOAL = 'Goal met. Lesson done.'

export function createRunControls({ container, course, runner, getValues }) {
  const row = document.createElement('div')
  row.className = 'run-controls'
  const runButton = document.createElement('button')
  runButton.type = 'button'
  runButton.className = 'run-button'
  runButton.textContent = 'Run'
  const stopButton = document.createElement('button')
  stopButton.type = 'button'
  stopButton.className = 'run-button'
  stopButton.textContent = 'Stop'
  const buttons = document.createElement('div')
  buttons.className = 'run-buttons'
  buttons.append(runButton, stopButton)
  const status = document.createElement('p')
  status.className = 'run-status'
  status.setAttribute('aria-live', 'polite')
  // Stand in for the Serial Monitor: the sim readout, updated each frame it changes.
  const readout = document.createElement('p')
  readout.className = 'run-readout'
  readout.hidden = true
  row.append(buttons, status, readout)
  container.append(row)

  let lessonId = null
  let frame = null
  let shownPhase = 'idle'
  let shownGoal = false
  let shownReadout = ''

  function showIdle(text) {
    runButton.disabled = false
    stopButton.disabled = true
    status.textContent = text
    shownPhase = 'idle'
    shownGoal = false
    showReadout('')
  }

  function showReadout(text) {
    if (text === shownReadout) return
    shownReadout = text
    readout.textContent = text
    readout.hidden = text === ''
  }

  function loop() {
    frame = null
    if (runner.getPhase() === 'idle') return
    runner.tick(performance.now())
    const phase = runner.getPhase()
    if (phase === 'running' && shownPhase !== 'running') {
      shownPhase = 'running'
      status.textContent = STATUS_RUNNING
    }
    if (runner.isGoalMet() && !shownGoal) {
      shownGoal = true
      status.textContent = STATUS_GOAL
    }
    showReadout(runner.getReadout())
    if (phase !== 'idle') frame = requestAnimationFrame(loop)
  }

  function stopLoop() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }

  runButton.addEventListener('click', () => {
    if (!runner.run({ lessonId, getValues, now: performance.now() })) return
    runButton.disabled = true
    stopButton.disabled = false
    status.textContent = STATUS_UPLOADING
    shownPhase = 'uploading'
    shownGoal = false
    stopLoop()
    frame = requestAnimationFrame(loop)
  })

  stopButton.addEventListener('click', () => {
    runner.stop()
    stopLoop()
    showIdle(STATUS_STOPPED)
  })

  // Only a lesson change resets the row; markComplete notifies with the same lesson.
  function render({ lesson }) {
    if (lesson.id === lessonId) return
    lessonId = lesson.id
    runner.stop()
    stopLoop()
    showIdle(STATUS_IDLE)
    row.hidden = !runner.hasSim(lessonId)
  }

  render(course.getState())
  course.subscribe(render)
}
