// Pure Arduino C++ tokenizer for the code panel colouring. No DOM access.
// tokenize(code) returns [{ type, text }]; joining every text gives back code.
const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break',
  'continue', 'return', 'const', 'void', 'static', 'volatile'
])
const TYPES = new Set([
  'int', 'float', 'double', 'bool', 'boolean', 'long', 'short', 'byte', 'char',
  'unsigned', 'String'
])
const CONSTANTS = new Set([
  'HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'LED_BUILTIN', 'true', 'false'
])
const BUILTINS = new Set([
  'pinMode', 'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead',
  'delay', 'delayMicroseconds', 'millis', 'micros', 'tone', 'noTone', 'map',
  'constrain', 'pulseIn', 'Serial', 'Servo'
])

// Tried in order at each position; the first match wins.
const RULES = [
  ['comment', /\/\*[\s\S]*?(?:\*\/|$)/y],
  ['comment', /\/\/[^\n]*/y],
  ['string', /"(?:\\.|[^"\\\n])*"?/y],
  ['string', /'(?:\\.|[^'\\\n])*'?/y],
  ['number', /\d+(?:\.\d+)?/y],
  ['word', /[A-Za-z_]\w*/y]
]
const PREPROCESSOR = /[ \t]*#[^\n]*/y

function wordType(word) {
  if (KEYWORDS.has(word)) return 'keyword'
  if (TYPES.has(word)) return 'type'
  if (CONSTANTS.has(word)) return 'constant'
  if (BUILTINS.has(word)) return 'builtin'
  return 'plain'
}

export function tokenize(code) {
  const tokens = []
  function push(type, text) {
    const last = tokens[tokens.length - 1]
    if (type === 'plain' && last && last.type === 'plain') last.text += text
    else tokens.push({ type, text })
  }

  let pos = 0
  while (pos < code.length) {
    if (pos === 0 || code[pos - 1] === '\n') {
      PREPROCESSOR.lastIndex = pos
      const match = PREPROCESSOR.exec(code)
      if (match) {
        push('preprocessor', match[0])
        pos += match[0].length
        continue
      }
    }
    let matched = false
    for (const [type, pattern] of RULES) {
      pattern.lastIndex = pos
      const match = pattern.exec(code)
      if (!match || match[0].length === 0) continue
      push(type === 'word' ? wordType(match[0]) : type, match[0])
      pos += match[0].length
      matched = true
      break
    }
    if (!matched) {
      push('plain', code[pos])
      pos += 1
    }
  }
  return tokens
}
