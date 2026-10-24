# Multimeter, lesson 1.3 Resistors and Ohm's law

> Feature: Sim multimeter that reads current through a selected part, and lesson 1.3 Resistors and Ohm's law with a resistor choice of 220 ohm, 1k and 10k

## Context

Job 010 added knob values to `inputs`, the sim `readout()` line and LED
`setBrightness`. Lesson 1.3 already has a sketch with an `ohms` choice
(220, 1000, 10000) and the `ledCircuit('D9')` circuit, but no sim and no goal.

## Requirements

1. **Ohm's law helpers.** New pure `src/sim/ohm.js`: `LED_SUPPLY_V` (5),
   `LED_FORWARD_V` (2), `ledCurrentMa(ohms)` = (5 - 2) / ohms * 1000, and
   `ledBrightness(ohms)` = `ledCurrentMa(ohms) / ledCurrentMa(220)` clamped to 0 to 1.
2. **Swappable resistor.** The 1.3 circuit has three resistors `r220`, `r1k`
   and `r10k` in the same holes (`5c` to `9c`), each with
   `showWhen: { param: 'ohms', value }`, so the colour bands follow the choice.
   The LED keeps `pin: 'D9'` and gains `ohmsParam: 'ohms'`.
3. **LED brightness from the series resistor.** `main.js` lights an LED at
   `pins.get(pin) * ledBrightness(values[part.ohmsParam])` when the part has
   `ohmsParam`, else at the pin level as before. It re-lights LEDs on every code
   panel value change.
4. **Meter probe in inputs.** `createInputs()` gains `getProbe()` (null when
   unset) and `setProbe(id)`. No notification.
5. **Multimeter UI.** New `src/ui/multimeter.js`
   `createMultimeter({ container, stage, getItems, inputs })` returns
   `{ setTargets(targets) }`. A target is `{ id, label, parts }`, listed in the
   circuit table as `meter`. The toolbar shows a labelled select "Meter on" with
   "Nothing" plus one option per target, below the Run row, hidden when there
   are no targets. A click (pointer down and up within 5 px) on a visible part
   that belongs to a target selects it, with a pointer cursor on hover.
   Both paths write `inputs.setProbe(id)`. `setTargets` resets the probe to null.
6. **Lesson 1.3 sim** `src/sim/ohms.js` `createOhmsSim`: D9 HIGH while running.
   Readout `Meter on <label>: <mA> mA` with one decimal (13.6, 3.0, 0.3), or
   `Meter: pick a part to measure` with no probe. The sim reads the label from
   `METER_LABELS` (`led` LED, `resistor` Resistor). Goal: since Run, update has
   seen a probe on the LED or resistor with each of the three resistor values.
   `stop()` sets D9 to 0.
7. **Lesson text.** 1.3 gets a third overview paragraph with the goal.
8. Registry, AGENTS.md, README and tests (`ohm`, `ohms` sim, inputs probe,
   circuits for 1.3) as in job 010.

## Acceptance criteria

1. `npm test` and `npm run build` pass.
2. `#1.3`: the resistor bands change with the choice, and the LED gets dimmer
   for 1 kohm and almost dark for 10 kohm while running.
3. Picking LED in "Meter on" or clicking the LED while running shows
   `Meter on LED: 13.6 mA`. Measuring with all three resistors completes 1.3.
4. Other lessons look and behave as before. The meter select is hidden there.

## Assumptions

- Goal: measure the current with each of the three resistors. Reason: this
  makes the learner see I = V / R change, and Run alone does not pass.
- A series circuit has one current, so the LED and resistor read the same.
