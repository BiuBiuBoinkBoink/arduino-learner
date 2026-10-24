// Sim registry: lesson id -> sim factory create({ pins, getValues, startedAt }).
import { createBlinkSim } from './blink.js'

export const sims = {
  '1.2': createBlinkSim
}
