// Splits lesson overview paragraphs into intro text and the goal sentence.
// The goal is the text after 'Goal: ' in the first paragraph that has it;
// text before it in that paragraph and every other paragraph stay in intro.
const MARK = 'Goal: '

export function splitGoal(paragraphs) {
  const index = paragraphs.findIndex((text) => text.includes(MARK))
  if (index === -1) return { intro: paragraphs.slice(), goal: null }
  const text = paragraphs[index]
  const at = text.indexOf(MARK)
  const before = text.slice(0, at).trim()
  const intro = paragraphs.slice(0, index)
  if (before !== '') intro.push(before)
  intro.push(...paragraphs.slice(index + 1))
  return { intro, goal: text.slice(at + MARK.length).trim() }
}
