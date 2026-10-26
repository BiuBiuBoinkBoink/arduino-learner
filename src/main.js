import './style.css'
import { lessons, levels } from './course/lessons.js'
import { createCourse } from './course/state.js'
import { createStepTracker } from './course/stepTracker.js'
import { createFlow } from './course/flow.js'
import { createNudge } from './course/nudge.js'
import { stepsFor, hasGeneratedSteps, scopeFor, CODE_OPEN_KINDS, BUILD_KINDS, BUILD_STEPS_ENABLED } from './course/steps.js'
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
import { createBottomSheet } from './ui/bottomSheet.js'
import { createSheetPeek } from './ui/sheetPeek.js'
import { createBoardTour } from './ui/boardTour.js'
import { createRunControls } from './ui/runControls.js'
import { createPartPress, createHoldButton } from './ui/partPress.js'
import { createPartTurn, createKnobSlider } from './ui/partTurn.js'
import { createMultimeter } from './ui/multimeter.js'
import { createPlacement } from './ui/placement.js'
import { createPartsTray } from './ui/partsTray.js'
import { createHoleTooltip } from './ui/holeTooltip.js'
import { createLabels } from './ui/labels.js'
import { createStepMarks } from './ui/stepMarks.js'
import { createExplain } from './app/explain.js'
import { createRoom } from './sim/room.js'
import { createRoomControls } from './ui/roomControls.js'
import { createSound } from './ui/sound.js'
import { createSerial } from './sim/serial.js'
import { createSerialMonitor, usesSerial } from './ui/serialMonitor.js'
import { createCodeRunner } from './runner/codeRunner.js'
import { circuits } from './circuits/circuits.js'
import { compare, diagnose, partLabel, placeOf } from './circuits/netlist.js'
import { isHole } from './circuits/holes.js'
import { suggest, joinPlaces, pendingPins, suggestionLabels } from './circuits/suggest.js'
import { autoWireColor } from './build/wireColor.js'
import { kitFor } from './build/kit.js'
import { createWorkbench } from './build/workbench.js'
import { createPins } from './sim/pins.js'
import { createInputs } from './sim/inputs.js'
import { sims } from './sim/sims.js'
import { createSimRunner, checkCode } from './sim/runner.js'

const layout = createLayout(document.querySelector('#app'))
// Compact layout: the guide and the code panel move into a bottom sheet over
// the workbench (Steps and Code tabs), and back to their columns in the other
// layouts. Neither is rebuilt, so the editor keeps its text and caret. Done
// before the scene exists, so the stage starts at its real size.
const sheet = createBottomSheet({
  container: layout.workbench,
  tabs: [
    { id: 'steps', label: 'Steps', element: layout.guide },
    { id: 'code', label: 'Code', element: layout.codePanel }
  ]
})
function applyLayout(mode) {
  sheet.setActive(mode === 'compact')
  if (mode !== 'compact') sheet.setState('peek')
}
applyLayout(layout.getMode())
layout.subscribeMode(applyLayout)
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
// Starting a lesson again also puts its circuit back to the start. Do it for
// me (hint level 3) applies the suggestion through the workbench.
const guide = createGuidePanel(layout.guide, {
  course,
  flow,
  tracker,
  // Show me and Do it for me need a reference circuit and a circuit check.
  canSuggest: (lesson, step) => Boolean(circuits[lesson.id]) && Boolean(step.check) && step.check.type === 'circuit',
  onRestart: () => {
    const { id } = course.getState().lesson
    workbench.reset()
    toursDone.delete(id)
    boardTour.reset(id)
    updateFlow()
  },
  onHelp: (level) => {
    if (level === 3) doItForMe()
  }
})
// The hint box opens by itself after a mistake or 40 s without progress.
const nudge = createNudge({ flow })
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

createSheetPeek({ container: sheet.peekSlot, flow, course })
// A step that opens the code panel picks the Code tab, and one that closes it
// the Steps tab, unless the sheet is only peeking.
layout.subscribeCode((open) => {
  if (layout.getMode() === 'compact' && sheet.getState() !== 'peek') sheet.selectTab(open ? 'code' : 'steps')
})

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
const multimeter = createMultimeter({ container: dock, stage, board, breadboard, getItems: view.items, inputs, onMeasure: (name) => explain.measureAt(name) })
const viewControls = createViewControls({
  container: layout.viewControls,
  stage,
  getFrameBox: frameBox,
  // Both boards, so the Uno pins stay in view for wiring.
  getEditBox: frameBox,
  onEdit: setEditing
})
// The first camera is set for a wide screen; narrower layouts start framed in
// the 3D view. A resize (a new layout, a phone turned) frames the top or 3D
// view again; a view the learner orbited stays as it is.
if (layout.getMode() !== 'wide') viewControls.setView('3d', { animate: false })
new ResizeObserver(() => {
  const kind = stage.getView()
  if (kind === 'top' || kind === '3d') viewControls.setView(kind, { animate: false })
}).observe(layout.stageEl)

