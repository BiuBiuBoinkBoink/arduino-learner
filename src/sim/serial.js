// Shared serial port between the running sketch and the Serial Monitor. Pure
// module, no DOM. Output: print and println build lines (the last one may be
// partial), keeping at most maxLines. Input: send(text) queues a line typed in
// the monitor, ending in a newline, for the sketch to read byte by byte or
// line by line. Subscribers get 'output' or 'input' on every change.
export const MAX_LINES = 200

// Arduino prints a float with 2 decimals.
export function formatValue(value) {
  if (typeof value === 'number' && !Number.isInteger(value)) return value.toFixed(2)
  return String(value)
}

// Times a loop that runs every periodMs from startedAt: due(now) says how many
// runs are due since the last call. After a long stall (a hidden tab) it skips
// ahead instead of flooding, running at most MAX_CATCH_UP times.
const MAX_CATCH_UP = 5

export function createTicker(periodMs, startedAt) {
  let next = startedAt
  return {
    due(now) {
      let count = 0
      while (now >= next) {
        count += 1
        next += periodMs
      }
      return Math.min(count, MAX_CATCH_UP)
    }
  }
}

export function createSerial({ maxLines = MAX_LINES } = {}) {
  let lines = []
  let partial = ''
  let input = ''
  const listeners = new Set()

  function notify(kind) {
    listeners.forEach((fn) => fn(kind))
  }

  function write(text) {
    const parts = (partial + text).split('\n')
    partial = parts.pop()
    lines.push(...parts)
    if (lines.length > maxLines) lines = lines.slice(lines.length - maxLines)
    notify('output')
  }

  function print(value) {
    write(formatValue(value))
  }

  function println(value = '') {
    write(formatValue(value) + '\n')
  }

  // Completed lines plus the partial one, if any.
  function getLines() {
    return partial === '' ? lines.slice() : [...lines, partial]
  }

  function clear() {
    lines = []
    partial = ''
    notify('output')
  }

  function send(text) {
    input += text + '\n'
    notify('input')
  }

  function available() {
    return input.length
  }

  // Next byte as a char code, or -1 when nothing is waiting.
  function read() {
    if (input === '') return -1
    const code = input.charCodeAt(0)
    input = input.slice(1)
    notify('input')
    return code
  }

  // Next full line without its newline, or null when none is complete.
  function readLine() {
    const end = input.indexOf('\n')
    if (end === -1) return null
    const line = input.slice(0, end)
    input = input.slice(end + 1)
    notify('input')
    return line
  }

  function clearInput() {
    if (input === '') return
    input = ''
    notify('input')
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { print, println, getLines, clear, send, available, read, readLine, clearInput, subscribe }
}
