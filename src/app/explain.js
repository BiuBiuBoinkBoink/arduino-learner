// Explain composition for main.js: the tools (src/explain/tools.js), the
// Explain menu, the card stack and the scene helpers the tools draw with.
// reset() runs on every lesson change: it closes every card, clears the trace
// and turns every toggle off. refresh() re-checks the menu rows (after a
// workbench change). onFrame() follows the run: a new run clears the scope
// buffer, and a phase change re-checks the rows.
//
// createExplain({ stage, board, breadboard, viewControls, viewContainer,
//   workbench, placement, getBuild, getReference, getItems, inputs, runner, getKit,
//   hasCircuit, pins, meter, codePanel, getLessonId })
//   -> { tools, menu, cards, reset(), refresh(), onFrame(), about(id), measureAt(name) }
// The last measured point keeps its label up to date as the pins change. In
// slow motion the running line is lit in the editor, at most once a frame.
import { createExplainTools } from '../explain/tools.js'
import { createExplainMenu } from '../ui/explainMenu.js'
import { createExplainCards } from '../ui/explainCards.js'
import { createCurrentTrace } from '../ui/currentTrace.js'
import { createLabels } from '../ui/labels.js'
import { openScopeCard } from '../ui/scope.js'
import { openConnectionsCard } from '../ui/connectionsCard.js'
import { openPartCard } from '../ui/partCard.js'
import { createScopeBuffer } from '../explain/scopeBuffer.js'
import { holePosition } from '../parts/breadboard.js'
import { unoPinPosition, UNO_PIN_NAMES } from '../parts/unoBoard.js'
import { isHole } from '../circuits/holes.js'
import { openWhatIfCard } from '../ui/whatIfCard.js'
import { buildGhost, disposeGroup } from '../ui/placement.js'
import { whatIfCode } from '../explain/whatIf.js'
import * as THREE from 'three'

const GHOST_TINT = new THREE.Color(0x2f6fd6)
const REMOVED_OPACITY = 0.2

