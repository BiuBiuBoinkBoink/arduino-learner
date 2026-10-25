// Run controls: Run and Stop buttons plus a status line for lessons with a sim.
// Run sends the code panel's sketch; code that does not compile or stops on an
// error shows its message here and its line in the code panel (onError).
// Drives the sim runner with a requestAnimationFrame loop while it is running,
// and shows the sim readout line under the status while it runs.
// getLock() returns null or why Run is locked (shown as the status, Run
// disabled); refreshLock() re-checks it. onFrame() runs after every loop frame,
// on Stop and on an error, so the lesson steps can follow the run.
const STATUS_IDLE = 'Press Run to upload the sketch.'
const STATUS_UPLOADING = 'Uploading sketch...'
const STATUS_RUNNING = 'Running.'
const STATUS_STOPPED = 'Stopped.'
// The sim goal is one check among the lesson steps, so it does not end the lesson.
const STATUS_GOAL = 'Goal met.'

export function createRunControls({ container, course, runner, getValues, getSource, onError, getLock = () => null, onFrame = () => {} }) {
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
  // The compact layout cuts a long status or readout with an ellipsis; the title keeps the whole line.
  for (const line of [status, readout]) {
    new MutationObserver(() => {
      line.title = line.textContent
    }).observe(line, { childList: true, characterData: true, subtree: true })
  }
  container.append(row)

  let lessonId = null
  let frame = null
  let shownPhase = 'idle'
  let shownGoal = false
  let shownReadout = ''
  // The status shows the run lock text while it is true.
  let lockShown = false

  function showIdle(text) {
    runButton.disabled = false
    stopButton.disabled = true
    status.textContent = text
    shownPhase = 'idle'
    shownGoal = false
    lockShown = false
    showReadout('')
    refreshLock()
  }

  // While idle, a lock disables Run and shows why; lifting it restores the idle text.
  function refreshLock() {
    if (shownPhase !== 'idle') return
    const lock = getLock()
    runButton.disabled = Boolean(lock)
    if (lock) {
      status.textContent = lock
      lockShown = true
    } else if (lockShown) {
      status.textContent = STATUS_IDLE
      lockShown = false
    }
  }

  function showReadout(text) {
    if (text === shownReadout) return
    shownReadout = text
    readout.textContent = text
    readout.hidden = text === ''
  }

  function showError() {
    const error = runner.getError()
    onError(error)
    showIdle(`Stopped. ${error.message}`)
    onFrame()
  }

  function loop() {
    frame = null
    if (runner.getPhase() === 'idle') return
    if (runner.getPhase() === 'error') {
      showError()
      return
    }
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
    if (phase === 'uploading' || phase === 'running') frame = requestAnimationFrame(loop)
    else if (phase === 'error') showError()
    onFrame()
  }

  function stopLoop() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }

  runButton.addEventListener('click', () => {
    if (getLock()) return
    onError(null)
    if (!runner.run({ lessonId, getValues, source: getSource(), now: performance.now() })) {
      if (runner.getPhase() === 'error') showError()
      return
    }
    runButton.disabled = true
    stopButton.disabled = false
    status.textContent = STATUS_UPLOADING
    shownPhase = 'uploading'
    shownGoal = false
    stopLoop()
    frame = requestAnimationFrame(loop)
  })

  function stop() {
    runner.stop()
    stopLoop()
    showIdle(STATUS_STOPPED)
    onFrame()
  }
  stopButton.addEventListener('click', stop)

  // A runtime error can arrive between frames, while the loop is waiting.
  function noticeError() {
    if (runner.getPhase() === 'error' && frame === null) showError()
  }

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
  return { noticeError, refreshLock, stop }
}
