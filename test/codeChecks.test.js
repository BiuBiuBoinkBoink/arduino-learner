import { describe, it, expect } from 'vitest'
import { analyzeCode, findCalls, countCalls, callLines, definesFunction } from '../src/runner/codeChecks.js'
import { createResponseTimer } from '../src/sim/responseTimer.js'
import { createSession } from '../src/runner/session.js'

const SKETCH = `#include <Servo.h>
Servo arm;
void blink(int ms) {
  digitalWrite(13, HIGH);
  delay(ms);
}
void setup() {
  arm.attach(9);
  Serial.begin(9600);
}
void loop() {
  blink(100);
  delay(200);
  if (millis() > 10) Serial.println(analogRead(A0));
}`

describe('analyzeCode', () => {
  const analysis = analyzeCode(SKETCH)

  it('lists functions, includes and every call with its line and function', () => {
    expect(analysis.error).toBe(null)
    expect(analysis.functions).toEqual(['blink', 'setup', 'loop'])
    expect(analysis.includes).toEqual(['Servo.h'])
    expect(findCalls(analysis, 'blink')).toEqual([{ name: 'blink', line: 12, inFunction: 'loop' }])
    expect(definesFunction(analysis, 'blink')).toBe(true)
    expect(definesFunction(analysis, 'setup2')).toBe(false)
  })

  it('counts calls, also inside one function, and finds their lines', () => {
    expect(countCalls(analysis, 'delay')).toBe(2)
    expect(countCalls(analysis, 'delay', { inFunction: 'loop' })).toBe(1)
    expect(callLines(analysis, 'delay')).toEqual([5, 13])
    expect(countCalls(analysis, 'Serial.println')).toBe(1)
    expect(countCalls(analysis, 'analogRead')).toBe(1)
    expect(countCalls(analysis, 'millis')).toBe(1)
    expect(countCalls(analysis, 'arm.attach', { inFunction: 'setup' })).toBe(1)
    expect(countCalls(analysis, 'tone')).toBe(0)
  })

  it('reports code that does not parse instead of throwing', () => {
    const broken = analyzeCode('void setup() {')
    expect(broken.error.line).toBe(1)
    expect(countCalls(broken, 'delay')).toBe(0)
  })
})

describe('createResponseTimer', () => {
  it('measures from an input change to the next output change', () => {
    const timer = createResponseTimer({ inputPin: 'D2', outputPin: 'D13' })
    timer.output({ kind: 'pin', pin: 'D13', value: 1, at: 5 })
    expect(timer.last()).toBe(null)
    timer.output({ kind: 'input', pin: 'D2', value: 0, at: 100 })
    expect(timer.waiting(130)).toBe(30)
    timer.output({ kind: 'pin', pin: 'D9', value: 1, at: 110 })
    timer.output({ kind: 'pin', pin: 'D13', value: 1, at: 140 })
    timer.output({ kind: 'input', pin: 'D2', value: null, at: 300 })
    timer.output({ kind: 'input', pin: 'D2', value: 0, at: 310 })
    timer.output({ kind: 'pin', pin: 'D13', value: 0, at: 320 })
    expect(timer.times()).toEqual([40, 10])
    expect(timer.worst()).toBe(40)
    expect(timer.waiting(400)).toBe(null)
  })
})

describe('session input events', () => {
  it('records each real input change at the time the sketch sees it', () => {
    const session = createSession('void setup() {}\nvoid loop() { delay(10); }')
    session.advance(50)
    session.setInputs({ D2: 0, A0: 0.5 })
    session.setInputs({ D2: 0 })
    session.setInputs({ D2: null })
    const events = session.advance(60).events.filter((event) => event[1] === 'input')
    expect(events).toEqual([[50, 'input', 'D2', 0], [50, 'input', 'A0', 0.5], [50, 'input', 'D2', null]])
  })
})
