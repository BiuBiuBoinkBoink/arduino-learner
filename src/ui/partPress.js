// Press and release on circuit parts tagged userData.pressable (the push
// button). A pointer down over one holds it until the pointer comes up, with
// the orbit camera off meanwhile; a miss orbits as before. The hold button is
// the keyboard path and goes through the same press and release.
import * as THREE from 'three'

export function createPartPress({ stage, getItems, inputs }) {
  const canvas = stage.renderer.domElement
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()

  let pressedId = null
  let pointerId = null
  let hovering = false

  // Visible pressable items in the current circuit, as [id, item] pairs.
  function pressables() {
    const items = getItems()
    if (!items) return []
    return Object.entries(items).filter(([, item]) => item.group.userData.pressable && item.group.visible)
  }

  function idAt(event) {
    const entries = pressables()
    if (entries.length === 0) return null
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, stage.camera)
    const hit = raycaster.intersectObjects(entries.map(([, item]) => item.group), true)[0]
    let object = hit ? hit.object : null
    while (object && !object.userData.pressable) object = object.parent
    return object ? object.name : null
  }

  function press(id) {
    if (pressedId !== null) return
    const items = getItems()
    if (!items || !items[id]) return
    pressedId = id
    inputs.setPressed(id, true)
    items[id].setPressed(true)
    stage.controls.enabled = false
    stage.invalidate()
  }

  function release() {
    if (pressedId === null) return
    const id = pressedId
    pressedId = null
    pointerId = null
    inputs.setPressed(id, false)
    const items = getItems()
    if (items && items[id]) items[id].setPressed(false)
    stage.controls.enabled = true
    stage.invalidate()
  }

  function setHovering(on) {
    if (on === hovering) return
    hovering = on
    canvas.style.cursor = on ? 'pointer' : ''
  }

  // Capture phase, so the orbit controls are off before their own pointerdown runs.
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || pressedId !== null) return
    const id = idAt(event)
    if (!id) return
    press(id)
    pointerId = event.pointerId
    canvas.setPointerCapture(event.pointerId)
  }, { capture: true })

  function onPointerEnd(event) {
    if (pointerId === null || event.pointerId !== pointerId) return
    release()
  }
  canvas.addEventListener('pointerup', onPointerEnd)
  canvas.addEventListener('pointercancel', onPointerEnd)
  canvas.addEventListener('lostpointercapture', onPointerEnd)

  canvas.addEventListener('pointermove', (event) => {
    if (pressedId !== null) return
    setHovering(idAt(event) !== null)
  })

  canvas.addEventListener('pointerleave', () => {
    if (pressedId === null) setHovering(false)
  })

  return { press, release, isPressed: () => pressedId !== null }
}

// "Hold to press" button for the keyboard and for anyone who cannot aim at the
// 3D part. Shown only while setTarget(id) names a pressable part.
export function createHoldButton({ container, partPress, inputs }) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'run-button hold-button'
  button.textContent = 'Hold to press'
  button.setAttribute('aria-pressed', 'false')
  button.hidden = true
  container.append(button)

  let target = null
  let holding = false

  // Releases only a press this button started, never a 3D press in progress.
  function down() {
    if (!target || partPress.isPressed()) return
    partPress.press(target)
    holding = true
  }

  function up() {
    if (!holding) return
    holding = false
    partPress.release()
  }

  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    button.setPointerCapture(event.pointerId)
    down()
  })
  button.addEventListener('pointerup', up)
  button.addEventListener('pointercancel', up)
  button.addEventListener('pointerleave', up)
  button.addEventListener('lostpointercapture', up)
  button.addEventListener('blur', up)
  button.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) down()
  })
  button.addEventListener('keyup', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    up()
  })
  // Stops a long press from opening the touch context menu.
  button.addEventListener('contextmenu', (event) => event.preventDefault())

  // aria-pressed follows the input itself, so a 3D press shows here too.
  inputs.subscribe((id, on) => {
    if (id === target) button.setAttribute('aria-pressed', String(on))
  })

  function setTarget(id) {
    holding = false
    target = id
    button.hidden = !id
    button.setAttribute('aria-pressed', String(Boolean(id) && inputs.isPressed(id)))
  }

  return { setTarget }
}
