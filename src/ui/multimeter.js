// Sim multimeter in the Controls dock, in one of two modes (the Mode select).
// Current: pick the part the meter probes, by clicking it in 3D or with the
// "Meter on" select. Targets come from the circuit table meter list; a target
// owns one or more part ids. Both paths write inputs.setProbe(id); the lesson
// sim shows the reading in its readout line. Current shows only on circuits
// with meter targets.
// Voltage: a click (or a touch tap) on a hole, a leg or a wire end, or a name
// typed in the Point field and Measure, calls onMeasure(name) (a hole or a pin
// name); the explain tools pin the reading there and setReading(text) shows it
// in the dock as well. Works on every lesson with a circuit, running or not.
//
// createMultimeter({ container, stage, board, breadboard, getItems, inputs,
//   onMeasure }) -> { setTargets(targets), setAvailable(on), setEnabled(on),
//   setReading(text), getMode() }
import * as THREE from 'three'
import { holeOrPinAt } from './placement.js'
import { isHole } from '../circuits/holes.js'
import { isPinName } from '../circuits/netlist.js'

// A pointer that moves further than this between down and up is an orbit, not a click.
const CLICK_SLOP_PX = 5
const TOUCH_SLOP_PX = 8

export function createMultimeter({ container, stage, board, breadboard, getItems, inputs, onMeasure = () => {} }) {
  const canvas = stage.renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const box = document.createElement('div')
  box.className = 'meter-box'
  box.hidden = true

  const modeRow = document.createElement('div')
  modeRow.className = 'code-param meter-select'
  const modeLabel = document.createElement('label')
  modeLabel.htmlFor = 'meter-mode'
  modeLabel.textContent = 'Mode'
  const modeSelect = document.createElement('select')
  modeSelect.id = 'meter-mode'
  modeRow.append(modeLabel, modeSelect)

  const row = document.createElement('div')
  row.className = 'code-param meter-select'
  const label = document.createElement('label')
  label.htmlFor = 'meter-probe'
  label.textContent = 'Meter on'
  const select = document.createElement('select')
  select.id = 'meter-probe'
  row.append(label, select)

  // Voltage mode keyboard path: a hole or pin name, then Measure.
  const pointRow = document.createElement('form')
  pointRow.className = 'code-param meter-point'
  const pointLabel = document.createElement('label')
  pointLabel.htmlFor = 'meter-point'
  pointLabel.textContent = 'Point'
  const pointInput = document.createElement('input')
  pointInput.id = 'meter-point'
  pointInput.type = 'text'
  pointInput.autocomplete = 'off'
  pointInput.spellcheck = false
  pointInput.placeholder = '9e or D13'
  const measure = document.createElement('button')
  measure.type = 'submit'
  measure.className = 'meter-measure'
  measure.textContent = 'Measure'
  pointRow.append(pointLabel, pointInput, measure)
  const reading = document.createElement('p')
  reading.className = 'meter-reading'
  reading.setAttribute('role', 'status')
  box.append(modeRow, row, pointRow, reading)
  container.append(box)

  let targets = []
  let available = false
  let mode = 'current'
  let down = null
  let hovering = false
  // Clicks are off while the circuit is being edited; the selects still work.
  let enabled = true

  // Target id owning a part id, or null.
  function targetOf(partId) {
    const target = targets.find((entry) => entry.parts.includes(partId))
    return target ? target.id : null
  }

  // Visible circuit items that belong to a target.
  function measurables() {
    const items = getItems()
    if (!items) return []
    return Object.entries(items).filter(([id, item]) => targetOf(id) && item.group.visible)
  }

  function targetAt(event) {
    const entries = measurables()
    if (entries.length === 0) return null
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, stage.camera)
    const groups = entries.map(([, item]) => item.group)
    const hit = raycaster.intersectObjects(groups, true)[0]
    let object = hit ? hit.object : null
    while (object && !groups.includes(object)) object = object.parent
    return object ? targetOf(object.name) : null
  }

  function setProbe(id) {
    inputs.setProbe(id)
    select.value = id || ''
  }

  function render() {
    box.hidden = !available && targets.length === 0
    const options = [...(targets.length > 0 ? [['current', 'Current']] : []), ['voltage', 'Voltage']]
    if (!options.some(([value]) => value === mode)) mode = options[0][0]
    modeSelect.replaceChildren(...options.map(([value, text]) => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      return option
    }))
    modeSelect.value = mode
    row.hidden = mode !== 'current'
    pointRow.hidden = mode !== 'voltage'
    reading.hidden = mode !== 'voltage' || reading.textContent === ''
  }

  modeSelect.addEventListener('change', () => {
    mode = modeSelect.value
    if (mode === 'voltage') setProbe(null)
    render()
  })
  select.addEventListener('change', () => setProbe(select.value || null))
  pointRow.addEventListener('submit', (event) => {
    event.preventDefault()
    const name = pointInput.value.trim()
    if (name) onMeasure(name)
  })

  canvas.addEventListener('pointerdown', (event) => {
    down = enabled && event.button === 0 ? { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' } : null
  })

  canvas.addEventListener('pointerup', (event) => {
    if (!down || box.hidden) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    const slop = down.touch ? TOUCH_SLOP_PX : CLICK_SLOP_PX
    down = null
    if (moved > slop) return
    if (mode === 'voltage') {
      const name = holeOrPinAt({ stage, board, breadboard, clientX: event.clientX, clientY: event.clientY })
      if (name && (isHole(name) || isPinName(name))) onMeasure(name)
      return
    }
    if (targets.length === 0) return
    const id = targetAt(event)
    if (id) setProbe(id)
  })

  canvas.addEventListener('pointermove', (event) => {
    if (targets.length === 0 || mode !== 'current' || event.buttons !== 0) return
    const on = enabled && targetAt(event) !== null
    if (on === hovering) return
    hovering = on
    canvas.style.cursor = on ? 'pointer' : ''
  })

  // A new circuit: its meter targets, and the mode back to Current when it has some.
  function setTargets(list) {
    targets = list || []
    if (hovering) canvas.style.cursor = ''
    hovering = false
    const none = document.createElement('option')
    none.value = ''
    none.textContent = 'Nothing'
    select.replaceChildren(none, ...targets.map((target) => {
      const option = document.createElement('option')
      option.value = target.id
      option.textContent = target.label
      return option
    }))
    mode = targets.length > 0 ? 'current' : 'voltage'
    setReading('')
    pointInput.value = ''
    setProbe(null)
    render()
  }

  // Voltage mode is there on every lesson with a circuit.
  function setAvailable(on) {
    available = Boolean(on)
    render()
  }

  function setReading(text) {
    reading.textContent = text || ''
    reading.hidden = mode !== 'voltage' || !text
  }

  function setEnabled(on) {
    enabled = Boolean(on)
    down = null
    if (!enabled && hovering) {
      hovering = false
      canvas.style.cursor = ''
    }
  }

  return { setTargets, setAvailable, setEnabled, setReading, getMode: () => mode }
}
