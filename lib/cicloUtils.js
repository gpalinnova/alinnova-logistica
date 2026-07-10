export function formatFechaDisplay(fechaISO) {
  const [y, m, d] = fechaISO.split('-')
  return `${d}/${m}/${y}`
}

export function titleCase(text) {
  if (!text) return ''
  return text.charAt(0) + text.slice(1).toLowerCase()
}