export function createExplain({ stage, board, breadboard, viewControls, viewContainer, workbench, placement, getBuild, getReference, getItems, inputs, runner, getKit, hasCircuit, pins, meter, codePanel, getLessonId }) {
  const cards = createExplainCards({ container: workbench })
  // Pinned labels of the explain tools, one list per owner ('trace', 'meter').
  const labels = createLabels({ stage, container: workbench })
  const pinned = new Map()
  function setLabels(owner, list) {
    pinned.set(owner, list)
    labels.set([...pinned.values()].flat())
  }
  const currentTrace = createCurrentTrace({ stage, board, breadboard, getItems, setLabels: (list) => setLabels('trace', list) })

  // Every output event of the running sketch, for the scope.
  const scopeBuffer = createScopeBuffer()
  runner.subscribeOutput(scopeBuffer.record)
  const isRunning = () => runner.getPhase() === 'running'

  // Buttons held down right now, by part id.
  function pressed() {
    const out = {}
    for (const part of getBuild().parts || []) if (part.type === 'button' && inputs.isPressed(part.id)) out[part.id] = true
    return out
  }

  const tools = createExplainTools({
    setXray(on) {
      breadboard.setXray(on)
      stage.invalidate()
    },
    getBuild,
    getReference,
    getPressed: pressed,
    showTrace: (path) => currentTrace.show(path),
    isRunning,
    openScope(pin, seconds) {
      const card = openScopeCard({ cards, buffer: scopeBuffer, getClock: runner.getClock, isRunning, pin, seconds })
      return card.text
    },
    showConnections(rows) {
      const open = cards.get('connections')
      if (open) open.update(rows)
      else openConnectionsCard({ cards, rows, onHover: (places) => placement.setOverlay((places || []).map((place) => ({ place, tone: 'info' }))) })
    },
    getKit,
    openPartCard: (type) => openPartCard({ cards, type }),
    hasCircuit,
    // While stopped nothing drives the pins, so every signal pin reads 0 V.
    getLevels: () => (isRunning()
      ? { pinLevels: pins.snapshot(), inputLevels: runner.getInputLevels() }
      : { pinLevels: Object.fromEntries(tools.signalPins().map((pin) => [pin, 0])), inputLevels: {} }),
    setSlowMotion: (speed) => (speed ? runner.setSlowMotion(true, speed) : runner.setSlowMotion(false)),
    getSlowMotion: () => runner.getSlowMotion(),
    runWhatIfCode: ({ line, text }) => whatIfCode({ lessonId: getLessonId(), source: codePanel.getSource(), values: codePanel.getValues(), line, text }),
    showWhatIf,
    showMeasure({ at, text }) {
      const point = pointOf(at)
      setLabels('meter', point ? [{ id: 'meter', position: point.setY(point.y + 0.3), text, tone: 'info' }] : [])
      meter.setReading(text)
    }
  })

  // The What if card, and while it is open the changed part as an accent
  // ghost: the turned LED, the new bands, or the part faded to 20% with the
  // real one hidden. The build itself never changes.
  function showWhatIf(view) {
    let ghost = null
    let hidden = null
    const table = view.kind === 'remove' ? getBuild().parts.find((part) => part.id === view.change.target) : view.changed
    if (table) {
      ghost = buildGhost({ table: { parts: [table], wires: [] }, board, breadboard, values: codePanel.getValues(), tint: GHOST_TINT })
      if (ghost) {
        ghost.name = 'whatif-ghost'
        if (view.kind === 'remove') {
          ghost.traverse((object) => {
            if (object.isMesh) object.material.opacity = REMOVED_OPACITY
          })
          const item = (getItems() || {})[table.id]
          if (item && item.group.visible) {
            hidden = item.group
            hidden.visible = false
          }
        }
        stage.scene.add(ghost)
      }
    }
    stage.invalidate()
    openWhatIfCard({
      cards,
      title: view.title,
      columns: view.columns,
      onClose: () => {
        if (ghost) disposeGroup(stage.scene, ghost)
        if (hidden) hidden.visible = true
        stage.invalidate()
      }
    })
  }

  function pointOf(name) {
    if (isHole(name)) {
      breadboard.group.updateWorldMatrix(true, false)
      return breadboard.group.localToWorld(holePosition(name))
    }
    if (UNO_PIN_NAMES.includes(name)) {
      board.group.updateWorldMatrix(true, false)
      return board.group.localToWorld(unoPinPosition(name))
    }
    return null
  }

  // The point measured last, read again whenever a pin changes (once a frame).
  let measured = null
  let measureFrame = null
  async function measureAt(name) {
    const result = await tools.measure(name)
    measured = result.ok ? name : null
    menu.setStatus(result.text)
    return result
  }
  function remeasure() {
    if (!measured || measureFrame !== null) return
    measureFrame = requestAnimationFrame(() => {
      measureFrame = null
      if (measured) tools.measure(measured)
    })
  }
  pins.subscribe(remeasure)

  // The line the slow sketch runs now, shown once a frame.
  let runningLine = null
  let lineFrame = null
  runner.subscribeLine((line) => {
    runningLine = line
    if (lineFrame !== null) return
    lineFrame = requestAnimationFrame(() => {
      lineFrame = null
      codePanel.setExecutingLine(runner.getSlowMotion() !== null ? runningLine : null)
    })
  })

  const why = (id) => () => tools.reasons()[id]
  const pinOptions = () => (getReference() ? tools.wiredPins() : []).map((pin) => ({ value: pin, label: pin }))
  const signalOptions = () => tools.signalPins().map((pin) => ({ value: pin, label: pin }))
  const rows = [
    { id: 'xray', label: 'X-ray', kind: 'toggle', pressed: () => breadboard.isXray(), run: (on) => tools.xray(on), reason: why('xray') },
    { id: 'trace', label: 'Trace the current from', kind: 'choice', options: pinOptions, run: (pin) => tools.trace(pin), reason: why('trace') },
    {
      id: 'connections',
      label: 'Connections',
      kind: 'toggle',
      pressed: () => cards.has('connections'),
      run: (on) => {
        if (on) return tools.connections(true)
        cards.close('connections')
        return { ok: true, text: 'The connections card is closed.' }
      },
      reason: why('connections')
    },
    {
      id: 'part',
      label: 'Part card for',
      kind: 'choice',
      options: () => getKit().map((part) => ({ value: part.id, label: part.label })),
      run: (id) => tools.part_card(id),
      reason: why('part')
    },
    { id: 'measure', label: 'Measure voltage at', kind: 'input', placeholder: '9e, D13 or led1.anode', run: (text) => measureAt(text), reason: why('measure') },
    {
      id: 'slow',
      label: 'Slow motion',
      kind: 'toggle',
      pressed: () => runner.getSlowMotion() !== null,
      run: (on) => tools.slow_motion(on ? 0.1 : 1),
      reason: why('slow')
    },
    {
      id: 'whatif',
      label: 'What if',
      kind: 'choice',
      options: () => (getReference() ? tools.whatIfChoices() : []),
      run: (choice) => {
        const [kind, target, value] = String(choice).split(':')
        return tools.what_if(kind, target, value)
      },
      reason: why('whatif')
    },
    { id: 'scope', label: 'Scope on', kind: 'choice', options: signalOptions, run: (pin) => tools.scope(pin, 5), reason: why('scope') }
  ]
  const menu = createExplainMenu({
    container: viewContainer,
    addToView: viewControls.addGroup,
    closeView: viewControls.closeMenu,
    rows
  })

  // The menu rows follow the build, and an open connections card shows it again.
  function refresh() {
    // A changed build makes the comparison stale.
    cards.close('whatif')
    if (cards.has('connections')) tools.connections(true)
    remeasure()
    menu.refresh()
  }

  function reset() {
    cards.closeAll()
    currentTrace.clear()
    measured = null
    setLabels('meter', [])
    if (breadboard.isXray()) tools.xray(false)
    menu.setStatus('')
    menu.refresh()
  }

  // A new run starts the scope again; a phase change re-checks the rows.
  let phase = runner.getPhase()
  function onFrame() {
    followSlow()
    const next = runner.getPhase()
    if (next === phase) return
    if (next === 'uploading' || (next === 'running' && phase !== 'uploading')) scopeBuffer.clear()
    phase = next
    menu.refresh()
  }

  // Slow motion ended (toggle, Stop, an error): the editor goes back to the trace.
  let wasSlow = false
  function followSlow() {
    const slow = runner.getSlowMotion() !== null
    if (slow === wasSlow) return
    wasSlow = slow
    if (!slow) codePanel.setExecutingLine(null)
    menu.refresh()
  }

  // The tray's ? buttons open part cards, with the text in the menu status.
  async function about(id) {
    const result = await tools.part_card(id)
    menu.setStatus(result.text)
  }

  return { tools, menu, cards, reset, refresh, onFrame, about, measureAt }
}
