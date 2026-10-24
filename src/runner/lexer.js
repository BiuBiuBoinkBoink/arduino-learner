// Lexer for the Arduino C subset the code runner understands. Pure module.
// lex(source) -> tokens [{ type, value, line, column }] ending in an 'eof'
// token. Types: number, string, char, ident, keyword, op, include. Comments
// and white space are skipped. Bad input throws a CodeError with its line.
export class CodeError extends Error {
  constructor(message, line, column) {
    super(`Line ${line}: ${message}`)
    this.name = 'CodeError'
    this.reason = message
    this.line = line
    this.column = column
  }
}

export const KEYWORDS = new Set([
  'void', 'int', 'long', 'unsigned', 'float', 'double', 'bool', 'boolean', 'char', 'byte', 'String',
  'const', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue',
  'return', 'enum', 'true', 'false'
])

// Longest first, so '<<=' wins over '<<' and '<'.
const OPERATORS = [
  '<<=', '>>=',
  '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '==', '!=', '<=', '>=', '&&', '||', '<<', '>>', '::',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '~', '&', '|', '^', '?', ':', ';', ',', '.', '(', ')', '{', '}', '[', ']'
]

const ESCAPES = { n: '\n', t: '\t', r: '\r', 0: '\0', '\\': '\\', "'": "'", '"': '"' }

export function lex(source) {
  const tokens = []
  let i = 0
  let line = 1
  let lineStart = 0

  const column = () => i - lineStart + 1
  const fail = (message) => {
    throw new CodeError(message, line, column())
  }
  const push = (type, value, startColumn) => tokens.push({ type, value, line, column: startColumn })

  function readEscape() {
    // At a backslash inside a string or char literal.
    i += 1
    const ch = source[i]
    if (!(ch in ESCAPES)) fail(`unknown escape \\${ch || ''}`)
    i += 1
    return ESCAPES[ch]
  }

  while (i < source.length) {
    const ch = source[i]
    const start = column()

    if (ch === '\n') {
      i += 1
      line += 1
      lineStart = i
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i += 1
      continue
    }
    if (source.startsWith('//', i)) {
      while (i < source.length && source[i] !== '\n') i += 1
      continue
    }
    if (source.startsWith('/*', i)) {
      const end = source.indexOf('*/', i + 2)
      if (end === -1) fail('this comment is never closed with */')
      for (let j = i; j < end; j++) {
        if (source[j] === '\n') {
          line += 1
          lineStart = j + 1
        }
      }
      i = end + 2
      continue
    }
    if (ch === '#') {
      const match = /^#include\s*[<"]([\w.]+)[>"]/.exec(source.slice(i, source.indexOf('\n', i) === -1 ? undefined : source.indexOf('\n', i)))
      if (!match) fail('only #include <Library.h> lines are supported')
      push('include', match[1], start)
      i += match[0].length
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] || ''))) {
      const rest = source.slice(i)
      const match = /^0[xX][0-9a-fA-F]+/.exec(rest) || /^0[bB][01]+/.exec(rest) ||
        /^(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?[fF]?/.exec(rest)
      let text = match[0]
      let isFloat = false
      let value
      if (/^0[xX]/.test(text)) value = parseInt(text.slice(2), 16)
      else if (/^0[bB]/.test(text)) value = parseInt(text.slice(2), 2)
      else {
        isFloat = /[.eEfF]/.test(text)
        value = Number(text.replace(/[fF]$/, ''))
      }
      i += text.length
      // Integer suffixes like 1000UL or 9600L.
      const suffix = /^[uUlL]+/.exec(source.slice(i))
      if (suffix && !isFloat) {
        i += suffix[0].length
        text += suffix[0]
      }
      if (/[A-Za-z_]/.test(source[i] || '')) fail(`'${text}${source[i]}' is not a valid number`)
      tokens.push({ type: 'number', value, isFloat, line, column: start })
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      const word = /^[A-Za-z_]\w*/.exec(source.slice(i))[0]
      i += word.length
      push(KEYWORDS.has(word) ? 'keyword' : 'ident', word, start)
      continue
    }
    if (ch === '"') {
      i += 1
      let text = ''
      while (source[i] !== '"') {
        if (i >= source.length || source[i] === '\n') fail('this string is missing its closing "')
        text += source[i] === '\\' ? readEscape() : source[i++]
      }
      i += 1
      push('string', text, start)
      continue
    }
    if (ch === "'") {
      i += 1
      if (source[i] === "'") fail("a char literal needs one character, like 'a'")
      const value = source[i] === '\\' ? readEscape() : source[i++]
      if (source[i] !== "'") fail("this char is missing its closing '")
      i += 1
      push('char', value, start)
      continue
    }
    const op = OPERATORS.find((item) => source.startsWith(item, i))
    if (!op) fail(`unexpected character '${ch}'`)
    i += op.length
    push('op', op, start)
  }
  push('eof', '', column())
  return tokens
}
