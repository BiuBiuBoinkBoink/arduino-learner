// Camera view buttons on the workbench: Top view, 3D view and Reset view.
// Top and 3D show aria-pressed for the current stage view; neither is pressed
// once the learner orbits by hand. The Edit circuit toggle (aria-pressed)
// calls onEdit(on); turning it on moves the camera to the top view framed on
// getEditBox() unless the learner orbited since the last view change, and
// turning it off goes back to the 3D view if edit mode moved the camera.
// In the compact layout the buttons fold into a View button (aria-expanded)
// that opens them as a small popover; Escape, a click outside or a choice
// closes it. Outside compact the View button is hidden by CSS.
export function createViewControls({ container, stage, getFrameBox, getEditBox = getFrameBox, onEdit = () => {} }) {
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
  const edit = viewButton('Edit circuit', () => setEditing(!editing))
  edit.classList.add('edit-button')
  edit.setAttribute('aria-pressed', 'false')
  const editGroup = document.createElement('div')
  editGroup.className = 'view-group'
  editGroup.append(edit)
  const menu = document.createElement('div')
  menu.className = 'view-menu'
  menu.id = 'view-menu'
  menu.append(editGroup, group)
  const toggle = viewButton('View', () => setMenuOpen(!menuOpen))
  toggle.classList.add('view-toggle')
  toggle.setAttribute('aria-controls', 'view-menu')
  toggle.setAttribute('aria-expanded', 'false')
  container.append(toggle, menu)

  let menuOpen = false
  function setMenuOpen(on, returnFocus = false) {
    menuOpen = Boolean(on)
    toggle.setAttribute('aria-expanded', String(menuOpen))
    container.classList.toggle('is-open', menuOpen)
    if (!menuOpen && returnFocus) toggle.focus()
  }
  // A choice closes the popover; Escape returns focus to the View button.
  menu.addEventListener('click', (event) => {
    if (menuOpen && event.target.closest('button')) setMenuOpen(false, true)
  })
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menuOpen) return
    event.preventDefault()
    event.stopPropagation()
    setMenuOpen(false, true)
  })
  document.addEventListener('pointerdown', (event) => {
    if (menuOpen && !container.contains(event.target)) setMenuOpen(false)
  })

  let editing = false
  let orbited = false
  let editMoved = false

  function sync() {
    const view = stage.getView()
    top.setAttribute('aria-pressed', String(view === 'top'))
    threeD.setAttribute('aria-pressed', String(view === '3d'))
  }

  function setView(kind, opts, box = getFrameBox()) {
    orbited = false
    const done = stage.setView(kind, box, opts)
    sync()
    return done
  }

  function setEditing(on) {
    on = Boolean(on)
    if (on === editing) return
    editing = on
    edit.setAttribute('aria-pressed', String(on))
    if (on) {
      editMoved = !orbited
      if (editMoved) setView('top', undefined, getEditBox())
    } else if (editMoved) {
      editMoved = false
      setView('3d')
    }
    onEdit(on)
  }

  // Edit circuit shows only on lessons with a circuit; hiding it leaves edit mode.
  function setEditAvailable(on) {
    editGroup.hidden = !on
    if (!on) setEditing(false)
  }

  stage.controls.addEventListener('start', () => {
    orbited = true
    sync()
  })
  sync()
  return { setView, setEditing, setEditAvailable, isEditing: () => editing }
}

function viewButton(text, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'view-button'
  button.textContent = text
  button.addEventListener('click', onClick)
  return button
}
