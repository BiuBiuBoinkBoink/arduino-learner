// Camera view buttons on the workbench: Top view, 3D view and Reset view.
// Top and 3D show aria-pressed for the current stage view; neither is pressed
// once the learner orbits by hand.
export function createViewControls({ container, stage, getFrameBox }) {
  const group = document.createElement('div')
  group.className = 'view-group'
  group.setAttribute('role', 'group')
  group.setAttribute('aria-label', 'Camera view')

  const top = viewButton('Top view', () => setView('top'))
  const threeD = viewButton('3D view', () => setView('3d'))
  const reset = viewButton('Reset view', () => setView('3d'))
  top.setAttribute('aria-pressed', 'false')
  threeD.setAttribute('aria-pressed', 'false')
  group.append(top, threeD, reset)
  container.append(group)

  function sync() {
    const view = stage.getView()
    top.setAttribute('aria-pressed', String(view === 'top'))
    threeD.setAttribute('aria-pressed', String(view === '3d'))
  }

  function setView(kind, opts) {
    const done = stage.setView(kind, getFrameBox(), opts)
    sync()
    return done
  }

  stage.controls.addEventListener('start', sync)
  sync()
  return { setView }
}

function viewButton(text, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'view-button'
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}
