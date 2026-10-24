// Screen layout: #app is a grid of a top bar, the guide panel on the left, the
// workbench in the middle (the 3D stage with its overlays) and the code panel
// on the right. The code panel open state lives here; the code panel module
// asks for changes through setCodeOpen.
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
  workbench.append(stageEl, runBar, viewControls, dock)

  const codePanel = document.createElement('aside')
  codePanel.id = 'code-panel'
  codePanel.setAttribute('aria-label', 'Code')

  app.append(topBar, guide, workbench, codePanel)

  let codeOpen = true
  const listeners = new Set()

  function setCodeOpen(on) {
    codeOpen = Boolean(on)
    codePanel.classList.toggle('is-closed', !codeOpen)
    listeners.forEach((fn) => fn(codeOpen))
  }

  function subscribeCode(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

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
    subscribeCode
  }
}
