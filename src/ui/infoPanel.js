// Info panel: lesson heading plus Overview, Pinout, Example and Specs tabs.
// Tabs follow the WAI-ARIA tabs pattern with roving tabindex and arrow, Home
// and End keys. The tabs are built once; only panel content re renders.
import { nextTabIndex } from './tabKeys.js'

const TABS = [
  { key: 'overview', label: 'Overview', fill: fillOverview },
  { key: 'pinout', label: 'Pinout', fill: fillPinout },
  { key: 'example', label: 'Example', fill: fillExample },
  { key: 'specs', label: 'Specs', fill: fillSpecs }
]

export function createInfoPanel(panel, course) {
  const heading = document.createElement('h2')
  heading.className = 'panel-heading'

  const tablist = document.createElement('div')
  tablist.className = 'info-tabs'
  tablist.setAttribute('role', 'tablist')
  tablist.setAttribute('aria-label', 'Lesson info sections')

  const items = TABS.map((tab) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'info-tab'
    button.id = 'info-tab-' + tab.key
    button.textContent = tab.label
    button.setAttribute('role', 'tab')
    button.setAttribute('aria-controls', 'info-tabpanel-' + tab.key)

    const body = document.createElement('div')
    body.className = 'info-tabpanel'
    body.id = 'info-tabpanel-' + tab.key
    body.setAttribute('role', 'tabpanel')
    body.setAttribute('aria-labelledby', button.id)
    body.tabIndex = 0

    tablist.append(button)
    return { tab, button, body }
  })

  panel.append(heading, tablist, ...items.map((item) => item.body))

  let selected = 0

  function select(index) {
    selected = index
    items.forEach(({ button, body }, i) => {
      const isSelected = i === index
      button.setAttribute('aria-selected', String(isSelected))
      button.tabIndex = isSelected ? 0 : -1
      body.hidden = !isSelected
    })
  }

  items.forEach(({ button }, i) => {
    button.addEventListener('click', () => select(i))
    button.addEventListener('keydown', (event) => {
      const next = nextTabIndex(event.key, selected, items.length)
      if (next === null) return
      event.preventDefault()
      select(next)
      items[next].button.focus()
    })
  })

  function render({ lesson }) {
    heading.textContent = lesson.id + ' ' + lesson.title
    items.forEach(({ tab, body }) => {
      body.replaceChildren()
      tab.fill(body, lesson)
    })
  }

  select(0)
  render(course.getState())
  course.subscribe(render)
}

function paragraph(text) {
  const p = document.createElement('p')
  p.className = 'panel-text'
  p.textContent = text
  return p
}

function fillOverview(body, lesson) {
  body.append(paragraph(lesson.summary), ...lesson.overview.map(paragraph))
}

function fillPinout(body, lesson) {
  const table = document.createElement('table')
  table.className = 'info-table'
  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const label of ['Pin', 'Use']) {
    const th = document.createElement('th')
    th.scope = 'col'
    th.textContent = label
    headRow.append(th)
  }
  head.append(headRow)
  const rows = document.createElement('tbody')
  for (const { pin, use } of lesson.pinout) {
    const tr = document.createElement('tr')
    const pinCell = document.createElement('td')
    pinCell.textContent = pin
    const useCell = document.createElement('td')
    useCell.textContent = use
    tr.append(pinCell, useCell)
    rows.append(tr)
  }
  table.append(head, rows)
  body.append(table)
}

function fillExample(body, lesson) {
  const pre = document.createElement('pre')
  pre.className = 'info-code'
  const code = document.createElement('code')
  code.textContent = lesson.example.code
  pre.append(code)
  body.append(pre, paragraph(lesson.example.note))
}

function fillSpecs(body, lesson) {
  const list = document.createElement('dl')
  list.className = 'info-specs'
  for (const { label, value } of lesson.specs) {
    const dt = document.createElement('dt')
    dt.textContent = label
    const dd = document.createElement('dd')
    dd.textContent = value
    list.append(dt, dd)
  }
  body.append(list)
}
