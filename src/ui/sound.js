// Buzzer sound: a Web Audio square wave that follows the tone frequency on one
// pin, and a "Sound" on/off toggle below the Run row, shown only on lessons
// with a buzzer. The setting persists under robo-learn:sound.
const STORAGE_KEY = 'robo-learn:sound'
const VOLUME = 0.04

function loadEnabled(storage) {
  try {
    return storage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

function saveEnabled(storage, on) {
  try {
    storage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Storage blocked; the setting lasts for this visit only.
  }
}

export function createSound({ container, tones, storage }) {
  let enabled = loadEnabled(storage)
  let pin = null
  let context = null
  let oscillator = null
  let gain = null

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'run-button sound-toggle'
  button.hidden = true
  container.append(button)

  function render() {
    button.textContent = enabled ? 'Sound on' : 'Sound off'
    button.setAttribute('aria-pressed', String(enabled))
  }

  // The context starts on first use, after the Run click has unlocked audio.
  function ensureContext() {
    if (context) return context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    context = new AudioContextClass()
    gain = context.createGain()
    gain.gain.value = VOLUME
    gain.connect(context.destination)
    return context
  }

  function silence() {
    if (!oscillator) return
    oscillator.stop()
    oscillator.disconnect()
    oscillator = null
  }

  function play(hz) {
    if (!enabled || !hz) {
      silence()
      return
    }
    const ctx = ensureContext()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume()
    if (!oscillator) {
      oscillator = ctx.createOscillator()
      oscillator.type = 'square'
      oscillator.connect(gain)
      oscillator.frequency.value = hz
      oscillator.start()
      return
    }
    oscillator.frequency.setValueAtTime(hz, ctx.currentTime)
  }

  button.addEventListener('click', () => {
    enabled = !enabled
    saveEnabled(storage, enabled)
    render()
    play(pin ? tones.get(pin) : 0)
  })

  tones.subscribe((name, hz) => {
    if (name === pin) play(hz)
  })

  // Names the buzzer pin of the current circuit, or null for none.
  function setPin(name) {
    silence()
    pin = name
    button.hidden = !name
    render()
  }

  render()
  return { setPin }
}
