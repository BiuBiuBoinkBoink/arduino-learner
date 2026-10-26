// What if card: 'What if: <change>' with two columns, Now and With the change.
// For a circuit change each column has an LED dot drawn lit or dark at its
// brightness and one sentence; for a code change a small still scope plot and
// the summary text. DOM, not pure.
//
// openWhatIfCard({ cards, title, columns, onClose }) -> card
// columns: [{ heading, sentence, led: { color, lit, brightness } } |
//           { heading, sentence, samples, ms }]
const LED_COLORS = { red: '#e0352b', yellow: '#f2c230', green: '#2fb35a', blue: '#2f6fd6', white: '#f0f0f5' }
const PLOT_W = 140
const PLOT_H = 48

function ledDot({ color, lit, brightness }) {
  const dot = document.createElement('span')
  dot.className = 'whatif-led'
  dot.setAttribute('aria-hidden', 'true')
  const hex = LED_COLORS[color] || LED_COLORS.red
  if (lit) {
    dot.style.background = hex
    dot.style.opacity = String(0.35 + 0.65 * Math.max(0, Math.min(1, brightness)))
    dot.style.boxShadow = `0 0 ${Math.round(4 + 10 * brightness)}px ${hex}`
  } else {
    dot.classList.add('is-dark')
  }
  return dot
}

function plot(samples, ms) {
  const canvas = document.createElement('canvas')
  const ratio = window.devicePixelRatio || 1
  canvas.width = Math.round(PLOT_W * ratio)
  canvas.height = Math.round(PLOT_H * ratio)
  canvas.style.width = PLOT_W + 'px'
  canvas.style.height = PLOT_H + 'px'
  canvas.className = 'whatif-plot'
  canvas.setAttribute('aria-hidden', 'true')
  const context = canvas.getContext('2d')
  if (!context || samples.length === 0) return canvas
  const styles = getComputedStyle(document.documentElement)
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.strokeStyle = styles.getPropertyValue('--line').trim() || '#d5d9e0'
  context.strokeRect(0.5, 0.5, PLOT_W - 1, PLOT_H - 1)
  const x = (at) => 2 + (at / ms) * (PLOT_W - 4)
  const y = (value) => 4 + (1 - value) * (PLOT_H - 8)
  context.strokeStyle = styles.getPropertyValue('--accent').trim() || '#2f6fd6'
  context.lineWidth = 1.5
  context.beginPath()
  samples.forEach((sample, i) => {
    if (i === 0) context.moveTo(x(sample.at), y(sample.value))
    else {
      context.lineTo(x(sample.at), y(samples[i - 1].value))
      context.lineTo(x(sample.at), y(sample.value))
    }
  })
  context.lineTo(x(ms), y(samples[samples.length - 1].value))
  context.stroke()
  return canvas
}

export function openWhatIfCard({ cards, title, columns, onClose = () => {} }) {
  const card = cards.open({ kind: 'whatif', title: 'What if: ' + title, onClose })
  const grid = document.createElement('div')
  grid.className = 'whatif-columns'
  for (const column of columns) {
    const box = document.createElement('div')
    box.className = 'whatif-column'
    const heading = document.createElement('p')
    heading.className = 'whatif-heading'
    heading.textContent = column.heading
    box.append(heading)
    if (column.led) box.append(ledDot(column.led))
    if (column.samples) box.append(plot(column.samples, column.ms))
    const sentence = document.createElement('p')
    sentence.className = 'whatif-sentence'
    sentence.textContent = column.sentence
    box.append(sentence)
    grid.append(box)
  }
  card.body.append(grid)
  return card
}
