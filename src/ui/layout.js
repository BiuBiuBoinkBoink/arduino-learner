// Screen layout: #app is a grid of a top bar, the guide panel on the left, the
// workbench in the middle (the 3D stage with its overlays) and the code panel
// on the right. The code panel open state lives here; the code panel module
// asks for changes through setCodeOpen.
//
// The layout mode follows the width of #app (a ResizeObserver): 'wide',
// 'medium' or 'compact' (layoutFor in layoutMode.js), set as data-layout on
// #app. All mode CSS keys off that attribute. getMode() reads it and
// subscribeMode(fn) calls fn(mode) when it changes. In compact mode the
// controls dock folds behind a Controls button (aria-expanded).
import { layoutFor } from './layoutMode.js'

export function createLayout(app) {
  const topBar = document.createElement('header')
  topBar.id = 'top-bar'

  const guide = document.createElement('aside')
  guide.id = 'guide-panel'
  guide.setAttribute('aria-label', 'Lesson guide')

  const workbench = document.createElement('main')
  workbench.id = 'workbench'
  workbench.setAttribute('aria-label', 'Workbench')
  const stageEl = document.createElement('div')
  stageEl.id = 'stage'
  const runBar = document.createElement('div')
  runBar.id = 'run-bar'
  const viewControls = document.createElement('div')
  viewControls.id = 'view-controls'
  const dock = document.createElement('div')
  dock.id = 'controls-dock'
  const dockHeading = document.createElement('p')
  dockHeading.className = 'dock-heading'
  dockHeading.textContent = 'Controls'
  dock.append(dockHeading)
  const dockToggle = document.createElement('button')
  dockToggle.type = 'button'
  dockToggle.className = 'view-button dock-toggle'
  dockToggle.textContent = 'Controls'
  dockToggle.setAttribute('aria-controls', 'controls-dock')
  dockToggle.setAttribute('aria-expanded', 'false')
  dockToggle.addEventListener('click', () => setDockOpen(dockToggle.getAttribute('aria-expanded') !== 'true'))
  workbench.append(stageEl, runBar, viewControls, dock, dockToggle)

  const codePanel = document.createElement('aside')
  codePanel.id = 'code-panel'
  codePanel.setAttribute('aria-label', 'Code')

  app.append(topBar, guide, workbench, codePanel)

  let codeOpen = true
  const listeners = new Set()
  const modeListeners = new Set()

  function setCodeOpen(on) {
    codeOpen = Boolean(on)
    codePanel.classList.toggle('is-closed', !codeOpen)
    listeners.forEach((fn) => fn(codeOpen))
  }

  function subscribeCode(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  function setDockOpen(on) {
    dockToggle.setAttribute('aria-expanded', String(Boolean(on)))
    dock.classList.toggle('is-open', Boolean(on))
  }

  let mode = null
  function setMode(next) {
    if (next === mode) return
    mode = next
    app.dataset.layout = mode
    if (mode !== 'compact') setDockOpen(false)
    modeListeners.forEach((fn) => fn(mode))
  }

  function subscribeMode(fn) {
    modeListeners.add(fn)
    return () => modeListeners.delete(fn)
  }

  setMode(layoutFor(app.getBoundingClientRect().width || window.innerWidth))
  new ResizeObserver((entries) => {
    const entry = entries[entries.length - 1]
    if (entry) setMode(layoutFor(entry.contentRect.width))
  }).observe(app)

  return {
    topBar,
    guide,
    workbench,
    stageEl,
    runBar,
    viewControls,
    dock,
    codePanel,
    setCodeOpen,
    isCodeOpen: () => codeOpen,
    subscribeCode,
    getMode: () => mode,
    subscribeMode
  }
}
