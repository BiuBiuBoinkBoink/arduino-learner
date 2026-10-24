import { describe, it, expect } from 'vitest'
import { parse } from '../src/runner/parser.js'
import { CodeError } from '../src/runner/lexer.js'
import { lessons } from '../src/course/lessons.js'
import { defaultValues, slotValues, fillSketch } from '../src/ui/sketch.js'

// The expression of the first statement of loop in: void loop() { <code> }
function expr(code) {
  const program = parse(`void loop() { ${code}; }`)
  return program.body[0].body.body[0].expression
}

// Compact form of an expression tree, for readable precedence checks.
function show(node) {
  switch (node.type) {
    case 'Number': return String(node.value)
    case 'Ident': return node.name
    case 'Binary': return `(${show(node.left)} ${node.operator} ${show(node.right)})`
    case 'Unary': return `(${node.operator}${show(node.argument)})`
    case 'Assign': return `(${show(node.target)} ${node.operator} ${show(node.value)})`
    case 'Conditional': return `(${show(node.test)} ? ${show(node.consequent)} : ${show(node.alternate)})`
    case 'Update': return node.prefix ? `(${node.operator}${show(node.argument)})` : `(${show(node.argument)}${node.operator})`
    case 'Call': return `${show(node.callee)}(${node.args.map(show).join(', ')})`
    case 'Member': return `${show(node.object)}.${node.property}`
    case 'Index': return `${show(node.object)}[${show(node.index)}]`
    case 'Cast': return `${node.valueType.name}(${show(node.argument)})`
    default: return node.type
  }
}

function errorOf(source) {
  try {
    parse(source)
  } catch (error) {
    return error
  }
  return null
}

describe('parse program structure', () => {
  it('reads includes, globals, enums and functions in order', () => {
    const program = parse(`#include <Servo.h>
enum State { RED, GREEN = 5, BLUE };
const int ledPin = 13;
int notes[] = {262, 294}, count;
Servo arm;
State state = RED;
void blink(int times, int pins[]);
int twice(int x) { return x * 2; }
void setup() {}
void loop() {}`)
    expect(program.includes).toEqual(['Servo.h'])
    expect(program.body.map((item) => item.type)).toEqual(['Enum', 'VarDecl', 'VarDecl', 'VarDecl', 'VarDecl', 'Prototype', 'Function', 'Function', 'Function'])
    const [states, led, notes, arm, state, proto, twice] = program.body
    expect(states.members.map((m) => [m.name, m.value && m.value.value])).toEqual([['RED', null], ['GREEN', 5], ['BLUE', null]])
    expect(led.valueType).toMatchObject({ name: 'int', const: true })
    expect(notes.declarations.map((d) => [d.name, d.isArray, d.init && d.init.type])).toEqual([['notes', true, 'InitList'], ['count', false, null]])
    expect(arm.valueType.name).toBe('Servo')
    expect(state.valueType.name).toBe('State')
    expect(proto.params.map((p) => [p.name, p.isArray])).toEqual([['times', false], ['pins', true]])
    expect(twice).toMatchObject({ name: 'twice', returnType: { name: 'int' }, line: 8 })
  })

  it('normalises multi word and alias types', () => {
    const program = parse('unsigned long a; unsigned b; boolean c; long int d; byte e; char f; double g; String h = "x";')
    expect(program.body.map((item) => item.valueType.name)).toEqual(['unsigned long', 'unsigned int', 'bool', 'long', 'byte', 'char', 'double', 'String'])
  })

  it('records lines on every node', () => {
    const program = parse('void loop() {\n  int x = 1;\n  if (x) {\n    x++;\n  }\n}')
    const [decl, branch] = program.body[0].body.body
    expect(decl.line).toBe(2)
    expect(branch.line).toBe(3)
    expect(branch.consequent.body[0].line).toBe(4)
  })
})

