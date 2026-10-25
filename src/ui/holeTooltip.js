// Hole tooltip: a small dark label that follows the pointer over the
// breadboard and the Uno headers while the circuit is being edited. It shows a
// hole name and its place ('9e' / 'strip 9 (rows a to e)'), or a pin name.
// aria-hidden: the tray's keyboard path gives the same information.
import { placeOf, placeLabel } from '../circuits/netlist.js'
import { isHole } from '../circuits/holes.js'

const OFFSET_PX = 14

export function createHoleTooltip({ container }) {
  const tip = document.createElement('div')
  tip.className = 'hole-tooltip'
  tip.setAttribute('aria-hidden', 'true')
  const name = document.createElement('span')
  name.className = 'hole-tooltip-name'
  const place = document.createElement('span')
  place.className = 'hole-tooltip-place'
  tip.append(name, place)
  tip.hidden = true
  container.append(tip)

  // target is a hole or pin name; clientX and clientY are the pointer.
  function show(target, clientX, clientY) {
    name.textContent = target
    place.textContent = isHole(target) ? placeLabel(placeOf(target)) : ''
    place.hidden = !isHole(target)
    const box = container.getBoundingClientRect()
    tip.style.left = clientX - box.left + OFFSET_PX + 'px'
    tip.style.top = clientY - box.top + OFFSET_PX + 'px'
    tip.hidden = false
  }

  function hide() {
    tip.hidden = true
  }

  return { show, hide }
}
