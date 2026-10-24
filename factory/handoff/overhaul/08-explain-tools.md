# Phase 8: Explain tools

## Goal

Tools that show why a circuit or sketch behaves the way it does. Learners
reach them from an `Explain` menu on the workbench; phase 9's help chat calls
the same functions. Every number they show comes from the simulator or the
netlist, never from a guess.

| Tool | What it shows |
| --- | --- |
| X-ray | The breadboard turns see-through and shows the metal strips under the holes |
| Trace the current | Moving dots follow the current from a pin through the learner's circuit and stop where the path breaks |
| Scope | A plot of a pin's level over the last few seconds, with a summary in words |
| Connections | Every net of the build as a list, with ticks where it matches the lesson circuit |
| Part card | A close-up of a part type: legs named, what each does, key numbers |
| Measure voltage | The voltage at a point of the circuit, as a label on it |
| Slow motion | The sketch runs at a tenth of the speed with the running line lit up |
| What if | A pretend copy with one change, shown next to the real one |

The proposal called one tool a schematic. Drawing schematics automatically is
out of scope; the Connections card replaces it.

## Read first

- `src/runner/interpreter.js`, `src/runner/session.js`,
  `src/runner/worker.js`, `src/runner/codeRunner.js`, `src/sim/runner.js`.
- `src/ui/multimeter.js`, `src/sim/ohm.js`, `src/sim/ohms.js`.
- Phase 3 `netlist.js`, phase 5 `labels.js`, phase 4 `placement.js` ghosts.
- `test/lessonGoals.test.js` (`drive`).

## 8.1 Explain menu and tool registry

- `src/ui/explainMenu.js`: an `Explain` button in the view controls (in
  compact mode inside the View menu) opens a popover with one row per tool.
  Toggles (`X-ray`, `Connections`, `Slow motion`) use `aria-pressed`. Tools
  that need a choice show a select and a `Show` button in the row (`Trace the
  current from` a pin; `Scope on` a pin; `Part card for` a kit part; `What if`
  a change). Rows that cannot work right now are disabled with a reason in
  muted text (`Run the sketch first.`, `Wire a pin first.`).
- `src/explain/tools.js`: `createExplainTools(deps)` returns one async function
  per tool. Each returns `{ ok, text }`: `text` is one or two plain sentences
  saying what is now on screen or what was found (the chat sends it back to the
  model; the menu shows it in a status line). The functions validate their
  arguments and return `{ ok: false, text: <reason> }` instead of throwing.
- Cards (scope, connections, part card, what if) share one container at the
  top right of the workbench, under the view controls, width 340px (full width
  minus 16px in compact mode), stacked, each with a title and a `Close` button
  (`aria-label="Close <title>"`). At most two cards at once; opening a third
  closes the oldest.
- A lesson change closes every card and turns every toggle off.

## 8.2 X-ray

- `createBreadboard()` gains `setXray(on)`: the body materials become
  transparent (`opacity: 0.25`, `depthWrite: false`) and a metal bar shows
  under each strip and each rail (a thin box, `0xb8bec6`, metalness 0.6, 0.12
  cm wide, running under the 5 holes of a strip or the 30 of a rail). The bars
  are built once and hidden when off.
- Tool `xray(on)`: text `The breadboard is see-through. Each metal bar joins the holes above it.`
  or `X-ray is off.`

## 8.3 Trace the current

Pure module `src/explain/currentPath.js`:

```js
// tracePath(build, { from, pressed = {} }) -> {
//   hops: [{ kind: 'wire' | 'strip' | 'part', id, from, to }],  // from and to are pin or hole names
//   parts: [ids in order],
//   reachesGround: boolean,
//   stop: { place, hole } | null,
//   blocked: { id, reason: 'reversed' } | null
// }
```

- Graph: nets from `buildNetlist`; edges are parts:
  - resistor, ldr, buzzer: both ways between their two nets;
  - LED: only from the anode net to the cathode net; RGB LED: from each colour
    leg's net to the cathode net;
  - button: between `a` and `b` only when `pressed[id]` is true;
  - potentiometer: between each pair of its nets;
  - tmp36 and servo: no edges (they are powered loads, not part of a current
    path in Level 1).
- Breadth first from the net of `from` to the GND net. Prefer the path through
  the fewest parts.
- When GND cannot be reached: follow the longest path from `from`; `stop` is
  the place where it ends and the hole there nearest to the last hop. If a
  reversed LED is the only way on, set `blocked`.