describe('parse statements', () => {
  const body = (code) => parse(`void loop() { ${code} }`).body[0].body.body

  it('reads if else chains, while, do while and for loops', () => {
    const [branch, loop, doLoop, forLoop, emptyFor] = body(`
      if (a) b(); else if (c) d(); else e();
      while (x < 3) x++;
      do { x--; } while (x > 0);
      for (int i = 0; i < 5; i++) {}
      for (;;) break;`)
    expect(branch.alternate.type).toBe('If')
    expect(branch.alternate.alternate.type).toBe('ExprStmt')
    expect(loop.type).toBe('While')
    expect(doLoop.type).toBe('DoWhile')
    expect(forLoop.init.type).toBe('VarDecl')
    expect(show(forLoop.test)).toBe('(i < 5)')
    expect(show(forLoop.update)).toBe('(i++)')
    expect([emptyFor.init, emptyFor.test, emptyFor.update]).toEqual([null, null, null])
  })

  it('reads switch with cases, default and fall through', () => {
    const [sw] = body('switch (state) { case RED: a(); case GREEN: b(); break; default: c(); }')
    expect(sw.cases.map((item) => [item.test && item.test.name, item.body.length])).toEqual([['RED', 1], ['GREEN', 2], [null, 1]])
  })

  it('reads return, continue and local declarations with constructor style', () => {
    const [ret, cont, decl] = body('return; continue; String name("hi");')
    expect(ret.argument).toBe(null)
    expect(cont.type).toBe('Continue')
    expect(decl.declarations[0].args[0].value).toBe('hi')
  })
})

describe('parse expressions', () => {
  it('follows C precedence and associativity', () => {
    expect(show(expr('a = b = 1 + 2 * 3 - 4 / 2 % 3'))).toBe('(a = (b = ((1 + (2 * 3)) - ((4 / 2) % 3))))')
    expect(show(expr('x = a || b && c | d ^ e & f == g < h << i'))).toBe('(x = (a || (b && (c | (d ^ (e & (f == (g < (h << i)))))))))')
    expect(show(expr('y = !a && -b'))).toBe('(y = ((!a) && (-b)))')
    expect(show(expr('z = a ? b : c ? d : e'))).toBe('(z = (a ? b : (c ? d : e)))')
    expect(show(expr('t += x-- - --y'))).toBe('(t += ((x--) - (--y)))')
  })

  it('reads calls, methods, indexes and casts', () => {
    expect(show(expr('Serial.println(notes[i + 1], 2)'))).toBe('Serial.println(notes[(i + 1)], 2)')
    expect(show(expr('v = (float)raw / 1023'))).toBe('(v = (float(raw) / 1023))')
    expect(show(expr('v = int(f) + String(3).length()'))).toBe('(v = (int(f) + String(3).length()))')
    expect(show(expr('s = State::RED'))).toBe('(s = RED)')
  })

  it('reads literals', () => {
    const call = expr("f(1.5, \"hi\", 'c', true, 0x10)")
    expect(call.args.map((arg) => arg.type)).toEqual(['Number', 'String', 'Char', 'Bool', 'Number'])
    expect(call.args[0].isFloat).toBe(true)
  })
})

describe('parse errors', () => {
  const cases = [
    ['void loop() {\n  int x = 1\n  x++;\n}', 2, "expected ';' after the declaration"],
    ['void loop() {\n  digitalWrite(13, HIGH)\n}', 2, "expected ';' after the statement"],
    ['void loop() {\n  if (x > 1 {\n  }\n}', 2, "expected ')' to close the if condition"],
    ['void setup() {\n  pinMode(13, OUTPUT);\n', 2, "missing its closing '}'"],
    ['void loop() {\n  5 = x;\n}', 2, 'cannot assign'],
    ['void loop() {\n  else x();\n}', 2, "'else' has no 'if'"],
    ['x = 5;', 1, 'expected a variable or function'],
    ['void loop() {\n  int a[];\n}', 2, 'needs a size'],
    ['void loop() {\n  case 1: x();\n}', 2, 'only be used inside a switch'],
    ['void loop() {\n  x = (1 + ;\n}', 2, 'expected a value']
  ]
  for (const [source, line, text] of cases) {
    it(`reports line ${line}: ${text}`, () => {
      const error = errorOf(source)
      expect(error).toBeInstanceOf(CodeError)
      expect(error.line).toBe(line)
      expect(error.message).toContain(text)
    })
  }
})

describe('every lesson sketch and example', () => {
  for (const lesson of lessons) {
    it(`parses ${lesson.id}`, () => {
      expect(() => parse(lesson.example.code)).not.toThrow()
      if (lesson.sketch) {
        const { code, params } = lesson.sketch
        const filled = fillSketch(code, slotValues(params, defaultValues(params)))
        const program = parse(filled)
        expect(program.body.some((item) => item.type === 'Function' && item.name === 'loop')).toBe(true)
      }
    })
  }
})
