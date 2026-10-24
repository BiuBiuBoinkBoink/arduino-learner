// Response timer for goals like "the LED reacts to the button in under 50 ms".
// Pure module. Feed it every sketch event (output(event)); it measures from a
// change of the input pin (an 'input' event from the circuit) to the next
// change of the output pin, both on the sketch clock. Times are in ms.
export function createResponseTimer({ inputPin, outputPin }) {
  let pendingSince = null
  const times = []

  function output({ kind, pin, at }) {
    if (kind === 'input' && pin === inputPin) {
      // A second input change before any reaction restarts the wait.
      pendingSince = at
    } else if (kind === 'pin' && pin === outputPin && pendingSince !== null) {
      times.push(at - pendingSince)
      pendingSince = null
    }
  }

  return {
    output,
    // Reactions measured so far, oldest first.
    times: () => times.slice(),
    last: () => (times.length ? times[times.length - 1] : null),
    worst: () => (times.length ? Math.max(...times) : null),
    // Waiting on an input change with no reaction yet: how long so far, else null.
    waiting: (at) => (pendingSince === null ? null : at - pendingSince)
  }
}
