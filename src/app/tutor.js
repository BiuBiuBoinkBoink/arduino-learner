// Help chat composition for main.js (only when VITE_TUTOR is on): the tool
// runner (src/tutor/tools.js) wired to the scene, the explain tools, the code
// panel and the panels, the chat loop (src/tutor/chat.js) with the state
// block, and the Ask tab. Highlights go through placement's overlay, the board
// pin rings or an accent ghost of the part; notes go on the explain label
// layer as 'chat'. Nothing here changes the build, the code or progress:
// show_placement and next_hint only raise the hint level (at most Show me),
// suggest_code only offers a line, and a demo input comes back by itself.
//
// createTutor({ askHost, stage, board, breadboard, placement, viewControls,
//   explain, codePanel, layout, sheet, guide, flow, course, lessons, runner,
//   inputs, room, partPress, partTurn, getBuild, getReference,
//   getCodeError, restoreMarks, selectReferenceTab }) -> { reset(), refresh(), chat, tools }
import * as THREE from 'three'
import { createTutorTools } from '../tutor/tools.js'
import { createChat } from '../tutor/chat.js'
import { buildState, formatState } from '../tutor/context.js'
import { createAskPanel } from '../ui/askPanel.js'
import { stepsFor, scopeFor } from '../course/steps.js'
import { describeNets } from '../explain/connections.js'
import { legsOf } from '../circuits/footprints.js'
import { buildGhost, disposeGroup } from '../ui/placement.js'

const ACCENT = new THREE.Color(0x2f6fd6)
const HIGHLIGHT_MS = 4000
const LABEL_MS = 6000
const CODE_MARK_MS = 8000
// Half the width of the box the camera frames around a hole, pin or part, in cm.
const NEAR_CM = 3
const LABEL_LIFT = 0.3

