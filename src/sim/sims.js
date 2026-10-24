// Sim registry: lesson id -> sim factory create({ pins, inputs, getValues, startedAt }).
import { createBlinkSim } from './blink.js'
import { createButtonSim } from './button.js'
import { createPullDownSim } from './pullDown.js'
import { createPotSim } from './pot.js'
import { createFadeSim } from './fade.js'
import { createOhmsSim } from './ohms.js'

export const sims = {
  '1.2': createBlinkSim,
  '1.3': createOhmsSim,
  '1.4': createButtonSim,
  '1.5': createPullDownSim,
  '1.6': createPotSim,
  '1.7': createFadeSim
}
