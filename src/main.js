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
import { createPartPress, createHoldButton } from './ui/partPress.js'
import { createPartTurn, createKnobSlider } from './ui/partTurn.js'
import { createMultimeter } from './ui/multimeter.js'
import { ledBrightness } from './sim/ohm.js'
import { createRoom } from './sim/room.js'
import { createRoomControls } from './ui/roomControls.js'
import { createUnoBoard } from './parts/unoBoard.js'
import { createBreadboard } from './parts/breadboard.js'
import { circuits } from './circuits/circuits.js'
import { buildCircuit } from './circuits/buildCircuit.js'
import { createPins } from './sim/pins.js'
import { createInputs } from './sim/inputs.js'
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

// One shared set of pin levels for the sims and the circuit parts they drive,
// and one set of learner inputs (held buttons) the sims read.
const pins = createPins()
const inputs = createInputs()
// The room the sensors read; its light level also dims the scene.
const room = createRoom()
room.subscribe((name, value) => {
  if (name === 'light') stage.setDaylight(value)
})

// Created before the circuit swap so its lesson values are current when a new circuit is built.
const { toolbar, getValues, subscribe: subscribeValues } = createCodePanel(panels.code, course)
const runControls = document.createElement('div')
toolbar.append(runControls)
const partPress = createPartPress({ stage, getItems: () => (circuit ? circuit.items : null), inputs })
const holdButton = createHoldButton({ container: toolbar, partPress, inputs })
const partTurn = createPartTurn({ stage, getItems: () => (circuit ? circuit.items : null), inputs })
const knobSlider = createKnobSlider({ container: toolbar, partTurn, inputs })
const roomControls = createRoomControls({ container: toolbar, room })
const multimeter = createMultimeter({ container: toolbar, stage, getItems: () => (circuit ? circuit.items : null), inputs })

// Parts with showWhen are drawn only while that code panel param has that value.
function showParts(values) {
  if (!circuit) return
  for (const part of circuits[circuitLessonId].parts) {
    if (!part.showWhen) continue
    circuit.items[part.id].group.visible = values[part.showWhen.param] === part.showWhen.value
  }
  stage.invalidate()
}

// Swap the lesson circuit on every lesson change; lessons without one show the empty breadboard.
let circuit = null
let circuitLeds = []
let circuitRgbLeds = []
let circuitLessonId = null
function showCircuit({ lesson }) {
  if (lesson.id === circuitLessonId) return
  circuitLessonId = lesson.id
  partPress.release()
  partTurn.release()
  if (circuit) {
    stage.scene.remove(circuit.group)
    circuit.group.traverse((object) => {
      if (!object.isMesh) return
      object.geometry.dispose()
      object.material.dispose()
    })
    circuit = null
    circuitLeds = []
    circuitRgbLeds = []
  }
  if (circuits[lesson.id]) {
    circuit = buildCircuit(circuits[lesson.id], { board, breadboard })
    circuitLeds = circuits[lesson.id].parts
      .filter((part) => part.type === 'led')
      .map((part) => ({ part, led: circuit.items[part.id] }))
    circuitRgbLeds = circuits[lesson.id].parts
      .filter((part) => part.type === 'rgbLed')
      .map((part) => ({ part, led: circuit.items[part.id] }))
    lightLeds()
    stage.scene.add(circuit.group)
    showParts(getValues())
  }
  const button = circuit ? circuits[lesson.id].parts.find((part) => part.type === 'button') : null
  holdButton.setTarget(button ? button.id : null)
  // Every new circuit starts with its knob in the middle.
  const pot = circuit ? circuits[lesson.id].parts.find((part) => part.type === 'potentiometer') : null
  if (pot) partTurn.setValue(pot.id, 0.5)
  knobSlider.setTarget(pot ? pot.id : null)
  multimeter.setTargets(circuit ? circuits[lesson.id].meter : null)
  // Every new circuit starts in the default room; sensor parts show their sliders.
  room.reset()
  const types = circuit ? circuits[lesson.id].parts.map((part) => part.type) : []
  roomControls.setSensors({ light: types.includes('ldr'), temp: types.includes('tmp36') })
  stage.invalidate()
}
// Light circuit LEDs from the level of the Uno pin that drives each (0 to 1, PWM
// duty), scaled by the series resistor when the part names an ohmsParam.
// With a pin name, only the LEDs on that pin.
function lightLeds(name) {
  const values = getValues()
  let changed = false
  for (const { part, led } of circuitLeds) {
    if (name !== undefined && part.pin !== name) continue
    const scale = part.ohmsParam ? ledBrightness(values[part.ohmsParam]) : 1
    led.setBrightness(pins.get(part.pin) * scale)
    changed = true
  }
  // RGB LEDs mix their three channel pins.
  for (const { part, led } of circuitRgbLeds) {
    const { red, green, blue } = part.pins
    if (name !== undefined && ![red, green, blue].includes(name)) continue
    led.setColor(pins.get(red), pins.get(green), pins.get(blue))
    changed = true
  }
  if (changed) stage.invalidate()
}

showCircuit(course.getState())
course.subscribe(showCircuit)
subscribeValues((values) => {
  showParts(values)
  lightLeds()
})

pins.subscribe((name) => lightLeds(name))

createInfoPanel(panels.info, course)
// One runner over the shared pin levels and inputs; only a sim goal marks a lesson done.
const runner = createSimRunner({ sims, pins, inputs, room, onGoal: (id) => course.markComplete(id) })
createRunControls({ container: runControls, course, runner, getValues })
createLessonStrip(panels.strip, course)
createBoardTour({ stage, board, course, container: app })
