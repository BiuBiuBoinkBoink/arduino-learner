// Explain composition for main.js: the tools (src/explain/tools.js), the
// Explain menu, the card stack and the scene helpers the tools draw with.
// reset() runs on every lesson change: it closes every card, clears the trace
// and turns every toggle off. refresh() re-checks the menu rows (after a
// workbench change). onFrame() follows the run: a new run clears the scope
// buffer, and a phase change re-checks the rows.
//
// createExplain({ stage, board, breadboard, viewControls, viewContainer,
//   workbench, placement, getBuild, getReference, getItems, inputs, runner })
//   -> { tools, menu, cards, reset(), refresh(), onFrame() }
import { createExplainTools } from '../explain/tools.js'
import { createExplainMenu } from '../ui/explainMenu.js'
import { createExplainCards } from '../ui/explainCards.js'
import { createCurrentTrace } from '../ui/currentTrace.js'
import { createLabels } from '../ui/labels.js'
import { openScopeCard } from '../ui/scope.js'
import { openConnectionsCard } from '../ui/connectionsCard.js'
import { createScopeBuffer } from '../explain/scopeBuffer.js'

export function createExplain({ stage, board, breadboard, viewControls, viewContainer, workbench, placement, getBuild, getReference, getItems, inputs, runner }) {
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
    }
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
    if (cards.has('connections')) tools.connections(true)
    menu.refresh()
  }

  function reset() {
    cards.closeAll()
    currentTrace.clear()
    if (breadboard.isXray()) tools.xray(false)
    menu.setStatus('')
    menu.refresh()
  }

  // A new run starts the scope again; a phase change re-checks the rows.
  let phase = runner.getPhase()
  function onFrame() {
    const next = runner.getPhase()
    if (next === phase) return
    if (next === 'uploading' || (next === 'running' && phase !== 'uploading')) scopeBuffer.clear()
    phase = next
    menu.refresh()
  }

  return { tools, menu, cards, reset, refresh, onFrame }
}
