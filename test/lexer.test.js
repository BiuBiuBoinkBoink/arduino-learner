import { describe, it, expect } from 'vitest'
import { lex, CodeError } from '../src/runner/lexer.js'

const kinds = (source) => lex(source).map((token) => [token.type, token.value])

describe('lex', () => {
  it('reads keywords, names, operators and ends with eof', () => {
    expect(kinds('int x = a <<= 2;')).toEqual([
      ['keyword', 'int'], ['ident', 'x'], ['op', '='], ['ident', 'a'], ['op', '<<='], ['number', 2], ['op', ';'], ['eof', '']
    ])
  })

  it('reads decimal, hex, binary, float and suffixed numbers', () => {
    const tokens = lex('10 0x1F 0b101 1.5 .5 2e3 5.0f 1000UL 9600L')
    expect(tokens.slice(0, -1).map((token) => token.value)).toEqual([10, 31, 5, 1.5, 0.5, 2000, 5, 1000, 9600])
    expect(tokens.slice(0, -1).map((token) => token.isFloat)).toEqual([false, false, false, true, true, true, true, false, false])
  })

  it('reads strings and chars with escapes', () => {
    expect(kinds('"a\\tb\\n" \'x\' \'\\n\'').slice(0, 3)).toEqual([['string', 'a\tb\n'], ['char', 'x'], ['char', '\n']])
  })

  it('skips comments and counts lines and columns', () => {
    const tokens = lex('// one\n/* two\nthree */ int\n  x;')
    expect(tokens[0]).toMatchObject({ value: 'int', line: 3, column: 10 })
    expect(tokens[1]).toMatchObject({ value: 'x', line: 4, column: 3 })
  })

  it('reads #include lines', () => {
    expect(kinds('#include <Servo.h>\nServo arm;')[0]).toEqual(['include', 'Servo.h'])
  })

  it('throws a CodeError with the line for bad input', () => {
    const cases = [
      ['int x = 1;\nint y = @;', 2, "unexpected character '@'"],
      ['String s = "open;', 1, 'missing its closing "'],
      ['/* never closed', 1, 'never closed'],
      ['#define LED 13', 1, '#include'],
      ['int x = 12abc;', 1, 'not a valid number']
    ]
    for (const [source, line, text] of cases) {
      let error = null
      try {
        lex(source)
      } catch (caught) {
        error = caught
      }
      expect(error).toBeInstanceOf(CodeError)
      expect(error.line).toBe(line)
      expect(error.message).toContain(`Line ${line}:`)
      expect(error.message).toContain(text)
    }
  })
})
