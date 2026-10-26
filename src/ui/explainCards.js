// Explain cards: the scope, connections, part card and what if cards share one
// stack at the top right of the workbench, under the view controls (full width
// less 16 px in the compact layout). Each card has a title and a Close button
// (aria-label 'Close <title>'). At most MAX_CARDS show at once: opening another
// closes the oldest, and opening a kind that is already open replaces it.
//
// createExplainCards({ container }) -> { open({ kind, title, onClose }) -> card,
//   close(kind), closeAll(), has(kind), get(kind) }
// card: { kind, element, body, setTitle(text), close() }; onClose runs once
// when the card goes, however it was closed.
export const MAX_CARDS = 2

export function createExplainCards({ container }) {
  const stack = document.createElement('div')
  stack.className = 'explain-cards'
  stack.id = 'explain-cards'
  container.append(stack)

  // Oldest first.
  let cards = []

  function open({ kind, title, onClose = () => {} }) {
    close(kind)
    while (cards.length >= MAX_CARDS) cards[0].close()
    const element = document.createElement('section')
    element.className = 'explain-card'
    element.dataset.kind = kind
    const header = document.createElement('div')
    header.className = 'explain-card-header'
    const heading = document.createElement('h3')
    heading.className = 'explain-card-title'
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'explain-card-close'
    closeButton.textContent = 'Close'
    header.append(heading, closeButton)
    const body = document.createElement('div')
    body.className = 'explain-card-body'
    element.append(header, body)
    stack.append(element)

    let closed = false
    const card = {
      kind,
      element,
      body,
      setTitle(text) {
        heading.textContent = text
        element.setAttribute('aria-label', text)
        closeButton.setAttribute('aria-label', 'Close ' + text)
      },
      close() {
        if (closed) return
        closed = true
        cards = cards.filter((entry) => entry !== card)
        element.remove()
        onClose()
      }
    }
    closeButton.addEventListener('click', () => card.close())
    card.setTitle(title)
    cards.push(card)
    return card
  }

  function get(kind) {
    return cards.find((card) => card.kind === kind) || null
  }

  function close(kind) {
    const card = get(kind)
    if (card) card.close()
  }

  function closeAll() {
    for (const card of cards.slice()) card.close()
  }

  return { open, close, closeAll, has: (kind) => Boolean(get(kind)), get }
}
