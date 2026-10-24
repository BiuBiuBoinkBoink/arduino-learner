// Step tracker: per lesson step progress (current step, passed and helped
// steps, quiz answers, latched sim keys, hint levels), saved as one JSON object
// keyed by lesson id. Pure module: storage is injected. Stored data is
// untrusted, so it is checked field by field and unknown ids are dropped.
const STEPS_KEY = 'robo-learn:steps'
export const MAX_HINT_LEVEL = 3

export function createStepTracker({ storage, lessons, stepsFor }) {
  const stepIds = new Map(lessons.map((lesson) => [lesson.id, stepsFor(lesson).map((step) => step.id)]))
  const listeners = new Set()
  let records = load()

  function blank() {
    return { current: 0, passed: [], helped: [], answers: {}, latched: {}, hintLevels: {} }
  }

  function isIndex(value) {
    return Number.isInteger(value) && value >= 0
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  // Keeps only known step ids from a stored list, in step order.
  function knownList(ids, list) {
    return Array.isArray(list) ? ids.filter((id) => list.includes(id)) : []
  }

  // Keeps only known step ids whose value passes the test.
  function knownMap(ids, map, keep) {
    const out = {}
    if (!isObject(map)) return out
    for (const id of ids) {
      if (Object.hasOwn(map, id) && keep(map[id])) out[id] = map[id]
    }
    return out
  }

  function clean(ids, raw) {
    const record = blank()
    if (!isObject(raw)) return record
    if (isIndex(raw.current)) record.current = Math.min(raw.current, Math.max(0, ids.length - 1))
    record.passed = knownList(ids, raw.passed)
    record.helped = knownList(ids, raw.helped).filter((id) => record.passed.includes(id))
    record.answers = knownMap(ids, raw.answers, isIndex)
    const latched = knownMap(ids, raw.latched, (keys) => Array.isArray(keys))
    for (const id of Object.keys(latched)) {
      latched[id] = [...new Set(latched[id].filter((key) => typeof key === 'string'))]
    }
    record.latched = latched
    record.hintLevels = knownMap(ids, raw.hintLevels, (level) => isIndex(level) && level <= MAX_HINT_LEVEL)
    return record
  }

  function load() {
    const out = {}
    let parsed
    try {
      const raw = storage.getItem(STEPS_KEY)
      if (raw == null) return out
      parsed = JSON.parse(raw)
    } catch {
      return out
    }
    if (!isObject(parsed)) return out
    for (const [lessonId, ids] of stepIds) {
      if (Object.hasOwn(parsed, lessonId)) out[lessonId] = clean(ids, parsed[lessonId])
    }
    return out
  }

  function save() {
    try {
      storage.setItem(STEPS_KEY, JSON.stringify(records))
    } catch {
      // Storage full or blocked: step progress stays in memory only.
    }
  }

  function copy(record) {
    return {
      current: record.current,
      passed: record.passed.slice(),
      helped: record.helped.slice(),
      answers: { ...record.answers },
      latched: Object.fromEntries(Object.entries(record.latched).map(([id, keys]) => [id, keys.slice()])),
      hintLevels: { ...record.hintLevels }
    }
  }

  function get(lessonId) {
    return copy(records[lessonId] || blank())
  }

  // True once the lesson has a stored record (anything was ever changed).
  function has(lessonId) {
    return Object.hasOwn(records, lessonId)
  }

  // Runs change(record, ids) on the lesson's record; saves and notifies when it returns true.
  function change(lessonId, fn) {
    const ids = stepIds.get(lessonId)
    if (!ids) return
    const record = records[lessonId] || blank()
    if (!fn(record, ids)) return
    records[lessonId] = record
    save()
    listeners.forEach((listener) => listener(lessonId))
  }

  function setCurrent(lessonId, index) {
    change(lessonId, (record, ids) => {
      if (!isIndex(index) || index >= ids.length || index === record.current) return false
      record.current = index
      return true
    })
  }

  function markPassed(lessonId, stepId, { helped = false } = {}) {
    change(lessonId, (record, ids) => {
      if (!ids.includes(stepId)) return false
      const passedNow = !record.passed.includes(stepId)
      const helpedNow = helped && !record.helped.includes(stepId)
      if (passedNow) record.passed = ids.filter((id) => id === stepId || record.passed.includes(id))
      if (helpedNow) record.helped = ids.filter((id) => id === stepId || record.helped.includes(id))
      return passedNow || helpedNow
    })
  }

  function answer(lessonId, stepId, option) {
    change(lessonId, (record, ids) => {
      if (!ids.includes(stepId) || !isIndex(option) || record.answers[stepId] === option) return false
      record.answers = { ...record.answers, [stepId]: option }
      return true
    })
  }

  function latch(lessonId, stepId, key) {
    change(lessonId, (record, ids) => {
      const keys = record.latched[stepId] || []
      if (!ids.includes(stepId) || typeof key !== 'string' || keys.includes(key)) return false
      record.latched = { ...record.latched, [stepId]: [...keys, key] }
      return true
    })
  }

  function setHintLevel(lessonId, stepId, level) {
    change(lessonId, (record, ids) => {
      if (!ids.includes(stepId) || !isIndex(level) || level > MAX_HINT_LEVEL) return false
      if (record.hintLevels[stepId] === level) return false
      record.hintLevels = { ...record.hintLevels, [stepId]: level }
      return true
    })
  }

  function reset(lessonId) {
    change(lessonId, (record) => {
      Object.assign(record, blank())
      return true
    })
  }

  function completeAll(lessonId) {
    change(lessonId, (record, ids) => {
      record.passed = ids.slice()
      record.current = Math.max(0, ids.length - 1)
      return true
    })
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { get, has, setCurrent, markPassed, answer, latch, setHintLevel, reset, completeAll, subscribe }
}
