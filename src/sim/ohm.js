// Ohm's law for an LED and its series resistor on a 5 V pin. Pure module.
export const LED_SUPPLY_V = 5
export const LED_FORWARD_V = 2
const FULL_OHMS = 220

// The resistor takes what the LED leaves, so I = (5 - 2) / R, in mA.
export function ledCurrentMa(ohms) {
  return (LED_SUPPLY_V - LED_FORWARD_V) / ohms * 1000
}

// Brightness 0 to 1 relative to the 220 ohm current.
export function ledBrightness(ohms) {
  return Math.min(1, Math.max(0, ledCurrentMa(ohms) / ledCurrentMa(FULL_OHMS)))
}
