// Interpreter for the parsed Arduino C subset, against a virtual clock. Pure
// module: all hardware goes through the hw object, so it runs the same in a
// Web Worker and in tests. createProgram(source, hw) parses (throwing a
// CodeError) and returns { advance(untilMs), millis(), error }. advance runs
// the sketch until the virtual clock reaches untilMs: delay() waits on the
// clock, and every statement costs STATEMENT_MS, so a busy loop also moves
// time on. A runtime error stops the program; advance returns it.
//
// hw: pinMode(pin, mode), digitalWrite(pin, 0 | 1), analogWrite(pin, 0 to 255),
// digitalRead(pin) -> 0 | 1, analogRead(pin) -> 0 to 1023, tone(pin, hz, ms),
// noTone(pin), servoWrite(pin, deg), serialWrite(text), serialAvailable(),
// serialRead() -> char code or -1, random() -> [0, 1). Pins are names: 'D13', 'A0'.
import { parse } from './parser.js'
import { CodeError } from './lexer.js'

export const STATEMENT_MS = 0.005
const YIELD_EVERY = 2000
const MAX_DEPTH = 64

export const CONSTANTS = {
  HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13,
  A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, DEC: 10, HEX: 16, BIN: 2
}
export const PIN_MODES = { 0: 'INPUT', 1: 'OUTPUT', 2: 'INPUT_PULLUP' }

const INT_BITS = {
  int: [16, true], 'unsigned int': [16, false], long: [32, true], 'unsigned long': [32, false],
  byte: [8, false], char: [8, true]
}
const FLOAT_TYPES = new Set(['float', 'double'])

// Uno pin number to pin name: 0 to 13 are D0 to D13, 14 to 19 are A0 to A5.
export function pinName(number, line) {
  const n = Math.trunc(number)
  if (n >= 0 && n <= 13) return `D${n}`
  if (n >= 14 && n <= 19) return `A${n - 14}`
  throw new CodeError(`pin ${number} does not exist on the Uno`, line, 1)
}

// Wraps a whole number into a C integer type of the given bits.
function wrap(value, bits, signed) {
  const range = 2 ** bits
  let v = Math.trunc(value) % range
  if (v < 0) v += range
  if (signed && v >= range / 2) v -= range
  return v
}

// Arduino prints floats with 2 decimals by default.
export function formatNumber(value, isFloat, digits = 2) {
  return isFloat ? value.toFixed(digits) : String(value)
}

const num = (v, f = false) => ({ v, f })

