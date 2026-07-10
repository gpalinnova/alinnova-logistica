const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function todayLocalISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(fechaISO, days) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function formatFechaLarga(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const diaSemana = DIAS_SEMANA[dt.getDay()]
  const mes = MESES[m - 1]
  return `${diaSemana}, ${d} de ${mes} de ${y}`
}

export function cleanDisplayText(raw) {
  if (!raw) return ''
  return String(raw).replace(/\r\n|\r|\n/g, ' ').replace(/\s+/g, ' ').trim()
}

export function normalizeText(raw) {
  if (!raw) return ''
  return String(raw)
    .replace(/\r\n|\r|\n/g, ' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\bX\s*\d+(?:[.,]\d+)?\s*(ML|MLS|G|GR|GRS|UNIDADES?|UNDS?|UND)\.?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Busca el producto del catálogo que corresponde al texto crudo del ciclo
// (proveniente del Excel). Devuelve todas las filas de catálogo que
// comparten el mismo nombre normalizado (para PROTEICO son 2: TIPO 1 y TIPO 2).
export function matchProductoRows(cicloRawText, componente, productos) {
  const normalizedFull = normalizeText(cicloRawText)
  if (!normalizedFull) return { rows: null, notFound: false }

  const parenMatch = normalizedFull.match(/\(([^)]+)\)/)
  const parenContent = parenMatch ? parenMatch[1].trim() : null
  const withoutParens = normalizedFull.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  const candidates = [normalizedFull, parenContent, withoutParens].filter(Boolean)

  const byNombre = new Map()
  for (const p of productos) {
    if (p.componente !== componente) continue
    const norm = normalizeText(p.nombre)
    if (!byNombre.has(norm)) byNombre.set(norm, [])
    byNombre.get(norm).push(p)
  }

  for (const cand of candidates) {
    if (byNombre.has(cand)) return { rows: byNombre.get(cand), notFound: false }
  }

  for (const cand of candidates) {
    for (const [norm, rows] of byNombre) {
      if (norm.includes(cand) || cand.includes(norm)) return { rows, notFound: false }
    }
  }

  return { rows: null, notFound: true }
}

const NO_ENCONTRADO = '⚠️ Producto no encontrado en catálogo'

const COMPONENTES_FILAS = [
  { key: 'BEBIDA UHT', label: 'BEBIDA UHT', field: 'bebida_uht' },
  { key: 'AGUA', label: 'AGUA', field: 'agua' },
  { key: 'PROTEICO', label: 'PROTEICO', field: 'proteico' },
  { key: 'POSTRE', label: 'POSTRE', field: 'postre' },
  { key: 'FRUTA', label: 'FRUTA', field: 'fruta' },
]

export function buildFilasTabla(cicloDia, productos) {
  return COMPONENTES_FILAS.map(c => {
    const raw = cicloDia?.[c.field]
    const nombreDisplay = cleanDisplayText(raw)

    if (!raw) {
      return { key: c.key, label: c.label, nombreDisplay: '-', empaqueLines: ['-'] }
    }

    const { rows, notFound } = matchProductoRows(raw, c.key, productos)

    if (notFound || !rows || rows.length === 0) {
      return { key: c.key, label: c.label, nombreDisplay, empaqueLines: [NO_ENCONTRADO] }
    }

    if (c.key === 'PROTEICO') {
      const tipo1 = rows.find(r => r.tipo === 'TIPO 1')
      const tipo2 = rows.find(r => r.tipo === 'TIPO 2')
      if (tipo1 && tipo2) {
        return {
          key: c.key,
          label: c.label,
          nombreDisplay,
          empaqueLines: [
            `TIPO 1 PEQUEÑO ${tipo1.empaque_texto}`,
            `TIPO 2 GRANDE ${tipo2.empaque_texto}`,
          ],
        }
      }
      const any = tipo1 || tipo2 || rows[0]
      return { key: c.key, label: c.label, nombreDisplay, empaqueLines: [any.empaque_texto] }
    }

    return { key: c.key, label: c.label, nombreDisplay, empaqueLines: [rows[0].empaque_texto] }
  })
}

export function buildWhatsappText(fechaDisplay, menuNumero, filas) {
  const lines = []
  lines.push('*PROVEEDOR ALINNOVA*')
  lines.push(`${fechaDisplay} — MENU ${menuNumero}`)
  lines.push('')
  for (const fila of filas) {
    lines.push(`*${fila.label}*: ${fila.nombreDisplay}`)
    for (const l of fila.empaqueLines) lines.push(`  ${l}`)
    lines.push('')
  }
  return lines.join('\n').trim()
}