- Turn the net path into hops: inside a net, a `strip` hop from the hole where
  the current arrives to the hole where it leaves (or a `wire` hop when it moves
  along a wire); across a part, a `part` hop from leg to leg.

Texts (the tool returns these):
- `Current flows from <pin> through the <part>, then the <part>, to GND.`
- `Current reaches the LED but cannot get through: the LED is in backwards.`
- `The current stops at <place>. Nothing there leads on to GND.`
- `Nothing is wired to <pin> yet.`

UI `src/ui/currentTrace.js`: eight small glowing spheres (radius 0.035 cm,
`MeshBasicMaterial` accent colour) move along the path at 2 cm per second for
6 seconds, then disappear. Wire hops follow the wire's curve (`wire.curve`
from `createWire`), strip hops run straight just above the holes, part hops run
straight leg to leg 0.3 cm above the board. At a stop, a red ring sits on the
stop hole with a pinned label `The path stops here`. Under reduced motion,
draw a static accent tube along the path for 6 seconds instead. Call
`invalidate()` each frame while it runs.

Tests `test/currentPath.test.js`: 1.2 reference reaches GND through the
resistor then the LED; reversed LED is blocked; resistor in strip 8 stops at
strip 8; 1.4 needs the button pressed; 1.8 from D10 reaches GND through r2 and
the green leg.

## 8.4 Scope

- `src/sim/runner.js`: add `subscribeOutput(fn)`, called for every output
  event it applies with `{ kind, pin, value, at }`.
- Pure `src/explain/scopeBuffer.js`:
  `createScopeBuffer({ windowMs = 10000 })` with `record(event)`,
  `samples(pin, fromMs, toMs)` (the level at `fromMs` plus every change after),
  `clear()`; and `summarize(samples, fromMs, toMs)` ->
  `{ highMs, lowMs, periodMs, duty, transitions, pwm }`.
  - Digital pins: average HIGH and LOW stretch lengths over complete stretches.
  - Levels strictly between 0 and 1 count as PWM: `duty` is the time weighted
    average.
- Texts: `<pin> is HIGH for about <n> ms, then LOW for about <n> ms: one cycle every <n> ms.`,
  `<pin> stays <HIGH|LOW>.`, `<pin> averages <n>% on (analogWrite about <v>).`,
  `<pin> has not changed since Run.` Round ms to the nearest 10 above 100.
- UI `src/ui/scope.js`: a card `Scope: <pin>` with a canvas 308 x 120 CSS px
  (scaled for `devicePixelRatio`), a stepped line in the accent colour over a
  light grid, y labels `0 V` and `5 V`, x labels `-<n> s` to `now`, and the
  summary under it (`aria-live="polite"`, updated at most once a second). Redraw
  at most 30 times a second while running; freeze when stopped.
- Tool `scope(pin, seconds)`: seconds 1 to 5; needs a running sketch; returns
  the summary text.

Tests `test/scopeBuffer.test.js`: blink at 500 / 500, a constant pin, PWM at
64, the window trims old events.

## 8.5 Connections

- Pure `src/explain/connections.js`: `describeNets(build, reference)` ->
  `[{ id, things: [labels], places: [keys], match: true | false | null }]`.
  Things use `thingLabel`; pins first. `match` is whether the net's canonical
  string occurs in the aligned reference (null without a reference). Skip nets
  with no tokens.
- UI `src/ui/connectionsCard.js`: card `Connections`, one row per net: a
  coloured dot (cycle six colours), the things as small chips, and a tick or a
  cross icon when `match` is not null. Hovering or focusing a row highlights
  its places (`info`). Footer: `Ticks show connections that match the lesson circuit.`
- Tool `connections(compare)`: `compare` false hides the ticks. Text:
  `<n> connections. <m> match the lesson circuit.` or `<n> connections.`

## 8.6 Part cards

