import * as XLSX from 'xlsx'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

const HEADERS = ['CONDUCTOR', 'AUXILIAR', 'PLACA', 'CARGUE ALINNOVA', 'ID SITIO ENTREGA', 'ORDEN ENTREGA', 'HORARIO ENTREGA ALINNOVA']

function cellText(value) {
  return value == null ? '' : String(value).trim()
}

// Excel serial day 0 = 1899-12-30.
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30)

function normalizeHorario(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const totalMs = Math.round(value * 86400000)
    const date = new Date(EXCEL_EPOCH_UTC_MS + totalMs)
    let hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const suffix = hours >= 12 ? 'p.m.' : 'a.m.'
    hours = hours % 12
    if (hours === 0) hours = 12
    return `${hours}:${String(minutes).padStart(2, '0')} ${suffix}`
  }
  return cellText(value)
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    reader.readAsArrayBuffer(file)
  })
}

export function detectMesAnioFromFilename(filename) {
  const upper = filename.toUpperCase()
  for (let i = 0; i < MESES.length; i++) {
    const regex = new RegExp(`${MESES[i]}[^0-9]{0,10}(\\d{4})`)
    const match = upper.match(regex)
    if (match) {
      return { mes: i + 1, año: parseInt(match[1], 10) }
    }
  }
  return null
}

export function parseRutasExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error('El archivo no contiene hojas legibles.')

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' })
  if (rows.length === 0) throw new Error('El archivo está vacío.')

  const headerRow = rows[0].map(cellText).map(h => h.toUpperCase())
  const colIndex = {}
  for (const h of HEADERS) {
    const idx = headerRow.indexOf(h)
    if (idx === -1) {
      throw new Error(`Falta la columna requerida "${h}" en el archivo. Encabezados esperados: ${HEADERS.join(' | ')}`)
    }
    colIndex[h] = idx
  }

  const asignaciones = []
  const repartidoresMap = new Map()

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || []
    const conductor = cellText(row[colIndex['CONDUCTOR']]).toUpperCase()
    const placa = cellText(row[colIndex['PLACA']]).toUpperCase()
    if (!conductor && !placa) continue

    const auxiliar = cellText(row[colIndex['AUXILIAR']]).toUpperCase() || null
    const cargue = normalizeHorario(row[colIndex['CARGUE ALINNOVA']])
    const idSitioRaw = cellText(row[colIndex['ID SITIO ENTREGA']])
    const idSitio = idSitioRaw ? parseInt(idSitioRaw, 10) : null
    const ordenRaw = cellText(row[colIndex['ORDEN ENTREGA']])
    const orden = ordenRaw ? parseInt(ordenRaw, 10) : 1
    const horarioEntrega = normalizeHorario(row[colIndex['HORARIO ENTREGA ALINNOVA']])

    if (!conductor || !placa) {
      throw new Error(`Fila ${r + 1}: CONDUCTOR y PLACA son obligatorios.`)
    }
    if (!idSitio || Number.isNaN(idSitio)) {
      throw new Error(`Fila ${r + 1}: ID SITIO ENTREGA inválido.`)
    }

    const key = `${conductor}||${placa}`
    if (!repartidoresMap.has(key)) {
      repartidoresMap.set(key, { conductor, auxiliar, placa })
    }

    asignaciones.push({
      conductor,
      placa,
      auxiliar,
      id_sitio_entrega: idSitio,
      orden_entrega: Number.isNaN(orden) ? 1 : orden,
      cargue_alinnova: cargue,
      horario_entrega_alinnova: horarioEntrega,
    })
  }

  if (asignaciones.length === 0) {
    throw new Error('No se detectaron asignaciones en el archivo.')
  }

  return {
    repartidores: Array.from(repartidoresMap.values()),
    asignaciones,
  }
}

export function nombreMes(mes, año) {
  return `${MESES[mes - 1]} ${año}`
}

export { MESES }
