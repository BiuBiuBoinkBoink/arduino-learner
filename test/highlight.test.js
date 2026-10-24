import { describe, it, expect } from 'vitest'
import { tokenize } from '../src/ui/highlight.js'
import { lessons } from '../src/course/lessons.js'

function typeOf(code, text) {
  const token = tokenize(code).find((item) => item.text === text)
  return token ? token.type : null
}

describe('tokenize', () => {
  it('joins back to the input for every lesson code', () => {
    for (const lesson of lessons) {
      const codes = [lesson.example.code]
      if (lesson.sketch) codes.push(lesson.sketch.code)
      for (const code of codes) {
        expect(tokenize(code).map((token) => token.text).join('')).toBe(code)
      }
    }
  })

  it('joins back for odd input', () => {
    const code = '#define X 1\n  "open\n/* never closed\n\t@$ x'
    expect(tokenize(code).map((token) => token.text).join('')).toBe(code)
    expect(tokenize('')).toEqual([])
  })

  it('marks line and block comments', () => {
    expect(typeOf('int a; // note here', '// note here')).toBe('comment')
    expect(typeOf('a /* one\ntwo */ b', '/* one\ntwo */')).toBe('comment')
  })

  it('marks double and single quoted strings', () => {
    expect(typeOf('Serial.println("hi there");', '"hi there"')).toBe('string')
    expect(typeOf("char c = 'x';", "'x'")).toBe('string')
    expect(typeOf('"a \\" b"', '"a \\" b"')).toBe('string')
  })

  it('marks integers and decimals as numbers', () => {
    expect(typeOf('x = 13;', '13')).toBe('number')
    expect(typeOf('x = 5.0;', '5.0')).toBe('number')
    expect(typeOf('x = 0.014;', '0.014')).toBe('number')
  })

  it('marks lines starting with # as preprocessor', () => {
    const code = '#include <Servo.h>\nServo arm;'
    expect(tokenize(code)[0]).toEqual({ type: 'preprocessor', text: '#include <Servo.h>' })
    expect(typeOf(code, 'Servo')).toBe('builtin')
  })

  it('marks keywords', () => {
    for (const word of ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'return', 'const', 'void']) {
      expect(typeOf(word + ' x', word)).toBe('keyword')
    }
  })

  it('marks types', () => {
    for (const word of ['int', 'float', 'bool', 'boolean', 'long', 'byte', 'char', 'unsigned', 'String']) {
      expect(typeOf(word + ' x', word)).toBe('type')
    }
  })

  it('marks constants', () => {
    for (const word of ['HIGH', 'LOW', 'INPUT', 'OUTPUT', 'INPUT_PULLUP', 'true', 'false']) {
      expect(typeOf('f(' + word + ')', word)).toBe('constant')
    }
  })

  it('marks Arduino builtins', () => {
    for (const word of ['pinMode', 'digitalWrite', 'digitalRead', 'analogWrite', 'analogRead', 'delay', 'millis', 'tone', 'noTone', 'map', 'Serial', 'Servo']) {
      expect(typeOf(word + '(1)', word)).toBe('builtin')
    }
  })

  it('keeps identifiers that contain a keyword plain', () => {
    const tokens = tokenize('long interval = 1000;')
    expect(tokens.map((token) => token.type)).toEqual(['type', 'plain', 'number', 'plain'])
    expect(tokens[1].text).toBe(' interval = ')
    expect(tokenize('ifReady = doTurn + forward;').map((token) => token.type)).toEqual(['plain'])
    expect(tokenize('ledPin13').map((token) => token.type)).toEqual(['plain'])
  })
})
