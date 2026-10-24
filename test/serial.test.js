import { describe, it, expect } from 'vitest'
import { createSerial, createTicker, formatValue, MAX_LINES } from '../src/sim/serial.js'
import { usesSerial } from '../src/ui/serialMonitor.js'
import { lessons } from '../src/course/lessons.js'

describe('formatValue', () => {
  it('prints floats with 2 decimals like Arduino, other values as they are', () => {
    expect(formatValue(2.5)).toBe('2.50')
    expect(formatValue(512)).toBe('512')
    expect(formatValue('hi')).toBe('hi')
  })
})

describe('createSerial output', () => {
  it('builds lines from print and println, with a partial last line', () => {
    const serial = createSerial()
    serial.print('A0 = ')
    expect(serial.getLines()).toEqual(['A0 = '])
    serial.println(512)
    serial.println()
    serial.print(1.5)
    expect(serial.getLines()).toEqual(['A0 = 512', '', '1.50'])
  })

  it('splits embedded newlines and keeps only the last maxLines', () => {
    const serial = createSerial({ maxLines: 3 })
    serial.println('a\nb')
    serial.println('c')
    serial.println('d')
    expect(serial.getLines()).toEqual(['b', 'c', 'd'])
    expect(MAX_LINES).toBe(200)
  })

  it('clear empties the output and notifies', () => {
    const serial = createSerial()
    const seen = []
    serial.subscribe((kind) => seen.push(kind))
    serial.println('x')
    serial.clear()
    expect(serial.getLines()).toEqual([])
    expect(seen).toEqual(['output', 'output'])
  })
})

describe('createSerial input', () => {
  it('queues sent lines with a newline for read and readLine', () => {
    const serial = createSerial()
    expect(serial.available()).toBe(0)
    expect(serial.read()).toBe(-1)
    expect(serial.readLine()).toBe(null)
    serial.send('on')
    serial.send('off')
    expect(serial.available()).toBe(7)
    expect(serial.read()).toBe('o'.charCodeAt(0))
    expect(serial.readLine()).toBe('n')
    expect(serial.readLine()).toBe('off')
    expect(serial.readLine()).toBe(null)
  })

  it('clearInput drops unread input and notifies only when there was some', () => {
    const serial = createSerial()
    const seen = []
    serial.subscribe((kind) => seen.push(kind))
    serial.clearInput()
    serial.send('x')
    serial.clearInput()
    expect(serial.available()).toBe(0)
    expect(seen).toEqual(['input', 'input'])
  })
})

describe('createTicker', () => {
  it('counts runs due every period from the start, capped after a stall', () => {
    const ticker = createTicker(200, 1000)
    expect(ticker.due(999)).toBe(0)
    expect(ticker.due(1000)).toBe(1)
    expect(ticker.due(1150)).toBe(0)
    expect(ticker.due(1450)).toBe(2)
    expect(ticker.due(60000)).toBe(5)
    expect(ticker.due(60100)).toBe(0)
  })
})

describe('usesSerial', () => {
  it('is true only for lessons whose sketch starts Serial', () => {
    const ids = lessons.filter(usesSerial).map((lesson) => lesson.id)
    expect(ids).toEqual(['1.6', '1.10'])
  })
})
