import { describe, it, expect } from 'vitest'
import { whatIfCode, whatIfCircuit, mainPin, cyclePhrase } from '../src/explain/whatIf.js'
import { circuits } from '../src/circuits/circuits.js'
import { lessons } from '../src/course/lessons.js'
import { defaultValues, slotValues, fillSketch } from '../src/ui/sketch.js'

function blinkSource() {
  const { code, params } = lessons.find((lesson) => lesson.id === '1.2').sketch
  return fillSketch(code, slotValues(params, defaultValues(params)))
}

describe('whatIfCode', () => {
  it('1.2 with line 10 at delay(200) goes from a 1000 ms cycle to about 700 ms', () => {
    const source = blinkSource()
    expect(source.split('\n')[9].trim()).toBe('delay(500);')
    const result = whatIfCode({ lessonId: '1.2', source, values: {}, line: 10, text: '  delay(200);' })
    expect(result.error).toBe(null)
    expect(result.pin).toBe('D13')
    expect(result.before.summary.periodMs).toBeCloseTo(1000, -1)
    expect(result.after.summary.periodMs).toBeGreaterThan(680)
    expect(result.after.summary.periodMs).toBeLessThan(720)
    expect(cyclePhrase('D13', result.before)).toBe('one cycle every 1000 ms')
    expect(cyclePhrase('D13', result.after)).toBe('one cycle every 700 ms')
  })

  it('reports a changed line that does not compile, and a line that is not there', () => {
    const source = blinkSource()
    expect(whatIfCode({ lessonId: '1.2', source, line: 10, text: '  delay(200' }).error.line).toBeGreaterThan(0)
    expect(whatIfCode({ lessonId: '1.2', source, line: 99, text: '' }).error.message).toBe('The sketch has no line 99.')
  })

  it('finds the main output pin of each kind of lesson', () => {
    expect(mainPin('1.2')).toBe('D13')
    expect(mainPin('1.8')).toBe('D9')
    expect(mainPin('1.11')).toBe('D8')
    expect(mainPin('1.12')).toBe('D9')
    expect(mainPin('1.6')).toBe(null)
    expect(mainPin('1.1')).toBe(null)
  })
})

describe('whatIfCircuit', () => {
  it('flipping the 1.2 LED makes it dark, because it is backwards', () => {
    const result = whatIfCircuit(circuits['1.2'], { kind: 'flip', target: 'led1' })
    expect(result.before.led1).toMatchObject({ lit: true, brightness: 1 })
    expect(result.after.led1).toMatchObject({ lit: false, blocked: true })
    expect(result.changed.legs).toEqual(['10e', '9e'])
  })

  it('a 10 kohm resistor dims the LED', () => {
    const result = whatIfCircuit(circuits['1.2'], { kind: 'ohms', target: 'r1', value: '10000' })
    expect(result.after.led1.lit).toBe(true)
    expect(result.after.led1.brightness).toBeLessThan(0.05)
    expect(result.changed.ohms).toBe(10000)
  })

  it('taking out the resistor or the LED leaves it dark', () => {
    expect(whatIfCircuit(circuits['1.2'], { kind: 'remove', target: 'r1' }).after.led1).toMatchObject({ lit: false, removed: false })
    expect(whatIfCircuit(circuits['1.2'], { kind: 'remove', target: 'led1' }).after.led1).toMatchObject({ lit: false, removed: true })
  })

  it('never changes the build and checks the change', () => {
    const build = structuredClone(circuits['1.2'])
    whatIfCircuit(build, { kind: 'flip', target: 'led1' })
    expect(build).toEqual(circuits['1.2'])
    expect(whatIfCircuit(build, { kind: 'flip', target: 'r1' }).error).toBe('Only an LED can be flipped.')
    expect(whatIfCircuit(build, { kind: 'ohms', target: 'r1', value: 'lots' }).error).toBe('Give the ohms as a number above 0.')
    expect(whatIfCircuit(build, { kind: 'melt', target: 'r1' }).error).toBe('There is no change called melt.')
    expect(whatIfCircuit(build, { kind: 'flip', target: 'zz' }).error).toBe('There is no placed part called zz.')
  })
})
