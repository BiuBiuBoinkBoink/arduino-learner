// Camera view buttons on the workbench: Top view, 3D view and Reset view.
// Top and 3D show aria-pressed for the current stage view; neither is pressed
// once the learner orbits by hand. The Edit circuit toggle (aria-pressed)
// calls onEdit(on); turning it on moves the camera to the top view framed on
// getEditBox() unless the learner orbited since the last view change, and
// turning it off goes back to the 3D view if edit mode moved the camera.
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
  container.append(editGroup, group)

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
