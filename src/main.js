import './style.css'
import * as THREE from 'three'
import { createStage } from './scene/stage.js'
import { createPanels } from './ui/panels.js'
import { lessons } from './course/lessons.js'
import { createCourse } from './course/state.js'
import { idFromHash, hashForId } from './course/hash.js'
import { createLessonStrip } from './ui/lessonStrip.js'
import { createInfoPanel } from './ui/infoPanel.js'
import { createCodePanel } from './ui/codePanel.js'
import { createBoardTour } from './ui/boardTour.js'
import { createRunControls } from './ui/runControls.js'
import { createUnoBoard } from './parts/unoBoard.js'
import { createBreadboard } from './parts/breadboard.js'
import { circuits } from './circuits/circuits.js'
import { buildCircuit } from './circuits/buildCircuit.js'
import { createPins } from './sim/pins.js'
import { sims } from './sim/sims.js'
import { createSimRunner } from './sim/runner.js'

const app = document.querySelector('#app')

const stageEl = document.createElement('div')
stageEl.id = 'stage'
app.append(stageEl)

const stage = createStage(stageEl)
const board = createUnoBoard()
const breadboard = createBreadboard()

// Uno on the left, breadboard on the right with a 1 cm gap, the pair centred on x = 0.
const BOARD_GAP = 1
const boardBox = new THREE.Box3().setFromObject(board.group)
const breadboardBox = new THREE.Box3().setFromObject(breadboard.group)
const boardWidth = boardBox.max.x - boardBox.min.x
const totalWidth = boardWidth + BOARD_GAP + breadboardBox.max.x - breadboardBox.min.x
board.group.position.x = -totalWidth / 2 - boardBox.min.x
breadboard.group.position.x = -totalWidth / 2 + boardWidth + BOARD_GAP - breadboardBox.min.x
stage.scene.add(board.group, breadboard.group)
stage.invalidate()
const panels = createPanels(app)

function getStorage() {
  try {
    const storage = window.localStorage
    if (storage) return storage
  } catch {
    // Storage blocked, fall through to memory.
  }
  const memory = new Map()
  return {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) }
  }
}

const course = createCourse({ lessons, storage: getStorage() })

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

// One shared set of pin levels for the sims and the circuit parts they drive.
const pins = createPins()

// Swap the lesson circuit on every lesson change; lessons without one show the empty breadboard.
let circuit = null
let circuitLeds = []
let circuitLessonId = null
function showCircuit({ lesson }) {
  if (lesson.id === circuitLessonId) return
  circuitLessonId = lesson.id
  if (circuit) {
    stage.scene.remove(circuit.group)
    circuit.group.traverse((object) => {
      if (!object.isMesh) return
      object.geometry.dispose()
      object.material.dispose()
    })
    circuit = null
    circuitLeds = []
  }
  if (circuits[lesson.id]) {
    circuit = buildCircuit(circuits[lesson.id], { board, breadboard })
    circuitLeds = circuits[lesson.id].parts
      .filter((part) => part.type === 'led')
      .map((part) => ({ pin: part.pin, led: circuit.items[part.id] }))
    for (const { pin, led } of circuitLeds) led.setLit(pins.get(pin) === 1)
    stage.scene.add(circuit.group)
  }
  stage.invalidate()
}
showCircuit(course.getState())
course.subscribe(showCircuit)

// Light each circuit LED from the level of the Uno pin that drives it.
pins.subscribe((name, level) => {
  const leds = circuitLeds.filter(({ pin }) => pin === name)
  if (leds.length === 0) return
  for (const { led } of leds) led.setLit(level === 1)
  stage.invalidate()
})

createInfoPanel(panels.info, course)
// One runner over the shared pin levels; only a sim goal marks a lesson done.
const runner = createSimRunner({ sims, pins, onGoal: (id) => course.markComplete(id) })
const { toolbar, getValues } = createCodePanel(panels.code, course)
createRunControls({ container: toolbar, course, runner, getValues })
createLessonStrip(panels.strip, course)
createBoardTour({ stage, board, course, container: app })
