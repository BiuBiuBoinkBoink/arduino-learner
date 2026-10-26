// Parts tray: the lesson kit at the bottom of the workbench while the circuit
// is being edited. Row 1 has one button per kit part (pick it up), Jumper
// wires (the wire tool), Undo and Reset circuit; row 2 the placement status
// and, while wiring, the wire colour; row 3 the keyboard path: a Hole input
// while carrying, From and To while bending a part or drawing a wire.
// setStep({ pulse, later }): parts of the current step pulse (an accent ring),
// parts of later steps say Later and cannot be picked up.
// After a tap on the board (touch, placement's touchReady) a floating row
// above the tray offers Place, Turn (parts with more than one orientation)
// and Cancel. Each kit part has a small ? button beside it (aria-label 'About
// the <part>') that calls onAbout(id) to open its part card.
import { isHole } from '../circuits/holes.js'
import { isPinName } from '../circuits/netlist.js'
import { orientationCount } from '../circuits/footprints.js'

const SVG = 'http://www.w3.org/2000/svg'
const RESET_CONFIRM_MS = 3000
const COLOURS = ['Auto', 'Red', 'Black', 'Yellow', 'Green', 'Blue', 'Orange', 'White']

function svgEl(name, attrs) {
  const el = document.createElementNS(SVG, name)
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
  return el
}

const leg = (x1, y1, x2, y2) => svgEl('line', { x1, y1, x2, y2, stroke: '#8a9099', 'stroke-width': 1.5 })

// A simple flat drawing per part type, 28 px square.
const ICONS = {
  led: () => [leg(11, 17, 11, 26), leg(17, 17, 17, 23), svgEl('path', { d: 'M7 18 V11 a7 7 0 0 1 14 0 V18 Z', fill: '#d0312d' })],
  resistor: () => [
    leg(2, 14, 26, 14),
    svgEl('rect', { x: 7, y: 10, width: 14, height: 8, rx: 3, fill: '#d8b98a' }),
    svgEl('rect', { x: 10, y: 10, width: 2, height: 8, fill: '#d0312d' }),
    svgEl('rect', { x: 13, y: 10, width: 2, height: 8, fill: '#d0312d' }),
    svgEl('rect', { x: 17, y: 10, width: 2, height: 8, fill: '#b8902a' })
  ],
  button: () => [svgEl('rect', { x: 5, y: 5, width: 18, height: 18, rx: 2, fill: '#3a3f47' }), svgEl('circle', { cx: 14, cy: 14, r: 5, fill: '#1d2330' })],
  potentiometer: () => [
    leg(8, 20, 8, 26), leg(14, 20, 14, 26), leg(20, 20, 20, 26),
    svgEl('circle', { cx: 14, cy: 12, r: 9, fill: '#2c6fd1' }),
    svgEl('line', { x1: 14, y1: 12, x2: 14, y2: 5, stroke: '#ffffff', 'stroke-width': 2 })
  ],
  tmp36: () => [leg(9, 17, 9, 26), leg(14, 17, 14, 26), leg(19, 17, 19, 26), svgEl('path', { d: 'M5 17 A9 9 0 0 1 23 17 Z', fill: '#1d2330' })],
  servo: () => [
    svgEl('rect', { x: 3, y: 10, width: 18, height: 13, rx: 2, fill: '#2c6fd1' }),
    svgEl('rect', { x: 9, y: 5, width: 16, height: 4, rx: 2, fill: '#f2f2f2', stroke: '#8a9099' }),
    svgEl('circle', { cx: 11, cy: 7, r: 2.5, fill: '#8a9099' })
  ],
  rgbLed: () => [
    leg(8, 17, 8, 25), leg(12, 17, 12, 27), leg(16, 17, 16, 25), leg(20, 17, 20, 25),
    svgEl('path', { d: 'M6 18 V11 a8 8 0 0 1 16 0 V18 Z', fill: '#e8e8f0', stroke: '#8a9099' })
  ],
  buzzer: () => [svgEl('circle', { cx: 14, cy: 14, r: 10, fill: '#1d2330' }), svgEl('circle', { cx: 14, cy: 14, r: 2.5, fill: '#5d6676' })],
  ldr: () => [
    leg(11, 20, 11, 27), leg(17, 20, 17, 27),
    svgEl('circle', { cx: 14, cy: 12, r: 9, fill: '#e8a33d' }),
    svgEl('path', { d: 'M8 9 H19 M9 12 H19 M8 15 H19', stroke: '#8a3b12', 'stroke-width': 1.2, fill: 'none' })
  ],
  wire: () => [svgEl('path', { d: 'M4 24 C4 4 24 4 24 24', stroke: '#2c6fd1', 'stroke-width': 2.5, fill: 'none' })]
}

// The drawing of a part type, size px square (the part card shows it at 96).
export function partIcon(type, size = 28) {
  const svg = svgEl('svg', { width: size, height: size, viewBox: '0 0 28 28', 'aria-hidden': 'true', class: 'tray-icon' })
  const draw = ICONS[type] || ICONS.button
  svg.append(...draw())
  return svg
}