// The learner's build of the lesson circuit. The scene draws it, not the
// reference table, which is the answer key. A lesson opens with its prebuilt
// list placed (1.2 has none, so it opens empty) or, without a list, its whole
// circuit (lesson prebuilt lists only count while BUILD_STEPS_ENABLED).
const workbench = createWorkbench({ storage: getStorage() })
let reference = null
// A lesson has a circuit to edit when it has a reference circuit or its own
// kit (1.1 has a kit and no reference: no run lock, no hint ghosts).
let hasCircuit = false
// Tray labels for the current kit: partLabel against the whole kit.
let kitLabels = {}

// Edit circuit mode: placement and the parts tray on, press, turn and meter
// clicks off.
const tooltip = createHoleTooltip({ container: layout.workbench })
const placement = createPlacement({ stage, board, breadboard, workbench, getItems: view.items, getValues, tooltip, onHover: noteHover })
const tray = createPartsTray({ container: layout.workbench, workbench, placement, kitLabels: () => kitLabels, onAbout: (id) => explain.about(id) })
// Step hints and mistakes in the scene: strip glows, pin rings, ghosts, labels.
const labels = createLabels({ stage, container: layout.workbench })
const marks = createStepMarks({ stage, board, breadboard, placement, labels, getValues })
function setEditing(on) {
  placement.setEnabled(on)
  tray.setVisible(on)
  partPress.setEnabled(!on)
  partTurn.setEnabled(!on)
  multimeter.setEnabled(!on)
  refreshMarks()
}

// Run stays locked while the build does not match the reference circuit; a
// short circuit gets its own message.
let buildMatches = true
let buildLock = null
const BUILD_LOCK = 'Finish the circuit to unlock Run.'
const SHORT_LOCK = 'Fix the short circuit to unlock Run.'
function checkBuild() {
  const build = workbench.getBuild()
  buildMatches = !reference || compare(build, reference).match
  buildLock = null
  if (!buildMatches) buildLock = diagnose(build, reference).some((item) => item.id === 'short') ? SHORT_LOCK : BUILD_LOCK
}

// The table the view draws: the build plus the reference meter and room flags.
function buildTable() {
  if (!hasCircuit) return null
  if (!reference) return workbench.getBuild()
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
  placement.refresh()
  stage.invalidate()
}

// Load the lesson build on every lesson change; lessons without a circuit show
// the empty breadboard.
let circuitLessonId = null
function showCircuit({ lesson }) {
  if (lesson.id === circuitLessonId) return
  circuitLessonId = lesson.id
  reference = circuits[lesson.id] || null
  hasCircuit = Boolean(reference || lesson.kit)
  const kit = kitFor(lesson, reference, { prebuiltLists: BUILD_STEPS_ENABLED })
  const kitParts = kit.parts.map((part) => ({ id: part.id, type: part.type, ...part.meta }))
  kitLabels = Object.fromEntries(kitParts.map((part) => [part.id, partLabel(part, kitParts)]))
  workbench.load(lesson.id, { kit, reference })
  checkBuild()
  viewControls.setEditAvailable(hasCircuit)
  multimeter.setAvailable(hasCircuit)
  placement.setEnabled(viewControls.isEditing())
  drawBuild({ fresh: true })
  defaultEditing(flow.getView())
  refreshMarks()
}

// Edit mode follows the step: on for build and wire steps, off for the others.
// The learner's own toggle sticks until the step changes.
let editStepKey = null
function defaultEditing(viewState) {
  const entry = viewState.steps[viewState.index]
  const key = viewState.lesson.id + ':' + viewState.index
  // The lesson's circuit loads after the flow hears of a lesson change.
  if (!entry || key === editStepKey || viewState.lesson.id !== circuitLessonId) return
  editStepKey = key
  viewControls.setEditing(hasCircuit && BUILD_KINDS.includes(entry.step.kind))
}
flow.subscribe(defaultEditing)

// Kit parts that a later build or wire step adds: shown as Later, not pickable.
function laterParts(lesson, index) {
  const steps = stepsFor(lesson)
  const now = scopeFor(lesson, index)
  const later = steps.slice(index + 1).filter((step) => BUILD_KINDS.includes(step.kind)).flatMap((step) => step.parts || [])
  return [...new Set(later)].filter((id) => !now.includes(id))
}

