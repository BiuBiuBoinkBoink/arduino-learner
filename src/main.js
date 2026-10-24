import './style.css'
import { lessons, levels } from './course/lessons.js'
import { createCourse } from './course/state.js'
import { createStepTracker } from './course/stepTracker.js'
import { createFlow } from './course/flow.js'
import { stepsFor, hasGeneratedSteps, CODE_OPEN_KINDS, BUILD_STEPS_ENABLED } from './course/steps.js'
import { evaluate } from './course/checks.js'
import { idFromHash, hashForId } from './course/hash.js'
import { createScene } from './app/scene.js'
import { createCircuitView } from './app/circuitView.js'
import { getStorage } from './app/storage.js'
import { createLayout } from './ui/layout.js'
import { createTopBar } from './ui/topBar.js'
import { createCourseMap } from './ui/courseMap.js'
import { createGuidePanel } from './ui/guidePanel.js'
import { createViewControls } from './ui/viewControls.js'
import { createInfoPanel } from './ui/infoPanel.js'
import { createCodePanel } from './ui/codePanel.js'
import { createBoardTour } from './ui/boardTour.js'
import { createRunControls } from './ui/runControls.js'
import { createPartPress, createHoldButton } from './ui/partPress.js'
import { createPartTurn, createKnobSlider } from './ui/partTurn.js'
import { createMultimeter } from './ui/multimeter.js'
import { createRoom } from './sim/room.js'
import { createRoomControls } from './ui/roomControls.js'
import { createSound } from './ui/sound.js'
import { createSerial } from './sim/serial.js'
import { createSerialMonitor, usesSerial } from './ui/serialMonitor.js'
import { createCodeRunner } from './runner/codeRunner.js'
import { circuits } from './circuits/circuits.js'
import { kitFor } from './build/kit.js'
import { createWorkbench } from './build/workbench.js'
import { createPins } from './sim/pins.js'
import { createInputs } from './sim/inputs.js'
import { sims } from './sim/sims.js'
import { createSimRunner, checkCode } from './sim/runner.js'

const layout = createLayout(document.querySelector('#app'))
const { stage, board, breadboard, frameBox } = createScene(layout.stageEl)

const course = createCourse({ lessons, storage: getStorage() })
// Lesson steps: per step progress and the flow that checks the current step.
const tracker = createStepTracker({ storage: getStorage(), lessons, stepsFor })
const flow = createFlow({ course, tracker, stepsFor, evaluate })

// URL hash sync: lesson changes push the hash, hashchange calls goTo.
// Unknown or missing hashes are replaced with the current lesson, no history entry.
function currentHash() {
  return hashForId(course.getState().lesson.id)
}
function resetHash() {
  if (location.hash !== currentHash()) history.replaceState(null, '', currentHash())
}

course.goTo(idFromHash(location.hash))
resetHash()
course.subscribe(() => {
  if (location.hash !== currentHash()) location.hash = currentHash()
})
window.addEventListener('hashchange', () => {
  course.goTo(idFromHash(location.hash))
  resetHash()
})

// One shared set of pin levels for the sims and the circuit parts they drive,
// and one set of learner inputs (held buttons) the sims read.
const pins = createPins()
const inputs = createInputs()
// Tone frequency in Hz per pin, 0 for silent: the same store shape as pins.
const tones = createPins()
// Servo arm angle in deg per pin; kept on Stop, like a real servo.
const servos = createPins()
// The serial port between the sketch and the Serial Monitor; cleared on lesson change.
const serial = createSerial()
// The learner's sketch runs in a Web Worker; its batches go to the sim runner,
// which is made further down once the course panels exist.
const codeRunner = createCodeRunner({
  onBatch: (batch) => runner.receive(batch),
  onError: (error) => {
    runner.fail(error)
    run.noticeError()
  }
})
// The room the sensors read; its light level also dims the scene.
const room = createRoom()
room.subscribe((name, value) => {
  if (name === 'light') stage.setDaylight(value)
})

