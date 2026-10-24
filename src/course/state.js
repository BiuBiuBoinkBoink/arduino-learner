// Course state: current lesson, completed lessons and subscribers.
// Pure module: storage is injected so it can be unit tested without a browser.
const PROGRESS_KEY = 'robo-learn:progress'

export function createCourse({ lessons, storage }) {
  const ids = lessons.map((lesson) => lesson.id)
  const listeners = new Set()
  let index = 0
  let completed = loadProgress()

  function loadProgress() {
    let raw = null
    try {
      raw = storage.getItem(PROGRESS_KEY)
    } catch {
      return []
    }
    if (raw == null) return []
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) return []
    return ids.filter((id) => parsed.includes(id))
  }

  function saveProgress() {
    try {
      storage.setItem(PROGRESS_KEY, JSON.stringify(completed))
    } catch {
      // Storage full or blocked: progress stays in memory only.
    }
  }

  function getState() {
    return {
      lesson: lessons[index],
      index,
      completed: completed.slice(),
      total: lessons.length
    }
  }

  function notify() {
    const state = getState()
    listeners.forEach((fn) => fn(state))
  }

  function goTo(id) {
    const target = ids.indexOf(id)
    if (target === -1 || target === index) return false
    index = target
    notify()
    return true
  }

  function next() {
    if (index < ids.length - 1) goTo(ids[index + 1])
  }

  function prev() {
    if (index > 0) goTo(ids[index - 1])
  }

  function markComplete(id) {
    if (!ids.includes(id)) return
    if (!completed.includes(id)) {
      completed = ids.filter((known) => known === id || completed.includes(known))
    }
    saveProgress()
    notify()
  }

  function subscribe(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }

  return { lessons, getState, goTo, next, prev, markComplete, subscribe }
}
