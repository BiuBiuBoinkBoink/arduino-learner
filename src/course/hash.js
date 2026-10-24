// URL hash helpers. Hash format is #<lesson id>, for example #1.3.
export function idFromHash(hash) {
  const id = (hash || '').replace(/^#/, '')
  return id === '' ? null : id
}

export function hashForId(id) {
  return '#' + id
}
