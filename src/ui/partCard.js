// Part card: a close-up of one part type from src/course/partInfo.js. The tray
// drawing at 96 px with each leg named beside it, the summary, the legs as a
// definition list and the facts as a two column list. DOM, not pure.
//
// openPartCard({ cards, type }) -> card, or null for an unknown type
import { PART_INFO } from '../course/partInfo.js'
import { partIcon } from './partsTray.js'

export function openPartCard({ cards, type }) {
  const info = PART_INFO[type]
  if (!info) return null
  const card = cards.open({ kind: 'part', title: info.name })
  const figure = document.createElement('div')
  figure.className = 'part-figure'
  const legNames = document.createElement('ol')
  legNames.className = 'part-leg-names'
  legNames.setAttribute('aria-label', 'Legs from left to right')
  for (const leg of info.legs) {
    const item = document.createElement('li')
    item.textContent = leg.label
    legNames.append(item)
  }
  figure.append(partIcon(type, 96), legNames)

  const summary = document.createElement('p')
  summary.className = 'part-summary'
  summary.textContent = info.summary

  const legs = document.createElement('dl')
  legs.className = 'part-legs'
  for (const leg of info.legs) {
    const term = document.createElement('dt')
    term.textContent = leg.label
    const text = document.createElement('dd')
    text.textContent = leg.text
    legs.append(term, text)
  }

  const facts = document.createElement('dl')
  facts.className = 'part-facts'
  for (const fact of info.facts) {
    const term = document.createElement('dt')
    term.textContent = fact.label
    const value = document.createElement('dd')
    value.textContent = fact.value
    facts.append(term, value)
  }
  card.body.append(figure, summary, legs, facts)
  return card
}
