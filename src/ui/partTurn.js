// Turn circuit parts tagged userData.turnable (the potentiometer) by dragging
// up or down over them, with the orbit camera off meanwhile; a miss orbits as
// before. The Knob slider is the keyboard path and goes through setValue.
import * as THREE from 'three'

// Drag this many pixels up to go from 0 to 1.
const DRAG_RANGE_PX = 200

export function createPartTurn({ stage, getItems, inputs }) {
  const canvas = stage.renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  let turningId = null
  let pointerId = null
  let startValue = 0
  let startY = 0
  let hovering = false
  // Off while the circuit is being edited.
  let enabled = true

  // Visible turnable items in the current circuit, as [id, item] pairs.
  function turnables() {
    const items = getItems()
    if (!items) return []
    return Object.entries(items).filter(([, item]) => item.group.userData.turnable && item.group.visible)
  }

  function idAt(event) {
    const entries = turnables()
    if (entries.length === 0) return null
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, stage.camera)
    const hit = raycaster.intersectObjects(entries.map(([, item]) => item.group), true)[0]
    let object = hit ? hit.object : null
    while (object && !object.userData.turnable) object = object.parent
    return object ? object.name : null
  }

  // Writes the knob value to the inputs and the 3D part.
  function setValue(id, v) {
    const value = Math.min(1, Math.max(0, v))
    inputs.setValue(id, value)
    const items = getItems()
    if (items && items[id]) items[id].setValue(value)
    stage.invalidate()
  }

  function release() {
    if (turningId === null) return
    turningId = null
    pointerId = null
    stage.controls.enabled = true
    stage.invalidate()
  }

  function setHovering(on) {
    if (on === hovering) return
    hovering = on
    canvas.style.cursor = on ? 'ns-resize' : ''
  }

  // Capture phase, so the orbit controls are off before their own pointerdown runs.
  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled || event.button !== 0 || turningId !== null) return
    const id = idAt(event)
    if (!id) return
    turningId = id
    pointerId = event.pointerId
    startValue = inputs.getValue(id)
    startY = event.clientY
    stage.controls.enabled = false
    canvas.setPointerCapture(event.pointerId)
  }, { capture: true })

  canvas.addEventListener('pointermove', (event) => {
    if (turningId !== null) {
      if (event.pointerId !== pointerId) return
      setValue(turningId, startValue + (startY - event.clientY) / DRAG_RANGE_PX)
      return
    }
    setHovering(enabled && idAt(event) !== null)
  })

  function onPointerEnd(event) {
    if (pointerId === null || event.pointerId !== pointerId) return
    release()
  }
  canvas.addEventListener('pointerup', onPointerEnd)
  canvas.addEventListener('pointercancel', onPointerEnd)
  canvas.addEventListener('lostpointercapture', onPointerEnd)

  canvas.addEventListener('pointerleave', () => {
    if (turningId === null) setHovering(false)
  })

  function setEnabled(on) {
    enabled = Boolean(on)
    if (!enabled) {
      release()
      setHovering(false)
    }
  }

  return { setValue, release, setEnabled }
}

// "Knob" range slider for the keyboard and for anyone who cannot drag the 3D
// part. Shown only while setTarget(id) names a turnable part; its value
// follows the input both ways, 0 to 1023 like analogRead.
export function createKnobSlider({ container, partTurn, inputs }) {
  const MAX = 1023
  const row = document.createElement('div')
  row.className = 'code-param knob-slider'
  const label = document.createElement('label')
  label.htmlFor = 'knob-slider'
  label.textContent = 'Knob'
  const output = document.createElement('output')
  output.className = 'code-param-value'
  output.htmlFor = 'knob-slider'
  const input = document.createElement('input')
  input.type = 'range'
  input.id = 'knob-slider'
  input.min = '0'
  input.max = String(MAX)
  input.step = '1'
  const top = document.createElement('div')
  top.className = 'code-param-top'
  top.append(label, output)
  row.append(top, input)
  row.hidden = true
  container.append(row)

  let target = null

  function show(value) {
    const raw = Math.round(value * MAX)
    input.value = String(raw)
    const text = raw + ' of ' + MAX
    output.textContent = String(raw)
    input.setAttribute('aria-valuetext', text)
  }

  input.addEventListener('input', () => {
    if (target) partTurn.setValue(target, Number(input.value) / MAX)
  })

  // Presses share the listeners and arrive as booleans; only knob numbers count.
  inputs.subscribe((id, value) => {
    if (id === target && typeof value === 'number') show(value)
  })

  function setTarget(id) {
    target = id
    row.hidden = !id
    if (id) show(inputs.getValue(id))
  }

  return { setTarget }
}
