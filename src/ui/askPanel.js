// Ask tab: the help chat's log and question box, in the guide's Ask pane (or
// the bottom sheet's Ask tab in compact). The log is role="log" with polite
// announcements: learner turns on the right, helper turns on the left with
// their tool chips, quiz, guess and recall cards inline, a Thinking... row
// while a request runs, and the newest turn scrolled into view. With no turns
// it shows what the helper can do and up to three suggestions for the step
// kind; a suggestion click asks it. New chat starts over. Nothing is stored.
//
// createAskPanel({ container, chat, getSuggestionContext }) -> { refresh(), focus() }
// getSuggestionContext() -> { kind, codeError } for the current step.
export const EMPTY_TEXT = 'Ask about your circuit, your code or this step. The helper can point at things and run small experiments. Chats are not saved.'
export const THINKING_TEXT = 'Thinking...'
export const MAX_QUESTION = 500

// Up to three questions for the step kind; the compile one only with a code error.
export function suggestionsFor(kind, codeError = false) {
  if (kind === 'build' || kind === 'wire') return ['Where does this part go?', 'Why is my checklist not ticked?']
  if (kind === 'code') {
    return [...(codeError ? ['Why does my code not compile?'] : []), 'What does this line do?', 'How can I see what my sketch is doing?']
  }
  if (kind === 'run' || kind === 'predict') return ['Why is nothing happening?', 'What should I try next?']
  return ['Can you explain this another way?']
}

