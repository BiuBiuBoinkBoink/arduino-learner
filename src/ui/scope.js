// Scope card: a plot of one pin's level over the last few seconds with a
// summary in words. The canvas is 308 x 120 CSS px (scaled for
// devicePixelRatio): a stepped accent line over a light grid, y labels 0 V and
// 5 V, x labels -<n> s to now. It redraws at most 30 times a second while the
// sketch runs and freezes when it stops; the summary (aria-live polite)
// changes at most once a second. DOM, not pure.
//
// openScopeCard({ cards, buffer, getClock, isRunning, pin, seconds }) -> card
import { describePin } from '../explain/scopeBuffer.js'

const WIDTH = 308
const HEIGHT = 120
const LEFT = 30
const BOTTOM = 16
const TOP = 6
const RIGHT = 6
const FRAME_MS = 1000 / 30
const SUMMARY_MS = 1000

export function openScopeCard({ cards, buffer, getClock, isRunning, pin, seconds }) {
  let frame = null
  const card = cards.open({
    kind: 'scope',
    title: 'Scope: ' + pin,
    onClose: () => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = null
    }
  })
  const canvas = document.createElement('canvas')
  canvas.className = 'scope-canvas'
  canvas.style.width = WIDTH + 'px'
  canvas.style.height = HEIGHT + 'px'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', `Plot of ${pin} over the last ${seconds} seconds`)
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(WIDTH * ratio)
  canvas.height = Math.round(HEIGHT * ratio)
  const summary = document.createElement('p')
  summary.className = 'scope-summary'
  summary.setAttribute('aria-live', 'polite')
  card.body.append(canvas, summary)

  const context = canvas.getContext('2d')
  const styles = getComputedStyle(document.documentElement)
  const accent = styles.getPropertyValue('--accent').trim() || '#2f6fd6'
  const line = styles.getPropertyValue('--line').trim() || '#d5d9e0'
  const muted = styles.getPropertyValue('--muted').trim() || '#5d6676'

  function draw(toMs) {
    if (!context) return
    const fromMs = toMs - seconds * 1000
    const w = WIDTH - LEFT - RIGHT
    const h = HEIGHT - TOP - BOTTOM
    const x = (at) => LEFT + ((at - fromMs) / (toMs - fromMs)) * w
    const y = (value) => TOP + (1 - value) * h
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.strokeStyle = line
    context.lineWidth = 1
    context.beginPath()
    for (let s = 0; s <= seconds; s++) {
      const gx = Math.round(LEFT + (s / seconds) * w) + 0.5
      context.moveTo(gx, TOP)
      context.lineTo(gx, TOP + h)
    }
    for (const value of [0, 0.5, 1]) {
      const gy = Math.round(y(value)) + 0.5
      context.moveTo(LEFT, gy)
      context.lineTo(LEFT + w, gy)
    }
    context.stroke()
    context.fillStyle = muted
    context.font = '10px system-ui, sans-serif'
    context.textBaseline = 'middle'
    context.textAlign = 'right'
    context.fillText('5 V', LEFT - 4, y(1))
    context.fillText('0 V', LEFT - 4, y(0))
    context.textBaseline = 'bottom'
    context.textAlign = 'left'
    context.fillText(`-${seconds} s`, LEFT, HEIGHT)
    context.textAlign = 'right'
    context.fillText('now', LEFT + w, HEIGHT)
    // A stepped line: each level holds until the next change.
    const samples = buffer.samples(pin, fromMs, toMs)
    context.strokeStyle = accent
    context.lineWidth = 2
    context.beginPath()
    samples.forEach((sample, i) => {
      const px = x(sample.at)
      if (i === 0) context.moveTo(px, y(sample.value))
      else {
        context.lineTo(px, y(samples[i - 1].value))
        context.lineTo(px, y(sample.value))
      }
    })
    context.lineTo(x(toMs), y(samples[samples.length - 1].value))
    context.stroke()
  }

  let lastDraw = -Infinity
  let lastSummary = -Infinity
  function update(force = false) {
    const toMs = getClock()
    const now = performance.now()
    if (force || now - lastDraw >= FRAME_MS) {
      lastDraw = now
      draw(toMs)
    }
    if (force || now - lastSummary >= SUMMARY_MS) {
      lastSummary = now
      summary.textContent = describePin(buffer, pin, toMs, seconds)
    }
  }

  function loop() {
    frame = requestAnimationFrame(loop)
    if (isRunning()) update()
  }
  update(true)
  frame = requestAnimationFrame(loop)
  card.text = summary.textContent
  return card
}