- Data `src/course/partInfo.js`, one entry per part type:

  | Type | Name | Summary | Legs | Facts |
  | --- | --- | --- | --- | --- |
  | led | LED | A light that lets current through one way only. | anode `Long leg (anode)`: Current goes in here. Connect it towards the pin, through a resistor. / cathode `Short leg (cathode)`: Current comes out here, on the side with the flat edge. Connect it towards GND. | Forward voltage: about 2 V (red); Max current: 20 mA; Needs: a series resistor, 220 ohm on 5 V |
  | resistor | Resistor | Limits current. It works either way round. | a and b `Either end`: Both ends are the same. | 220 ohm: red red brown; 1 kohm: brown black red; 10 kohm: brown black orange |
  | button | Push button | A switch that joins its two sides while you press it. | a `Left pair`: These two legs are always joined to each other. / b `Right pair`: These two legs are always joined to each other. | Sits: across the centre gap; Pressed: left pair joined to right pair |
  | potentiometer | Potentiometer | A resistor with a sliding contact you move with a knob. | end1 `Outer leg`: To 5V or GND. / wiper `Middle leg (wiper)`: Gives a voltage between the two outer legs. / end2 `Outer leg`: To GND or 5V. | Turns: 270 deg; Reads: 0 to 1023 on an analog pin |
  | ldr | Photoresistor | A resistor that changes with light: less light, more resistance. | a and b `Either end`: Both ends are the same. | Bright: about 1 kohm; Dark: about 1 Mohm |
  | tmp36 | TMP36 | A temperature sensor whose output rises 10 mV per deg C. | vs `+Vs (left)`: To 5V or 3.3V. / vout `Vout (middle)`: To an analog pin. / gnd `GND (right)`: To GND. | At 0 deg C: 0.5 V; Per degree: 10 mV; Legs: left to right with the flat face towards you |
  | buzzer | Passive buzzer | Clicks each time its voltage changes, so a fast square wave makes a tone. | a and b `Either leg`: Works both ways round; the + leg usually goes to the pin. | Drive with: tone(pin, Hz); Range: about 100 to 5000 Hz |
  | servo | Servo | A motor that turns its arm to an angle from 0 to 180 deg and holds it. | gnd `Brown wire`: GND. / vcc `Red wire`: 5V. / signal `Orange wire`: A pin, for the angle pulses. | Library: Servo.h; Speed: about 0.1 s per 60 deg |
  | rgbLed | RGB LED | Three LEDs in one case, red, green and blue, sharing one GND leg. | red `Red leg`: To a PWM pin through a resistor. / cathode `Longest leg (cathode)`: To GND. / green `Green leg`: To a PWM pin through a resistor. / blue `Blue leg`: To a PWM pin through a resistor. | Type: common cathode; Mix: set each colour with analogWrite |

- UI `src/ui/partCard.js`: card with a 96px drawing (the tray icon scaled up,
  with each leg labelled beside it), the summary, the legs as a definition
  list and the facts as a two column list.
- Each tray item gets a small `?` button (`aria-label="About the <part>"`)
  that opens its card.
- Tool `part_card(part)` takes a kit id or a type. Text: the summary.

## 8.7 Measure voltage

- Pure `src/explain/voltages.js`:
  `netVoltages(build, { pinLevels, inputLevels })` -> `Map(netId -> volts | null)`.
  - A net with an Uno pin: GND 0, 5V 5, 3.3V 3.3, VIN 9, an output pin its
    level times 5 (PWM is the average), an input pin with an input level from
    the board times 5.
  - A net joined through one resistor to a known net and to an LED anode
    whose cathode net is at 0 V: the LED forward voltage when the known net is
    above it, else the known voltage. Forward voltages: red 2.0, yellow 2.1,
    green 2.2, blue 3.0; RGB channels red 2.0, green 3.0, blue 3.0.
  - A net joined through a resistor to a known net and to nothing else that
    conducts: the known voltage.
  - Anything else: null.
- `src/ui/multimeter.js`: a mode select `Current` / `Voltage` beside `Meter on`.
  In voltage mode a click on a hole, leg or wire end pins a label
  `<place>: <v> V` (one decimal), or `<place>: not set` for null. Works while
  stopped too (outputs read 0 V).
- Tool `measure(target)` (a hole, pin, or `id.terminal`): text
  `<place> reads <v> V.` or `<place> has no fixed voltage right now.`

Tests `test/voltages.test.js`: 1.2 with D13 HIGH (anode 2.0, the D13 net 5.0,
GND 0), D13 LOW (all 0), a dead end resistor net.

## 8.8 Slow motion