const topBar = createTopBar(layout.topBar, course, { levels, onOpenMap: () => toggleMap(), flow })
const courseMap = createCourseMap({ container: layout.topBar, course, levels, button: topBar.mapButton })
function toggleMap() {
  if (courseMap.isOpen()) courseMap.close()
  else courseMap.open()
}
const guide = createGuidePanel(layout.guide, { course, flow, tracker })
createInfoPanel(guide.referenceBody, course, { heading: false })

// Created before the circuit swap so its lesson values are current when a new circuit is built.
const codePanel = createCodePanel(layout.codePanel, course, { setOpen: layout.setCodeOpen })
const { getValues, subscribe: subscribeValues } = codePanel
// The code panel opens by default on predict, run and code steps and closes on
// the others; the learner's own open or close sticks until the step changes.
let codeStepKey = null
function defaultCodeOpen(view) {
  const entry = view.steps[view.index]
  const key = view.lesson.id + ':' + view.index
  if (!entry || key === codeStepKey) return
  codeStepKey = key
  layout.setCodeOpen(CODE_OPEN_KINDS.includes(entry.step.kind))
}
defaultCodeOpen(flow.getView())
flow.subscribe(defaultCodeOpen)

// The Serial Monitor sits under the sketch editor, and moves with it to full screen.
const serialMonitor = createSerialMonitor({
  container: codePanel.serialSlot,
  serial,
  onSend: (text) => codeRunner.sendSerial(text)
})
let serialLessonId = course.getState().lesson.id
serialMonitor.setVisible(usesSerial(course.getState().lesson))
course.subscribe(({ lesson }) => {
  if (lesson.id === serialLessonId) return
  serialLessonId = lesson.id
  serial.clear()
  serialMonitor.setVisible(usesSerial(lesson))
})

const view = createCircuitView({ stage, board, breadboard, pins, servos, tones, getValues })
const dock = layout.dock
const partPress = createPartPress({ stage, getItems: view.items, inputs })
const holdButton = createHoldButton({ container: dock, partPress, inputs })
const partTurn = createPartTurn({ stage, getItems: view.items, inputs })
const knobSlider = createKnobSlider({ container: dock, partTurn, inputs })
const roomControls = createRoomControls({ container: dock, room })
const sound = createSound({ container: dock, tones, storage: getStorage() })
const multimeter = createMultimeter({ container: dock, stage, getItems: view.items, inputs })
createViewControls({ container: layout.viewControls, stage, getFrameBox: frameBox })

// The learner's build of the lesson circuit. The scene draws it, not the
// reference table, which is the answer key. Until build steps exist every
// lesson opens with its whole circuit prebuilt (lesson prebuilt lists wait for
// BUILD_STEPS_ENABLED).
const workbench = createWorkbench({ storage: getStorage() })
let reference = null

// The table the view draws: the build plus the reference meter and room flags.
function buildTable() {
  if (!reference) return null
  return { ...workbench.getBuild(), meter: reference.meter, roomDriven: reference.roomDriven }
}

// Draw the build, then point the per lesson controls at its parts. fresh is
// true on a lesson change: only then do the knob, servo and room start over
// and the meter forget its probe.
// The values of the params that resistors in the drawn build take their ohms from.
let ohmsKey = ''
function ohmsKeyOf(values) {
  const table = view.table()
  if (!table) return ''
  return table.parts.filter((part) => part.type === 'resistor' && part.ohmsParam).map((part) => values[part.ohmsParam]).join()
}

