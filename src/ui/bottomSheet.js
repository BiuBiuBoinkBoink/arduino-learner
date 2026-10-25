// Bottom sheet for the compact layout: fixed to the bottom of the workbench,
// in one of three states (peek, half, full; sheetState.js). The header holds a
// drag handle (a button: click or Enter toggles peek and half, ArrowUp and
// ArrowDown expand and collapse, a drag snaps with nextSheetState), the tabs
// (WAI-ARIA tabs, keys from nextTabIndex) and an Expand / Collapse button
// (Expand opens it full, Collapse goes back to peek). Under the header the
// peek slot shows while in peek; the tab panels while half or full.
//
// createBottomSheet({ container, tabs: [{ id, label, element }] }) -> {
//   setState('peek' | 'half' | 'full'), getState(), selectTab(id), getTab(),
//   subscribe(fn), setActive(on), peekSlot }
//
// setActive(true) shows the sheet and moves each tab's element into its panel,
// leaving a placeholder comment where it was; setActive(false) puts every
// element back and hides the sheet. The elements are never rebuilt, so their
// text, caret and listeners stay. subscribe(fn) calls fn({ state, tab }).
import { nextTabIndex } from './tabKeys.js'
import { nextSheetState, sheetHeights, SHEET_STATES } from './sheetState.js'

const DRAG_SLOP_PX = 5

export function createBottomSheet({ container, tabs }) {
  const sheet = document.createElement('section')
  sheet.id = 'bottom-sheet'
  sheet.setAttribute('aria-label', 'Lesson panel')
  sheet.hidden = true

  const handle = document.createElement('button')
  handle.type = 'button'
  handle.className = 'sheet-handle'
  handle.setAttribute('aria-label', 'Resize the lesson panel')
  const bar = document.createElement('span')
  bar.className = 'sheet-handle-bar'
  bar.setAttribute('aria-hidden', 'true')
  handle.append(bar)

  const header = document.createElement('div')
  header.className = 'sheet-header'
  const tabList = document.createElement('div')
  tabList.className = 'sheet-tabs'
  tabList.setAttribute('role', 'tablist')
  tabList.setAttribute('aria-label', 'Lesson panel')
  const expand = document.createElement('button')
  expand.type = 'button'
  expand.className = 'view-button sheet-expand'
  expand.setAttribute('aria-controls', 'bottom-sheet')
  header.append(tabList, expand)

  const peekSlot = document.createElement('div')
  peekSlot.className = 'sheet-peek'

  const panels = document.createElement('div')
  panels.className = 'sheet-panels'

  const entries = tabs.map((tab) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'sheet-tab'
    button.id = 'sheet-tab-' + tab.id
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', 'sheet-panel-' + tab.id)
    button.textContent = tab.label
    const panel = document.createElement('div')
    panel.className = 'sheet-panel'
    panel.id = 'sheet-panel-' + tab.id
    panel.setAttribute('role', 'tabpanel')
    panel.setAttribute('aria-labelledby', button.id)
    tabList.append(button)
    panels.append(panel)
    return { ...tab, button, panel, placeholder: document.createComment(tab.id + ' panel') }
  })

  sheet.append(handle, header, peekSlot, panels)
  container.append(sheet)

  let state = 'peek'
  let tab = entries[0].id
  let active = false
  const listeners = new Set()

  function notify() {
    listeners.forEach((fn) => fn({ state, tab }))
  }

  function render() {
    sheet.dataset.state = state
    peekSlot.hidden = state !== 'peek'
    panels.hidden = state === 'peek'
    const open = state !== 'peek'
    expand.textContent = open ? 'Collapse' : 'Expand'
    expand.setAttribute('aria-expanded', String(open))
    for (const entry of entries) {
      const selected = entry.id === tab
      entry.button.setAttribute('aria-selected', String(selected))
      entry.button.tabIndex = selected ? 0 : -1
      entry.panel.hidden = !selected
    }
  }

  function setState(next) {
    if (!SHEET_STATES.includes(next) || next === state) return
    state = next
    render()
    notify()
  }

  function selectTab(id) {
    if (!entries.some((entry) => entry.id === id) || id === tab) return
    tab = id
    render()
    notify()
  }

  entries.forEach((entry, i) => {
    entry.button.addEventListener('click', () => {
      selectTab(entry.id)
      // A tab picked while peeking opens the sheet so its panel shows.
      if (state === 'peek') setState('half')
    })
    entry.button.addEventListener('keydown', (event) => {
      const next = nextTabIndex(event.key, i, entries.length)
      if (next === null) return
      event.preventDefault()
      selectTab(entries[next].id)
      entries[next].button.focus()
    })
  })

  expand.addEventListener('click', () => setState(state === 'peek' ? 'full' : 'peek'))

  // The handle: click toggles peek and half, unless the click ends a drag.
  let drag = null
  let dragged = false
  handle.addEventListener('click', () => {
    if (dragged) {
      dragged = false
      return
    }
    setState(state === 'peek' ? 'half' : 'peek')
  })
  handle.addEventListener('keydown', (event) => {
    const action = event.key === 'ArrowUp' ? 'expand' : event.key === 'ArrowDown' ? 'collapse' : null
    if (!action) return
    event.preventDefault()
    setState(nextSheetState(state, action))
  })
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    dragged = false
    const height = container.getBoundingClientRect().height
    drag = { id: event.pointerId, y: event.clientY, height, start: sheetHeights(height)[state], dy: 0 }
    try {
      handle.setPointerCapture(event.pointerId)
    } catch {
      // A synthetic pointer cannot be captured; the drag still follows it.
    }
  })
  handle.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return
    drag.dy = event.clientY - drag.y
    if (Math.abs(drag.dy) <= DRAG_SLOP_PX && !sheet.classList.contains('is-dragging')) return
    const { peek, full } = sheetHeights(drag.height)
    sheet.classList.add('is-dragging')
    sheet.style.height = Math.min(full, Math.max(peek, drag.start - drag.dy)) + 'px'
  })
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return
    const moved = sheet.classList.contains('is-dragging')
    sheet.classList.remove('is-dragging')
    sheet.style.height = ''
    if (moved) {
      // Swallows the click that follows this pointer up, and only that one.
      dragged = true
      setTimeout(() => {
        dragged = false
      }, 0)
      setState(nextSheetState(state, { type: 'drag', dy: drag.dy, height: drag.height }))
    }
    drag = null
  }
  handle.addEventListener('pointerup', endDrag)
  handle.addEventListener('pointercancel', endDrag)

  function setActive(on) {
    on = Boolean(on)
    if (on === active) return
    active = on
    for (const entry of entries) {
      if (on) {
        entry.element.before(entry.placeholder)
        entry.panel.append(entry.element)
      } else {
        entry.placeholder.replaceWith(entry.element)
      }
    }
    sheet.hidden = !on
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  render()
  return {
    setState,
    getState: () => state,
    selectTab,
    getTab: () => tab,
    subscribe,
    setActive,
    isActive: () => active,
    peekSlot
  }
}