export function createProgram(source, hw) {
  const program = parse(source)
  const globals = new Map()
  const functions = new Map()
  const enumValues = new Map()
  let clock = 0
  let steps = 0
  let depth = 0
  let target = 0
  let waitUntil = null
  let error = null
  let done = false

  const fail = (message, node) => {
    throw new CodeError(message, node ? node.line : 1, 1)
  }

  // ---- Values and types ----

  // Converts a value to a declared type: wraps integers, keeps floats, makes Strings.
  function coerce(typeName, value, node) {
    if (typeName === 'String') {
      if (typeof value.v === 'string') return { v: value.v, s: true }
      return { v: value.ch ? String.fromCharCode(value.v) : formatNumber(value.v, value.f), s: true }
    }
    if (typeof value.v === 'string') fail(`cannot store text in a ${typeName}`, node)
    if (typeof value.v !== 'number') fail(`cannot store this in a ${typeName}`, node)
    if (FLOAT_TYPES.has(typeName)) return num(value.v, true)
    if (typeName === 'bool') return num(value.v !== 0 ? 1 : 0)
    if (Object.hasOwn(INT_BITS, typeName)) {
      const [bits, signed] = INT_BITS[typeName]
      const result = num(wrap(value.v, bits, signed))
      if (typeName === 'char') result.ch = true
      return result
    }
    // Enum types hold ints.
    return num(Math.trunc(value.v))
  }

  function truthy(value) {
    if (typeof value.v === 'string') return value.v.length > 0
    return value.v !== 0
  }

  function text(value, digits) {
    if (typeof value.v === 'string') return value.v
    if (value.ch) return String.fromCharCode(value.v)
    if (value.f) return formatNumber(value.v, true, digits === undefined ? 2 : digits)
    if (digits === 16) return value.v.toString(16).toUpperCase()
    if (digits === 2) return value.v.toString(2)
    return String(value.v)
  }

  // ---- Scopes ----

  function lookup(scope, name, node) {
    for (let frame = scope; frame; frame = frame.parent) {
      if (frame.vars.has(name)) return frame.vars.get(name)
    }
    if (globals.has(name)) return globals.get(name)
    return null
  }

  function newScope(parent) {
    return { vars: new Map(), parent }
  }

  // ---- Clock ----

  function* tick(node) {
    clock += STATEMENT_MS
    steps += 1
    if (clock >= target || steps % YIELD_EVERY === 0) yield clock
  }

  function* wait(ms) {
    yield clock + Math.max(0, ms)
  }

  // ---- Declarations ----

  function* declare(decl, scope, frameVars) {
    const typeName = decl.valueType.name
    for (const item of decl.declarations) {
      if (frameVars.has(item.name)) fail(`${item.name} is already declared here`, item)
      let record
      if (typeName === 'Servo') {
        record = { type: 'Servo', object: { pin: null, angle: 90 }, const: false }
      } else if (item.isArray) {
        let size = null
        if (item.size) size = (yield* evaluate(item.size, scope)).v
        let elements = []
        if (item.init && item.init.type === 'InitList') {
          for (const element of item.init.elements) elements.push(coerce(typeName, yield* evaluate(element, scope), element).v)
        } else if (item.init) {
          const value = yield* evaluate(item.init, scope)
          if (typeof value.v !== 'string' || typeName !== 'char') fail('only a char array can start from text', item)
          elements = [...value.v].map((ch) => ch.charCodeAt(0)).concat(0)
        }
        if (size === null) size = elements.length
        if (!Number.isInteger(size) || size <= 0) fail(`the array ${item.name} needs a size above 0`, item)
        if (elements.length > size) fail(`too many values for ${item.name}, which holds ${size}`, item)
        while (elements.length < size) elements.push(0)
        record = { type: typeName, array: elements, const: decl.valueType.const }
      } else {
        let value
        if (item.init) value = coerce(typeName, yield* evaluate(item.init, scope), item)
        else if (item.args) value = coerce(typeName, item.args.length ? yield* evaluate(item.args[0], scope) : { v: '' }, item)
        else value = typeName === 'String' ? { v: '', s: true } : coerce(typeName, num(0), item)
        record = { type: typeName, value, const: decl.valueType.const }
      }
      frameVars.set(item.name, record)
    }
  }

  // ---- Statements ----
  // exec returns undefined, 'break', 'continue' or { ret: value }.

  function* exec(node, scope) {
    yield* tick(node)
    switch (node.type) {
      case 'Block': {
        const inner = newScope(scope)
        for (const statement of node.body) {
          const result = yield* exec(statement, inner)
          if (result) return result
        }
        return undefined
      }
      case 'VarDecl':
        yield* declare(node, scope, scope.vars)
        return undefined
      case 'ExprStmt':
        yield* evaluate(node.expression, scope)
        return undefined
      case 'Empty':
        return undefined
      case 'If':
        if (truthy(yield* evaluate(node.test, scope))) return yield* exec(node.consequent, scope)
        if (node.alternate) return yield* exec(node.alternate, scope)
        return undefined
      case 'While':
        while (truthy(yield* evaluate(node.test, scope))) {
          const result = yield* exec(node.body, scope)
          if (result === 'break') break
          if (result && result !== 'continue') return result
          yield* tick(node)
        }
        return undefined
      case 'DoWhile':
        do {
          const result = yield* exec(node.body, scope)
          if (result === 'break') break
          if (result && result !== 'continue') return result
        } while (truthy(yield* evaluate(node.test, scope)))
        return undefined
      case 'For': {
        const loopScope = newScope(scope)
        if (node.init) yield* exec(node.init, loopScope)
        while (!node.test || truthy(yield* evaluate(node.test, loopScope))) {
          const result = yield* exec(node.body, loopScope)
          if (result === 'break') break
          if (result && result !== 'continue') return result
          if (node.update) yield* evaluate(node.update, loopScope)
          yield* tick(node)
        }
        return undefined
      }
      case 'Switch': {
        const value = (yield* evaluate(node.discriminant, scope)).v
        let matched = false
        const inner = newScope(scope)
        for (const pass of [false, true]) {
          // First pass looks for a matching case; the second starts at default.
          for (const item of node.cases) {
            if (!matched) {
              if (pass ? item.test !== null : item.test === null) continue
              if (!pass && (yield* evaluate(item.test, scope)).v !== value) continue
              matched = true
            }
            for (const statement of item.body) {
              const result = yield* exec(statement, inner)
              if (result === 'break') return undefined
              if (result) return result
            }
          }
          if (matched) return undefined
        }
        return undefined
      }
      case 'Break':
        return 'break'
      case 'Continue':
        return 'continue'
      case 'Return':
        return { ret: node.argument ? yield* evaluate(node.argument, scope) : null }
      default:
        return fail(`cannot run a ${node.type} here`, node)
    }
  }

  // ---- Expressions ----

  // A storage place for assignment: { get(), set(value) }.
  function* place(node, scope) {
    if (node.type === 'Ident') {
      const record = lookup(scope, node.name, node)
      if (!record) fail(`${node.name} is not declared`, node)
      if (record.array) fail(`${node.name} is an array; use ${node.name}[index]`, node)
      return {
        get: () => record.value,
        set: (value) => {
          if (record.const) fail(`${node.name} is const and cannot change`, node)
          record.value = coerce(record.type, value, node)
          return record.value
        }
      }
    }
    if (node.type === 'Index') {
      const { record, index } = yield* element(node, scope)
      const kind = { f: FLOAT_TYPES.has(record.type), ch: record.type === 'char' }
      return {
        get: () => ({ v: record.array[index], f: kind.f, ch: kind.ch || undefined }),
        set: (value) => {
          if (record.const) fail(`${node.object.name} is const and cannot change`, node)
          record.array[index] = coerce(record.type, value, node).v
          return { v: record.array[index], f: kind.f }
        }
      }
    }
    return fail('cannot assign to this', node)
  }

  function* element(node, scope) {
    if (node.object.type !== 'Ident') fail('only named arrays can be indexed', node)
    const record = lookup(scope, node.object.name, node)
    if (!record) fail(`${node.object.name} is not declared`, node)
    const index = (yield* evaluate(node.index, scope)).v
    if (record.type === 'String' && !record.array) return { record: null, index, string: record }
    if (!record.array) fail(`${node.object.name} is not an array`, node)
    if (!Number.isInteger(index) || index < 0 || index >= record.array.length) {
      fail(`index ${index} is outside ${node.object.name}, which has ${record.array.length} items (0 to ${record.array.length - 1})`, node)
    }
    return { record, index }
  }

  function arithmetic(op, l, r, node) {
    const isString = typeof l.v === 'string' || typeof r.v === 'string'
    if (isString) {
      if (op === '+') return { v: text(l) + text(r), s: true }
      if (op === '==') return num(text(l) === text(r) ? 1 : 0)
      if (op === '!=') return num(text(l) !== text(r) ? 1 : 0)
      if (['<', '>', '<=', '>='].includes(op)) {
        const a = text(l)
        const b = text(r)
        return num({ '<': a < b, '>': a > b, '<=': a <= b, '>=': a >= b }[op] ? 1 : 0)
      }
      fail(`'${op}' does not work on text`, node)
    }
    const f = l.f || r.f
    const a = l.v
    const b = r.v
    switch (op) {
      case '+': return num(a + b, f)
      case '-': return num(a - b, f)
      case '*': return num(a * b, f)
      case '/':
        if (b === 0 && !f) fail('division by zero', node)
        return f ? num(a / b, true) : num(Math.trunc(a / b))
      case '%':
        if (f) fail("'%' needs whole numbers", node)
        if (b === 0) fail('division by zero', node)
        return num(a % b)
      case '<': return num(a < b ? 1 : 0)
      case '>': return num(a > b ? 1 : 0)
      case '<=': return num(a <= b ? 1 : 0)
      case '>=': return num(a >= b ? 1 : 0)
      case '==': return num(a === b ? 1 : 0)
      case '!=': return num(a !== b ? 1 : 0)
      case '&': case '|': case '^': case '<<': case '>>':
        if (f) fail(`'${op}' needs whole numbers`, node)
        return num({ '&': a & b, '|': a | b, '^': a ^ b, '<<': a << b, '>>': a >> b }[op])
      default:
        return fail(`unknown operator ${op}`, node)
    }
  }

  function* evaluate(node, scope) {
    switch (node.type) {
      case 'Number': return num(node.value, node.isFloat)
      case 'String': return { v: node.value, s: true }
      case 'Char': return { v: node.value.charCodeAt(0), f: false, ch: true }
      case 'Bool': return num(node.value ? 1 : 0)
      case 'Ident': {
        const record = lookup(scope, node.name, node)
        if (record) {
          if (record.array) return { v: record.array, array: record }
          if (record.object) return { v: record.object, object: record.type }
          return record.value
        }
        if (enumValues.has(node.name)) return num(enumValues.get(node.name))
        if (Object.hasOwn(CONSTANTS, node.name)) return num(CONSTANTS[node.name])
        if (node.name === 'Serial') return num(1)
        return fail(`${node.name} is not declared`, node)
      }
      case 'Sequence': {
        let last = null
        for (const item of node.expressions) last = yield* evaluate(item, scope)
        return last
      }
      case 'Assign': {
        const target = yield* place(node.target, scope)
        const value = yield* evaluate(node.value, scope)
        if (node.operator === '=') return target.set(value)
        return target.set(arithmetic(node.operator.slice(0, -1), target.get(), value, node))
      }
      case 'Conditional':
        return truthy(yield* evaluate(node.test, scope))
          ? yield* evaluate(node.consequent, scope)
          : yield* evaluate(node.alternate, scope)
      case 'Binary': {
        if (node.operator === '&&') {
          if (!truthy(yield* evaluate(node.left, scope))) return num(0)
          return num(truthy(yield* evaluate(node.right, scope)) ? 1 : 0)
        }
        if (node.operator === '||') {
          if (truthy(yield* evaluate(node.left, scope))) return num(1)
          return num(truthy(yield* evaluate(node.right, scope)) ? 1 : 0)
        }
        const left = yield* evaluate(node.left, scope)
        const right = yield* evaluate(node.right, scope)
        return arithmetic(node.operator, left, right, node)
      }
      case 'Unary': {
        const value = yield* evaluate(node.argument, scope)
        if (node.operator === '!') return num(truthy(value) ? 0 : 1)
        if (typeof value.v !== 'number') fail(`'${node.operator}' needs a number`, node)
        if (node.operator === '-') return num(-value.v, value.f)
        if (node.operator === '+') return num(value.v, value.f)
        return num(~value.v)
      }
      case 'Update': {
        const target = yield* place(node.argument, scope)
        const before = target.get()
        const after = target.set(num(before.v + (node.operator === '++' ? 1 : -1), before.f))
        return node.prefix ? after : before
      }
      case 'Cast': {
        const value = yield* evaluate(node.argument, scope)
        return coerce(node.valueType.name, value, node)
      }
      case 'Index': {
        const found = yield* element(node, scope)
        if (found.string) {
          const s = found.string.value.v
          return { v: found.index >= 0 && found.index < s.length ? s.charCodeAt(found.index) : 0, f: false, ch: true }
        }
        return { v: found.record.array[found.index], f: FLOAT_TYPES.has(found.record.type), ch: found.record.type === 'char' || undefined }
      }
      case 'Call':
        return yield* call(node, scope)
      case 'Member':
        return fail(`${node.property} needs brackets, like ${node.property}()`, node)
      case 'InitList':
        return fail('a { } list can only start an array', node)
      default:
        return fail(`cannot work out a ${node.type}`, node)
    }
  }

  function* evaluateArgs(args, scope) {
    const values = []
    for (const arg of args) values.push(yield* evaluate(arg, scope))
    return values
  }

  function needArgs(name, values, count, node) {
    const [min, max] = Array.isArray(count) ? count : [count, count]
    if (values.length < min || values.length > max) {
      const want = min === max ? `${min}` : `${min} to ${max}`
      fail(`${name}() takes ${want} value${max === 1 ? '' : 's'}, not ${values.length}`, node)
    }
  }

  function* call(node, scope) {
    if (node.callee.type === 'Member') return yield* callMethod(node, scope)
    const name = node.callee.name
    if (functions.has(name)) return yield* callUser(functions.get(name), node, scope)
    const values = yield* evaluateArgs(node.args, scope)
    const n = (i) => values[i].v
    switch (name) {
      case 'pinMode':
        needArgs(name, values, 2, node)
        hw.pinMode(pinName(n(0), node.line), PIN_MODES[n(1)] || 'INPUT')
        return null
      case 'digitalWrite':
        needArgs(name, values, 2, node)
        hw.digitalWrite(pinName(n(0), node.line), n(1) ? 1 : 0)
        return null
      case 'digitalRead':
        needArgs(name, values, 1, node)
        return num(hw.digitalRead(pinName(n(0), node.line)))
      case 'analogRead':
        needArgs(name, values, 1, node)
        // A bare 0 to 5 means A0 to A5, like on the Uno.
        return num(hw.analogRead(pinName(n(0) < 14 ? n(0) + 14 : n(0), node.line)))
      case 'analogWrite':
        needArgs(name, values, 2, node)
        hw.analogWrite(pinName(n(0), node.line), Math.min(255, Math.max(0, Math.trunc(n(1)))))
        return null
      case 'delay':
        needArgs(name, values, 1, node)
        yield* wait(n(0))
        return null
      case 'delayMicroseconds':
        needArgs(name, values, 1, node)
        yield* wait(n(0) / 1000)
        return null
      case 'millis':
        needArgs(name, values, 0, node)
        return num(wrap(Math.floor(clock), 32, false))
      case 'micros':
        needArgs(name, values, 0, node)
        return num(wrap(Math.floor(clock * 1000), 32, false))
      case 'tone':
        needArgs(name, values, [2, 3], node)
        hw.tone(pinName(n(0), node.line), n(1), values.length === 3 ? n(2) : null)
        return null
      case 'noTone':
        needArgs(name, values, 1, node)
        hw.noTone(pinName(n(0), node.line))
        return null
      case 'map':
        needArgs(name, values, 5, node)
        if (n(2) === n(1)) fail('map() needs two different input ends', node)
        return num(Math.trunc((n(0) - n(1)) * (n(4) - n(3)) / (n(2) - n(1))) + n(3))
      case 'constrain':
        needArgs(name, values, 3, node)
        return num(Math.min(n(2), Math.max(n(1), n(0))), values.some((value) => value.f))
      case 'min':
      case 'max':
        needArgs(name, values, 2, node)
        return num(Math[name](n(0), n(1)), values[0].f || values[1].f)
      case 'abs':
        needArgs(name, values, 1, node)
        return num(Math.abs(n(0)), values[0].f)
      case 'sqrt':
      case 'sin':
      case 'cos':
        needArgs(name, values, 1, node)
        return num(Math[name](n(0)), true)
      case 'pow':
        needArgs(name, values, 2, node)
        return num(n(0) ** n(1), true)
      case 'random': {
        needArgs(name, values, [1, 2], node)
        const [low, high] = values.length === 1 ? [0, n(0)] : [n(0), n(1)]
        return num(high <= low ? low : low + Math.floor(hw.random() * (high - low)))
      }
      case 'randomSeed':
        return null
      default:
        return fail(`${name}() is not a known function`, node)
    }
  }

  function* callUser(fn, node, scope) {
    if (fn.params.length !== node.args.length) {
      fail(`${fn.name}() takes ${fn.params.length} value${fn.params.length === 1 ? '' : 's'}, not ${node.args.length}`, node)
    }
    if (depth >= MAX_DEPTH) fail(`too many nested calls; does ${fn.name}() call itself forever?`, node)
    const frame = newScope(null)
    for (let i = 0; i < fn.params.length; i++) {
      const param = fn.params[i]
      const value = yield* evaluate(node.args[i], scope)
      if (param.isArray) {
        if (!value.array) fail(`${fn.name}() needs an array for ${param.name}`, node)
        // Arrays are passed by reference, like in C.
        frame.vars.set(param.name, value.array)
      } else {
        frame.vars.set(param.name, { type: param.valueType.name, value: coerce(param.valueType.name, value, node), const: param.valueType.const })
      }
    }
    depth += 1
    let result
    try {
      result = yield* exec(fn.body, frame)
    } finally {
      depth -= 1
    }
    const returned = result && result.ret !== undefined ? result.ret : null
    if (fn.returnType.name === 'void') return null
    if (!returned) fail(`${fn.name}() must return a ${fn.returnType.name}`, fn)
    return coerce(fn.returnType.name, returned, node)
  }

  function* callMethod(node, scope) {
    const { object, property } = node.callee
    const values = yield* evaluateArgs(node.args, scope)
    if (object.type === 'Ident' && object.name === 'Serial' && !lookup(scope, 'Serial')) {
      return serialMethod(property, values, node)
    }
    if (object.type !== 'Ident') {
      // A method on a temporary String, like String(n).length().
      const value = yield* evaluate(object, scope)
      if (typeof value.v !== 'string') fail(`cannot call ${property}() on this`, node)
      return stringMethod({ type: 'String', value: { v: value.v, s: true }, const: false }, property, values, node)
    }
    const record = lookup(scope, object.name, node)
    if (!record) fail(`${object.name} is not declared`, node)
    if (record.type === 'Servo') return servoMethod(record.object, property, values, node)
    if (record.type === 'String' && !record.array) return stringMethod(record, property, values, node)
    return fail(`${object.name} has no method ${property}()`, node)
  }

  function serialMethod(property, values, node) {
    switch (property) {
      case 'begin':
        return null
      case 'print':
      case 'println': {
        needArgs(`Serial.${property}`, values, [0, 2], node)
        const out = values.length ? text(values[0], values.length === 2 ? values[1].v : undefined) : ''
        hw.serialWrite(property === 'println' ? out + '\n' : out)
        return null
      }
      case 'available':
        return num(hw.serialAvailable())
      case 'read':
        return num(hw.serialRead())
      case 'readString':
      case 'readStringUntil': {
        const stop = property === 'readStringUntil' ? values[0].v : -1
        let out = ''
        for (;;) {
          const code = hw.serialRead()
          if (code === -1 || code === stop) break
          out += String.fromCharCode(code)
        }
        return { v: out, s: true }
      }
      case 'parseInt': {
        let out = ''
        for (;;) {
          const code = hw.serialRead()
          if (code === -1) break
          const ch = String.fromCharCode(code)
          if (/[0-9]/.test(ch) || (ch === '-' && out === '')) out += ch
          else if (out !== '') break
        }
        return num(out === '' || out === '-' ? 0 : Number(out))
      }
      default:
        return fail(`Serial.${property}() is not supported`, node)
    }
  }

  function servoMethod(servo, property, values, node) {
    switch (property) {
      case 'attach':
        needArgs('attach', values, [1, 3], node)
        servo.pin = pinName(values[0].v, node.line)
        hw.servoWrite(servo.pin, servo.angle)
        return null
      case 'write':
        needArgs('write', values, 1, node)
        servo.angle = Math.min(180, Math.max(0, Math.trunc(values[0].v)))
        if (servo.pin === null) fail('call attach() before write()', node)
        hw.servoWrite(servo.pin, servo.angle)
        return null
      case 'read':
        return num(servo.angle)
      case 'detach':
        servo.pin = null
        return null
      default:
        return fail(`a Servo has no method ${property}()`, node)
    }
  }

  function stringMethod(record, property, values, node) {
    const s = record.value.v
    const set = (v) => {
      if (record.const) fail('this String is const and cannot change', node)
      record.value = { v, s: true }
      return null
    }
    switch (property) {
      case 'length': return num(s.length)
      case 'toInt': return num(Number.parseInt(s, 10) || 0)
      case 'toFloat': return num(Number.parseFloat(s) || 0, true)
      case 'trim': return set(s.trim())
      case 'toUpperCase': return set(s.toUpperCase())
      case 'toLowerCase': return set(s.toLowerCase())
      case 'equals': return num(s === text(values[0]) ? 1 : 0)
      case 'equalsIgnoreCase': return num(s.toLowerCase() === text(values[0]).toLowerCase() ? 1 : 0)
      case 'startsWith': return num(s.startsWith(text(values[0])) ? 1 : 0)
      case 'endsWith': return num(s.endsWith(text(values[0])) ? 1 : 0)
      case 'indexOf': return num(s.indexOf(text(values[0])))
      case 'charAt': return { v: s.charCodeAt(values[0].v) || 0, f: false, ch: true }
      case 'substring': return { v: s.substring(values[0].v, values.length > 1 ? values[1].v : undefined), s: true }
      default: return fail(`a String has no method ${property}()`, node)
    }
  }

  // ---- Program ----

  for (const item of program.body) {
    if (item.type === 'Function') {
      if (functions.has(item.name)) fail(`${item.name}() is defined twice`, item)
      functions.set(item.name, item)
    }
  }
  if (!functions.has('setup')) fail('the sketch needs a void setup() function', program)
  if (!functions.has('loop')) fail('the sketch needs a void loop() function', program)

  function* main() {
    const top = { vars: globals, parent: null }
    for (const item of program.body) {
      if (item.type === 'Enum') {
        let value = -1
        for (const member of item.members) {
          value = member.value ? (yield* evaluate(member.value, top)).v : value + 1
          enumValues.set(member.name, value)
        }
      } else if (item.type === 'VarDecl') {
        yield* declare(item, top, globals)
      }
    }
    const callNode = (name) => ({ type: 'Call', callee: { type: 'Ident', name }, args: [], line: functions.get(name).line })
    yield* call(callNode('setup'), top)
    const loopCall = callNode('loop')
    for (;;) {
      yield* call(loopCall, top)
      yield* tick(loopCall)
    }
  }

  const runner = main()

  // Runs until the clock reaches untilMs. Returns null, or the error that stopped it.
  function advance(untilMs) {
    if (error || done) return error
    target = untilMs
    try {
      for (;;) {
        if (waitUntil !== null) {
          if (waitUntil > untilMs) {
            clock = Math.max(clock, untilMs)
            return null
          }
          clock = Math.max(clock, waitUntil)
          waitUntil = null
        }
        const step = runner.next()
        if (step.done) {
          done = true
          return null
        }
        waitUntil = step.value
      }
    } catch (caught) {
      error = caught instanceof CodeError ? caught : new CodeError(String(caught.message || caught), 1, 1)
      return error
    }
  }

  return {
    advance,
    millis: () => clock,
    get error() {
      return error
    }
  }
}
