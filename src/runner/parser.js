// Parser for the Arduino C subset: setup and loop, int long unsigned float
// double bool char byte String, const, arrays, enum, functions, if else, for,
// while, do while, switch, break, continue, return, library objects (Servo)
// and #include lines. Pure module. parse(source) -> Program AST; every node
// carries its line. Errors throw a CodeError naming the line.
import { lex, CodeError } from './lexer.js'

const TYPE_WORDS = new Set(['void', 'int', 'long', 'unsigned', 'float', 'double', 'bool', 'boolean', 'char', 'byte', 'String'])
// Library classes a sketch may declare objects of.
export const LIBRARY_CLASSES = new Set(['Servo'])

const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>='])
// Binary operators from loosest to tightest.
const BINARY_LEVELS = [
  ['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']
]

function describe(token) {
  if (token.type === 'eof') return 'the end of the code'
  if (token.type === 'string') return `"${token.value}"`
  return `'${token.value}'`
}

export function parse(source) {
  const tokens = lex(source)
  const enumNames = new Set()
  let pos = 0

  const peek = (offset = 0) => tokens[Math.min(pos + offset, tokens.length - 1)]
  const next = () => tokens[pos++]
  const is = (value, offset = 0) => {
    const token = peek(offset)
    return (token.type === 'op' || token.type === 'keyword') && token.value === value
  }
  const fail = (message, token = peek()) => {
    throw new CodeError(message, token.line, token.column)
  }

  function accept(value) {
    if (!is(value)) return false
    pos += 1
    return true
  }

  // A missing ';' or ')' is reported at the end of the token before it.
  function expect(value, what) {
    if (accept(value)) return tokens[pos - 1]
    const prev = tokens[pos - 1]
    if ((value === ';' || value === ')') && prev && prev.line < peek().line) {
      throw new CodeError(`expected '${value}' ${what}`, prev.line, prev.column)
    }
    return fail(`expected '${value}' ${what}, found ${describe(peek())}`)
  }

  function identifier(what) {
    const token = peek()
    if (token.type !== 'ident') fail(`expected ${what}, found ${describe(token)}`)
    pos += 1
    return token.value
  }

  // True when a type starts at offset (a type keyword, enum name or library class).
  function startsType(offset = 0) {
    const token = peek(offset)
    if (token.type === 'keyword') return TYPE_WORDS.has(token.value) || token.value === 'const'
    return token.type === 'ident' && (enumNames.has(token.value) || LIBRARY_CLASSES.has(token.value))
  }

  // A declaration starts with a type followed by a name (not a cast like int(x)).
  function startsDeclaration() {
    if (!startsType()) return false
    let offset = 0
    while (startsType(offset)) offset += 1
    return peek(offset).type === 'ident'
  }

  function parseType() {
    const line = peek().line
    let isConst = accept('const')
    const words = []
    while (peek().type === 'keyword' && TYPE_WORDS.has(peek().value)) words.push(next().value)
    if (words.length === 0) {
      const token = peek()
      if (token.type === 'ident' && (enumNames.has(token.value) || LIBRARY_CLASSES.has(token.value))) words.push(next().value)
      else fail(`expected a type, found ${describe(token)}`)
    }
    if (accept('const')) isConst = true
    // 'unsigned' alone means unsigned int; 'boolean' is Arduino's bool.
    let name = words.join(' ')
    if (name === 'unsigned') name = 'unsigned int'
    if (name === 'boolean') name = 'bool'
    if (name === 'long int') name = 'long'
    if (name === 'unsigned long int') name = 'unsigned long'
    return { name, const: isConst, line }
  }

  // ---- Top level ----

  function parseProgram() {
    const includes = []
    const body = []
    while (peek().type !== 'eof') {
      const token = peek()
      if (token.type === 'include') {
        includes.push(next().value)
        continue
      }
      if (is('enum')) {
        body.push(parseEnum())
        continue
      }
      if (!startsType()) fail(`expected a variable or function, found ${describe(token)}`)
      const type = parseType()
      const nameToken = peek()
      const name = identifier('a name after the type')
      if (is('(')) body.push(parseFunction(type, name, nameToken.line))
      else body.push(parseDeclarationRest(type, name, nameToken.line))
    }
    return { type: 'Program', includes, body, line: 1 }
  }

  function parseEnum() {
    const line = next().line
    const name = identifier('an enum name')
    enumNames.add(name)
    expect('{', 'to start the enum values')
    // A member's value is its expression, or null for one more than the last.
    const members = []
    while (!is('}')) {
      const memberLine = peek().line
      const member = identifier('an enum value name')
      const value = accept('=') ? parseConditional() : null
      members.push({ name: member, value, line: memberLine })
      if (!accept(',')) break
    }
    expect('}', 'to close the enum')
    expect(';', 'after the enum')
    return { type: 'Enum', name, members, line }
  }

  function parseFunction(returnType, name, line) {
    expect('(', 'to start the parameter list')
    const params = []
    if (!(is(')') || (is('void') && is(')', 1)))) {
      do {
        const type = parseType()
        const paramName = identifier('a parameter name')
        let isArray = false
        if (accept('[')) {
          expect(']', 'after [ in an array parameter')
          isArray = true
        }
        params.push({ type: 'Param', valueType: type, name: paramName, isArray, line: type.line })
      } while (accept(','))
    } else {
      accept('void')
    }
    expect(')', 'to close the parameter list')
    if (accept(';')) return { type: 'Prototype', returnType, name, params, line }
    if (!is('{')) fail(`expected '{' to start the body of ${name}, found ${describe(peek())}`)
    return { type: 'Function', returnType, name, params, body: parseBlock(), line }
  }

  // After 'type name': [size] = init, more names, then ';'.
  function parseDeclarationRest(valueType, firstName, line) {
    const declarations = []
    let name = firstName
    let nameLine = line
    for (;;) {
      let size = null
      let isArray = false
      if (accept('[')) {
        isArray = true
        if (!is(']')) size = parseExpression()
        expect(']', 'to close the array size')
      }
      let init = null
      let args = null
      if (accept('=')) init = is('{') ? parseInitList() : parseAssignment()
      else if (is('(') && !isArray) {
        // Constructor style, like String name("hi").
        next()
        args = is(')') ? [] : parseArguments()
        expect(')', 'to close the arguments')
      }
      if (isArray && size === null && (!init || init.type !== 'InitList')) {
        fail(`the array ${name} needs a size or a list of values`)
      }
      declarations.push({ name, isArray, size, init, args, line: nameLine })
      if (!accept(',')) break
      nameLine = peek().line
      name = identifier('a name after the comma')
    }
    expect(';', 'after the declaration')
    return { type: 'VarDecl', valueType, declarations, line: valueType.line }
  }

  function parseInitList() {
    const line = expect('{', 'to start the list').line
    const elements = []
    while (!is('}')) {
      elements.push(is('{') ? parseInitList() : parseAssignment())
      if (!accept(',')) break
    }
    expect('}', 'to close the list')
    return { type: 'InitList', elements, line }
  }

  // ---- Statements ----

  function parseBlock() {
    const line = expect('{', 'to start the block').line
    const body = []
    while (!is('}')) {
      if (peek().type === 'eof') fail("this block is missing its closing '}'", tokens[pos - 1])
      body.push(parseStatement())
    }
    next()
    return { type: 'Block', body, line }
  }

  function parseStatement() {
    const token = peek()
    const line = token.line
    if (is('{')) return parseBlock()
    if (accept(';')) return { type: 'Empty', line }
    if (accept('if')) {
      expect('(', "after 'if'")
      const test = parseExpression()
      expect(')', 'to close the if condition')
      const consequent = parseStatement()
      const alternate = accept('else') ? parseStatement() : null
      return { type: 'If', test, consequent, alternate, line }
    }
    if (accept('while')) {
      expect('(', "after 'while'")
      const test = parseExpression()
      expect(')', 'to close the while condition')
      return { type: 'While', test, body: parseStatement(), line }
    }
    if (accept('do')) {
      const body = parseStatement()
      expect('while', "after the do body")
      expect('(', "after 'while'")
      const test = parseExpression()
      expect(')', 'to close the while condition')
      expect(';', 'after the do while')
      return { type: 'DoWhile', body, test, line }
    }
    if (accept('for')) {
      expect('(', "after 'for'")
      let init = null
      if (!is(';')) {
        if (startsDeclaration()) {
          const type = parseType()
          const nameLine = peek().line
          init = parseDeclarationRest(type, identifier('a loop variable name'), nameLine)
        } else {
          init = { type: 'ExprStmt', expression: parseExpression(), line }
          expect(';', 'after the for setup')
        }
      } else {
        next()
      }
      const test = is(';') ? null : parseExpression()
      expect(';', 'after the for condition')
      const update = is(')') ? null : parseExpression()
      expect(')', 'to close the for loop header')
      return { type: 'For', init, test, update, body: parseStatement(), line }
    }
    if (accept('switch')) return parseSwitch(line)
    if (accept('break')) {
      expect(';', "after 'break'")
      return { type: 'Break', line }
    }
    if (accept('continue')) {
      expect(';', "after 'continue'")
      return { type: 'Continue', line }
    }
    if (accept('return')) {
      const argument = is(';') ? null : parseExpression()
      expect(';', 'after the return value')
      return { type: 'Return', argument, line }
    }
    if (is('case') || is('default')) fail(`'${token.value}' can only be used inside a switch`)
    if (is('else')) fail("this 'else' has no 'if' before it")
    if (is('enum')) fail('declare enums outside functions')
    if (startsDeclaration()) {
      const type = parseType()
      const nameLine = peek().line
      return parseDeclarationRest(type, identifier('a name after the type'), nameLine)
    }
    const expression = parseExpression()
    expect(';', 'after the statement')
    return { type: 'ExprStmt', expression, line }
  }

  function parseSwitch(line) {
    expect('(', "after 'switch'")
    const discriminant = parseExpression()
    expect(')', 'to close the switch value')
    expect('{', 'to start the switch body')
    const cases = []
    while (!is('}')) {
      const caseLine = peek().line
      let test = null
      if (accept('case')) test = parseConditional()
      else if (!accept('default')) fail(`expected 'case' or 'default' in the switch, found ${describe(peek())}`)
      expect(':', 'after the case value')
      const body = []
      while (!is('case') && !is('default') && !is('}')) {
        if (peek().type === 'eof') fail("this switch is missing its closing '}'")
        body.push(parseStatement())
      }
      cases.push({ test, body, line: caseLine })
    }
    next()
    return { type: 'Switch', discriminant, cases, line }
  }

  // ---- Expressions ----

  function parseExpression() {
    const first = parseAssignment()
    if (!is(',')) return first
    const expressions = [first]
    while (accept(',')) expressions.push(parseAssignment())
    return { type: 'Sequence', expressions, line: first.line }
  }

  function parseAssignment() {
    const left = parseConditional()
    const token = peek()
    if (token.type === 'op' && ASSIGN_OPS.has(token.value)) {
      if (!['Ident', 'Index', 'Member'].includes(left.type)) fail(`cannot assign to this expression with '${token.value}'`, token)
      next()
      return { type: 'Assign', operator: token.value, target: left, value: parseAssignment(), line: left.line }
    }
    return left
  }

  function parseConditional() {
    const test = parseBinary(0)
    if (!accept('?')) return test
    const consequent = parseAssignment()
    expect(':', "in the ? : expression")
    const alternate = parseConditional()
    return { type: 'Conditional', test, consequent, alternate, line: test.line }
  }

  function parseBinary(level) {
    if (level === BINARY_LEVELS.length) return parseUnary()
    let left = parseBinary(level + 1)
    for (;;) {
      const token = peek()
      if (token.type !== 'op' || !BINARY_LEVELS[level].includes(token.value)) return left
      next()
      left = { type: 'Binary', operator: token.value, left, right: parseBinary(level + 1), line: left.line }
    }
  }

  function parseUnary() {
    const token = peek()
    if (token.type === 'op' && ['!', '-', '+', '~'].includes(token.value)) {
      next()
      return { type: 'Unary', operator: token.value, argument: parseUnary(), line: token.line }
    }
    if (token.type === 'op' && (token.value === '++' || token.value === '--')) {
      next()
      const argument = parseUnary()
      if (!['Ident', 'Index', 'Member'].includes(argument.type)) fail(`'${token.value}' needs a variable`, token)
      return { type: 'Update', operator: token.value, prefix: true, argument, line: token.line }
    }
    // C style cast: (int) x
    if (is('(') && peek(1).type === 'keyword' && TYPE_WORDS.has(peek(1).value)) {
      let offset = 1
      while (peek(offset).type === 'keyword' && TYPE_WORDS.has(peek(offset).value)) offset += 1
      if (peek(offset).type === 'op' && peek(offset).value === ')') {
        next()
        const valueType = parseType()
        expect(')', 'to close the cast')
        return { type: 'Cast', valueType, argument: parseUnary(), line: token.line }
      }
    }
    return parsePostfix(parsePrimary())
  }

  function parseArguments() {
    const args = [parseAssignment()]
    while (accept(',')) args.push(parseAssignment())
    return args
  }

  function parsePostfix(expression) {
    for (;;) {
      const token = peek()
      if (accept('(')) {
        if (!['Ident', 'Member'].includes(expression.type)) fail('only functions and methods can be called', token)
        const args = is(')') ? [] : parseArguments()
        expect(')', 'to close the call')
        expression = { type: 'Call', callee: expression, args, line: expression.line }
      } else if (accept('[')) {
        const index = parseExpression()
        expect(']', 'to close the index')
        expression = { type: 'Index', object: expression, index, line: expression.line }
      } else if (accept('.')) {
        const property = identifier('a method or field name after .')
        expression = { type: 'Member', object: expression, property, line: expression.line }
      } else if (is('++') || is('--')) {
        if (!['Ident', 'Index', 'Member'].includes(expression.type)) fail(`'${token.value}' needs a variable`, token)
        next()
        expression = { type: 'Update', operator: token.value, prefix: false, argument: expression, line: expression.line }
      } else {
        return expression
      }
    }
  }

  function parsePrimary() {
    const token = peek()
    const line = token.line
    if (token.type === 'number') {
      next()
      return { type: 'Number', value: token.value, isFloat: token.isFloat, line }
    }
    if (token.type === 'string') {
      next()
      return { type: 'String', value: token.value, line }
    }
    if (token.type === 'char') {
      next()
      return { type: 'Char', value: token.value, line }
    }
    if (is('true') || is('false')) {
      next()
      return { type: 'Bool', value: token.value === 'true', line }
    }
    if (token.type === 'ident') {
      next()
      // Enum scope, like State::RED.
      if (accept('::')) return { type: 'Ident', name: identifier('a name after ::'), scope: token.value, line }
      return { type: 'Ident', name: token.value, line }
    }
    // Function style cast or String constructor: int(x), float(x), String(n).
    if (token.type === 'keyword' && TYPE_WORDS.has(token.value) && is('(', 1)) {
      const valueType = parseType()
      next()
      const args = is(')') ? [] : parseArguments()
      expect(')', 'to close the conversion')
      if (args.length !== 1) fail(`${valueType.name}( ) takes one value`, token)
      return { type: 'Cast', valueType, argument: args[0], line }
    }
    if (accept('(')) {
      const expression = parseExpression()
      expect(')', 'to close the bracket')
      return expression
    }
    if (token.type === 'keyword' && TYPE_WORDS.has(token.value)) fail(`a declaration of ${token.value} cannot go here`)
    return fail(`expected a value, found ${describe(token)}`)
  }

  return parseProgram()
}
