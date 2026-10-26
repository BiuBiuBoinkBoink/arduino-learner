import { describe, it, expect } from 'vitest'
import { suggestionsFor, EMPTY_TEXT } from '../src/ui/askPanel.js'

describe('suggestionsFor', () => {
  it('gives up to three questions by step kind', () => {
    expect(suggestionsFor('build')).toEqual(['Where does this part go?', 'Why is my checklist not ticked?'])
    expect(suggestionsFor('wire')).toEqual(suggestionsFor('build'))
    expect(suggestionsFor('code')).toEqual(['What does this line do?', 'How can I see what my sketch is doing?'])
    expect(suggestionsFor('code', true)).toEqual(['Why does my code not compile?', 'What does this line do?', 'How can I see what my sketch is doing?'])
    expect(suggestionsFor('run')).toEqual(['Why is nothing happening?', 'What should I try next?'])
    expect(suggestionsFor('predict')).toEqual(suggestionsFor('run'))
    expect(suggestionsFor('learn')).toEqual(['Can you explain this another way?'])
    expect(suggestionsFor('explore')).toEqual(['Can you explain this another way?'])
  })

  it('has the empty state text', () => {
    expect(EMPTY_TEXT).toBe('Ask about your circuit, your code or this step. The helper can point at things and run small experiments. Chats are not saved.')
  })
})
