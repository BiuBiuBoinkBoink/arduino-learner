# RGB LED, lesson 1.8 Colour mixing

> Feature: RGB LED part and lesson 1.8 Colour mixing with a target colour match goal

## Requirements

1. **RGB LED part** `src/parts/rgbLed.js` `createRgbLed({ legs })`: a common
   cathode 5 mm LED on four legs in a row (red, cathode, green, blue), a
   diffused lens. `setColor(r, g, b)` takes channel levels from 0 to 1. It
   glows in the mix read as sRGB (so 255, 128, 0 looks orange) at a strength
   from the brightest channel, and tints the lens to the same hue. All zero
   has no glow. Every mesh casts shadows.
2. **Circuit format** `{ id, type: 'rgbLed', at: '14e', pins: { red, green, blue } }`.
   The legs go at `c` to `c + 3` of the row of `at` (`rgbHoles(at)`); the
   column must be at most 27.
3. **1.8 circuit**: the RGB LED at `14e`. D9 goes to `8a` and a 220 ohm
   resistor from `8c` to `14c` (red). D10 goes to `16j` and a 220 ohm resistor
   from `16g` to `16d`, across the channel (green). D11 goes to `23a` and a
   220 ohm resistor from `23c` to `17c` (blue). GND goes to `15a`, the cathode.
4. **main.js** lights each RGB LED from its three pin levels.
5. **1.8 sketch**: `setColour({{red}}, {{green}}, {{blue}})` in loop, with
   range params Red, Green and Blue (0 to 255 step 1, defaults 0, 120, 255).
6. **Sim** `src/sim/rgb.js` `createRgbSim`: D9, D10 and D11 = value / 255, read
   live. Readout `Now r, g, b. Target orange 255, 128, 0`. Goal: every channel
   within 25 of orange (255, 128, 0) since Run. `stop()` clears the pins.
7. 1.8 gets a third overview paragraph with the goal. Tests, AGENTS.md,
   README and backlog are updated.

## Assumptions

- Target colour orange, tolerance 25 per channel. Reason: it needs two
  channels mixed and one off, and the default sky blue does not pass.