function itemButton(type) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'tray-item'
  const text = document.createElement('span')
  text.className = 'tray-item-text'
  const name = document.createElement('span')
  name.className = 'tray-item-name'
  const sub = document.createElement('span')
  sub.className = 'tray-item-sub'
  text.append(name, sub)
  button.append(partIcon(type), text)
  return { button, name, sub }
}

function touchButton(text, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'tray-action tray-touch-button'
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}

function field(id, labelText) {
  const wrap = document.createElement('div')
  wrap.className = 'tray-field'
  const label = document.createElement('label')
  label.htmlFor = id
  label.textContent = labelText
  const input = document.createElement('input')
  input.type = 'text'
  input.id = id
  input.autocomplete = 'off'
  input.spellcheck = false
  input.size = 5
  wrap.append(label, input)
  return { wrap, input }
}

export function createPartsTray({ container, workbench, placement, kitLabels, onAbout = () => {} }) {
  const tray = document.createElement('div')
  tray.id = 'parts-tray'
  tray.setAttribute('role', 'region')
  tray.setAttribute('aria-label', 'Parts tray')
  tray.hidden = true

  const row1 = document.createElement('div')
  row1.className = 'tray-row'
  const label = document.createElement('span')
  label.className = 'tray-label'
  label.textContent = 'Parts'
  const items = document.createElement('div')
  items.className = 'tray-items'
  const wireItem = itemButton('wire')
  wireItem.button.classList.add('tray-wires')
  wireItem.name.textContent = 'Jumper wires'
  wireItem.button.setAttribute('aria-pressed', 'false')
  const undo = document.createElement('button')
  undo.type = 'button'
  undo.className = 'tray-action'
  undo.textContent = 'Undo'
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.className = 'tray-action'
  reset.textContent = 'Reset circuit'
  const actions = document.createElement('div')
  actions.className = 'tray-actions'
  actions.append(undo, reset)
  row1.append(label, items, actions)

  const row2 = document.createElement('div')
  row2.className = 'tray-row tray-status-row'
  const status = document.createElement('p')
  status.className = 'tray-status'
  status.setAttribute('role', 'status')
  const colourWrap = document.createElement('div')
  colourWrap.className = 'tray-field'
  const colourLabel = document.createElement('label')
  colourLabel.htmlFor = 'wire-colour'
  colourLabel.textContent = 'Colour'
  const colour = document.createElement('select')
  colour.id = 'wire-colour'
  for (const name of COLOURS) {
    const option = document.createElement('option')
    option.value = name.toLowerCase()
    option.textContent = name
    colour.append(option)
  }
  colourWrap.append(colourLabel, colour)
  colourWrap.hidden = true
  row2.append(status, colourWrap)

  const row3 = document.createElement('form')
  row3.className = 'tray-row tray-keys'
  row3.hidden = true

  const touchRow = document.createElement('div')
  touchRow.className = 'tray-touch'
  touchRow.setAttribute('role', 'group')
  touchRow.setAttribute('aria-label', 'Place the part')
  touchRow.hidden = true
  const touchPlace = touchButton('Place', () => placement.confirm())
  touchPlace.classList.add('is-primary')
  const touchTurn = touchButton('Turn', () => placement.rotate())
  const touchCancel = touchButton('Cancel', () => placement.cancel())
  touchRow.append(touchPlace, touchTurn, touchCancel)

  tray.append(touchRow, row1, row2, row3)
  container.append(tray)

  let partButtons = new Map()
  let kitKey = null
  let keysKey = null
  let inputs = {}
  let resetTimer = null
  let stepParts = { pulse: [], later: [] }

  function disarmReset() {
    clearTimeout(resetTimer)
    resetTimer = null
    reset.textContent = 'Reset circuit'
  }

  reset.addEventListener('click', () => {
    if (resetTimer === null) {
      reset.textContent = 'Click again to reset'
      resetTimer = setTimeout(disarmReset, RESET_CONFIRM_MS)
      return
    }
    disarmReset()
    workbench.reset()
  })
  undo.addEventListener('click', () => workbench.undo())
  wireItem.button.addEventListener('click', (event) => {
    const on = placement.getState().mode !== 'wire'
    placement.toggleWire(on)
    if (on && event.detail === 0 && inputs.from) inputs.from.focus()
  })
  colour.addEventListener('change', () => placement.setWireColor(colour.value))

  // Kit part buttons, made again only when the kit changes.
  function renderKit(trayState) {
    const key = trayState.parts.map((part) => part.id + ':' + part.type).join()
    if (key === kitKey) return
    kitKey = key
    partButtons = new Map()
    const labels = kitLabels()
    items.replaceChildren()
    for (const part of trayState.parts) {
      const item = itemButton(part.type)
      item.name.textContent = labels[part.id] || part.id
      item.button.addEventListener('click', (event) => {
        const state = placement.getState()
        if (state.id === part.id && state.mode !== 'idle') {
          placement.cancel()
          if (placement.getState().mode !== 'idle') placement.cancel()
          return
        }
        placement.pick(part.id)
        const first = inputs.hole || inputs.from
        if (event.detail === 0 && first) first.focus()
      })
      partButtons.set(part.id, item)
      const about = document.createElement('button')
      about.type = 'button'
      about.className = 'tray-about'
      about.textContent = '?'
      about.setAttribute('aria-label', 'About the ' + (labels[part.id] || part.id))
      about.addEventListener('click', () => onAbout(part.id))
      const wrap = document.createElement('span')
      wrap.className = 'tray-item-wrap'
      wrap.append(item.button, about)
      items.append(wrap)
    }
    items.append(wireItem.button)
  }

  // Name typed into a keyboard field: a hole, or a pin when pins are allowed.
  function readName(input, pins) {
    const text = input.value.trim()
    const name = /^(t|b)[+-]\d+$/i.test(text) ? text.toUpperCase() : /^\d+[a-j]$/i.test(text) ? text.toLowerCase() : text
    if (isHole(name) || (pins && isPinName(name))) return name
    placement.showMessage(`There is no hole called ${text}.`)
    return null
  }

  function submitKeys() {
    const state = placement.getState()
    if (state.mode === 'carry') {
      const hole = readName(inputs.hole, false)
      if (hole && placement.placeAt(hole)) placement.confirm()
    } else if (state.mode === 'bend' || state.mode === 'wire') {
      if (state.step === 1) {
        const from = readName(inputs.from, state.mode === 'wire')
        if (!from || !placement.placeAt(from) || !placement.confirm()) return
      }
      const to = readName(inputs.to, false)
      if (to && placement.placeAt(to) && placement.confirm() && state.mode === 'wire') {
        inputs.from.value = ''
        inputs.to.value = ''
        inputs.from.focus()
      }
    }
  }

  row3.addEventListener('submit', (event) => {
    event.preventDefault()
    submitKeys()
  })

  // The keyboard row, made again only when the kind of placement changes.
  function renderKeys(state) {
    const key = state.mode === 'idle' ? '' : state.mode === 'carry' ? 'carry' : 'ends'
    if (key === keysKey) return
    const hadFocus = row3.contains(document.activeElement)
    keysKey = key
    inputs = {}
    row3.replaceChildren()
    row3.hidden = key === ''
    if (key === '') {
      if (hadFocus && state.id === null) {
        const item = lastPicked && partButtons.get(lastPicked)
        if (item) item.button.focus()
      }
      return
    }
    if (key === 'carry') {
      const hole = field('place-hole', 'Hole')
      inputs.hole = hole.input
      row3.append(hole.wrap)
    } else {
      const from = field('place-from', 'From')
      const to = field('place-to', 'To')
      inputs.from = from.input
      inputs.to = to.input
      row3.append(from.wrap, to.wrap)
    }
    const place = document.createElement('button')
    place.type = 'submit'
    place.className = 'tray-action'
    place.textContent = 'Place'
    row3.append(place)
  }

  let lastPicked = null
  function render() {
    const trayState = workbench.tray()
    const state = placement.getState()
    if (state.id) lastPicked = state.id
    renderKit(trayState)
    for (const part of trayState.parts) {
      const item = partButtons.get(part.id)
      if (!item) continue
      const later = stepParts.later.includes(part.id)
      item.sub.textContent = later ? 'Later' : !part.placed ? 'In the tray' : part.prebuilt ? 'Built earlier' : 'Placed'
      item.button.disabled = later
      item.button.classList.toggle('is-pulsing', stepParts.pulse.includes(part.id) && !part.placed && !later)
      const carried = state.id === part.id && (state.mode === 'carry' || state.mode === 'bend')
      item.button.classList.toggle('is-carried', carried)
      item.button.setAttribute('aria-pressed', String(carried))
    }
    const { total, used } = trayState.wires
    wireItem.sub.textContent = `${total - used} of ${total} left`
    wireItem.button.setAttribute('aria-pressed', String(state.mode === 'wire'))
    wireItem.button.classList.toggle('is-carried', state.mode === 'wire')
    undo.disabled = !workbench.canUndo()
    status.textContent = state.status
    colourWrap.hidden = state.mode !== 'wire'
    colour.value = state.wireColor
    renderKeys(state)
    touchRow.hidden = !state.touchReady
    const part = state.id ? workbench.kitPart(state.id) : null
    touchTurn.hidden = !(state.mode === 'carry' && part && orientationCount(part.type) > 1)
  }

  // A new lesson may bring a kit with the same ids but other labels.
  workbench.subscribe((event) => {
    if (event.type === 'load') kitKey = null
    render()
  })
  placement.subscribe(render)

  function setVisible(on) {
    tray.hidden = !on
    if (!on) disarmReset()
    if (on) {
      kitKey = null
      render()
    }
  }

  function setStep({ pulse = [], later = [] } = {}) {
    stepParts = { pulse: pulse.slice(), later: later.slice() }
    render()
  }

  return { setVisible, render, setStep }
}