export function createAskPanel({ container, chat, getSuggestionContext }) {
  container.classList.add('ask-pane')

  const top = document.createElement('div')
  top.className = 'ask-top'
  const fresh = document.createElement('button')
  fresh.type = 'button'
  fresh.className = 'guide-text-button ask-new'
  fresh.textContent = 'New chat'
  top.append(fresh)

  const log = document.createElement('div')
  log.className = 'ask-log'
  log.setAttribute('role', 'log')
  log.setAttribute('aria-live', 'polite')
  log.setAttribute('aria-label', 'Help chat')
  log.tabIndex = 0

  const empty = document.createElement('div')
  empty.className = 'ask-empty'
  const emptyText = document.createElement('p')
  emptyText.className = 'panel-text'
  emptyText.textContent = EMPTY_TEXT
  const suggestions = document.createElement('div')
  suggestions.className = 'ask-suggestions'
  empty.append(emptyText, suggestions)

  const turns = document.createElement('div')
  turns.className = 'ask-turns'

  const thinking = document.createElement('p')
  thinking.className = 'ask-thinking'
  thinking.textContent = THINKING_TEXT
  log.append(empty, turns, thinking)

  const form = document.createElement('form')
  form.className = 'ask-form'
  const label = document.createElement('label')
  label.htmlFor = 'ask-input'
  label.textContent = 'Your question'
  const row = document.createElement('div')
  row.className = 'ask-row'
  const input = document.createElement('textarea')
  input.id = 'ask-input'
  input.rows = 2
  input.maxLength = MAX_QUESTION
  const send = document.createElement('button')
  send.type = 'submit'
  send.className = 'run-button ask-send'
  send.textContent = 'Send'
  row.append(input, send)
  form.append(label, row)

  container.append(top, log, form)

  // The option picked on each quiz or guess card (memory only).
  const picked = new WeakMap()
  let nodes = []
  let keys = []
  let suggestionKey = ''
  let refocus = false

  // The question box gets focus back once the answer is in.
  function ask(text) {
    if (chat.isBusy()) return
    refocus = true
    chat.ask(text)
  }

  function chip(text) {
    const li = document.createElement('li')
    li.className = 'ask-chip'
    li.textContent = text
    return li
  }

  function para(text, className = 'panel-text') {
    const p = document.createElement('p')
    p.className = className
    p.textContent = text
    return p
  }

  function choiceCard(card) {
    const box = document.createElement('div')
    box.className = 'ask-card'
    box.append(para(card.question, 'panel-text ask-card-question'))
    const answer = picked.get(card)
    const options = document.createElement('div')
    options.className = 'guide-options'
    card.options.forEach((option, i) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'guide-option'
      button.textContent = option
      button.setAttribute('aria-pressed', String(answer === i))
      if (answer === i) button.classList.add(card.kind === 'quiz' ? (i === card.answer ? 'is-right' : 'is-wrong') : 'is-picked')
      if (answer !== undefined) button.disabled = true
      button.addEventListener('click', () => {
        if (picked.has(card) || chat.isBusy()) return
        picked.set(card, i)
        ask((card.kind === 'quiz' ? 'My answer: ' : 'My guess: ') + option)
      })
      options.append(button)
    })
    box.append(options)
    if (card.kind === 'quiz' && answer !== undefined && card.why) box.append(para(card.why, 'panel-text ask-card-why'))
    return box
  }

  function recallCard(card) {
    const quote = document.createElement('blockquote')
    quote.className = 'ask-recall'
    const title = para(card.title, 'panel-text ask-recall-title')
    quote.append(title, ...card.body.map((text) => para(text)))
    return quote
  }

  function turnNode(entry) {
    const node = document.createElement('div')
    node.className = 'ask-turn is-' + entry.role + (entry.muted ? ' is-muted' : '')
    if (entry.text) node.append(para(entry.text, 'ask-bubble'))
    if (entry.note) node.append(para(entry.note, 'ask-note'))
    if (entry.chips.length > 0) {
      const list = document.createElement('ul')
      list.className = 'ask-chips'
      list.setAttribute('aria-label', 'What the helper did')
      list.append(...entry.chips.map(chip))
      node.append(list)
    }
    for (const card of entry.cards) node.append(card.kind === 'recall' ? recallCard(card) : choiceCard(card))
    return node
  }

  const keyOf = (entry) => JSON.stringify([entry.role, entry.text, entry.note, entry.muted, entry.chips, entry.cards.map((card) => picked.get(card) ?? null)])

  function renderSuggestions() {
    const { kind, codeError } = getSuggestionContext()
    const list = suggestionsFor(kind, codeError)
    const key = list.join('\n')
    if (key === suggestionKey) return
    suggestionKey = key
    suggestions.replaceChildren(...list.map((text) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'guide-option ask-suggestion'
      button.textContent = text
      button.addEventListener('click', () => ask(text))
      return button
    }))
  }

  // Only turns that changed are rebuilt, so the log announces new text once.
  function render() {
    const transcript = chat.getTranscript()
    const busy = chat.isBusy()
    if (transcript.length < nodes.length) {
      nodes = []
      keys = []
      turns.replaceChildren()
    }
    transcript.forEach((entry, i) => {
      const key = keyOf(entry)
      if (keys[i] === key) return
      const node = turnNode(entry)
      if (nodes[i]) nodes[i].replaceWith(node)
      else turns.append(node)
      nodes[i] = node
      keys[i] = key
    })
    empty.hidden = transcript.length > 0
    if (transcript.length === 0) renderSuggestions()
    thinking.hidden = !busy
    input.disabled = busy
    send.disabled = busy
    for (const button of log.querySelectorAll('.ask-card .guide-option:not(:disabled), .ask-suggestion')) button.setAttribute('aria-disabled', String(busy))
    log.scrollTop = log.scrollHeight
    if (!busy && refocus) {
      refocus = false
      input.focus()
    }
  }

  function submit() {
    const text = input.value.trim()
    if (!text || chat.isBusy()) return
    input.value = ''
    ask(text)
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    submit()
  })
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    submit()
  })
  fresh.addEventListener('click', () => {
    chat.reset()
    input.focus()
  })

  chat.subscribe(render)
  render()

  return {
    refresh() {
      if (chat.getTranscript().length === 0) renderSuggestions()
    },
    focus: () => input.focus()
  }
}
