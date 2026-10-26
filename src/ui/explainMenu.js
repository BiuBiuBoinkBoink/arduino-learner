// Explain menu: an Explain button with the view buttons (inside the View
// popover in the compact layout) that opens a popover with one row per tool.
// Toggle rows are one aria-pressed button; choice rows have a label, a select
// and a Show button; input rows a label, a text field and a Show button. A row
// that cannot work right now is disabled, with its reason in muted text under
// it. The status line (role="status") shows the text the last tool returned.
// Escape closes the popover and returns focus to the Explain button (the View
// button in compact); a pointer down outside closes it.
//
// createExplainMenu({ container, addToView, closeView, rows }) -> { open(),
//   close(returnFocus), isOpen(), refresh(), setStatus(text) }
// rows: [{ id, label, kind: 'toggle', pressed(), run(on) }
//      | { id, label, kind: 'choice', options() -> [{ value, label }], run(value) }
//      | { id, label, kind: 'input', placeholder, run(text) }], each with an
// optional reason() -> null or the text that disables it. run returns (or
// resolves to) { ok, text }.
export function createExplainMenu({ container, addToView, closeView = () => {}, rows }) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'view-button explain-toggle'
  button.textContent = 'Explain'
  button.setAttribute('aria-expanded', 'false')
  button.setAttribute('aria-controls', 'explain-menu')
  const group = document.createElement('div')
  group.className = 'view-group explain-group'
  group.append(button)
  addToView(group)

  const popover = document.createElement('div')
  popover.className = 'explain-menu'
  popover.id = 'explain-menu'
  popover.setAttribute('role', 'group')
  popover.setAttribute('aria-label', 'Explain tools')
  popover.hidden = true
  const heading = document.createElement('p')
  heading.className = 'explain-heading'
  heading.textContent = 'Explain'
  const list = document.createElement('ul')
  list.className = 'explain-rows'
  const status = document.createElement('p')
  status.className = 'explain-status'
  status.setAttribute('role', 'status')
  popover.append(heading, list, status)
  container.append(popover)

  const views = rows.map(buildRow)
  list.append(...views.map((view) => view.item))

  function buildRow(row) {
    const item = document.createElement('li')
    item.className = 'explain-row'
    item.dataset.tool = row.id
    const reason = document.createElement('p')
    reason.className = 'explain-reason'
    reason.id = 'explain-reason-' + row.id
    reason.hidden = true
    const view = { row, item, reason, controls: [], toggle: null, field: null, optionsKey: null }
    if (row.kind === 'toggle') {
      const toggle = document.createElement('button')
      toggle.type = 'button'
      toggle.className = 'explain-row-toggle'
      toggle.textContent = row.label
      toggle.setAttribute('aria-pressed', 'false')
      toggle.addEventListener('click', () => runRow(view, toggle.getAttribute('aria-pressed') !== 'true'))
      view.toggle = toggle
      view.controls.push(toggle)
      item.append(toggle)
    } else {
      const label = document.createElement('label')
      label.className = 'explain-row-label'
      label.htmlFor = 'explain-' + row.id
      label.textContent = row.label
      const field = document.createElement(row.kind === 'choice' ? 'select' : 'input')
      field.id = 'explain-' + row.id
      field.className = 'explain-field'
      if (row.kind === 'input') {
        field.type = 'text'
        field.autocomplete = 'off'
        field.spellcheck = false
        field.placeholder = row.placeholder || ''
      }
      const show = document.createElement('button')
      show.type = 'button'
      show.className = 'explain-show'
      show.textContent = 'Show'
      show.addEventListener('click', () => runRow(view, field.value))
      // Enter in the text field runs it too.
      field.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || row.kind !== 'input') return
        event.preventDefault()
        runRow(view, field.value)
      })
      const controls = document.createElement('div')
      controls.className = 'explain-controls'
      controls.append(field, show)
      view.field = field
      view.controls.push(field, show)
      item.append(label, controls)
    }
    item.append(reason)
    return view
  }

  async function runRow(view, value) {
    if (view.reason.hidden === false) return
    let result
    try {
      result = await view.row.run(value)
    } catch {
      result = { ok: false, text: 'That did not work. Try again.' }
    }
    if (result && result.text) setStatus(result.text)
    refresh()
  }

  function setStatus(text) {
    status.textContent = text || ''
  }

  // Reasons, pressed states and choices follow the app; a choice list is
  // rebuilt only when it changes, keeping the picked value when it is still there.
  function refresh() {
    for (const view of views) {
      const { row } = view
      const why = typeof row.reason === 'function' ? row.reason() : null
      view.reason.hidden = !why
      view.reason.textContent = why || ''
      view.item.classList.toggle('is-disabled', Boolean(why))
      for (const control of view.controls) {
        control.disabled = Boolean(why)
        if (why) control.setAttribute('aria-describedby', view.reason.id)
        else control.removeAttribute('aria-describedby')
      }
      if (view.toggle) view.toggle.setAttribute('aria-pressed', String(Boolean(row.pressed())))
      if (row.kind === 'choice') {
        const options = row.options()
        const key = JSON.stringify(options)
        if (key !== view.optionsKey) {
          view.optionsKey = key
          const picked = view.field.value
          view.field.replaceChildren(...options.map((option) => {
            const element = document.createElement('option')
            element.value = option.value
            element.textContent = option.label
            return element
          }))
          if (options.some((option) => option.value === picked)) view.field.value = picked
        }
      }
    }
  }

  let openNow = false
  function open() {
    openNow = true
    popover.hidden = false
    button.setAttribute('aria-expanded', 'true')
    container.classList.add('is-explaining')
    refresh()
    const first = views.flatMap((view) => view.controls).find((control) => !control.disabled)
    if (first) first.focus()
  }

  function close(returnFocus = false) {
    if (!openNow) return
    openNow = false
    popover.hidden = true
    button.setAttribute('aria-expanded', 'false')
    container.classList.remove('is-explaining')
    if (!returnFocus) return
    // In compact the Explain button sits in the closed View popover.
    const visible = button.getClientRects().length > 0
    const target = visible ? button : container.querySelector('.view-toggle')
    if (target) target.focus()
  }

  // The View popover would close with focus on View; the Explain popover takes over.
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    closeView()
    if (openNow) close(true)
    else open()
  })
  container.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openNow) return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  })
  document.addEventListener('pointerdown', (event) => {
    if (openNow && !popover.contains(event.target) && !button.contains(event.target)) close(false)
  })

  return { open, close, isOpen: () => openNow, refresh, setStatus }
}
