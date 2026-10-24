// localStorage, or an in memory stand in when storage is blocked.
export function getStorage() {
  try {
    const storage = window.localStorage
    if (storage) return storage
  } catch {
    // Storage blocked, fall through to memory.
  }
  const memory = new Map()
  return {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => { memory.set(key, String(value)) }
  }
}