- `src/runner/session.js`: options `{ trace: false, timeScale: 1 }`. With
  `trace`, emit `[ms, 'line', null, line]` each time a statement starts (from
  the interpreter's node `line`; add a hook in `interpreter.js`). Keep normal
  runs unchanged.
- `worker.js` and `codeRunner.js`: messages and methods `setTrace(on)` and
  `setTimeScale(scale)`; the worker advances the sketch clock by real elapsed
  time times the scale.
- `src/sim/runner.js`: `setSlowMotion(on)`. On: time scale 0.1 and trace on;
  the run is marked as a demo, so `onGoal` is not called and `getProgress()`
  returns `{}` for the rest of this run. Off: time scale 1 and trace off; the
  run stays a demo until the next Run. The status line shows
  `Slow motion. Goals are paused until you press Run again.`
- Code panel: `setExecutingLine(n)` adds class `is-executing` (accent border
  on the left and a stronger background than the trace highlight), fed from
  `line` events at most once per frame.
- Boards that move with real time (the 1.12 arm, the P1 day) still use real
  time in slow motion; that is fine for a demo.
- Tool `slow_motion(speed)`: speed `0.1` or `0.25`; needs a running sketch.
  Text: `The sketch now runs at a tenth of its speed, with the running line lit up. Goals are paused.`

Tests: session line events with trace on and none with it off; time scale in
the worker client stub; runner demo mode suppresses `onGoal`.

## 8.9 What if

- Move the `drive` pattern from `test/lessonGoals.test.js` into
  `src/sim/headless.js`:
  `runHeadless({ lessonId, source, values, ms, actions })` -> `{ events, progress, goalMet, error }`.
  `actions` is a list of `{ at, kind: 'press' | 'release' | 'knob' | 'light' | 'temp', id, value }`.
  Update `lessonGoals.test.js` to use it (same assertions).
- Pure `src/explain/whatIf.js`:
  - `whatIfCode({ lessonId, source, values, line, text })`: runs the current
    source and the changed source for 3000 ms each with `runHeadless`, then
    `summarize` on the lesson's main output pin (the LED `pin`, or D8 for the
    buzzer, D9 for the servo) for both. Returns `{ before, after, error }`.
  - `whatIfCircuit(build, change)` with change `{ kind: 'flip' | 'remove' | 'ohms', target, value }`:
    returns `{ before, after }` per LED: `{ lit, brightness }` using
    `tracePath` from the LED's driving pin (lit when the path reaches GND
    through that LED) and `ledBrightness(ohms)` of the resistor on the path.
- UI `src/ui/whatIfCard.js`: card `What if: <change>` with two columns `Now`
  and `With the change`: for code, a small static scope plot and the summary
  text in each; for circuits, an LED dot drawn lit or dark at its brightness
  and one sentence. While the card is open, the changed part is drawn as an
  accent ghost (flip shows the turned LED; remove shows the part faded to 20%;
  ohms shows the new bands). The learner's build never changes.
- Explain menu choices: `Flip the <LED>` for each LED and RGB LED,
  `Use 1 kohm` and `Use 10 kohm` for each resistor, `Take out the <part>` for
  each part. Code changes are chat only.
- Tool `what_if(kind, target, value)`: kinds `code` (target is the line
  number as text, value the new line), `flip`, `remove`, `ohms` (value is the
  ohms as text). Text examples:
  `Now: one cycle every 1000 ms. With line 10 changed: one cycle every 600 ms.`
  `Now: the LED lights. With the change: the LED stays dark, because the current cannot get through it backwards.`

Tests `test/whatIf.test.js`: 1.2 delay 500 to 200 changes the cycle from 1000
to about 700 ms; flipping the 1.2 LED makes it dark; a 10 kohm resistor
dims it.

## Browser checks

1. 1.2 (finished build): Explain, X-ray: strips show under the holes. Off.
2. Trace the current from D13: dots run D13, resistor, LED, GND, then stop.
   Break the circuit (edit mode, move the resistor end): trace again: the dots
   stop with the red ring and the label.
3. Run, Scope on D13: the plot steps every 500 ms and the summary says one
   cycle every 1000 ms.
4. Connections with ticks; break a connection: that row shows a cross; hover a
   row: its strip lights up.
5. Part card from the tray `?` on the LED.
6. Meter in Voltage mode: the LED long leg strip reads 2.0 V while D13 is
   HIGH and 0.0 V while LOW.
7. Slow motion while running: the editor lights each line in turn; the goal
   does not complete during slow motion even with fast delays; Run again counts.
8. What if `Flip the LED`: the card shows Now lit, With the change dark, and a
   flipped ghost.
9. Lesson change closes every card.

## Acceptance criteria

- [ ] All eight tools work from the Explain menu with mouse and keyboard.
- [ ] Every tool returns `{ ok, text }` with the texts above.
- [ ] The learner's build and progress never change because of a tool.
- [ ] Slow motion never completes a goal.
- [ ] All new pure modules are tested; lessonGoals still passes through
      `runHeadless`.

## AGENTS.md updates

New section "Explain tools" with each tool, its module, its text and its rule
about progress. Add the session `trace` and `timeScale` options and the runner
`subscribeOutput` and `setSlowMotion`.

## Decisions made while building

(Write any choice you had to make here.)
