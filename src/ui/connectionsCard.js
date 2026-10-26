// Connections card: one row per net of the build, a coloured dot (six colours
// in turn), the things it joins as small chips and, when compared with the
// lesson circuit, a tick or a cross. Pointing at or focusing a row lights its
// places on the breadboard (onHover(places), onHover(null) on leaving). The
// footer says what the ticks mean. DOM, not pure.
//
// openConnectionsCard({ cards, rows, onHover, onClose }) -> card with update(rows)
const SVG = 'http://www.w3.org/2000/svg'
export const NET_COLORS = ['#2f6fd6', '#d0312d', '#1d7f53', '#c98a00', '#7a3fc1', '#1b8a9a']
export const CONNECTIONS_FOOTER = 'Ticks show connections that match the lesson circuit.'

function markIcon(match) {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('class', 'net-mark ' + (match ? 'is-match' : 'is-miss'))
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', match ? 'M3 8.5 L6.5 12 L13 4.5' : 'M4 4 L12 12 M12 4 L4 12')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke-width', '2.2')
  path.setAttribute('stroke-linecap', 'round')
  svg.append(path)
  return svg
}

export function openConnectionsCard({ cards, rows, onHover, onClose = () => {} }) {
  const card = cards.open({
    kind: 'connections',
    title: 'Connections',
    onClose: () => {
      onHover(null)
      onClose()
    }
  })
  const list = document.createElement('ul')
  list.className = 'net-list'
  const footer = document.createElement('p')
  footer.className = 'net-footer'
  card.body.append(list, footer)

  function update(next) {
    onHover(null)
    list.replaceChildren(...next.map((row, i) => {
      const item = document.createElement('li')
      item.className = 'net-row'
      item.tabIndex = 0
      const dot = document.createElement('span')
      dot.className = 'net-dot'
      dot.style.background = NET_COLORS[i % NET_COLORS.length]
      dot.setAttribute('aria-hidden', 'true')
      const chips = document.createElement('span')
      chips.className = 'net-chips'
      for (const thing of row.things) {
        const chip = document.createElement('span')
        chip.className = 'net-chip'
        chip.textContent = thing
        chips.append(chip)
      }
      item.append(dot, chips)
      let words = row.things.join(', ')
      if (row.match !== null) {
        item.append(markIcon(row.match))
        words += row.match ? ', matches the lesson circuit' : ', does not match the lesson circuit'
      }
      item.setAttribute('aria-label', words)
      const on = () => onHover(row.places)
      const off = () => onHover(null)
      item.addEventListener('pointerenter', on)
      item.addEventListener('pointerleave', off)
      item.addEventListener('focus', on)
      item.addEventListener('blur', off)
      return item
    }))
    footer.hidden = !next.some((row) => row.match !== null)
    footer.textContent = CONNECTIONS_FOOTER
  }
  update(rows)
  card.update = update
  return card
}