function drawBuild({ fresh }) {
  partPress.release()
  partTurn.release()
  const table = buildTable()
  view.show(table, { fresh })
  ohmsKey = ohmsKeyOf(getValues())
  const find = (type) => (table ? table.parts.find((part) => part.type === type) : null)
  const button = find('button')
  holdButton.setTarget(button ? button.id : null)
  // Every new circuit starts with its knob in the middle; a rebuild keeps it.
  const pot = find('potentiometer')
  if (pot) partTurn.setValue(pot.id, fresh ? 0.5 : inputs.getValue(pot.id))
  knobSlider.setTarget(pot ? pot.id : null)
  if (fresh) multimeter.setTargets(table ? table.meter : null)
  // Every new circuit starts in the default room; sensor parts show their sliders.
  if (fresh) room.reset()
  const types = table ? table.parts.map((part) => part.type) : []
  const ownRoom = table && !table.roomDriven
  roomControls.setSensors({ light: ownRoom && types.includes('ldr'), temp: ownRoom && types.includes('tmp36') })
  const buzzer = find('buzzer')
  sound.setPin(buzzer ? buzzer.pin : null)
  stage.invalidate()
}

// Load the lesson build on every lesson change; lessons without a circuit show
// the empty breadboard.
let circuitLessonId = null
function showCircuit({ lesson }) {
  if (lesson.id === circuitLessonId) return
  circuitLessonId = lesson.id
  reference = circuits[lesson.id] || null
  workbench.load(lesson.id, { kit: kitFor(lesson, reference, { prebuiltLists: BUILD_STEPS_ENABLED }), reference })
  drawBuild({ fresh: true })
}

// Every edit redraws the build in place.
workbench.subscribe((event) => {
  if (event.type !== 'load') drawBuild({ fresh: false })
})

showCircuit(course.getState())
course.subscribe(showCircuit)
// A resistor that takes its ohms from a param is rebuilt when that param changes.
subscribeValues((values) => {
  if (ohmsKeyOf(values) !== ohmsKey) {
    drawBuild({ fresh: false })
    return
  }
  view.showParts(values)
  view.relight()
})

// One runner over the shared pin levels and inputs. A sim goal marks a lesson
// with a generated step done; a lesson with its own steps is done when the
// flow has seen every step pass.
function onGoal(id) {
  const lesson = lessons.find((item) => item.id === id)
  if (lesson && hasGeneratedSteps(lesson)) course.markComplete(id)
}
const runner = createSimRunner({ sims, pins, inputs, room, tones, servos, serial, codeRunner, onGoal })

// Everything a step check looks at. The compile result is cached by source.
const toursDone = new Set()
let checkedSource = null
let checkedError = null
function currentContext() {
  const source = codePanel.getSource()
  if (source !== checkedSource) {
    checkedSource = source
    checkedError = checkCode(source)
  }
  const { lesson } = course.getState()
  return {
    lessonId: lesson.id,
    sim: { phase: runner.getPhase(), progress: runner.getProgress() },
    code: { error: checkedError },
    tour: { complete: toursDone.has(lesson.id) }
  }
}
function updateFlow() {
  flow.update(currentContext())
}

const run = createRunControls({
  container: layout.runBar,
  course,
  runner,
  getValues,
  getSource: codePanel.getSource,
  onError: codePanel.setError,
  getLock: () => flow.runLock(),
  onFrame: updateFlow
})
flow.subscribe(() => run.refreshLock())
course.subscribe(updateFlow)
// Code edits and control changes re-check the code steps, 300 ms after the last one.
let editTimer = null
function updateFlowSoon() {
  clearTimeout(editTimer)
  editTimer = setTimeout(updateFlow, 300)
}
subscribeValues(updateFlowSoon)
codePanel.onInput(updateFlowSoon)
// A slider move while running swaps in the refilled sketch at once; edited
// code waits for the next Run, like a real upload.
subscribeValues(() => {
  if (runner.getPhase() === 'running' && !codePanel.isEdited()) runner.reload(codePanel.getSource(), performance.now())
})
// A finished tour counts for the step checks, and still marks 1.1 done while
// its step is the generated one.
function onTourComplete(id) {
  toursDone.add(id)
  const lesson = lessons.find((item) => item.id === id)
  if (lesson && hasGeneratedSteps(lesson)) course.markComplete(id)
  updateFlow()
}
createBoardTour({ stage, board, course, container: layout.workbench, onComplete: onTourComplete })
updateFlow()
