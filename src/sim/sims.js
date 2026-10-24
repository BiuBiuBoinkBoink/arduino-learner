// Sim registry: lesson id -> sim factory create({ pins, inputs, getValues, startedAt }).
import { createBlinkSim } from './blink.js'
import { createButtonSim } from './button.js'
import { createPullDownSim } from './pullDown.js'

export const sims = {
  '1.2': createBlinkSim,
  '1.4': createButtonSim,
  '1.5': createPullDownSim
}
