// Empty panel shells. Later jobs fill them.
export function createPanels(root) {
  const info = document.createElement('aside')
  info.id = 'info-panel'
  info.setAttribute('aria-label', 'Lesson info')

  const code = document.createElement('aside')
  code.id = 'code-panel'
  code.setAttribute('aria-label', 'Code')

  const strip = document.createElement('nav')
  strip.id = 'lesson-strip'
  strip.setAttribute('aria-label', 'Lessons')

  root.append(info, code, strip)
  return { info, code, strip }
}