// Tray pulses, Later parts, and on a build or wire step that has not passed:
// the places a new part must join (build) or the pins still to wire (wire),
// and the current mistake in red with a label at its first hole or pin.
function refreshMarks() {
  const viewState = flow.getView()
  const { lesson, index } = viewState
  if (lesson.id !== circuitLessonId) return
  const entry = viewState.steps[index]
  const later = hasCircuit && entry ? laterParts(lesson, index) : []
  placement.setLocked(later)
  const kind = entry ? entry.step.kind : null
  const building = Boolean(hasCircuit && entry && BUILD_KINDS.includes(kind) && !entry.passed)
  tray.setStep({ pulse: building && kind === 'build' ? entry.step.parts || [] : [], later })
  // Hint glows, rings and ghosts come from the reference circuit; without one
  // (1.1) only the mistake glow and label show.
  // Show me on a code step marks the lines to change in the editor.
  const showMe = entry && kind === 'code' && !entry.passed && entry.hintLevel >= 2 ? entry.step.showMe : null
  if (showMe) codePanel.markLines(showMe.lines, showMe.note)
  else codePanel.clearMarks()
  if (!building) {
    guide.setShowMe(showMe ? [codeShowMeText(showMe)] : [])
    marks.clear()
    return
  }
  const build = currentBuild()
  const scope = scopeFor(lesson, index)
  // Show me on a build or wire step: the suggestion as ghosts and labels,
  // recomputed after every change so it never goes stale.
  const suggestion = entry.hintLevel >= 2 ? suggest(build, reference, entry.step, scope) : []
  const texts = suggestionLabels(suggestion, reference)
  guide.setShowMe(texts.map((item) => item.text))
  if (!viewControls.isEditing()) {
    marks.clear()
    return
  }
  let places = []
  const pins = []
  const list = texts.map((item, i) => ({ id: 'hint-' + i, at: item.at, text: item.text, tone: 'info' }))
  if (kind === 'build') places = joinPlaces(build, reference, entry.step, scope).map((place) => ({ place, tone: 'info' }))
  else pins.push(...pendingPins(build, reference))
  const feedback = viewState.result && viewState.result.feedback
  const targets = viewState.targets
  if (feedback && targets) {
    const bad = new Set([...targets.places, ...targets.holes.filter(isHole).map(placeOf)])
    places = [...places.filter((item) => !bad.has(item.place)), ...[...bad].map((place) => ({ place, tone: 'bad' }))]
    const at = targets.holes[0] || targets.pins[0]
    if (at) list.push({ id: 'mistake', at: [at], text: feedback.text, tone: 'bad' })
  }
  marks.set({ places, pins, ghost: ghostTable(suggestion, build), labels: list })
}
flow.subscribe(refreshMarks)

// The suggested parts and wires as a circuit table for the hint ghosts.
function ghostTable(items, build) {
  const parts = []
  const wires = []
  items.forEach((item, i) => {
    if (item.kind === 'part') {
      const part = workbench.kitPart(item.id)
      if (part) parts.push({ ...part, legs: item.legs })
    } else if (item.kind === 'wire') {
      wires.push({ id: 'hint-' + i, from: item.from, to: item.to, color: autoWireColor(item.from, build) })
    }
  })
  return parts.length + wires.length > 0 ? { parts, wires } : null
}

// 'Lines 10 and 12: try 200' for a code step's showMe.
function codeShowMeText({ lines, note }) {
  const list = lines.map(String)
  const words = list.length > 1 ? 'Lines ' + list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : 'Line ' + list[0]
  return note ? words + ': ' + note : words
}

// Do it for me: take out wrong wires, place the parts and add the wires the
// suggestion names. Whatever is in the learner's hand is put back first.
function doItForMe() {
  const viewState = flow.getView()
  const entry = viewState.steps[viewState.index]
  if (!reference || !entry || entry.passed || !BUILD_KINDS.includes(entry.step.kind)) return
  if (!viewControls.isEditing()) viewControls.setEditing(true)
  placement.cancel()
  placement.cancel()
  const items = suggest(currentBuild(), reference, entry.step, scopeFor(viewState.lesson, viewState.index))
  for (const item of items) {
    if (item.kind === 'unwire') workbench.removeWire(item.id)
    else if (item.kind === 'part') workbench.place(item.id, item.legs)
    else if (item.kind === 'wire') workbench.addWire(item.from, item.to)
  }
}