export function createTutor({ askHost, stage, board, breadboard, placement, viewControls, explain, codePanel, layout, sheet, guide, flow, course, lessons, runner, inputs, room, partPress, partTurn, getBuild, getReference, getCodeError, restoreMarks, selectReferenceTab }) {
  const timers = new Set()
  function later(fn, ms) {
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }

  const placed = () => (getBuild().parts || []).filter((part) => legsOf(part).length > 0)

  // The world point of a hole, a pin or the middle of a placed part's legs.
  function pointAt(kind, value) {
    if (kind !== 'part') return explain.pointOf(value)
    const part = placed().find((item) => item.id === value)
    const points = part ? legsOf(part).map((hole) => explain.pointOf(hole)).filter(Boolean) : []
    if (points.length === 0) return null
    return points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(points.length)
  }

  // A highlighted part is an accent ghost over it for a few seconds.
  let ghost = null
  function clearGhost() {
    if (ghost) disposeGroup(stage.scene, ghost)
    ghost = null
    stage.invalidate()
  }

  let overlayCount = 0
  function highlight({ kind, value }) {
    if (kind === 'place') {
      const mine = ++overlayCount
      placement.setOverlay([{ place: value, tone: 'info' }])
      later(() => {
        if (overlayCount === mine) placement.setOverlay([])
      }, HIGHLIGHT_MS)
    } else if (kind === 'pin') {
      board.highlightPins([value])
      later(restoreMarks, HIGHLIGHT_MS)
    } else {
      const part = placed().find((item) => item.id === value)
      clearGhost()
      ghost = buildGhost({ table: { parts: [part], wires: [] }, board, breadboard, values: codePanel.getValues(), tint: ACCENT })
      if (ghost) {
        ghost.name = 'chat-ghost'
        stage.scene.add(ghost)
        const mine = ghost
        later(() => {
          if (ghost === mine) clearGhost()
        }, HIGHLIGHT_MS)
      }
    }
    stage.invalidate()
  }

  // Pinned notes, each gone after LABEL_MS.
  let notes = []
  let noteCount = 0
  function showNotes() {
    explain.setLabels('chat', notes.map((note) => ({ id: note.id, position: note.position, text: note.text, tone: 'info' })))
  }
  function pinLabel({ kind, value, text }) {
    const point = pointAt(kind, value)
    if (!point) return
    const id = 'chat-' + ++noteCount
    notes = [...notes, { id, position: point.setY(point.y + LABEL_LIFT), text }]
    showNotes()
    later(() => {
      notes = notes.filter((note) => note.id !== id)
      showNotes()
    }, LABEL_MS)
  }

  function moveCamera({ kind, value, view }) {
    let box
    if (kind === 'board') {
      const group = value === 'uno' ? board.group : breadboard.group
      box = new THREE.Box3().setFromObject(group)
    } else {
      const point = pointAt(kind, value)
      if (!point) return
      box = new THREE.Box3(point.clone().subScalar(NEAR_CM), point.clone().addScalar(NEAR_CM))
    }
    viewControls.setView(view, undefined, { min: { ...box.min }, max: { ...box.max } })
  }

  // The code panel open: the drawer or column, or the Code tab in compact.
  function openCode() {
    layout.setCodeOpen(true)
    if (layout.getMode() === 'compact') {
      sheet.selectTab('code')
      if (sheet.getState() === 'peek') sheet.setState('half')
    }
  }

  function openSteps() {
    if (layout.getMode() === 'compact') {
      sheet.selectTab('steps')
      if (sheet.getState() === 'peek') sheet.setState('half')
    }
  }

  // Inputs a demo may set: placed buttons and knobs, and the room sliders the
  // circuit shows (not when the sim sets the room).
  function inputTargets() {
    const parts = placed()
    const reference = getReference()
    const ownRoom = !(reference && reference.roomDriven)
    const types = parts.map((part) => part.type)
    return {
      buttons: parts.filter((part) => part.type === 'button').map((part) => part.id),
      knobs: parts.filter((part) => part.type === 'potentiometer').map((part) => part.id),
      light: ownRoom && types.includes('ldr'),
      temp: ownRoom && types.includes('tmp36')
    }
  }
  function getInput(name) {
    if (name === 'room-light') return room.getLight()
    if (name === 'room-temp') return room.getTempC()
    if (inputTargets().buttons.includes(name)) return inputs.isPressed(name)
    return inputs.getValue(name)
  }
  // A value put back after the lesson changed is dropped with its target.
  function setInput(name, value) {
    const targets = inputTargets()
    if (name === 'room-light') {
      if (targets.light) room.setLight(value)
    } else if (name === 'room-temp') {
      if (targets.temp) room.setTempC(value)
    } else if (targets.buttons.includes(name)) {
      if (value) partPress.press(name)
      else partPress.release()
    } else if (targets.knobs.includes(name)) {
      partTurn.setValue(name, value)
    }
  }

  function currentStep() {
    const view = flow.getView()
    const entry = view.steps[view.index]
    if (!entry) return null
    const check = entry.step.check || {}
    return {
      lesson: view.lesson,
      step: entry.step,
      hintLevel: entry.hintLevel,
      passed: entry.passed,
      scope: scopeFor(view.lesson, view.index),
      canSuggest: Boolean(getReference()) && check.type === 'circuit'
    }
  }

  const tools = createTutorTools({
    explain: explain.tools,
    getBuild,
    getStep: currentStep,
    lessons,
    stepsFor,
    raiseHint: (level) => flow.raiseHint(level),
    showPlacement() {
      if (!viewControls.isEditing()) viewControls.setEditing(true)
      openSteps()
      restoreMarks()
    },
    highlight,
    pinLabel,
    moveCamera,
    codeLineCount: () => (course.getState().lesson.sketch ? codePanel.getSource().split('\n').length : 0),
    pointToCode(line, note) {
      openCode()
      codePanel.markLines([line], note)
      later(restoreMarks, CODE_MARK_MS)
    },
    offerLine(line, text, why) {
      openCode()
      codePanel.offerLine(line, text, why)
    },
    isRunning: () => runner.getPhase() === 'running',
    beginDemo: () => runner.beginDemo(),
    inputTargets,
    getInput,
    setInput,
    setTimer: later,
    openReference(tab) {
      openSteps()
      guide.openReference()
      selectReferenceTab(tab)
    }
  })

  // The state block: the step, its checklist and mistake, the circuit, the
  // code and the run, as the learner sees them now.
  function state() {
    const view = flow.getView()
    const entry = view.steps[view.index]
    const lesson = view.lesson
    const build = getBuild()
    const hasBuild = Boolean(getReference() || lesson.kit)
    return formatState(buildState({
      lesson,
      step: entry.step,
      view: entry,
      hintLevel: entry.hintLevel,
      build: hasBuild ? build : null,
      connections: hasBuild ? describeNets(build, getReference()) : null,
      code: lesson.sketch ? codePanel.getSource() : null,
      codeError: lesson.sketch ? getCodeError() : null,
      run: { phase: runner.getPhase(), readout: runner.getReadout(), progress: runner.getProgress() }
    }))
  }

  const chat = createChat({ runTool: tools.run, getState: state })
  const askPanel = createAskPanel({
    container: askHost,
    chat,
    getSuggestionContext: () => {
      const step = currentStep()
      return { kind: step ? step.step.kind : 'learn', codeError: Boolean(course.getState().lesson.sketch && getCodeError()) }
    }
  })

  // A lesson change: a new conversation, and every chat mark gone.
  function reset() {
    chat.reset()
    for (const id of timers) clearTimeout(id)
    timers.clear()
    notes = []
    showNotes()
    clearGhost()
    placement.setOverlay([])
    askPanel.refresh()
  }

  return { reset, refresh: () => askPanel.refresh(), chat, tools }
}
