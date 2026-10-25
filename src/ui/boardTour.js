// Board tour for lessons with a tour field: hover labels and clickable zones on
// the board, plus a tour card with a checklist as the keyboard path. Zone names
// and text come from the lesson data. Opened zones live in memory only.
// onComplete(lessonId) runs once when every zone of the lesson is opened.
// Returns { setEnabled(on), reset(lessonId) }: main.js turns the tour on only
// while the current step is the tour step, and reset forgets a lesson's opened
// zones (Start this lesson again).
import * as THREE from 'three'
import { createTour } from '../sim/tour.js'

const CLICK_SLOP = 5
const HIGHLIGHT = new THREE.Color(0x2f6fd6)
const HIGHLIGHT_INTENSITY = 0.45
const NO_GLOW = new THREE.Color(0x000000)

export function createBoardTour({ stage, board, course, container, onComplete }) {
  const canvas = stage.renderer.domElement
  const zoneObjects = Object.values(board.zones)
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const tours = new Map()

  const label = document.createElement('div')
  label.className = 'tour-label'
  label.hidden = true

  const card = document.createElement('section')
  card.className = 'tour-card'
  card.setAttribute('aria-label', 'Board tour')
  card.hidden = true
  const heading = document.createElement('h2')
  heading.className = 'tour-heading'
  const text = document.createElement('p')
  text.className = 'tour-text'
  const progress = document.createElement('p')
  progress.className = 'tour-progress'
  progress.setAttribute('aria-live', 'polite')
  const checklist = document.createElement('div')
  checklist.className = 'tour-checklist'
  card.append(heading, text, progress, checklist)

  container.append(card, label)

  let active = null
  let enabled = true
  let hovered = null
  let down = null

  function stateFor(lesson) {
    if (!tours.has(lesson.id)) {
      tours.set(lesson.id, { tour: createTour(lesson.tour.map((entry) => entry.zone)), last: null })
    }
    return tours.get(lesson.id)
  }

  function entryFor(zoneId) {
    return active.lesson.tour.find((entry) => entry.zone === zoneId)
  }

  function setHighlight(zoneId, on) {
    board.zones[zoneId].traverse((object) => {
      if (!object.isMesh) return
      object.material.emissive.copy(on ? HIGHLIGHT : NO_GLOW)
      object.material.emissiveIntensity = on ? HIGHLIGHT_INTENSITY : 1
    })
  }

  function setHovered(zoneId) {
    if (zoneId === hovered) return
    if (hovered) setHighlight(hovered, false)
    hovered = zoneId
    if (hovered) setHighlight(hovered, true)
    canvas.style.cursor = hovered ? 'pointer' : ''
    if (!hovered) label.hidden = true
    stage.invalidate()
  }

  function zoneAt(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, stage.camera)
    const hit = raycaster.intersectObjects(zoneObjects, true)[0]
    let object = hit ? hit.object : null
    while (object && !object.userData.zoneId) object = object.parent
    return object ? object.userData.zoneId : null
  }

  function moveLabel(event) {
    label.style.left = event.clientX + 14 + 'px'
    label.style.top = event.clientY + 14 + 'px'
  }

  canvas.addEventListener('pointermove', (event) => {
    if (!active || !enabled) return
    const zoneId = zoneAt(event)
    setHovered(zoneId)
    if (zoneId) {
      label.textContent = entryFor(zoneId).label
      label.hidden = false
      moveLabel(event)
    }
  })

  canvas.addEventListener('pointerleave', () => {
    if (active) setHovered(null)
  })

  canvas.addEventListener('pointerdown', (event) => {
    if (!active || !enabled || event.button !== 0) return
    down = { x: event.clientX, y: event.clientY, zoneId: zoneAt(event) }
  })

  canvas.addEventListener('pointerup', (event) => {
    const start = down
    down = null
    if (!active || !enabled || !start || !start.zoneId) return
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
    if (moved < CLICK_SLOP && zoneAt(event) === start.zoneId) open(start.zoneId)
  })

  function open(zoneId) {
    const { lesson, state } = active
    state.last = zoneId
    if (state.tour.open(zoneId)) onComplete(lesson.id)
    renderCard()
  }

  function renderCard() {
    const { lesson, state } = active
    const { tour } = state
    const entry = state.last ? entryFor(state.last) : null
    heading.textContent = entry ? entry.label : 'Board tour'
    text.textContent = entry ? entry.text : 'Point at a part of the board and click it, or pick a part below.'
    progress.textContent = tour.isComplete()
      ? 'All ' + tour.total + ' parts opened.'
      : tour.openedCount() + ' of ' + tour.total + ' parts opened'
    checklist.replaceChildren(...lesson.tour.map((item) => {
      const isOpened = tour.isOpened(item.zone)
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'tour-item'
      button.setAttribute('aria-pressed', String(isOpened))
      const mark = document.createElement('span')
      mark.className = 'tour-item-mark'
      mark.setAttribute('aria-hidden', 'true')
      const name = document.createElement('span')
      name.textContent = item.label
      button.append(mark, name)
      button.addEventListener('click', () => {
        open(item.zone)
        checklist.children[lesson.tour.indexOf(item)].focus()
      })
      return button
    }))
  }

  function render({ lesson }) {
    if (active && active.lesson === lesson) return
    down = null
    setHovered(null)
    if (!lesson.tour) {
      active = null
      card.hidden = true
      return
    }
    active = { lesson, state: stateFor(lesson) }
    card.hidden = !enabled
    renderCard()
  }

  function setEnabled(on) {
    if (Boolean(on) === enabled) return
    enabled = Boolean(on)
    down = null
    if (!enabled) setHovered(null)
    card.hidden = !(active && enabled)
  }

  function reset(lessonId) {
    tours.delete(lessonId)
    if (active && active.lesson.id === lessonId) {
      active = { lesson: active.lesson, state: stateFor(active.lesson) }
      renderCard()
    }
  }

  render(course.getState())
  course.subscribe(render)
  return { setEnabled, reset }
}