// The build the step checks see: one object per workbench state, so the
// checks can cache their results until the next edit.
let checkedBuild = null
function currentBuild() {
  if (!checkedBuild) checkedBuild = workbench.getBuild()
  return checkedBuild
}
// Workbench changes since the current step became current; a mistake shows
// only once the learner changed something on this step.
let attempts = 0
let attemptsKey = null
function stepKey(viewState) {
  return viewState.lesson.id + ':' + viewState.index
}
// What the learner did while the current step is current, for event checks:
// the places hovered, parts moved and parts put back in the tray. Memory only.
function freshEvents() {
  return { 'strip-hover': new Set(), 'part-moved': 0, 'part-returned': 0 }
}
let stepEvents = freshEvents()
flow.subscribe((viewState) => {
  if (stepKey(viewState) === attemptsKey) return
  attemptsKey = stepKey(viewState)
  attempts = 0
  stepEvents = freshEvents()
})
attemptsKey = stepKey(flow.getView())
function noteHover(hole) {
  if (!hole || stepEvents['strip-hover'].has(placeOf(hole))) return
  stepEvents['strip-hover'].add(placeOf(hole))
  updateFlow()
}

// Hovering shows strips on explore steps that count hovers, with edit mode off.
function hoverOnlyFor(viewState) {
  const entry = viewState.steps[viewState.index]
  placement.setHoverOnly(Boolean(entry && entry.step.kind === 'explore' && entry.step.check.type === 'event' && !entry.passed))
}
hoverOnlyFor(flow.getView())
flow.subscribe(hoverOnlyFor)

// Every edit redraws the build in place, re-checks the run lock and the step;
// a build that stops matching stops a running sketch.
workbench.subscribe((event) => {
  checkedBuild = null
  if (event.type === 'load') return
  attempts += 1
  if (event.type === 'move') stepEvents['part-moved'] += 1
  if (event.type === 'remove') stepEvents['part-returned'] += 1
  drawBuild({ fresh: false })
  checkBuild()
  if (!buildMatches && ['uploading', 'running'].includes(runner.getPhase())) run.stop()
  run.refreshLock()
  updateFlow()
  refreshMarks()
  nudge.poke()
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

// The run status while a slow motion run is a demo.
const SLOW_NOTE = 'Slow motion. Goals are paused until you press Run again.'

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
    tour: { complete: toursDone.has(lesson.id) },
    events: stepEvents,
    build: currentBuild(),
    reference,
    scope: scopeFor(lesson, tracker.get(lesson.id).current),
    attempts,
    busy: isBusy()
  }
}
// True while a part is in the learner's hand or a bend or wire is half drawn.
function isBusy(state = placement.getState()) {
  return state.mode === 'carry' || state.mode === 'bend' || (state.mode === 'wire' && state.first !== null)
}
// Picking up or putting down changes busy, which hides or shows the mistake.
let wasBusy = false
placement.subscribe((state) => {
  const busy = isBusy(state)
  if (busy === wasBusy) return
  wasBusy = busy
  updateFlow()
})
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
  getLock: () => flow.runLock() || buildLock,
  onFrame: () => {
    updateFlow()
    explain.onFrame()
  },
  getNote: () => (runner.isDemo() ? SLOW_NOTE : null)
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
// A finished tour counts for the tour step check; the flow marks 1.1 done once
// every step passed. The tour card and zone clicks are on only during that step.
function onTourComplete(id) {
  toursDone.add(id)
  updateFlow()
}
const boardTour = createBoardTour({ stage, board, course, container: layout.workbench, onComplete: onTourComplete })
function tourFor(viewState) {
  const entry = viewState.steps[viewState.index]
  boardTour.setEnabled(Boolean(entry && ['tour', 'legacy'].includes(entry.step.check.type)))
}
tourFor(flow.getView())
flow.subscribe(tourFor)

// Explain tools: the Explain menu with the view buttons, its cards and what
// the tools draw in the scene. A lesson change closes every card and turns
// every toggle off. No tool changes the build, the steps or progress.
const explain = createExplain({
  stage,
  board,
  breadboard,
  viewControls,
  viewContainer: layout.viewControls,
  workbench: layout.workbench,
  placement,
  getBuild: currentBuild,
  getReference: () => reference,
  getItems: view.items,
  inputs,
  runner,
  getKit: () => workbench.tray().parts.map((part) => ({ id: part.id, type: part.type, label: kitLabels[part.id] || part.id })),
  hasCircuit: () => hasCircuit,
  pins,
  meter: multimeter,
  codePanel
})
let explainLessonId = course.getState().lesson.id
course.subscribe(({ lesson }) => {
  if (lesson.id === explainLessonId) return
  explainLessonId = lesson.id
  explain.reset()
})
workbench.subscribe(() => explain.refresh())
updateFlow()
