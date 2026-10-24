// Sim multimeter: pick the part the meter probes, by clicking it in 3D or with
// the "Meter on" select. Targets come from the circuit table meter list; a
// target owns one or more part ids. Both paths write inputs.setProbe(id); the
// lesson sim shows the reading in its readout line.
import * as THREE from 'three'

// A pointer that moves further than this between down and up is an orbit, not a click.
const CLICK_SLOP_PX = 5

export function createMultimeter({ container, stage, getItems, inputs }) {
  const canvas = stage.renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  const row = document.createElement('div')
  row.className = 'code-param meter-select'
  const label = document.createElement('label')
  label.htmlFor = 'meter-probe'
  label.textContent = 'Meter on'
  const select = document.createElement('select')
  select.id = 'meter-probe'
  row.append(label, select)
  row.hidden = true
  container.append(row)

  let targets = []
  let down = null
  let hovering = false

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

  select.addEventListener('change', () => setProbe(select.value || null))

  canvas.addEventListener('pointerdown', (event) => {
    down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null
  })

  canvas.addEventListener('pointerup', (event) => {
    if (!down || targets.length === 0) return
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
    down = null
    if (moved > CLICK_SLOP_PX) return
    const id = targetAt(event)
    if (id) setProbe(id)
  })

  canvas.addEventListener('pointermove', (event) => {
    if (targets.length === 0 || event.buttons !== 0) return
    const on = targetAt(event) !== null
    if (on === hovering) return
    hovering = on
    canvas.style.cursor = on ? 'pointer' : ''
  })

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
    row.hidden = targets.length === 0
    setProbe(null)
  }

  return { setTargets }
}
