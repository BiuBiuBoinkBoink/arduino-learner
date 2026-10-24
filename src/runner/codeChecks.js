// Code checks: what a goal can learn from the learner's code itself, without
// running it. Pure module. analyzeCode(source) walks the AST once and returns
// an analysis for the helpers below, or { error } when the code does not parse.
// Calls are named as written: 'delay', 'Serial.println', 'arm.write'.
import { parse } from './parser.js'

// Name of a call as written, or null for a call on an expression.
function callName(callee) {
  if (callee.type === 'Ident') return callee.name
  if (callee.type === 'Member' && callee.object.type === 'Ident') return `${callee.object.name}.${callee.property}`
  return null
}

export function analyzeCode(source) {
  let program
  try {
    program = parse(source)
  } catch (error) {
    return { error: { message: error.message, line: error.line || 1 }, calls: [], functions: [], includes: [] }
  }
  const calls = []
  const functions = []

  // Visits every node below node; fn names the function being walked.
  function walk(node, fn) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item, fn)
      return
    }
    if (node.type === 'Call') {
      const name = callName(node.callee)
      if (name) calls.push({ name, line: node.line, inFunction: fn })
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'line' || key === 'type') continue
      if (value && typeof value === 'object') walk(value, fn)
    }
  }

  for (const item of program.body) {
    if (item.type === 'Function') {
      functions.push(item.name)
      walk(item.body, item.name)
    } else {
      walk(item, null)
    }
  }
  return { error: null, calls, functions, includes: program.includes }
}

// Calls of name, optionally only those inside one function (like 'loop').
export function findCalls(analysis, name, { inFunction } = {}) {
  return analysis.calls.filter((call) => call.name === name && (inFunction === undefined || call.inFunction === inFunction))
}

export function countCalls(analysis, name, options) {
  return findCalls(analysis, name, options).length
}

// Lines where name is called, for pointing the learner at them.
export function callLines(analysis, name, options) {
  return findCalls(analysis, name, options).map((call) => call.line)
}

export function definesFunction(analysis, name) {
  return analysis.functions.includes(name)
}
