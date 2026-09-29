import * as XLSX from 'xlsx'

const SHEET_NAME = 'COMPLEMENTOS REFORZADOS'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const DIA_NOMBRE = {
  0: 'DOMINGO', 1: 'LUNES', 2: 'MARTES', 3: 'MIÉRCOLES', 4: 'JUEVES', 5: 'VIERNES', 6: 'SÁBADO',
}

// Rótulo de la columna A → columna de reforzados_ciclo_dias. DERIVADO DE
// CEREAL se reconoce (para no confundirlo con otro rótulo) pero no se guarda:
// la tabla no tiene esa columna.
const COMPONENTES_POR_ROTULO = {
  'BEBIDA UHT': 'bebida_uht',
  'AGUA': 'agua',
  'PROTEICO': 'proteico',
  'DERIVADO DE CEREAL': null,
  'POSTRE': 'postre',
  'FRUTA': 'fruta',
}

export const COMPONENTES_CICLO = ['bebida_uht', 'agua', 'proteico', 'postre', 'fruta']

function cellText(value) {
  return value == null ? '' : String(value).trim()
}

function normalizarRotulo(value) {
  return cellText(value).toUpperCase().replace(/\s+/g, ' ')
}

// Excel serial day 0 = 1899-12-30. Post-1900 only, so the fake Feb-29-1900
// leap day in Excel's serial system doesn't need special-casing here.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)
// Rango de seriales aceptados como fecha (2010-01-01 .. 2060-12-31): evita
// que un número suelto en la hoja se interprete como día del ciclo.
const SERIAL_MIN = 40179
const SERIAL_MAX = 58804

function toDate(value, añoPorDefecto) {
  if (typeof value === 'number') {
    if (value < SERIAL_MIN || value > SERIAL_MAX) return null
    return new Date(EXCEL_EPOCH_UTC_MS + Math.round(value) * 86400000)
  }
  if (value instanceof Date && !isNaN(value)) {
    // XLSX's serial->Date conversion can land a few ms before midnight due to
    // float precision, so round to the nearest whole day instead of flooring.
    const days = Math.round(value.getTime() / 86400000)
    return new Date(days * 86400000)
  }
  // Texto dd/mm/aaaa (o dd/mm si la hoja trae el año en "ROTACIÓN").
  const match = cellText(value).match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?$/)
  if (!match) return null
  const d = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  let y = match[3] ? parseInt(match[3], 10) : añoPorDefecto
  if (!y) return null
  if (y < 100) y += 2000
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  return date
}

function formatFechaISO(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function nombreMesCiclo(mes, año) {
  return `${MESES[mes - 1]} ${año}`
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

function detectarRotacion(rows) {
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const rowText = (rows[r] || []).map(cellText).join(' ')
    const match = rowText.match(/ROTACI[ÓO]N\s+([A-ZÁÉÍÓÚÑ]+)\s+(\d{4})/i)
    if (!match) continue
    const idx = MESES.indexOf(match[1].toUpperCase())
    if (idx >= 0) return { mes: idx + 1, año: parseInt(match[2], 10) }
  }
  return null
}

// Parseo basado en fechas: no depende de rótulos "SEMANA" ni de columnas
// consecutivas. Toda celda con fecha válida es un día del ciclo; en su misma
// columna, la siguiente celda "MENU <n>" es su menú, y los componentes se
// leen por el rótulo de la columna A en las filas siguientes hasta la
// próxima fila que tenga fechas (o el final). Columnas sin fecha (recesos,
// celdas combinadas con texto) quedan fuera sin error.
export function parseCicloExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames.find(n => n.trim().toUpperCase() === SHEET_NAME) || workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no contiene hojas legibles.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  const rotacion = detectarRotacion(rows)

  // Celdas combinadas: sheet_to_json deja el valor solo en la esquina
  // superior izquierda; para leer componentes se resuelve al valor del rango.
  const merges = sheet['!merges'] || []
  function valorCelda(r, c) {
    const directo = rows[r]?.[c]
    if (cellText(directo) !== '') return directo
    const rango = merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c)
    return rango ? rows[rango.s.r]?.[rango.s.c] : directo
  }

  const fechasEncontradas = []
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || []
    for (let c = 1; c < row.length; c++) {
      const date = toDate(row[c], rotacion?.año)
      if (date) fechasEncontradas.push({ r, c, date })
    }
  }

  if (fechasEncontradas.length === 0) {
    throw new Error('No se detectaron fechas en el archivo. Verifica que la fila de fechas tenga días válidos (dd/mm/aaaa).')
  }

  const filasConFecha = [...new Set(fechasEncontradas.map(f => f.r))].sort((a, b) => a - b)
  const siguienteFilaConFecha = r => filasConFecha.find(x => x > r) ?? rows.length

  const diasPorFecha = new Map()
  const duplicadas = []

  for (const { r, c, date } of fechasEncontradas) {
    const fin = siguienteFilaConFecha(r)
    let menuNumero = null
    let menuTexto = ''
    const componentes = { bebida_uht: '', agua: '', proteico: '', postre: '', fruta: '' }
    let festivo = false

    for (let rr = r + 1; rr < fin; rr++) {
      const texto = cellText(valorCelda(rr, c))
      if (texto.toUpperCase().includes('FESTIVO')) festivo = true

      if (menuNumero == null && !menuTexto) {
        const menuMatch = cellText(rows[rr]?.[c]).match(/^MEN[UÚ]\s*(\d+)/i)
        if (menuMatch) {
          menuNumero = parseInt(menuMatch[1], 10)
          menuTexto = cellText(rows[rr][c])
          continue
        }
      }

      const rotulo = normalizarRotulo(rows[rr]?.[0])
      if (!(rotulo in COMPONENTES_POR_ROTULO)) continue
      const campo = COMPONENTES_POR_ROTULO[rotulo]
      if (campo && !componentes[campo]) componentes[campo] = texto
    }

    const fecha = formatFechaISO(date)
    if (diasPorFecha.has(fecha)) {
      duplicadas.push(fecha)
      continue
    }

    diasPorFecha.set(fecha, {
      fecha,
      dia_semana: DIA_NOMBRE[date.getUTCDay()],
      menu_numero: festivo ? null : menuNumero,
      bebida_uht: festivo ? null : (componentes.bebida_uht || null),
      agua: festivo ? null : (componentes.agua || null),
      proteico: festivo ? null : (componentes.proteico || null),
      postre: festivo ? null : (componentes.postre || null),
      fruta: festivo ? null : (componentes.fruta || null),
      festivo,
    })
  }

  const dias = [...diasPorFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Meses que abarca el archivo (normalmente uno). Si no hay fila
  // "ROTACIÓN", el mes principal es el de la mayoría de las fechas.
  const conteoMeses = new Map()
  for (const d of dias) {
    const clave = d.fecha.slice(0, 7)
    conteoMeses.set(clave, (conteoMeses.get(clave) || 0) + 1)
  }
  const meses = [...conteoMeses.keys()].sort().map(clave => {
    const [y, m] = clave.split('-').map(Number)
    return { mes: m, año: y, nombreMes: nombreMesCiclo(m, y) }
  })
  let principal = rotacion
  if (!principal) {
    const [clave] = [...conteoMeses.entries()].sort((a, b) => b[1] - a[1])[0]
    const [y, m] = clave.split('-').map(Number)
    principal = { mes: m, año: y }
  }

  return {
    mes: principal.mes,
    año: principal.año,
    nombreMes: nombreMesCiclo(principal.mes, principal.año),
    meses,
    dias,
    semanas: filasConFecha.length,
    duplicadas,
  }
}
