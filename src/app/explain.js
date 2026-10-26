// Explain composition for main.js: the tools (src/explain/tools.js), the
// Explain menu, the card stack and the scene helpers the tools draw with.
// reset() runs on every lesson change: it closes every card and turns every
// toggle off. refresh() re-checks the menu rows (after a workbench change or a
// run phase change).
//
// createExplain({ stage, breadboard, viewControls, viewContainer, workbench })
//   -> { tools, menu, cards, reset(), refresh() }
import { createExplainTools } from '../explain/tools.js'
import { createExplainMenu } from '../ui/explainMenu.js'
import { createExplainCards } from '../ui/explainCards.js'

export function createExplain({ stage, breadboard, viewControls, viewContainer, workbench }) {
  const cards = createExplainCards({ container: workbench })

  const tools = createExplainTools({
    setXray(on) {
      breadboard.setXray(on)
      stage.invalidate()
    }
  })

  const why = (id) => () => tools.reasons()[id]
  const rows = [
    { id: 'xray', label: 'X-ray', kind: 'toggle', pressed: () => breadboard.isXray(), run: (on) => tools.xray(on), reason: why('xray') }
  ]
  const menu = createExplainMenu({
    container: viewContainer,
    addToView: viewControls.addGroup,
    closeView: viewControls.closeMenu,
    rows
  })

  function reset() {
    cards.closeAll()
    if (breadboard.isXray()) tools.xray(false)
    menu.setStatus('')
    menu.refresh()
  }

  return { tools, menu, cards, reset, refresh: menu.refresh }
}
