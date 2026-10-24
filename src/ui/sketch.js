// Pure helpers for lesson sketches: param defaults, {{name}} slot filling and
// the timed trace. No DOM access.
export function defaultValues(params) {
  const values = {}
  for (const param of params) values[param.name] = param.value
  return values
}

// Text each slot shows: the value, or the chosen option's code text when it has one.
export function slotValues(params, values) {
  const slots = { ...values }
  for (const param of params) {
    const option = (param.options || []).find((item) => item.value === values[param.name])
    if (option && option.code !== undefined) slots[param.name] = option.code
  }
  return slots
}

export function fillSketch(code, values) {
  return code.replace(/\{\{(\w+)\}\}/g, (slot, name) =>
    name in values ? String(values[name]) : slot
  )
}

export function stepDuration(step, values) {
  return typeof step.ms === 'number' ? step.ms : values[step.ms]
}

// Index of the step active elapsedMs after the trace started, looping over
// the total duration. A step ends exactly where the next one starts.
export function traceStepAt(trace, values, elapsedMs) {
  if (trace.length === 0) return -1
  const durations = trace.map((step) => stepDuration(step, values))
  const total = durations.reduce((sum, ms) => sum + ms, 0)
  let time = elapsedMs % total
  for (let i = 0; i < durations.length; i++) {
    if (time < durations[i]) return i
    time -= durations[i]
  }
  return durations.length - 1
}
