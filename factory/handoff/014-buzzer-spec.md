# Piezo buzzer, sound setting, lesson 1.11 Sound

> Feature: Piezo buzzer part with Web Audio square wave sound, a sound on/off setting, and lesson 1.11 Sound with a 3 note tune goal

## Requirements

1. **Tones store**: a second `createPins()` in `main.js` named `tones`, which
   holds a tone frequency in Hz per pin (0 is silent). The runner passes it to
   sims as `tones` and resets it on stop, like the pins.
2. **Buzzer part** `src/parts/buzzer.js` `createBuzzer({ legs })`: a black
   round case with a sound hole on two legs (positive, negative).
   `setPlaying(on)` shows a faint `sound-ring` above the hole. Circuit
   `{ id, type: 'buzzer', at: '12e', pin: 'D8' }` puts the legs at `c` and
   `c + 3` (`buzzerHoles`); the column must be at most 27. `main.js` shows
   the ring while the buzzer pin has a tone.
3. **Sound** `src/ui/sound.js` `createSound({ container, tones, storage })` ->
   `{ setPin(name) }`: a Web Audio square wave (gain 0.04) that follows the
   tone on the buzzer pin. A "Sound on" / "Sound off" toggle button with
   `aria-pressed` sits below the Run row, shown only on lessons with a buzzer.
   The setting persists under `robo-learn:sound` (try/catch), and the default
   is on. The audio context starts on first use.
4. **1.11 circuit**: buzzer at `12e`, D8 to `12a`, GND to `15a`.
5. **1.11 sketch**: `int notes[] = { {{note1}}, {{note2}}, {{note3}} };` with
   three choice params (C to B, 262 to 494 Hz; defaults C, D, E), and a loop
   of `tone(buzzerPin, notes[i], 300); delay(350);` then `delay(1000)`.
6. **Sim** `src/sim/tune.js` `createTuneSim`: plays the notes on D8 for 300 ms
   every 350 ms, then 1000 ms of silence. Each note reads its param when it
   starts, and a slow frame never drops a note. Readout
   `tone(8, <hz>), note <name>. Target tune E D C` or
   `Silent. Target tune E D C`. Goal: one loop played E, D, C in order.
7. 1.11 gets a third overview paragraph with the goal. Tests, AGENTS.md,
   README and backlog are updated.

## Assumptions

- The target tune is E D C, so the default C D E does not pass.
- Sound defaults to on; the toggle is the only setting.
